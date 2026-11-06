import { Cliente, Solicitud, Cotizacion, Tipologia } from "../models/negocio.js";
import { Usuario } from "../models/seguridad.js";
import { auditar } from "../helpers/auditoria.js";
import { diferencias } from "../helpers/diff.js";
import { regenerarClave } from "../services/cuentas.js";

const CAMPOS_EDITABLES = ["nombre", "cedula_nit", "correo", "telefono", "direccion", "ciudad", "departamento", "cargo", "nombre_contacto", "id_tipologia", "tipo_usuario", "tipo_persona", "tiene_RUT", "estado"];
const CAMPOS_CLIENTE = ["nombre", "telefono", "direccion", "ciudad", "departamento", "cargo", "nombre_contacto", "id_tipologia", "tipo_persona", "tiene_RUT"];

/** RF-12: busca por cedula/NIT y devuelve datos + historial para precargar. */
export const buscar = async (req, res) => {
  const cedula = String(req.query.cedula_nit || "").trim();
  if (!cedula) return res.status(400).json({ msg: "Indique la cédula o NIT" });
  const cliente = await Cliente.findOne({ cedula_nit: cedula }).lean();
  if (!cliente) return res.json({ existe: false });
  const solicitudes = await Solicitud.find({ id_cliente: cliente._id }).sort({ fecha_creacion: -1 }).lean();
  const cotizaciones = await Cotizacion.find({ id_solicitud: { $in: solicitudes.map((s) => s._id) } }).select("numero_cotizacion version estado fecha_emision valor_total id_solicitud").sort({ fecha_emision: -1 }).lean();
  const cuenta = await Usuario.exists({ id_cliente: cliente._id });
  await auditar(req, { tipo_accion: "consulta_cliente", requerimiento: "RF-12", tabla_afectada: "Clientes", id_registro: String(cliente._id), id_cliente: cliente._id });
  res.json({ existe: true, cliente, tiene_cuenta: !!cuenta, historial: { solicitudes, cotizaciones } });
};

export const listar = async (req, res) => {
  const f = {};
  if (req.query.q) { const r = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); f.$or = [{ nombre: r }, { cedula_nit: r }, { correo: r }]; }
  res.json(await Cliente.find(f).sort({ nombre: 1 }).limit(200).lean());
};

export const obtener = async (req, res) => {
  const c = await Cliente.findById(req.params.id).lean();
  if (!c) return res.status(404).json({ msg: "Cliente no encontrado" });
  res.json(c);
};

/** El laboratorista corrige cualquier dato del cliente (RF-23). */
export const editar = async (req, res) => {
  const c = await Cliente.findById(req.params.id);
  if (!c) return res.status(404).json({ msg: "Cliente no encontrado" });
  const nuevo = {}; CAMPOS_EDITABLES.forEach((k) => { if (req.body[k] !== undefined) nuevo[k] = req.body[k]; });
  if (nuevo.id_tipologia && !(await Tipologia.exists({ _id: nuevo.id_tipologia }))) return res.status(400).json({ msg: "Tipología no válida" });
  const d = diferencias(c, nuevo, CAMPOS_EDITABLES);
  try { Object.assign(c, nuevo); c.fecha_ultima_interaccion = new Date(); await c.save(); }
  catch (e) { return res.status(e.code === 11000 ? 409 : 400).json({ msg: e.code === 11000 ? "Ya existe un cliente con esa cédula/NIT" : e.message }); }
  if (d.despues.correo) await Usuario.updateOne({ id_cliente: c._id }, { correo: c.correo });
  if (d.cambio) await auditar(req, { tipo_accion: "editar_cliente", requerimiento: "RF-23", tabla_afectada: "Clientes", id_registro: String(c._id), valor_anterior: d.antes, valor_nuevo: d.despues, id_cliente: c._id });
  res.json(c);
};

/** RF-23: cada usuario corrige su propio perfil. */
export const miPerfil = async (req, res) => {
  const u = req.usuario;
  if (u.esCliente) {
    const c = await Cliente.findById(u.id_cliente);
    const nuevo = {}; CAMPOS_CLIENTE.forEach((k) => { if (req.body[k] !== undefined) nuevo[k] = req.body[k]; });
    const d = diferencias(c, nuevo, CAMPOS_CLIENTE);
    Object.assign(c, nuevo); await c.save();
    if (nuevo.nombre) { u.nombre = nuevo.nombre; }
    if (nuevo.telefono) u.telefono = nuevo.telefono;
    await u.save();
    if (d.cambio) await auditar(req, { tipo_accion: "editar_perfil", requerimiento: "RF-23", tabla_afectada: "Clientes", id_registro: String(c._id), valor_anterior: d.antes, valor_nuevo: d.despues, id_cliente: c._id });
    return res.json({ cliente: c });
  }
  const nuevo = {}; ["nombre", "telefono", "cargo"].forEach((k) => { if (req.body[k] !== undefined) nuevo[k] = req.body[k]; });
  const d = diferencias(u, nuevo, ["nombre", "telefono", "cargo"]);
  Object.assign(u, nuevo); await u.save();
  if (d.cambio) await auditar(req, { tipo_accion: "editar_perfil", requerimiento: "RF-23", tabla_afectada: "Usuarios_sistema", id_registro: String(u._id), valor_anterior: d.antes, valor_nuevo: d.despues });
  res.json({ usuario: { nombre: u.nombre, telefono: u.telefono, cargo: u.cargo } });
};

export const miCliente = async (req, res) => {
  if (!req.usuario.esCliente) return res.status(400).json({ msg: "Solo para clientes" });
  res.json(await Cliente.findById(req.usuario.id_cliente).lean());
};

/** El laboratorista genera una clave nueva y se envia por correo (la ve el laboratorista). */
export const reenviarClave = async (req, res) => {
  const u = await Usuario.findOne({ id_cliente: req.params.id });
  if (!u) return res.status(404).json({ msg: "El cliente no tiene cuenta" });
  const clave = await regenerarClave(u);
  await auditar(req, { tipo_accion: "reenviar_clave", requerimiento: "RF-28", tabla_afectada: "Usuarios_sistema", id_registro: String(u._id), id_cliente: u.id_cliente });
  res.json({ msg: "Clave nueva enviada al correo del cliente", clave_inicial: clave });
};
