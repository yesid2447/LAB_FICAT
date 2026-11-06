import crypto from "crypto";

export const ipDe = (req) => (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").toString().split(",")[0].trim();
export const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Fecha AAAA-MM-DD en hora de Colombia. */
export function hoyBogota(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export const fmtMoneda = (n) => "$ " + Math.round(Number(n) || 0).toLocaleString("es-CO");
export const fmtCant = (n) => Number(n).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Clave inicial generada por el sistema (sin caracteres ambiguos). */
export function generarClave(largo = 10) {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(largo), (b) => a[b % a.length]).join("");
}
export const generarCodigo6 = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");
export const hashCodigo = (codigo, id) => sha256(`${id}:${codigo}:${process.env.JWT_SECRET || ""}`);

/** Horario de uso: lunes a viernes 08:00-12:00 y 14:00-17:00 (Colombia). */
export function dentroDeHorario(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t) => p.find((x) => x.type === t).value;
  if (["Sat", "Sun"].includes(g("weekday"))) return false;
  const m = (Number(g("hour")) % 24) * 60 + Number(g("minute"));
  return (m >= 480 && m < 720) || (m >= 840 && m < 1020);
}
