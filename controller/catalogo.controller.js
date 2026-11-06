import { Servicio, Tipologia, Plantilla } from "../models/negocio.js";
import { auditar } from "../helpers/auditoria.js";
import { diferencias } from "../helpers/diff.js";

/** CRUD administrable (RF-30) para Catalogo_servicios y Tipologias_SENOVA. */
const fabrica = (Modelo, tabla, campos) => ({
  listar: async (req, res) => {
    const f = {}; if (req.query.activo === "true" || req.usuario.esCliente) f.activo = true;
    res.json(await Modelo.find(f).sort({ nombre: 1 }).lean());
  },
  crear: async (req, res) => {
    const d = {}; campos.forEach((k) => { if (req.body[k] !== undefined) d[k] = req.body[k]; });
    try { const x = await Modelo.create(d); await auditar(req, { tipo_accion: `crear_${tabla}`, requerimiento: "RF-30", tabla_afectada: tabla, id_registro: String(x._id), valor_nuevo: d }); res.status(201).json(x); }
    catch (e) { res.status(e.code === 11000 ? 409 : 400).json({ msg: e.code === 11000 ? "Ya existe un registro con ese nombre" : e.message }); }
  },
  actualizar: async (req, res) => {
    const x = await Modelo.findById(req.params.id); if (!x) return res.status(404).json({ msg: "No encontrado" });
    const nuevo = {}; campos.forEach((k) => { if (req.body[k] !== undefined) nuevo[k] = req.body[k]; });
    const d = diferencias(x, nuevo, campos);
    try { Object.assign(x, nuevo); await x.save(); } catch (e) { return res.status(400).json({ msg: e.message }); }
    if (d.cambio) await auditar(req, { tipo_accion: `editar_${tabla}`, requerimiento: "RF-30", tabla_afectada: tabla, id_registro: String(x._id), valor_anterior: d.antes, valor_nuevo: d.despues });
    res.json(x);
  },
});
export const servicios = fabrica(Servicio, "Catalogo_servicios", ["nombre", "parametro", "metodologia", "precio", "descripcion", "activo", "codigo_referencia", "unidad", "tecnica", "tercerizado", "acreditado_res1619"]);
export const tipologias = fabrica(Tipologia, "Tipologias_SENOVA", ["nombre", "activo"]);

export const plantillas = {
  listar: async (req, res) => res.json(await Plantilla.find().select("-estructura").lean()),
  obtener: async (req, res) => { const p = await Plantilla.findById(req.params.id).lean(); p ? res.json(p) : res.status(404).json({ msg: "No encontrada" }); },
  actualizar: async (req, res) => {
    const p = await Plantilla.findById(req.params.id); if (!p) return res.status(404).json({ msg: "No encontrada" });
    const campos = ["nombre", "campos_variables", "version_formato", "fecha_aprobacion_formato"];
    const nuevo = {}; campos.forEach((k) => { if (req.body[k] !== undefined) nuevo[k] = req.body[k]; });
    const d = diferencias(p, nuevo, campos); Object.assign(p, nuevo); await p.save();
    if (d.cambio) await auditar(req, { tipo_accion: "editar_plantilla", requerimiento: "RF-30", tabla_afectada: "Plantillas", id_registro: String(p._id), valor_anterior: d.antes, valor_nuevo: d.despues });
    res.json(p);
  },
};
