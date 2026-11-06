import { Contador } from "../models/seguridad.js";

/**
 * Consecutivo de cotizaciones: reinicia cada ano.
 * Devuelve "0039-2026" (el sufijo V1, V2... es la version de la cotizacion).
 * En 2026 la semilla deja el contador en 38 para que el primero sea 0039.
 */
export async function siguienteNumeroCotizacion(anio) {
  const c = await Contador.findOneAndUpdate({ _id: `cotizacion-${anio}` }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `${String(c.seq).padStart(4, "0")}-${anio}`;
}
