// npm run seed          -> roles, permisos, laboratorista administrador, tipologias, catalogo, plantilla, contador
// npm run seed:demo     -> ademas crea la cotizacion de ejemplo 0039-2026V1 (Ingrid) como BORRADOR demo (sin enviar correos)
// npm run seed:reset    -> BORRA las colecciones de esta fase y vuelve a sembrar (solo desarrollo)
import "dotenv/config";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { Rol, Permiso, RolPermiso, Usuario, Contador } from "../models/seguridad.js";
import { Tipologia, Cliente, Solicitud, Plantilla, Servicio, Cotizacion, CotizacionServicio } from "../models/negocio.js";
import { guardarArchivo } from "../services/archivos.js";
import { generarClave, hoyBogota } from "../helpers/utils.js";
import { TEXTOS_0039, OBS_SERVICIO_TEXTO } from "../helpers/textosPlantilla.js";
import { DATOS_DEMO } from "./datosDemo.js";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

const PERMISOS = [
  ["clientes", "ver"], ["clientes", "editar"], ["solicitudes", "crear"], ["cotizaciones", "ver"], ["cotizaciones", "crear"], ["cotizaciones", "editar"],
  ["cotizaciones", "enviar"], ["cotizaciones", "subir_firmada"], ["cotizaciones", "firmar"], ["catalogo", "administrar"], ["tipologias", "administrar"],
  ["plantillas", "ver"], ["plantillas", "administrar"], ["usuarios", "crear_cuenta"], ["auditoria", "ver"], ["perfil", "editar_propio"],
  ["estado", "consultar_todo"], ["estado", "consultar_propio"],
];
const TODOS_PERSONAL = PERMISOS.filter(([m, a]) => !(m === "cotizaciones" && a === "firmar") && a !== "consultar_propio");
const ROLES = {
  "Laboratorista": { d: "Titular del laboratorio. Realiza todas las acciones.", p: TODOS_PERSONAL },
  "Companero de laboratorio": { d: "Compañero del laboratorista. Realiza todas las acciones.", p: TODOS_PERSONAL },
  "Recepcion": { d: "Atiende clientes y consulta cotizaciones.", p: [["clientes", "ver"], ["cotizaciones", "ver"], ["perfil", "editar_propio"], ["estado", "consultar_todo"]] },
  "Analista": { d: "Analiza muestras (fases posteriores).", p: [["perfil", "editar_propio"]] },
  "Cliente": { d: "Cliente del laboratorio.", p: [["cotizaciones", "firmar"], ["perfil", "editar_propio"], ["estado", "consultar_propio"]] },
};
// Lista PROVISIONAL: reemplazar por las 12 tipologias oficiales de SENOVA (editables luego en RF-30).
const TIPOLOGIAS = ["Empresas", "Emprendedores", "Instituciones educativas", "Entidades públicas", "Gremios y asociaciones", "Cooperativas", "Productores agropecuarios",
  "Aprendices SENA", "Instructores SENA", "Investigadores", "Personas naturales", "Otros"];

const SERVICIOS = [
  { codigo_referencia: "*", nombre: "Fibra Cruda", parametro: "Fibra cruda", unidad: "%", metodologia: "INTERNO -GOMEFC.01 V02 2024-09-23", tecnica: "Hidròlisis Acida y Bàsica", precio: 133900, tercerizado: true, acreditado_res1619: false },
  { codigo_referencia: "2", nombre: "Cenizas", parametro: "Cenizas", unidad: "%", metodologia: "AOAC 900.02 C:2023 Modificado", tecnica: "Gravimetría", precio: 15000, acreditado_res1619: true },
  { codigo_referencia: "4", nombre: "Proteína", parametro: "Proteína", unidad: "%", metodologia: "AOAC 981.10:2023 Modificado", tecnica: "Volumetría (Kjeldhal)", precio: 15000, acreditado_res1619: true },
  { codigo_referencia: "3", nombre: "Grasas", parametro: "Grasas", unidad: "%", metodologia: "AOAC 920.39 C:2023 Modificado", tecnica: "Gravimetría (Soxhlet)", precio: 15000, acreditado_res1619: true },
  { codigo_referencia: "1", nombre: "Humedad", parametro: "Humedad", unidad: "%", metodologia: "AOAC 925.45 B:2023 Modificado", tecnica: "Gravimetría", precio: 15000, acreditado_res1619: true },
];

await mongoose.connect(process.env.MONGO_URL);
console.log("Conectado a MongoDB");
if (args.includes("--reset")) {
  for (const M of [Rol, Permiso, RolPermiso, Usuario, Contador, Tipologia, Cliente, Solicitud, Plantilla, Servicio, Cotizacion, CotizacionServicio]) await M.deleteMany({});
  console.log("Colecciones de la fase 1 vaciadas");
}

