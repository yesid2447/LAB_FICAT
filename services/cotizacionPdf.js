import { Cotizacion, CotizacionServicio, Cliente, Solicitud, Plantilla, Tipologia } from "../models/negocio.js";
import { Usuario } from "../models/seguridad.js";
import { leerArchivo } from "./archivos.js";
import { htmlOferta } from "./plantilla0039.js";
import { htmlAPdf } from "./pdf.js";
import { OBS_SERVICIO_TEXTO } from "../helpers/textosPlantilla.js";

const dataUri = (buf, tipo = "image/png") => (buf ? `data:${tipo};base64,${buf.toString("base64")}` : null);

/** Carga todo lo necesario y arma el PDF de una cotizacion. Opcional: firma del cliente y datos del firmante. */
export async function generarPdfCotizacion(idCotizacion, { firmaCliente = null, acepta = null, desdeSnapshot = false } = {}) {
  const cot = await Cotizacion.findById(idCotizacion).lean();
  const items = await CotizacionServicio.find({ id_cotizacion: cot._id }).sort({ numero_item: 1 }).lean();
  const sol = await Solicitud.findById(cot.id_solicitud).lean();
  const cliente = (desdeSnapshot && cot.snapshot?.cliente) || (await Cliente.findById(sol.id_cliente).lean());
  const tip = cliente.id_tipologia ? await Tipologia.findById(cliente.id_tipologia).lean() : null;
  const plantilla = await Plantilla.findById(cot.id_plantilla).lean();
  const elab = await Usuario.findById(cot.elaborada_por).lean();
  const [logo, firmaLab] = await Promise.all([leerArchivo(plantilla.estructura.logo_id), leerArchivo(elab.firma_imagen)]);
  const [cargo1, cargo2] = String(elab.cargo || "").split("/").map((s) => s.trim());
  const html = htmlOferta({
    cot: { ...cot, observaciones_servicio: cot.observaciones_servicio === OBS_SERVICIO_TEXTO ? undefined : cot.observaciones_servicio },
    cliente, tipologia: tip?.nombre || "", items, plantilla,
    elaboro: { nombre: elab.nombre, cargo1: cargo1 || "", cargo2: cargo2 || "" },
    logo: dataUri(logo), firmaLab: dataUri(firmaLab), firmaCliente: dataUri(firmaCliente), acepta,
  });
  return htmlAPdf(html);
}
