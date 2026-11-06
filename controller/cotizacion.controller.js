import { Cotizacion, CotizacionServicio, Servicio, Solicitud, Cliente, Plantilla } from "../models/negocio.js";
import { Usuario, CodigoVerificacion } from "../models/seguridad.js";
import { auditar } from "../helpers/auditoria.js";
import { sha256, ipDe, hoyBogota, generarCodigo6, hashCodigo } from "../helpers/utils.js";
import { OBS_SERVICIO_TEXTO, TEXTOS_0039 } from "../helpers/textosPlantilla.js";
import { guardarArchivo, leerArchivo } from "../services/archivos.js";
import { siguienteNumeroCotizacion } from "../services/consecutivo.js";
import { generarPdfCotizacion } from "../services/cotizacionPdf.js";
import { enviarCorreo, urlSistema } from "../services/correo.js";
import { crearCuentaCliente } from "../services/cuentas.js";

const MEDIOS = ["presencial", "whatsapp", "correo", "otro"];
const etiqueta = (c) => `${c.numero_cotizacion}V${c.version}`;

/* ---------- utilidades ---------- */
/** Arma las filas de Cotizacion_servicios copiando precio y metodo del catalogo (quedan congelados). */
async function armarItems(itemsIn) {
  if (!Array.isArray(itemsIn) || !itemsIn.length) throw new Error("Agregue al menos un ensayo a la cotización");
  const ids = [...new Set(itemsIn.map((i) => String(i.id_servicio)))];
  const cat = await Servicio.find({ _id: { $in: ids } }).lean();
  const mapa = Object.fromEntries(cat.map((s) => [String(s._id), s]));
  const usados = new Set();
  return itemsIn.map((i) => {
    const s = mapa[String(i.id_servicio)];
    if (!s) throw new Error("Hay un ensayo que no existe en el catálogo");
    if (!s.activo && !i._permitirInactivo) throw new Error(`El ensayo "${s.nombre}" no está disponible`);
    const numero_item = Number(i.numero_item) || 1;
    const llave = `${numero_item}-${s._id}`;
    if (usados.has(llave)) throw new Error(`El ensayo "${s.nombre}" está repetido en el ítem ${numero_item}`);
    usados.add(llave);
    const cantidad = Number(i.cantidad), precio = i.precio_unitario !== undefined && i.precio_unitario !== "" ? Number(i.precio_unitario) : s.precio;
    if (!(cantidad > 0) || !(precio >= 0)) throw new Error("Cantidad y valor unitario deben ser números válidos");
    return {
      numero_item, id_servicio: s._id, descripcion_item: i.descripcion_item || "Descripción de la muestra a ensayar",
      cantidad, precio_unitario: precio, costo_ensayo: Math.round(cantidad * precio),
      nombre_ensayo: s.nombre, codigo_referencia: i.codigo_referencia ?? s.codigo_referencia, unidad: i.unidad ?? s.unidad,
      metodo: i.metodo ?? s.metodologia, tecnica: i.tecnica ?? s.tecnica, tercerizado: s.tercerizado, acreditado_res1619: s.acreditado_res1619,
    };
  });
}
const total = (filas) => filas.reduce((s, f) => s + f.costo_ensayo, 0);
const obsPorDefecto = (filas) => (filas.some((f) => f.tercerizado) ? TEXTOS_0039.observacion_tercerizado : "");

