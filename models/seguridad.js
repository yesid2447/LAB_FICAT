import mongoose from "mongoose";
const { Schema } = mongoose;
const oid = (ref, extra = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });

/* ---------- Roles, permisos (RF-28) ---------- */
export const Rol = mongoose.model("Rol", new Schema({
  nombre: { type: String, required: true, unique: true },
  descripcion: String,
  activo: { type: Boolean, default: true },
}, { collection: "Roles" }));

export const Permiso = mongoose.model("Permiso", new Schema({
  modulo: { type: String, required: true },
  accion: { type: String, required: true },
  descripcion: String,
}, { collection: "Permisos" }));
Permiso.schema.index({ modulo: 1, accion: 1 }, { unique: true });

export const RolPermiso = mongoose.model("RolPermiso", new Schema({
  id_rol: oid("Rol", { required: true }),
  id_permiso: oid("Permiso", { required: true }),
}, { collection: "Rol_permisos" }));
RolPermiso.schema.index({ id_rol: 1, id_permiso: 1 }, { unique: true });

/* ---------- Usuarios del sistema (login propio) ---------- */
export const Usuario = mongoose.model("Usuario", new Schema({
  nombre: { type: String, required: true },
  correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
  telefono: String,
  id_rol: oid("Rol", { required: true }),
  activo: { type: Boolean, default: true },
  id_cliente: oid("Cliente", { default: null }), // solo para el rol Cliente
  cargo: String,
  firma_imagen: { type: Schema.Types.ObjectId, default: null }, // archivo en GridFS
  contrasena_hash: { type: String, required: true },
  ultimo_acceso: Date,
  intentos_fallidos: { type: Number, default: 0 },
  bloqueado_hasta: Date,
  debe_cambiar_contrasena: { type: Boolean, default: false }, // "no obligatorio"
}, { collection: "Usuarios_sistema" }));

/* ---------- Auditoria inmutable (RF-35) ---------- */
const auditoriaSchema = new Schema({
  id_usuario: oid("Usuario", { default: null }), // vacio si lo hizo el sistema
  nombre_usuario: String,
  rol_al_momento: String,
  tipo_accion: { type: String, required: true },
  accion: String,
  resultado: { type: String, enum: ["exitoso", "denegado", "error"], default: "exitoso" },
  requerimiento: String,
  tabla_afectada: String,
  id_registro: String,
  valor_anterior: Schema.Types.Mixed,
  valor_nuevo: Schema.Types.Mixed,
  detalle: String,
  id_cliente: oid("Cliente", { default: null }),
  id_solicitud: oid("Solicitud", { default: null }),
  id_muestra: { type: Schema.Types.ObjectId, default: null },
  canal_origen: { type: String, default: "web" },
  ip_origen: String,
  fecha_hora: { type: Date, default: Date.now },
}, { collection: "Auditoria_acciones", versionKey: false });
// Inmutable: se puede crear, nunca editar ni borrar.
const bloquear = () => { throw new Error("Auditoria_acciones es inmutable: no se edita ni se borra"); };
["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"]
  .forEach((op) => auditoriaSchema.pre(op, bloquear));
auditoriaSchema.pre("save", function (next) { if (!this.isNew) return bloquear(); next(); });
export const Auditoria = mongoose.model("Auditoria", auditoriaSchema);

/* ---------- Colecciones tecnicas (NO son del modelo de datos) ---------- */
export const Contador = mongoose.model("Contador", new Schema({
  _id: String, // ej. "cotizacion-2026"
  seq: { type: Number, default: 0 },
}, { collection: "Contadores", versionKey: false }));

// Codigos de 6 digitos (firma de cotizacion y recuperacion de clave). Se guardan con hash y vencen solos (TTL).
export const CodigoVerificacion = mongoose.model("CodigoVerificacion", new Schema({
  tipo: { type: String, enum: ["firma", "recuperacion"], required: true },
  id_usuario: oid("Usuario", { required: true }),
  id_cotizacion: oid("Cotizacion", { default: null }),
  codigo_hash: { type: String, required: true },
  intentos: { type: Number, default: 0 },
  verificado: { type: Boolean, default: false },
  usado: { type: Boolean, default: false },
  creado: { type: Date, default: Date.now },
  expira: { type: Date, required: true },
  expira_firma: Date, // ventana para firmar despues de verificar
  borrar_en: { type: Date, required: true, index: { expires: 0 } },
}, { collection: "Codigos_verificacion", versionKey: false }));
