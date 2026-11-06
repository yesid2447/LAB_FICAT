import { Router } from "express";
import multer from "multer";
import { body } from "express-validator";
import { validar } from "../middlewares/validar.js";
import { validarSesion } from "../middlewares/auth.js";
import { requierePermiso as P, validarHorario } from "../middlewares/permisos.js";
import * as auth from "../controller/auth.controller.js";
import * as cli from "../controller/cliente.controller.js";
import * as sol from "../controller/solicitud.controller.js";
import * as cot from "../controller/cotizacion.controller.js";
import * as cat from "../controller/catalogo.controller.js";
import * as est from "../controller/estado.controller.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const w = (fn) => wrap(fn);
const r = Router();

/* ---- Publico ---- */
r.post("/auth/login", body("correo").isEmail().withMessage("Correo no válido"), body("contrasena").notEmpty().withMessage("Escriba su contraseña"), validar, w(auth.login));
r.post("/auth/recuperar", body("correo").isEmail().withMessage("Correo no válido"), validar, w(auth.recuperar));
r.post("/auth/restablecer", body("correo").isEmail(), body("codigo").isLength({ min: 6, max: 6 }).withMessage("El código tiene 6 dígitos"), body("nueva").isLength({ min: 8 }).withMessage("La contraseña debe tener al menos 8 caracteres"), validar, w(auth.restablecer));

/* ---- Desde aqui todo requiere sesion ---- */
r.use(w(validarSesion));
r.post("/auth/logout", w(auth.logout));
r.get("/auth/me", w(auth.me));
r.post("/auth/cambiar-clave", body("nueva").isLength({ min: 8 }).withMessage("La contraseña debe tener al menos 8 caracteres"), validar, w(auth.cambiarClave));
r.put("/perfil", P("perfil", "editar_propio", "RF-23"), w(cli.miPerfil));
r.get("/perfil/cliente", w(cli.miCliente));

r.use(w(validarHorario));

/* Clientes (RF-12, RF-23) */
r.get("/clientes/buscar", P("clientes", "ver", "RF-12"), w(cli.buscar));
r.get("/clientes", P("clientes", "ver"), w(cli.listar));
r.get("/clientes/:id", P("clientes", "ver"), w(cli.obtener));
r.put("/clientes/:id", P("clientes", "editar", "RF-23"), w(cli.editar));
r.post("/clientes/:id/reenviar-clave", P("usuarios", "crear_cuenta", "RF-28"), w(cli.reenviarClave));

/* Solicitudes (RF-01) */
r.post("/solicitudes", P("solicitudes", "crear", "RF-01"),
  body("cedula_nit").trim().notEmpty().withMessage("Escriba la cédula o NIT"), body("nombre").trim().notEmpty().withMessage("Escriba el nombre"),
  body("correo").isEmail().withMessage("Correo no válido"), body("telefono").trim().notEmpty().withMessage("Escriba el teléfono"),
  body("descripcion_necesidad").trim().notEmpty().withMessage("Describa la necesidad"), validar, w(sol.crear));
r.get("/solicitudes", w(sol.listar));
r.get("/solicitudes/:id", w(sol.obtener));

/* Catalogos (RF-30) */
r.get("/catalogo", w(cat.servicios.listar));
r.post("/catalogo", P("catalogo", "administrar", "RF-30"), w(cat.servicios.crear));
r.put("/catalogo/:id", P("catalogo", "administrar", "RF-30"), w(cat.servicios.actualizar));
r.get("/tipologias", w(cat.tipologias.listar));
r.post("/tipologias", P("tipologias", "administrar", "RF-30"), w(cat.tipologias.crear));
r.put("/tipologias/:id", P("tipologias", "administrar", "RF-30"), w(cat.tipologias.actualizar));
r.get("/plantillas", P("plantillas", "ver"), w(cat.plantillas.listar));
r.get("/plantillas/:id", P("plantillas", "ver"), w(cat.plantillas.obtener));
r.put("/plantillas/:id", P("plantillas", "administrar", "RF-30"), w(cat.plantillas.actualizar));

/* Cotizaciones (RF-02, RF-03) */
r.get("/cotizaciones", w(cot.listar));
r.post("/cotizaciones", P("cotizaciones", "crear", "RF-02"), body("id_solicitud").isMongoId().withMessage("Solicitud no válida"), validar, w(cot.crear));
r.get("/cotizaciones/:id", w(cot.obtener));
r.get("/cotizaciones/:id/pdf", w(cot.verPdf));
r.put("/cotizaciones/:id", P("cotizaciones", "editar", "RF-02"), w(cot.actualizar));
r.post("/cotizaciones/:id/nueva-version", P("cotizaciones", "editar", "RF-02"), w(cot.nuevaVersion));
r.post("/cotizaciones/:id/enviar", P("cotizaciones", "enviar", "RF-03"), w(cot.enviar));
r.post("/cotizaciones/:id/subir-firmada", P("cotizaciones", "subir_firmada", "RF-03"), upload.single("archivo"), w(cot.subirFirmada));
r.get("/cotizaciones/:id/integridad", P("cotizaciones", "ver"), w(cot.verificarIntegridad));
r.post("/cotizaciones/:id/firma/solicitar-codigo", P("cotizaciones", "firmar", "RF-03"), w(cot.solicitarCodigo));
r.post("/cotizaciones/:id/firma/verificar-codigo", P("cotizaciones", "firmar", "RF-03"), body("codigo").isLength({ min: 6, max: 6 }).withMessage("El código tiene 6 dígitos"), validar, w(cot.verificarCodigo));
r.post("/cotizaciones/:id/firmar", P("cotizaciones", "firmar", "RF-03"), w(cot.firmar));

/* Estado, notificaciones, auditoria (RF-27, RF-35) */
r.get("/estado/mio", P("estado", "consultar_propio", "RF-27"), w(est.miEstado));
r.get("/estado/resumen", P("estado", "consultar_todo", "RF-27"), w(est.resumen));
r.get("/notificaciones", w(est.notificaciones));
r.get("/auditoria", P("auditoria", "ver", "RF-35"), w(est.auditoria));

export default r;