async function puedeVer(req, cot) {
  if (!req.usuario.esCliente) return true;
  if (cot.estado === "borrador") return false;
  const sol = await Solicitud.findById(cot.id_solicitud).lean();
  return String(sol.id_cliente) === String(req.usuario.id_cliente);
}
async function cargar(req, res, estados) {
  const cot = await Cotizacion.findById(req.params.id);
  if (!cot || !(await puedeVer(req, cot))) { res.status(404).json({ msg: "Cotización no encontrada" }); return null; }
  if (estados && !estados.includes(cot.estado)) { res.status(409).json({ msg: `La cotización está "${cot.estado}"; esta acción requiere: ${estados.join(" o ")}` }); return null; }
  return cot;
}
const tmpCampos = (b) => ({
  fecha_validez: b.fecha_validez, plazo_entrega_dias_habiles: b.plazo_entrega_dias_habiles !== undefined ? Number(b.plazo_entrega_dias_habiles) : undefined,
  observaciones_propuesta: b.observaciones_propuesta, observaciones_servicio: b.observaciones_servicio, alcance: b.alcance,
});
const limpiar = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/* ---------- RF-02: crear / editar ---------- */
export const crear = async (req, res) => {
  const sol = await Solicitud.findById(req.body.id_solicitud);
  if (!sol) return res.status(404).json({ msg: "Solicitud no encontrada" });
  let filas;
  try { filas = await armarItems(req.body.items); } catch (e) { return res.status(400).json({ msg: e.message }); }
  const plantilla = await Plantilla.findOne({ codigo_formato: "CAT–ST–OC–F–002" }).sort({ version_formato: -1 });
  if (!plantilla) return res.status(500).json({ msg: "Falta la plantilla 0039-2026V1. Ejecute npm run seed" });
  const hoy = hoyBogota(), anio = hoy.slice(0, 4);
  const numero = await siguienteNumeroCotizacion(anio);
  const cot = await Cotizacion.create({
    id_solicitud: sol._id, id_plantilla: plantilla._id, numero_cotizacion: numero, version: 1, estado: "borrador",
    fecha_emision: hoy, fecha_validez: req.body.fecha_validez || `${anio}-12-31`, plazo_entrega_dias_habiles: Number(req.body.plazo_entrega_dias_habiles) || 15,
    observaciones_propuesta: req.body.observaciones_propuesta ?? obsPorDefecto(filas),
    observaciones_servicio: req.body.observaciones_servicio ?? OBS_SERVICIO_TEXTO,
    alcance: req.body.alcance, elaborada_por: req.usuario._id, valor_total: total(filas),
  });
  await CotizacionServicio.insertMany(filas.map((f) => ({ ...f, id_cotizacion: cot._id })));
  await auditar(req, { tipo_accion: "crear_cotizacion", requerimiento: "RF-02", tabla_afectada: "Cotizaciones", id_registro: String(cot._id), id_solicitud: sol._id, id_cliente: sol.id_cliente, valor_nuevo: { numero: etiqueta(cot), valor_total: cot.valor_total, items: filas.length } });
  res.status(201).json(await detalle(cot._id));
};

export const actualizar = async (req, res) => {
  const cot = await cargar(req, res, ["borrador"]);
  if (!cot) return;
  const antes = { valor_total: cot.valor_total, fecha_validez: cot.fecha_validez, plazo: cot.plazo_entrega_dias_habiles };
  if (req.body.items) {
    let filas; try { filas = await armarItems(req.body.items); } catch (e) { return res.status(400).json({ msg: e.message }); }
    await CotizacionServicio.deleteMany({ id_cotizacion: cot._id });
    await CotizacionServicio.insertMany(filas.map((f) => ({ ...f, id_cotizacion: cot._id })));
    cot.valor_total = total(filas);
    if (req.body.observaciones_propuesta === undefined && cot.observaciones_propuesta === undefined) cot.observaciones_propuesta = obsPorDefecto(filas);
  }
  Object.assign(cot, limpiar(tmpCampos(req.body)));
  await cot.save();
  await auditar(req, { tipo_accion: "editar_cotizacion", requerimiento: "RF-02", tabla_afectada: "Cotizaciones", id_registro: String(cot._id), id_solicitud: cot.id_solicitud, valor_anterior: antes, valor_nuevo: { valor_total: cot.valor_total, fecha_validez: cot.fecha_validez, plazo: cot.plazo_entrega_dias_habiles } });
  res.json(await detalle(cot._id));
};

