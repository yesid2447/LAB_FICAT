import jwt from "jsonwebtoken";
import { Usuario, Rol, RolPermiso } from "../models/seguridad.js";

export const COOKIE = "labficat_sesion";
export const opcionesCookie = () => ({
  httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
  maxAge: Number(process.env.JWT_HORAS || 8) * 3600 * 1000, path: "/",
});

export function firmarSesion(res, usuario) {
  const token = jwt.sign({ uid: String(usuario._id) }, process.env.JWT_SECRET, { expiresIn: `${Number(process.env.JWT_HORAS || 8)}h` });
  res.cookie(COOKIE, token, opcionesCookie());
}

const cachePermisos = new Map(); // id_rol -> { permisos:Set, hasta }
async function permisosDeRol(idRol) {
  const k = String(idRol), c = cachePermisos.get(k);
  if (c && c.hasta > Date.now()) return c.permisos;
  const rp = await RolPermiso.find({ id_rol: idRol }).populate("id_permiso").lean();
  const permisos = new Set(rp.filter((x) => x.id_permiso).map((x) => `${x.id_permiso.modulo}.${x.id_permiso.accion}`));
  cachePermisos.set(k, { permisos, hasta: Date.now() + 30000 });
  return permisos;
}
export const limpiarCachePermisos = () => cachePermisos.clear();

/** Exige sesion valida. Deja req.usuario (con rol_nombre y permisos). */
export async function validarSesion(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE];
    if (!token) return res.status(401).json({ msg: "Debe iniciar sesión" });
    const { uid } = jwt.verify(token, process.env.JWT_SECRET);
    const u = await Usuario.findById(uid);
    if (!u || !u.activo) return res.status(401).json({ msg: "Sesión no válida" });
    const rol = await Rol.findById(u.id_rol).lean();
    u.rol_nombre = rol?.nombre;
    u.permisos = await permisosDeRol(u.id_rol);
    u.esCliente = rol?.nombre === "Cliente";
    req.usuario = u;
    next();
  } catch {
    res.status(401).json({ msg: "Sesión vencida. Ingrese de nuevo" });
  }
}
