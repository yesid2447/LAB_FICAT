# LABFICAT · Sistema de Gestión de Clientes y Servicio Analítico
**Fase 1: RF-01 a RF-03** (hasta justo antes del rombo «¿Cliente firma?»). Node + Express + Mongoose + MongoDB Atlas. Frontend estático en `public/`.

## Puesta en marcha
```bash
npm install
cp .env.example .env      # complete MONGO_URL, JWT_SECRET (16+ caracteres), SEED_ADMIN_CORREO y, opcional, SEED_ADMIN_CLAVE y Gmail
npm run seed              # roles, permisos, laboratorista, tipologías, catálogo (5 ensayos), plantilla 0039-2026V1, contador
npm run seed:demo         # (opcional) crea la cotización demo 0039-2026V1 de Ingrid como borrador, sin enviar correos
npm start                 # http://localhost:4500
```
- Si no define `SEED_ADMIN_CLAVE`, el seed genera una y la muestra **una sola vez**.
- Sin `GMAIL_USER`/`GMAIL_APP_PASSWORD` el correo funciona en **modo simulado**: se guarda en `Notificaciones` (estado «simulado») y se imprime en la consola (ahí verá el código de 6 dígitos para probar la firma).
- **PDF:** usa Puppeteer + Chromium. En su equipo `npm install` lo descarga. En servidor use el `Dockerfile` incluido (Render/Railway con Docker, VPS ≥ 1 GB). No sirve en Vercel/Netlify.
- Nunca suba `.env`. La clave de Atlas que se expuso antes debe rotarse (usted decidió hacerlo al final: no lo olvide).

## Lo que hace cada actor
**Laboratorista (o su compañero)** — entra con correo y contraseña:
1. **RF-01/RF-12** *Nueva solicitud*: escribe la cédula/NIT y pulsa Buscar. Si existe, se precargan datos e historial (no se duplica). Si no, completa los datos, tipología SENOVA y la autorización de datos (Habeas Data). Se crea el cliente, su **cuenta** (clave inicial generada por el sistema, visible para él y enviada al cliente por correo) y la solicitud «en trámite».
2. **RF-02** *Crear cotización*: elige ensayos del catálogo (precio, método y técnica se copian y quedan congelados), cantidades, varios ítems/muestras, validez, plazo y observaciones. Puede **editar todo** mientras es borrador, con vista previa del PDF idéntico a la plantilla 0039-2026V1.
3. **RF-03** *Confirmar y enviar*: el sistema genera el PDF, guarda la copia fija (snapshot) y manda un correo-aviso con enlace y sus datos de contacto. Estado «enviada».
4. Aceptación: si el cliente firma en la página, queda «firmada». Si acepta en persona u otro medio (incluido el cliente que responde por WhatsApp por su cuenta), el laboratorista **sube el PDF firmado** y elige el medio.
5. Modificar una cotización enviada crea la **versión V2, V3…** (la anterior queda «reemplazada»). Los consecutivos reinician cada año.
6. También administra catálogos (RF-30), corrige clientes (RF-23), reenvía claves y consulta **Auditoría** y **Correos enviados**.

**Cliente** — entra con su correo y la clave recibida (puede cambiarla o recuperarla con código por correo):
1. Recibe el correo-aviso (solo enlace, sin cédula ni valores).
2. **Mi estado** (RF-27) y **Mis cotizaciones**: abre el PDF.
3. **Firmar**: pide código → llega por correo (6 dígitos, vence en 10 min, 3 intentos) → verifica → dibuja la firma (signature_pad) → confirma nombre y C.C. → acepta. El servidor incrusta la firma en el PDF, calcula el **SHA-256** y guarda `pdf_firmado`, firmante, fecha/hora, IP, dispositivo y huella. Todo queda en Auditoría.
4. Edita su perfil (RF-23). Firma electrónica simple (Ley 527/1999, Decreto 2364/2012): **el área jurídica del SENA debe confirmarlo.**