/** Modificar una cotizacion ya enviada sube SOLO la version (V2, V3...). */
export const nuevaVersion = async (req, res) => {
  const cot = await cargar(req, res, ["enviada"]);
  if (!cot) return;
  if (await Cotizacion.exists({ numero_cotizacion: cot.numero_cotizacion, version: { $gt: cot.version } })) return res.status(409).json({ msg: "Ya existe una versión más reciente" });
  const filas = await CotizacionServicio.find({ id_cotizacion: cot._id }).lean();
  const nueva = await Cotizacion.create({
    id_solicitud: cot.id_solicitud, id_plantilla: cot.id_plantilla, numero_cotizacion: cot.numero_cotizacion, version: cot.version + 1, estado: "borrador",
    fecha_emision: hoyBogota(), fecha_validez: cot.fecha_validez, plazo_entrega_dias_habiles: cot.plazo_entrega_dias_habiles,
    observaciones_propuesta: cot.observaciones_propuesta, observaciones_servicio: cot.observaciones_servicio, alcance: cot.alcance,
    elaborada_por: req.usuario._id, valor_total: cot.valor_total,
  });
  await CotizacionServicio.insertMany(filas.map(({ _id, id_cotizacion, ...r }) => ({ ...r, id_cotizacion: nueva._id })));
  await auditar(req, { tipo_accion: "nueva_version_cotizacion", requerimiento: "RF-02", tabla_afectada: "Cotizaciones", id_registro: String(nueva._id), id_solicitud: cot.id_solicitud, valor_anterior: { version: cot.version }, valor_nuevo: { version: nueva.version } });
  res.status(201).json(await detalle(nueva._id));
};

async function detalle(id) {
  const cot = await Cotizacion.findById(id).populate("elaborada_por", "nombre cargo").lean();
  const items = await CotizacionServicio.find({ id_cotizacion: id }).sort({ numero_item: 1 }).lean();
  const sol = await Solicitud.findById(cot.id_solicitud).populate("id_cliente").lean();
  return { ...cot, items, solicitud: sol, etiqueta: etiqueta(cot) };
}
export const obtener = async (req, res) => {
  const cot = await cargar(req, res); if (!cot) return;
  const d = await detalle(cot._id);
  if (req.usuario.esCliente) { delete d.snapshot; delete d.dispositivo_ip; delete d.hash_pdf; }
  res.json(d);
};
export const listar = async (req, res) => {
  const f = {};
  if (req.query.id_solicitud) f.id_solicitud = req.query.id_solicitud;
  if (req.query.estado) f.estado = req.query.estado;
  if (req.usuario.esCliente) {
    const sols = await Solicitud.find({ id_cliente: req.usuario.id_cliente }).select("_id").lean();
    f.id_solicitud = { $in: sols.map((s) => s._id) }; f.estado = { $ne: "borrador" };
  }
  const cots = await Cotizacion.find(f).select("-snapshot").sort({ numero_cotizacion: -1, version: -1 }).limit(300).lean();
  res.json(cots.map((c) => ({ ...c, etiqueta: etiqueta(c) })));
};

/* ---------- PDF ---------- */
export const verPdf = async (req, res) => {
  const cot = await cargar(req, res); if (!cot) return;
  let buf = cot.estado === "firmada" ? await leerArchivo(cot.pdf_firmado) : cot.estado === "borrador" ? null : await leerArchivo(cot.pdf_enviado);
  if (!buf && cot.estado === "reemplazada") buf = await leerArchivo(cot.pdf_enviado);
  if (!buf) buf = await generarPdfCotizacion(cot._id); // borrador: vista previa en vivo
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Cotizacion_${etiqueta(cot)}.pdf"`, "Cache-Control": "no-store" });
  res.send(buf);
};

