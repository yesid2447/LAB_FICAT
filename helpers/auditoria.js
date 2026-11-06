import { Auditoria } from "../models/seguridad.js";
import { ipDe } from "./utils.js";

/**
 * Registra una accion en Auditoria_acciones (RF-35). Nunca debe tumbar la peticion.
 * No guardar claves ni codigos en valor_anterior / valor_nuevo.
 */
export async function auditar(req, datos) {
  try {
    const u = req?.usuario;
    await Auditoria.create({
      id_usuario: u?._id ?? datos.id_usuario ?? null,
      nombre_usuario: u?.nombre ?? datos.nombre_usuario ?? "sistema",
      rol_al_momento: u?.rol_nombre ?? datos.rol_al_momento ?? null,
      canal_origen: "web",
      ip_origen: req ? ipDe(req) : null,
      ...datos,
    });
  } catch (e) {
    console.error("No se pudo escribir la auditoria:", e.message);
  }
}