## Estructura (basada en backend_prueba)
`models/` · `controller/` · `routes/index.js` · `middlewares/` (sesión, permisos, horario, validar) · `services/` (correo, PDF, plantilla, consecutivo, GridFS, cuentas) · `helpers/` · `scripts/seed.js` · `public/`.
Sesión: JWT en cookie `httpOnly` (`secure` en producción, `sameSite=lax`). Contraseñas con bcrypt; bloqueo tras 5 intentos fallidos por 15 min.

## Colecciones y campos que NO están en el modelo (decisiones a revisar)
- **Contadores** y **Codigos_verificacion** (técnicas; códigos con hash y vencen solos por TTL). Archivos en GridFS (`archivos.files/.chunks`).
- `Cotizaciones`: se agregaron `snapshot`, `pdf_enviado`, `hash_pdf`, `dispositivo`, `es_demo`; estado extra `reemplazada`. `numero_cotizacion` guarda `0039-2026` y `version` el número (V1 = 1).
- `Notificaciones`: se agregaron `asunto` y `error`; se quitó `id_grupo_envio`. `Clientes`: `autoriza_tratamiento_datos`. `Auditoria_acciones`: se mantienen `accion` y `detalle`.
- **Horario** (L–V 8–12 y 2–5, hora Colombia): se aplica a las escrituras del personal solo con `HORARIO_ESTRICTO=true` (apagado por defecto para poder probar).

## Consecutivo
`npm run seed` deja el contador de 2026 en 38 → la primera cotización es la **0039**. `seed:demo` la usa para el ejemplo de Ingrid, así que la siguiente real sale **0040**. Sin demo, la primera real será 0039-2026V1.

## Comparación del PDF con el original
`docs/comparacion_lado_a_lado.png` (izquierda original, derecha generado) y `docs/muestra_0039-2026V1.pdf`. Se regenera con `npm run comparar-pdf /ruta/0039-2026V1.pdf` (no necesita base de datos). El diseño y los textos son idénticos, incluidas sus particularidades («Reponsable», «Hidròlisis», menciones a WhatsApp, pago antes del informe). Diferencias menores: tipografía de reemplazo (Carlito en lugar de Calibri) y pequeñas variaciones de altura de filas. `docs/ejemplo_firmada.pdf` muestra una cotización de 2 ítems firmada digitalmente.

## Pruebas
Con el servidor y una base local corriendo: `E2E_LOG=/ruta/log_del_servidor node scripts/e2e.mjs` (flujo completo: 32 verificaciones; usa los datos del seed).

## Pendiente para la fase 2 (desde «¿Cliente firma?»)
RF-20/RF-21 (sin continuar y seguimiento), RF-04 (interno/externo), RF-05 a RF-08 (cupones, pagos, semáforo, alertas diarias, Pagos_alternativos), RF-32/33/34, RF-24 y de ahí en adelante (muestras, análisis, informes, reclamaciones). Tareas diarias (cron) para avisos. Tablas aún sin crear: Cupones, Pagos, Pagos_alternativos, Muestras y siguientes.

## Contradicciones y puntos abiertos
1. El PDF oficial dice «pago antes del informe» y menciona WhatsApp; se dejó idéntico y **manda la regla del sistema** (sin pago confirmado no hay recepción ni análisis para externos).
2. Las **12 tipologías SENOVA** no aparecen en los documentos: el seed trae una lista **provisional** (solo «Empresas» está confirmada por el PDF). Reemplácela desde Catálogos.
3. El prompt decía horario 8–6; se aplicó el que usted confirmó (8–12 y 2–5).
4. Los documentos (.md, recorrido, diagrama) aún mencionan tres canales; conviene actualizarlos a «solo correo».
5. Los ZIP de OneDrive (F-001/F-002/F-003) y los .docx no se usaron: son de fases posteriores.
