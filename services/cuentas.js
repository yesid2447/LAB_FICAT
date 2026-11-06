import bcrypt from "bcryptjs";
import { Usuario, Rol } from "../models/seguridad.js";
import { generarClave } from "../helpers/utils.js";
import { enviarCorreo, urlSistema } from "./correo.js";

/**
 * Crea la cuenta del cliente (la crea el laboratorista). La clave inicial la genera el sistema,
 * se envia al cliente por correo y se devuelve al laboratorista (puede verla). No es temporal.
 */
export async function crearCuentaCliente(cliente) {
  const rol = await Rol.findOne({ nombre: "Cliente" });
  const clave = generarClave();
  const u = await Usuario.create({
    nombre: cliente.nombre, correo: cliente.correo, telefono: cliente.telefono, id_rol: rol._id,
    id_cliente: cliente._id, contrasena_hash: await bcrypt.hash(clave, 10), debe_cambiar_contrasena: false,
  });
  await enviarClaveInicial(u, clave, true);
  return { usuario: u, clave };
}

export async function enviarClaveInicial(u, clave, nueva) {
  await enviarCorreo({
    para: u.correo, asunto: "Su acceso al sistema de LABFICAT",
    titulo: nueva ? "Su cuenta fue creada" : "Su clave de acceso",
    parrafos: [`Ingrese con este correo y la siguiente contraseña: <b style="font-size:18px">${clave}</b>`,
      "Puede cambiarla cuando quiera desde su perfil, o recuperarla con un código que enviamos a su correo."],
    boton: { texto: "Ingresar al sistema", url: urlSistema("#/login") },
    tipo: nueva ? "cuenta_creada" : "reenvio_clave", id_cliente: u.id_cliente, id_usuario: u._id, tabla_referencia: "Usuarios_sistema", id_referencia: u._id,
  });
}

export async function regenerarClave(u) {
  const clave = generarClave();
  u.contrasena_hash = await bcrypt.hash(clave, 10); u.intentos_fallidos = 0; u.bloqueado_hasta = null;
  await u.save();
  await enviarClaveInicial(u, clave, false);
  return clave;
}