/* ---------- RF-03: enviar ---------- */
export const enviar = async (req, res) => {
  const cot = await cargar(req, res, ["borrador"]); if (!cot) return;
  const sol = await Solicitud.findById(cot.id_solicitud);
  const cliente = await Cliente.findById(sol.id_cliente).lean();
  const filas = await CotizacionServicio.find({ id_cotizacion: cot._id }).lean();
  if (!filas.length) return res.status(400).json({ msg: "La cotización no tiene ensayos" });
  let cuentaCliente = await Usuario.findOne({ id_cliente: cliente._id });
  let claveNueva = null;
  if (!cuentaCliente) { const c = await crearCuentaCliente(await Cliente.findById(cliente._id)); cuentaCliente = c.usuario; claveNueva = c.clave; }

  const pdf = await generarPdfCotizacion(cot._id);
  cot.pdf_enviado = await guardarArchivo(pdf, `Cotizacion_${etiqueta(cot)}.pdf`, "application/pdf", { id_cotizacion: String(cot._id), tipo: "enviada", sha256: sha256(pdf) });
  cot.snapshot = { enviada_el: new Date(), cliente, items: filas, valor_total: cot.valor_total, fecha_emision: cot.fecha_emision, fecha_validez: cot.fecha_validez, plazo_entrega_dias_habiles: cot.plazo_entrega_dias_habiles, observaciones_propuesta: cot.observaciones_propuesta, observaciones_servicio: cot.observaciones_servicio, sha256_pdf: sha256(pdf) };
  cot.estado = "enviada"; cot.fecha_envio = new Date();
  await cot.save();
  await Cotizacion.updateMany({ numero_cotizacion: cot.numero_cotizacion, version: { $lt: cot.version }, estado: "enviada" }, { estado: "reemplazada" });
  await Cliente.updateOne({ _id: cliente._id }, { fecha_ultima_interaccion: new Date() });

  const n = await enviarCorreo({
    para: cliente.correo, asunto: `Su cotización ${etiqueta(cot)} está disponible - LABFICAT`, titulo: "Tiene una cotización para revisar",
    parrafos: [`LABFICAT preparó la cotización <b>${etiqueta(cot)}</b>. Ingrese al sistema para verla, firmarla o descargarla.`],
    boton: { texto: "Ver mi cotización", url: urlSistema(`#/cotizacion/${cot._id}`) },
    tipo: "envio_cotizacion", id_cliente: cliente._id, id_usuario: cuentaCliente._id, tabla_referencia: "Cotizaciones", id_referencia: cot._id,
  });
  await auditar(req, { tipo_accion: "enviar_cotizacion", requerimiento: "RF-03", tabla_afectada: "Cotizaciones", id_registro: String(cot._id), id_solicitud: sol._id, id_cliente: cliente._id, valor_anterior: { estado: "borrador" }, valor_nuevo: { estado: "enviada", correo: n.estado_envio } });
  res.json({ msg: n.estado_envio === "fallido" ? "Cotización marcada como enviada, pero el correo falló. Reintente o avise al cliente" : "Cotización enviada al cliente", correo: n.estado_envio, clave_inicial: claveNueva, cotizacion: await detalle(cot._id) });
};

/* ---------- RF-03: aceptacion presencial u otro medio (sube el laboratorista) ---------- */
export const subirFirmada = async (req, res) => {
  const cot = await cargar(req, res, ["enviada"]); if (!cot) return;
  if (!req.file) return res.status(400).json({ msg: "Adjunte el PDF de la cotización firmada" });
  if (req.file.buffer.slice(0, 5).toString() !== "%PDF-") return res.status(400).json({ msg: "El archivo no es un PDF válido" });
  if (!MEDIOS.includes(req.body.medio_aceptacion)) return res.status(400).json({ msg: `Indique el medio de aceptación: ${MEDIOS.join(", ")}` });
  const hash = sha256(req.file.buffer);
  const id = await guardarArchivo(req.file.buffer, `Cotizacion_${etiqueta(cot)}_firmada.pdf`, "application/pdf", { id_cotizacion: String(cot._id), tipo: "firmada_subida", sha256: hash });
  const r = await Cotizacion.findOneAndUpdate({ _id: cot._id, estado: "enviada" }, { estado: "firmada", pdf_firmado: id, medio_aceptacion: req.body.medio_aceptacion, subida_por: req.usuario._id, fecha_subida: new Date(), hash_pdf: hash, nombre_firmante: req.body.nombre_firmante || undefined, cc_firmante: req.body.cc_firmante || undefined }, { new: true });
  if (!r) return res.status(409).json({ msg: "La cotización ya fue firmada" });
  const sol = await Solicitud.findById(cot.id_solicitud).lean();
  await Cliente.updateOne({ _id: sol.id_cliente }, { fecha_ultima_interaccion: new Date() });
  await auditar(req, { tipo_accion: "subir_cotizacion_firmada", requerimiento: "RF-03", tabla_afectada: "Cotizaciones", id_registro: String(cot._id), id_solicitud: sol._id, id_cliente: sol.id_cliente, valor_anterior: { estado: "enviada" }, valor_nuevo: { estado: "firmada", medio_aceptacion: req.body.medio_aceptacion, sha256: hash } });
  res.json({ msg: "Cotización firmada registrada", cotizacion: await detalle(cot._id) });
};

