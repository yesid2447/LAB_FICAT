import { validationResult } from "express-validator";
/** Corta con 400 si alguna validacion de express-validator fallo. */
export function validar(req, res, next) {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(400).json({ msg: e.array()[0].msg, errores: e.array() });
  next();
}
