import bcrypt from "bcryptjs";
import { Usuario, CodigoVerificacion } from "../models/seguridad.js";
import { Cliente } from "../models/negocio.js";
import { auditar } from "../helpers/auditoria.js";
import { generarCodigo6, hashCodigo, ipDe } from "../helpers/utils.js";
import { firmarSesion, COOKIE, opcionesCookie } from "../middlewares/auth.js";
import { enviarCorreo, urlSistema } from "../services/correo.js";
import { Rol } from "../models/seguridad.js";

const MAX_INTENTOS = 5, BLOQUEO_MIN = 15;
const CLAVE_MIN = 8;

async function datosSesion(u) {
  const rol = await Rol.findById(u.id_rol).lean();
  return { id: u._id, nombre: u.nombre, correo: u.correo, telefono: u.telefono, cargo: u.cargo, rol: rol?.nombre, id_cliente: u.id_cliente, debe_cambiar_contrasena: u.debe_cambiar_contrasena };
}

export const login = async (req, res) => {
  const correo = String(req.body.correo || "").toLowerCase().trim();
  const u = await Usuario.findOne({ correo });
  const falla = async (msg, detalle) => {
    await auditar(req, { tipo_accion: "inicio_sesion", resultado: "denegado", requerimiento: "RF-28", tabla_afectada: "Usuarios_sistema", id_registro: u?._id && String(u._id), nombre_usuario: u?.nombre || correo, detalle, id_usuario: u?._id });
    return res.status(401).json({ msg });
  };
  if (!u || !u.activo) return falla("Correo o contraseña incorrectos", "usuario inexistente o inactivo");
  if (u.bloqueado_hasta && u.bloqueado_hasta > new Date())
    return falla(`Cuenta bloqueada por intentos fallidos. Intente de nuevo después de las ${u.bloqueado_hasta.toLocaleTimeString("es-CO", { timeZone: "America/Bogota" })}`, "cuenta bloqueada");
  const ok = await bcrypt.compare(String(req.body.contrasena || ""), u.contrasena_hash);
  if (!ok) {
    u.intentos_fallidos += 1;
    if (u.intentos_fallidos >= MAX_INTENTOS) { u.bloqueado_hasta = new Date(Date.now() + BLOQUEO_MIN * 60000); u.intentos_fallidos = 0; }
    await u.save();
    return falla("Correo o contraseña incorrectos", "clave incorrecta");
  }
  u.intentos_fallidos = 0; u.bloqueado_hasta = null; u.ultimo_acceso = new Date();
  await u.save();
  firmarSesion(res, u);
  req.usuario = Object.assign(u, { rol_nombre: (await Rol.findById(u.id_rol).lean())?.nombre });
  await auditar(req, { tipo_accion: "inicio_sesion", resultado: "exitoso", requerimiento: "RF-28", tabla_afectada: "Usuarios_sistema", id_registro: String(u._id), id_cliente: u.id_cliente });
  res.json({ usuario: await datosSesion(u) });
};

export const logout = async (req, res) => {
  await auditar(req, { tipo_accion: "cierre_sesion", requerimiento: "RF-28" });
  res.clearCookie(COOKIE, { ...opcionesCookie(), maxAge: undefined });
  res.json({ msg: "Sesión cerrada" });
};

export const me = async (req, res) => {
  const d = await datosSesion(req.usuario);
  res.json({ usuario: { ...d, permisos: [...req.usuario.permisos] } });
};

export const cambiarClave = async (req, res) => {
  const { actual, nueva } = req.body;
  if (!(await bcrypt.compare(String(actual || ""), req.usuario.contrasena_hash))) {
    await auditar(req, { tipo_accion: "cambio_clave", resultado: "denegado", requerimiento: "RF-28", detalle: "clave actual incorrecta" });
    return res.status(400).json({ msg: "La contraseña actual no es correcta" });
  }
  req.usuario.contrasena_hash = await bcrypt.hash(nueva, 10);
  req.usuario.debe_cambiar_contrasena = false;
  await req.usuario.save();
  await auditar(req, { tipo_accion: "cambio_clave", requerimiento: "RF-28", tabla_afectada: "Usuarios_sistema", id_registro: String(req.usuario._id) });
  res.json({ msg: "Contraseña actualizada" });
};

/** Recuperacion: envia un codigo de 6 digitos al correo (siempre responde igual para no revelar si existe). */
export const recuperar = async (req, res) => {
  const u = await Usuario.findOne({ correo: String(req.body.correo || "").toLowerCase().trim(), activo: true });
  if (u) {
    await CodigoVerificacion.deleteMany({ tipo: "recuperacion", id_usuario: u._id });
    const codigo = generarCodigo6();
    const cv = new CodigoVerificacion({ tipo: "recuperacion", id_usuario: u._id, codigo_hash: "x", expira: new Date(Date.now() + 10 * 60000), borrar_en: new Date(Date.now() + 3600000) });
    cv.codigo_hash = hashCodigo(codigo, cv._id); await cv.save();
    await enviarCorreo({ para: u.correo, asunto: "Código para recuperar su contraseña - LABFICAT", titulo: "Recuperar contraseña",
      parrafos: [`Su código de verificación es: <b style="font-size:22px;letter-spacing:3px">${codigo}</b>`, "Vence en 10 minutos. Si usted no lo pidió, ignore este mensaje."],
      boton: { texto: "Abrir el sistema", url: urlSistema("#/recuperar") }, tipo: "recuperacion_clave", id_usuario: u._id, id_cliente: u.id_cliente, tabla_referencia: "Usuarios_sistema", id_referencia: u._id, incluirContacto: false });
    await auditar(req, { tipo_accion: "solicitud_recuperacion_clave", requerimiento: "RF-28", nombre_usuario: u.nombre, id_usuario: u._id });
  }
  res.json({ msg: "Si el correo está registrado, recibirá un código de 6 dígitos" });
};

export const restablecer = async (req, res) => {
  const { correo, codigo, nueva } = req.body;
  const u = await Usuario.findOne({ correo: String(correo || "").toLowerCase().trim(), activo: true });
  const cv = u && await CodigoVerificacion.findOne({ tipo: "recuperacion", id_usuario: u._id, usado: false }).sort({ creado: -1 });
  const invalido = () => res.status(400).json({ msg: "Código inválido o vencido" });
  if (!cv || cv.expira < new Date() || cv.intentos >= 3) return invalido();
  if (cv.codigo_hash !== hashCodigo(String(codigo || ""), cv._id)) { cv.intentos += 1; await cv.save(); return invalido(); }
  u.contrasena_hash = await bcrypt.hash(nueva, 10); u.intentos_fallidos = 0; u.bloqueado_hasta = null; await u.save();
  cv.usado = true; await cv.save();
  await auditar(req, { tipo_accion: "recuperacion_clave", requerimiento: "RF-28", tabla_afectada: "Usuarios_sistema", id_registro: String(u._id), nombre_usuario: u.nombre, id_usuario: u._id });
  res.json({ msg: "Contraseña restablecida. Ya puede ingresar" });
};

export const CLAVE_MINIMA = CLAVE_MIN;
