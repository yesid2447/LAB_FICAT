import { Solicitud, Cotizacion, Cliente, Notificacion } from "../models/negocio.js";
import { Auditoria } from "../models/seguridad.js";

/** RF-27 (basico): el cliente ve el estado de sus solicitudes y cotizaciones. */
export const miEstado = async (req, res) => {
  const sols = await Solicitud.find({ id_cliente: req.usuario.id_cliente }).sort({ fecha_creacion: -1 }).lean();
  const cots = await Cotizacion.find({ id_solicitud: { $in: sols.map((s) => s._id) }, estado: { $ne: "borrador" } }).select("id_solicitud numero_cotizacion version estado fecha_envio fecha_hora_firma medio_aceptacion fecha_validez").sort({ version: -1 }).lean();
  const paso = (c) => (c.estado === "firmada" ? "Cotización firmada" : c.estado === "enviada" ? "Cotización enviada: falta su firma" : "Reemplazada por una versión nueva");
  res.json(sols.map((s) => {
    const cs = cots.filter((c) => String(c.id_solicitud) === String(s._id));
    const vigente = cs.find((c) => c.estado !== "reemplazada");
    return { id: s._id, necesidad: s.descripcion_necesidad, fecha: s.fecha_creacion, estado_flujo: s.estado_flujo,
      etapa: vigente ? paso(vigente) : "En trámite: el laboratorio prepara su cotización", cotizaciones: cs.map((c) => ({ ...c, etiqueta: `${c.numero_cotizacion}V${c.version}`, paso: paso(c) })) };
  }));
};

export const resumen = async (req, res) => {
  const [porEstado, porFlujo, clientes] = await Promise.all([
    Cotizacion.aggregate([{ $group: { _id: "$estado", n: { $sum: 1 } } }]),
    Solicitud.aggregate([{ $group: { _id: "$estado_flujo", n: { $sum: 1 } } }]),
    Cliente.countDocuments(),
  ]);
  res.json({ cotizaciones: Object.fromEntries(porEstado.map((x) => [x._id, x.n])), solicitudes: Object.fromEntries(porFlujo.map((x) => [x._id, x.n])), clientes });
};

export const notificaciones = async (req, res) => {
  const f = req.usuario.esCliente ? { id_cliente: req.usuario.id_cliente } : {};
  res.json(await Notificacion.find(f).sort({ fecha_envio: -1 }).limit(200).lean());
};

export const auditoria = async (req, res) => {
  const f = {};
  ["tipo_accion", "resultado", "requerimiento", "tabla_afectada"].forEach((k) => { if (req.query[k]) f[k] = req.query[k]; });
  if (req.query.id_cliente) f.id_cliente = req.query.id_cliente;
  if (req.query.id_solicitud) f.id_solicitud = req.query.id_solicitud;
  res.json(await Auditoria.find(f).sort({ fecha_hora: -1 }).limit(Math.min(Number(req.query.limit) || 200, 1000)).lean());
};