// Permisos y roles
for (const [modulo, accion] of PERMISOS) await Permiso.updateOne({ modulo, accion }, { $setOnInsert: { descripcion: `${modulo}: ${accion}` } }, { upsert: true });
const permisos = await Permiso.find().lean();
const idPerm = (m, a) => permisos.find((p) => p.modulo === m && p.accion === a)._id;
const roles = {};
for (const [nombre, def] of Object.entries(ROLES)) {
  const rol = await Rol.findOneAndUpdate({ nombre }, { $setOnInsert: { descripcion: def.d, activo: true } }, { upsert: true, new: true });
  roles[nombre] = rol;
  await RolPermiso.deleteMany({ id_rol: rol._id });
  await RolPermiso.insertMany(def.p.map(([m, a]) => ({ id_rol: rol._id, id_permiso: idPerm(m, a) })));
}
console.log("Roles y permisos listos");

// Tipologias y catalogo
for (const nombre of TIPOLOGIAS) await Tipologia.updateOne({ nombre }, { $setOnInsert: { activo: true } }, { upsert: true });
for (const s of SERVICIOS) await Servicio.updateOne({ nombre: s.nombre }, { $setOnInsert: { ...s, activo: true } }, { upsert: true });

// Plantilla 0039-2026V1 (logo en GridFS)
let plantilla = await Plantilla.findOne({ codigo_formato: "CAT–ST–OC–F–002", version_formato: 5 });
if (!plantilla) {
  const logoId = await guardarArchivo(fs.readFileSync(path.join(raiz, "assets/logo.png")), "logo_sena.png", "image/png", { uso: "plantilla" });
  plantilla = await Plantilla.create({
    nombre: "Oferta de servicios 0039-2026V1", tipo: "cotizacion", codigo_formato: "CAT–ST–OC–F–002", version_formato: 5, fecha_aprobacion_formato: "2025-03-25",
    estructura: { logo_id: logoId, textos: TEXTOS_0039 },
    campos_variables: ["numero_cotizacion", "version", "fecha_emision", "fecha_validez", "plazo_entrega_dias_habiles", "cliente", "items", "observaciones_propuesta", "observaciones_servicio", "elaborada_por", "nombre_aceptacion", "cc_aceptacion", "firma_aceptacion"],
  });
}

// Laboratorista administrador
const correo = (process.env.SEED_ADMIN_CORREO || "").toLowerCase().trim();
if (!correo) console.log("AVISO: defina SEED_ADMIN_CORREO en .env para crear el laboratorista administrador");
else if (!(await Usuario.exists({ correo }))) {
  const clave = process.env.SEED_ADMIN_CLAVE || generarClave(12);
  const firmaId = await guardarArchivo(fs.readFileSync(path.join(raiz, "assets/firma.png")), "firma_manuel.png", "image/png", { uso: "firma_usuario" });
  await Usuario.create({
    nombre: "Manuel Fernando Córdoba Porras", correo, cargo: "Ing. Químico, MSc / Reponsable de la Gestión Técnica y Administrativa del Laboratorio",
    id_rol: roles["Laboratorista"]._id, firma_imagen: firmaId, contrasena_hash: await bcrypt.hash(clave, 10), debe_cambiar_contrasena: false,
  });
  console.log(`Laboratorista creado: ${correo}${process.env.SEED_ADMIN_CLAVE ? "" : "  clave generada (guárdela, no se vuelve a mostrar): " + clave}`);
} else console.log("El laboratorista ya existe");

// Contador: en 2026 la primera cotizacion nueva es la 0039
const anio = hoyBogota().slice(0, 4);
await Contador.updateOne({ _id: `cotizacion-${anio}` }, { $setOnInsert: { seq: anio === "2026" ? 38 : 0 } }, { upsert: true });

// Demo opcional
if (args.includes("--demo")) {
  const admin = await Usuario.findOne({ correo });
  if (!admin) console.log("Cree primero el laboratorista (SEED_ADMIN_CORREO) para cargar la demo");
  else if (await Cotizacion.exists({ es_demo: true })) console.log("La demo ya existe");
  else {
    const d = DATOS_DEMO, tip = await Tipologia.findOne({ nombre: "Empresas" });
    const cli = await Cliente.create({ ...d.cliente, id_tipologia: tip._id, autoriza_tratamiento_datos: true });
    const sol = await Solicitud.create({ id_cliente: cli._id, descripcion_necesidad: d.necesidad });
    const { siguienteNumeroCotizacion } = await import("../services/consecutivo.js");
    const numero = await siguienteNumeroCotizacion("2026");
    const cot = await Cotizacion.create({
      id_solicitud: sol._id, id_plantilla: plantilla._id, numero_cotizacion: numero, version: 1, estado: "borrador", es_demo: true,
      fecha_emision: "2026-10-13", fecha_validez: "2026-12-31", plazo_entrega_dias_habiles: 15, elaborada_por: admin._id,
      observaciones_propuesta: TEXTOS_0039.observacion_tercerizado, observaciones_servicio: OBS_SERVICIO_TEXTO, valor_total: 387800,
    });
    const cat = await Servicio.find().lean();
    await CotizacionServicio.insertMany(d.items.map((i) => ({ ...i, id_cotizacion: cot._id, id_servicio: cat.find((s) => s.nombre === i.nombre_ensayo)._id })));
    console.log(`Demo cargada: cotización ${numero}V1 (borrador, cliente sin cuenta, no se envió ningún correo)`);
  }
}
await mongoose.disconnect();