/* ---------- RF-03: firma digital propia (codigo por correo + firma dibujada) ---------- */
export const solicitarCodigo = async (req, res) => {
  const cot = await cargar(req, res, ["enviada"]); if (!cot) return;
  const ultimo = await CodigoVerificacion.findOne({ tipo: "firma", id_usuario: req.usuario._id, id_cotizacion: cot._id }).sort({ creado: -1 });
  if (ultimo && Date.now() - ultimo.creado < 60000) return res.status(429).json({ msg: "Espere un minuto antes de pedir otro código" });
  await CodigoVerificacion.deleteMany({ tipo: "firma", id_usuario: req.usuario._id, id_cotizacion: cot._id });
  const codigo = generarCodigo6();
  const cv = new CodigoVerificacion({ tipo: "firma", id_usuario: req.usuario._id, id_cotizacion: cot._id, codigo_hash: "x", expira: new Date(Date.now() + 10 * 60000), borrar_en: new Date(Date.now() + 3600000) });
  cv.codigo_hash = hashCodigo(codigo, cv._id); await cv.save();
  await enviarCorreo({
    para: req.usuario.correo, asunto: "Código para firmar su cotización - LABFICAT", titulo: "Código de verificación",
    parrafos: [`Su código para firmar la cotización ${etiqueta(cot)} es: <b style="font-size:22px;letter-spacing:3px">${codigo}</b>`, "Vence en 10 minutos y permite 3 intentos. Si usted no lo pidió, ignore este mensaje."],
    tipo: "codigo_firma", id_cliente: req.usuario.id_cliente, id_usuario: req.usuario._id, tabla_referencia: "Cotizaciones", id_referencia: cot._id, incluirContacto: false,
  });
  await auditar(req, { tipo_accion: "solicitar_codigo_firma", requerimiento: "RF-03", tabla_afectada: "Cotizaciones", id_registro: String(cot._id), id_cliente: req.usuario.id_cliente });
  res.json({ msg: "Enviamos un código de 6 dígitos a su correo. Vence en 10 minutos" });
};

export const verificarCodigo = async (req, res) => {
  const cot = await cargar(req, res, ["enviada"]); if (!cot) return;
  const cv = await CodigoVerificacion.findOne({ tipo: "firma", id_usuario: req.usuario._id, id_cotizacion: cot._id, usado: false }).sort({ creado: -1 });
  if (!cv || cv.expira < new Date()) return res.status(400).json({ msg: "El código venció. Pida uno nuevo" });
  if (cv.intentos >= 3) return res.status(400).json({ msg: "Superó los 3 intentos. Pida un código nuevo" });
  if (cv.codigo_hash !== hashCodigo(String(req.body.codigo || "").trim(), cv._id)) {
    cv.intentos += 1; await cv.save();
    await auditar(req, { tipo_accion: "verificar_codigo_firma", resultado: "denegado", requerimiento: "RF-03", tabla_afectada: "Cotizaciones", id_registro: String(cot._id), detalle: `intento ${cv.intentos} de 3` });
    return res.status(400).json({ msg: cv.intentos >= 3 ? "Superó los 3 intentos. Pida un código nuevo" : `Código incorrecto. Le quedan ${3 - cv.intentos} intento(s)` });
  }
  cv.verificado = true; cv.expira_firma = new Date(Date.now() + 15 * 60000); await cv.save();
  await auditar(req, { tipo_accion: "verificar_codigo_firma", requerimiento: "RF-03", tabla_afectada: "Cotizaciones", id_registro: String(cot._id) });
  res.json({ msg: "Código verificado. Dibuje su firma", valido_hasta: cv.expira_firma });
};

