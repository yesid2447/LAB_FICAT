import mongoose from "mongoose";
const { Schema } = mongoose;
const oid = (ref, extra = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });

export const Tipologia = mongoose.model("Tipologia", new Schema({
  nombre: { type: String, required: true, unique: true },
  activo: { type: Boolean, default: true },
}, { collection: "Tipologias_SENOVA" }));

export const Cliente = mongoose.model("Cliente", new Schema({
  cedula_nit: { type: String, required: true, unique: true, trim: true },
  nombre: { type: String, required: true, trim: true },
  correo: { type: String, required: true, lowercase: true, trim: true },
  telefono: String,
  tipo_usuario: { type: String, enum: ["interno", "externo"], default: "externo" },
  id_tipologia: oid("Tipologia", { default: null }),
  tipo_persona: { type: String, enum: ["natural", "juridica"], default: "natural" },
  tiene_RUT: { type: Boolean, default: false },
  estado: { type: String, enum: ["activo", "inactivo", "sin continuar"], default: "activo" },
  fecha_ultima_interaccion: { type: Date, default: Date.now },
  nombre_contacto: String,
  cargo: String,
  direccion: String,
  ciudad: String,
  departamento: String,
  autoriza_tratamiento_datos: { type: Boolean, default: false }, // Habeas Data, Ley 1581/2012
}, { collection: "Clientes" }));

export const Solicitud = mongoose.model("Solicitud", new Schema({
  id_cliente: oid("Cliente", { required: true, index: true }),
  descripcion_necesidad: { type: String, required: true },
  estado_flujo: { type: String, default: "en tramite" },
  fecha_creacion: { type: Date, default: Date.now },
}, { collection: "Solicitudes" }));

export const Plantilla = mongoose.model("Plantilla", new Schema({
  nombre: { type: String, required: true },
  tipo: { type: String, default: "cotizacion" },
  estructura: Schema.Types.Mixed,   // secciones y textos fijos (identicos al formato oficial)
  campos_variables: [String],
  codigo_formato: String,
  version_formato: Number,
  fecha_aprobacion_formato: String, // se muestra tal cual: 2025-03-25
}, { collection: "Plantillas" }));

export const Servicio = mongoose.model("Servicio", new Schema({
  nombre: { type: String, required: true },
  parametro: String,
  metodologia: String,
  precio: { type: Number, required: true, min: 0 },
  descripcion: String,
  activo: { type: Boolean, default: true },
  codigo_referencia: String,
  unidad: { type: String, default: "%" },
  tecnica: String,
  tercerizado: { type: Boolean, default: false },
  acreditado_res1619: { type: Boolean, default: false },
}, { collection: "Catalogo_servicios" }));

export const Cotizacion = mongoose.model("Cotizacion", new Schema({
  id_solicitud: oid("Solicitud", { required: true, index: true }),
  id_plantilla: oid("Plantilla", { required: true }),
  numero_cotizacion: { type: String, required: true },   // 0039-2026
  version: { type: Number, default: 1 },                  // V1, V2...
  valor_total: { type: Number, default: 0 },
  alcance: String,
  estado: { type: String, enum: ["borrador", "enviada", "firmada", "reemplazada"], default: "borrador" },
  fecha_emision: { type: String, required: true },        // AAAA-MM-DD
  fecha_validez: { type: String, required: true },
  plazo_entrega_dias_habiles: { type: Number, default: 15 },
  observaciones_propuesta: String,
  observaciones_servicio: String,
  elaborada_por: oid("Usuario", { required: true }),
  fecha_envio: Date,
  snapshot: Schema.Types.Mixed,                           // copia fija de lo enviado
  pdf_enviado: { type: Schema.Types.ObjectId, default: null },
  // Aceptacion
  medio_aceptacion: { type: String, enum: ["digital", "presencial", "whatsapp", "correo", "otro", null], default: null },
  firma: { type: Schema.Types.ObjectId, default: null },  // imagen de la firma (GridFS)
  fecha_hora_firma: Date,
  dispositivo_ip: String,
  dispositivo: String,
  hash_pdf: String,                                       // SHA-256 del pdf_firmado
  nombre_firmante: String,
  cc_firmante: String,
  pdf_firmado: { type: Schema.Types.ObjectId, default: null },
  subida_por: oid("Usuario", { default: null }),
  fecha_subida: Date,
  es_demo: { type: Boolean, default: false },
}, { collection: "Cotizaciones" }));
Cotizacion.schema.index({ numero_cotizacion: 1, version: 1 }, { unique: true });

export const CotizacionServicio = mongoose.model("CotizacionServicio", new Schema({
  id_cotizacion: oid("Cotizacion", { required: true }),
  numero_item: { type: Number, required: true },
  id_servicio: oid("Servicio", { required: true }),
  descripcion_item: String,            // descripcion de la muestra del item
  cantidad: { type: Number, required: true, min: 0 },
  precio_unitario: { type: Number, required: true, min: 0 },   // COPIADO del catalogo
  costo_ensayo: { type: Number, required: true },
  // Datos congelados del catalogo al momento de cotizar
  nombre_ensayo: String, codigo_referencia: String, unidad: String,
  metodo: String, tecnica: String, tercerizado: Boolean, acreditado_res1619: Boolean,
}, { collection: "Cotizacion_servicios" }));
CotizacionServicio.schema.index({ id_cotizacion: 1, numero_item: 1, id_servicio: 1 }, { unique: true });

export const Notificacion = mongoose.model("Notificacion", new Schema({
  tipo: String,
  id_cliente: oid("Cliente", { default: null }),
  id_usuario: oid("Usuario", { default: null }),
  destinatario_correo: String,
  id_plantilla: oid("Plantilla", { default: null }),
  canal: { type: String, default: "correo" },
  asunto: String,
  tabla_referencia: String,
  id_referencia: String,
  fecha_envio: { type: Date, default: Date.now },
  estado_envio: { type: String, enum: ["enviado", "simulado", "fallido"], default: "enviado" },
  error: String,
}, { collection: "Notificaciones" }));
