// Genera docs/muestra_0039-2026V1.pdf con los datos de ejemplo de Ingrid (sin base de datos)
// para compararlo con el PDF oficial. Uso: npm run comparar-pdf [ruta_pdf_original]
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { htmlOferta } from "../services/plantilla0039.js";
import { htmlAPdf, cerrarNavegador } from "../services/pdf.js";
import { TEXTOS_0039, OBS_SERVICIO_TEXTO } from "../helpers/textosPlantilla.js";
import { DATOS_DEMO } from "./datosDemo.js";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const png = (f) => "data:image/png;base64," + fs.readFileSync(path.join(raiz, "assets", f)).toString("base64");
const d = DATOS_DEMO;
const html = htmlOferta({
  cot: { numero_cotizacion: "0039-2026", version: 1, fecha_emision: "2026-10-13", fecha_validez: "2026-12-31", plazo_entrega_dias_habiles: 15 },
  cliente: d.cliente, tipologia: "Empresas", items: d.items,
  plantilla: { codigo_formato: "CAT–ST–OC–F–002", fecha_aprobacion_formato: "2025-03-25", version_formato: 5, estructura: { textos: TEXTOS_0039 } },
  elaboro: { nombre: "Manuel Fernando Córdoba Porras", cargo1: "Ing. Químico, MSc", cargo2: "Reponsable de la Gestión Técnica y Administrativa del Laboratorio" },
  logo: png("logo.png"), firmaLab: png("firma.png"),
});
fs.mkdirSync(path.join(raiz, "docs"), { recursive: true });
const salida = path.join(raiz, "docs", "muestra_0039-2026V1.pdf");
fs.writeFileSync(salida, await htmlAPdf(html));
await cerrarNavegador();
console.log("PDF generado:", salida);
const original = process.argv[2];
if (original) {
  try {
    execSync(`pdftoppm -r 110 -png "${original}" "${raiz}/docs/original" && pdftoppm -r 110 -png "${salida}" "${raiz}/docs/generado"`);
    console.log("Imágenes en docs/: original-1.png y generado-1.png (compárelas lado a lado)");
  } catch { console.log("Instale poppler-utils (pdftoppm) para generar las imágenes de comparación."); }
}