export const firmar = async (req, res) => {
  const cot = await cargar(req, res, ["enviada"]); if (!cot) return;
  const cv = await CodigoVerificacion.findOne({ tipo: "firma", id_usuario: req.usuario._id, id_cotizacion: cot._id, verificado: true, usado: false });
  if (!cv || !cv.expira_firma || cv.expira_firma < new Date()) return res.status(403).json({ msg: "Verifique primero el código enviado a su correo" });
  const { firma_png, nombre, cc, acepta } = req.body;
  if (acepta !== true) return res.status(400).json({ msg: "Debe aceptar las condiciones de la oferta" });
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(firma_png || ""));
  const png = m && Buffer.from(m[1], "base64");
  if (!png || png.length > 400000 || png.slice(0, 4).toString("hex") !== "89504e47") return res.status(400).json({ msg: "La firma no es válida (PNG de máximo 400 KB)" });
  if (String(nombre || "").trim().length < 3) return res.status(400).json({ msg: "Escriba su nombre completo" });
  if (!/^[0-9A-Za-z.\-]{5,20}$/.test(String(cc || "").trim())) return res.status(400).json({ msg: "Escriba su C.C. o NIT (5 a 20 caracteres)" });

  const fecha = new Date();
  const pdf = await generarPdfCotizacion(cot._id, { firmaCliente: png, acepta: { nombre: nombre.trim(), cc: cc.trim() }, desdeSnapshot: true });
  const hash = sha256(pdf);
  const idFirma = await guardarArchivo(png, `firma_${etiqueta(cot)}.png`, "image/png", { id_cotizacion: String(cot._id) });
  const idPdf = await guardarArchivo(pdf, `Cotizacion_${etiqueta(cot)}_firmada.pdf`, "application/pdf", { id_cotizacion: String(cot._id), tipo: "firmada_digital", sha256: hash });
  const r = await Cotizacion.findOneAndUpdate({ _id: cot._id, estado: "enviada" }, {
    estado: "firmada", medio_aceptacion: "digital", firma: idFirma, pdf_firmado: idPdf, hash_pdf: hash, fecha_hora_firma: fecha,
    nombre_firmante: nombre.trim(), cc_firmante: cc.trim(), dispositivo_ip: ipDe(req), dispositivo: String(req.headers["user-agent"] || "").slice(0, 300),
  }, { new: true });
  if (!r) return res.status(409).json({ msg: "La cotización ya fue firmada" });
  cv.usado = true; await cv.save();
  const sol = await Solicitud.findById(cot.id_solicitud).lean();
  await Cliente.updateOne({ _id: sol.id_cliente }, { fecha_ultima_interaccion: fecha });
  await auditar(req, { tipo_accion: "firmar_cotizacion", requerimiento: "RF-03", tabla_afectada: "Cotizaciones", id_registro: String(cot._id), id_solicitud: sol._id, id_cliente: sol.id_cliente, valor_anterior: { estado: "enviada" }, valor_nuevo: { estado: "firmada", medio: "digital", sha256: hash, fecha_hora_firma: fecha }, canal_origen: "web" });
  // Aviso al laboratorista que elaboro la cotizacion
  const elab = await Usuario.findById(cot.elaborada_por).lean();
  if (elab) await enviarCorreo({ para: elab.correo, asunto: `Cotización ${etiqueta(cot)} firmada`, titulo: "Un cliente firmó su cotización", parrafos: [`La cotización <b>${etiqueta(cot)}</b> fue firmada digitalmente.`], boton: { texto: "Abrir en el sistema", url: urlSistema(`#/cotizacion/${cot._id}`) }, tipo: "cotizacion_firmada", id_usuario: elab._id, tabla_referencia: "Cotizaciones", id_referencia: cot._id, incluirContacto: false });
  res.json({ msg: "Cotización firmada correctamente", sha256: hash, cotizacion: await detalle(cot._id) });
};

/** Comprueba que el PDF guardado no fue alterado (recalcula la huella SHA-256). */
export const verificarIntegridad = async (req, res) => {
  const cot = await cargar(req, res, ["firmada"]); if (!cot) return;
  const buf = await leerArchivo(cot.pdf_firmado);
  const actual = buf ? sha256(buf) : null;
  res.json({ integro: !!actual && actual === cot.hash_pdf, sha256_guardado: cot.hash_pdf, sha256_actual: actual });
};
