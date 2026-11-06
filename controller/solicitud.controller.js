import { Cliente, Solicitud, Cotizacion, Tipologia } from "../models/negocio.js";
import { Usuario } from "../models/seguridad.js";
import { auditar } from "../helpers/auditoria.js";
import { crearCuentaCliente } from "../services/cuentas.js";

/**
 * RF-01 (+ RF-12): registra la solicitud. Si la cedula/NIT existe usa ese cliente (no se duplica);
 * si no, crea el cliente y su cuenta. Guarda Solicitudes con estado_flujo "en tramite".
 */
export const crear = async (req, res) => {
  const b = req.body;
  const cedula = String(b.cedula_nit).trim();
  let cliente = await Cliente.findOne({ cedula_nit: cedula });
  let clienteNuevo = false, cuenta = null;

  if (!cliente) {
    if (b.autoriza_tratamiento_datos !== true) return res.status(400).json({ msg: "Debe confirmar la autorización de tratamiento de datos (Ley 1581 de 2012)" });
    if (b.id_tipologia && !(await Tipologia.exists({ _id: b.id_tipologia, activo: true }))) return res.status(400).json({ msg: "Tipología no válida" });
    if (await Usuario.exists({ correo: String(b.correo).toLowerCase().trim() })) return res.status(409).json({ msg: "Ya existe una cuenta con ese correo. Revise el correo o busque al cliente por su cédula/NIT" });
    cliente = await Cliente.create({
      cedula_nit: cedula, nombre: b.nombre, correo: b.correo, telefono: b.telefono, tipo_usuario: b.tipo_usuario || "externo",
      id_tipologia: b.id_tipologia || null, tipo_persona: b.tipo_persona || "natural", tiene_RUT: !!b.tiene_RUT,
      nombre_contacto: b.nombre_contacto || b.nombre, cargo: b.cargo, direccion: b.direccion, ciudad: b.ciudad, departamento: b.departamento,
      autoriza_tratamiento_datos: true,
    });
    clienteNuevo = true;
    await auditar(req, { tipo_accion: "crear_cliente", requerimiento: "RF-01", tabla_afectada: "Clientes", id_registro: String(cliente._id), id_cliente: cliente._id, valor_nuevo: { cedula_nit: cedula, nombre: cliente.nombre, tipo_usuario: cliente.tipo_usuario } });
  }
  if (!(await Usuario.exists({ id_cliente: cliente._id }))) {
    cuenta = await crearCuentaCliente(cliente);
    await auditar(req, { tipo_accion: "crear_cuenta_cliente", requerimiento: "RF-28", tabla_afectada: "Usuarios_sistema", id_registro: String(cuenta.usuario._id), id_cliente: cliente._id });
  }
  const sol = await Solicitud.create({ id_cliente: cliente._id, descripcion_necesidad: b.descripcion_necesidad, estado_flujo: "en tramite" });
  cliente.fecha_ultima_interaccion = new Date(); await cliente.save();
  await auditar(req, { tipo_accion: "crear_solicitud", requerimiento: "RF-01", tabla_afectada: "Solicitudes", id_registro: String(sol._id), id_solicitud: sol._id, id_cliente: cliente._id, valor_nuevo: { estado_flujo: "en tramite" } });
  res.status(201).json({ solicitud: sol, cliente, cliente_nuevo: clienteNuevo, clave_inicial: cuenta?.clave || null });
};

export const listar = async (req, res) => {
  const f = req.usuario.esCliente ? { id_cliente: req.usuario.id_cliente } : {};
  if (req.query.estado_flujo) f.estado_flujo = req.query.estado_flujo;
  const sols = await Solicitud.find(f).populate("id_cliente", "nombre cedula_nit correo").sort({ fecha_creacion: -1 }).limit(300).lean();
  const cots = await Cotizacion.find({ id_solicitud: { $in: sols.map((s) => s._id) } }).select("id_solicitud numero_cotizacion version estado valor_total").sort({ version: 1 }).lean();
  res.json(sols.map((s) => ({ ...s, cotizaciones: cots.filter((c) => String(c.id_solicitud) === String(s._id)).filter((c) => !req.usuario.esCliente || c.estado !== "borrador") })));
};

export const obtener = async (req, res) => {
  const s = await Solicitud.findById(req.params.id).populate("id_cliente").lean();
  if (!s) return res.status(404).json({ msg: "Solicitud no encontrada" });
  if (req.usuario.esCliente && String(s.id_cliente._id) !== String(req.usuario.id_cliente)) return res.status(403).json({ msg: "No autorizado" });
  const cotizaciones = await Cotizacion.find({ id_solicitud: s._id }).sort({ version: 1 }).lean();
  res.json({ ...s, cotizaciones: req.usuario.esCliente ? cotizaciones.filter((c) => c.estado !== "borrador") : cotizaciones });
};
