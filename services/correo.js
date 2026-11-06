import nodemailer from "nodemailer";
import { Notificacion } from "../models/negocio.js";
import { esc } from "../helpers/utils.js";

let transporte;
const configurado = () => process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD;
function getTransporte() {
  if (!transporte) transporte = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
  return transporte;
}
export const urlSistema = (hash = "") => `${process.env.BASE_URL || "http://localhost:4500"}/${hash}`;

/** Bloque con los datos de contacto del laboratorio (van en los correos al cliente). */
const contactoLab = () => `
  <p style="color:#555;font-size:13px;margin-top:24px">Contacto del laboratorio:<br>
  ${esc(process.env.LAB_NOMBRE || "LABFICAT")}<br>
  ${esc(process.env.LAB_CORREO || "labficat@sena.edu.co")}${process.env.LAB_TELEFONO ? " · " + esc(process.env.LAB_TELEFONO) : ""}</p>`;

/**
 * Envia un correo (unico canal) y guarda una fila en Notificaciones.
 * El cuerpo es SOLO un aviso con enlace: nunca cedula, valores, resultados ni adjuntos.
 * Excepciones permitidas por diseno: clave inicial y codigos de verificacion.
 * Modo simulado si faltan GMAIL_USER / GMAIL_APP_PASSWORD (imprime en consola).
 */
export async function enviarCorreo({ para, asunto, titulo, parrafos = [], boton, tipo, id_cliente = null, id_usuario = null, tabla_referencia, id_referencia, incluirContacto = true }) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;color:#1b2a22">
    <h2 style="color:#2e7d00;margin:0 0 12px">${esc(titulo)}</h2>
    ${parrafos.map((p) => `<p style="line-height:1.5">${p}</p>`).join("")}
    ${boton ? `<p><a href="${esc(boton.url)}" style="background:#39a900;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;display:inline-block">${esc(boton.texto)}</a></p>` : ""}
    ${incluirContacto ? contactoLab() : ""}</div>`;
  const noti = { tipo, id_cliente, id_usuario, destinatario_correo: para, canal: "correo", asunto, tabla_referencia, id_referencia: id_referencia ? String(id_referencia) : undefined };
  try {
    if (!configurado()) {
      console.log(`\n[CORREO SIMULADO] Para: ${para}\nAsunto: ${asunto}\n${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")}\n${boton ? "Enlace: " + boton.url : ""}\n`);
      return await Notificacion.create({ ...noti, estado_envio: "simulado" });
    }
    await getTransporte().sendMail({
      from: `"LABFICAT SENA" <${process.env.GMAIL_USER}>`, to: para, subject: asunto, html,
      replyTo: process.env.MAIL_REPLY_TO || "labficat@sena.edu.co",
    });
    return await Notificacion.create({ ...noti, estado_envio: "enviado" });
  } catch (e) {
    console.error("Fallo el envio de correo:", e.message);
    return await Notificacion.create({ ...noti, estado_envio: "fallido", error: e.message });
  }
}
