import { auditar } from "../helpers/auditoria.js";
import { dentroDeHorario } from "../helpers/utils.js";

/**
 * requierePermiso("cotizaciones", "enviar"): valida la accion contra Rol_permisos.
 * Si se niega, queda en Auditoria_acciones con resultado "denegado".
 */
export const requierePermiso = (modulo, accion, requerimiento) => async (req, res, next) => {
  if (req.usuario.permisos.has(`${modulo}.${accion}`)) return next();
  await auditar(req, {
    tipo_accion: `${modulo}.${accion}`, resultado: "denegado", requerimiento,
    detalle: `${req.method} ${req.originalUrl}`,
  });
  res.status(403).json({ msg: "No tiene permiso para realizar esta acción" });
};

/** Horario de uso (L-V 8-12 y 2-5). Solo aplica a personal si HORARIO_ESTRICTO=true. */
export async function validarHorario(req, res, next) {
  if (process.env.HORARIO_ESTRICTO !== "true" || req.usuario?.esCliente || req.method === "GET") return next();
  if (dentroDeHorario()) return next();
  await auditar(req, { tipo_accion: "fuera_de_horario", resultado: "denegado", detalle: `${req.method} ${req.originalUrl}` });
  res.status(403).json({ msg: "Fuera del horario de uso (lunes a viernes 8:00-12:00 y 2:00-5:00 p. m.)" });
}
