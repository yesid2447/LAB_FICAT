// Frontend estático de LABFICAT (fase 1: RF-01 a RF-03). Sin framework: rutas por hash.
const $ = (s, r = document) => r.querySelector(s);
const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "$ " + Math.round(Number(n) || 0).toLocaleString("es-CO");
const fecha = (d) => (d ? new Date(d).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" }) : "—");
const app = $("#app");
let yo = null; // usuario en sesión

async function api(url, { method = "GET", body, form } = {}) {
  const r = await fetch("/api" + url, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : {}, body: form || (body ? JSON.stringify(body) : undefined) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401 && yo) { yo = null; location.hash = "#/login"; } throw new Error(j.msg || "Error inesperado"); }
  return j;
}
function avisar(msg, tipo = "") { const d = document.createElement("div"); d.className = tipo; d.textContent = msg; $("#aviso").append(d); setTimeout(() => d.remove(), tipo ? 7000 : 4500); }
const act = async (btn, fn) => { btn.disabled = true; try { await fn(); } catch (x) { avisar(x.message, "error"); } finally { btn.disabled = false; } };
const eti = (s) => `<span class="etiqueta ${e(s)}">${e(s)}</span>`;
const esPersonal = () => yo && yo.rol !== "Cliente";
const can = (p) => yo?.permisos?.includes(p);

/* ---------- Estructura general ---------- */
function marco(activo, html) {
  const nav = esPersonal()
    ? [["#/solicitudes", "Solicitudes"], ["#/nueva-solicitud", "Nueva solicitud"], ["#/clientes", "Clientes"], ["#/catalogo", "Catálogos"], ["#/notificaciones", "Correos enviados"], ...(can("auditoria.ver") ? [["#/auditoria", "Auditoría"]] : []), ["#/perfil", "Mi perfil"]]
    : [["#/estado", "Mi estado"], ["#/mis-cotizaciones", "Mis cotizaciones"], ["#/perfil", "Mi perfil"]];
  const links = nav.map(([h, t]) => `<a href="${h}" class="${activo === h ? "activo" : ""}">${t}</a>`).join("");
  const salir = `<button id="salir" class="chico">Cerrar sesión</button>`;
  app.innerHTML = esPersonal()
    ? `<div class="estructura"><aside class="lateral"><div class="marca"><i></i>LABFICAT</div>${links}<div class="pie">${e(yo.nombre)}<br>${e(yo.rol)}<br>${salir}</div></aside><main class="contenido">${html}</main></div>`
    : `<header class="cliente-barra"><div class="marca"><i></i>LABFICAT</div>${links}<span class="esp"></span><span class="mini" style="color:#cfdccb">${e(yo.nombre)}</span>${salir}</header><main class="contenido">${html}</main>`;
  $("#salir").onclick = async () => { await api("/auth/logout", { method: "POST" }).catch(() => {}); yo = null; location.hash = "#/login"; };
}

/* ---------- Acceso ---------- */
function vistaLogin() {
  app.innerHTML = `<div class="login"><form class="tarjeta" id="f"><div class="marca" style="color:var(--tinta)"><i></i>LABFICAT</div><h1>Ingresar</h1>
    <p class="mini">Laboratorio de Caracterización Fisicoquímica de Alimentos · SENA San Gil</p>
    <label for="c">Correo</label><input id="c" type="email" autocomplete="username" required>
    <label for="p" style="margin-top:.7rem">Contraseña</label><input id="p" type="password" autocomplete="current-password" required>
    <div class="acciones" style="margin-top:1rem"><button class="primario" id="b">Ingresar</button><a href="#/recuperar" class="boton">Olvidé mi contraseña</a></div></form></div>`;
  $("#f").onsubmit = (ev) => { ev.preventDefault(); act($("#b"), async () => { await api("/auth/login", { method: "POST", body: { correo: $("#c").value, contrasena: $("#p").value } }); await cargarYo(); location.hash = esPersonal() ? "#/solicitudes" : "#/estado"; }); };
}
function vistaRecuperar() {
  app.innerHTML = `<div class="login"><div class="tarjeta"><h1>Recuperar contraseña</h1><form id="f1"><label>Correo de su cuenta</label><input id="c" type="email" required>
    <div class="acciones" style="margin-top:.8rem"><button class="primario" id="b1">Enviarme un código</button><a class="boton" href="#/login">Volver</a></div></form>
    <form id="f2" hidden style="margin-top:1rem"><div class="ok">Si el correo está registrado, le enviamos un código de 6 dígitos. Vence en 10 minutos.</div><label>Código</label><input id="k" inputmode="numeric" maxlength="6" required>
    <label style="margin-top:.6rem">Contraseña nueva (mínimo 8 caracteres)</label><input id="n" type="password" minlength="8" autocomplete="new-password" required><button class="primario" id="b2" style="margin-top:.8rem">Cambiar contraseña</button></form></div></div>`;
  $("#f1").onsubmit = (ev) => { ev.preventDefault(); act($("#b1"), async () => { await api("/auth/recuperar", { method: "POST", body: { correo: $("#c").value } }); $("#f2").hidden = false; }); };
  $("#f2").onsubmit = (ev) => { ev.preventDefault(); act($("#b2"), async () => { await api("/auth/restablecer", { method: "POST", body: { correo: $("#c").value, codigo: $("#k").value, nueva: $("#n").value } }); avisar("Contraseña cambiada. Ya puede ingresar"); location.hash = "#/login"; }); };
}

/* ---------- Solicitudes (RF-01 / RF-12) ---------- */
async function vistaSolicitudes() {
  const [lista, res] = await Promise.all([api("/solicitudes"), api("/estado/resumen").catch(() => null)]);
  const c = res?.cotizaciones || {};
  marco("#/solicitudes", `<div class="cab"><h1>Solicitudes</h1><a class="boton primario" href="#/nueva-solicitud">Nueva solicitud</a></div>
   ${res ? `<p class="mini">Cotizaciones: ${c.borrador || 0} en borrador · ${c.enviada || 0} enviadas · ${c.firmada || 0} firmadas · ${res.clientes} clientes</p>` : ""}
   ${lista.length ? `<div class="tarjeta tabla-scroll"><table><thead><tr><th>Fecha</th><th>Cliente</th><th>Necesidad</th><th>Estado</th><th>Cotización</th><th></th></tr></thead><tbody>
   ${lista.map((s) => { const cot = s.cotizaciones.at(-1); return `<tr><td>${fecha(s.fecha_creacion)}</td><td>${e(s.id_cliente?.nombre)}<div class="mini">${e(s.id_cliente?.cedula_nit)}</div></td><td>${e(s.descripcion_necesidad)}</td><td>${eti(s.estado_flujo)}</td>
   <td>${cot ? `<a href="#/cotizacion/${cot._id}">${e(cot.numero_cotizacion)}V${cot.version}</a> ${eti(cot.estado)}` : "—"}</td>
   <td>${cot ? "" : can("cotizaciones.crear") ? `<a class="boton chico" href="#/cotizacion-nueva/${s._id}">Crear cotización</a>` : ""}</td></tr>`; }).join("")}</tbody></table></div>`
   : `<div class="vacio">Aún no hay solicitudes. Registre la primera cuando un cliente contacte al laboratorio.</div>`}`);
}

async function vistaNuevaSolicitud() {
  const tips = await api("/tipologias?activo=true");
  marco("#/nueva-solicitud", `<h1>Nueva solicitud</h1><p class="mini">Escriba primero la cédula o NIT: si el cliente ya existe, se cargan sus datos y su historial.</p>
  <form id="f" class="tarjeta"><div class="rejilla">
   <div><label>Cédula / NIT *</label><div class="acciones" style="flex-wrap:nowrap"><input name="cedula_nit" required><button type="button" id="buscar">Buscar</button></div></div>
   <div><label>Nombre o razón social *</label><input name="nombre" required></div>
   <div><label>Correo *</label><input name="correo" type="email" required></div>
   <div><label>Teléfono / celular *</label><input name="telefono" required></div>
   <div><label>Tipo de usuario</label><select name="tipo_usuario"><option value="externo">Externo (paga)</option><option value="interno">Interno (aprendiz o instructor)</option></select></div>
   <div><label>Tipología SENOVA</label><select name="id_tipologia"><option value="">Seleccione…</option>${tips.map((t) => `<option value="${t._id}">${e(t.nombre)}</option>`).join("")}</select></div>
   <div><label>Tipo de persona</label><select name="tipo_persona"><option value="natural">Natural</option><option value="juridica">Jurídica</option></select></div>
   <div><label>Persona de contacto</label><input name="nombre_contacto"></div><div><label>Cargo</label><input name="cargo"></div>
   <div><label>Dirección</label><input name="direccion"></div><div><label>Ciudad</label><input name="ciudad"></div><div><label>Departamento</label><input name="departamento"></div>
   <div class="ancho"><label>Necesidad del cliente *</label><textarea name="descripcion_necesidad" required></textarea></div>
   <div class="ancho" id="habeas"><label style="display:flex;gap:.5rem;align-items:flex-start;color:var(--tinta)"><input type="checkbox" name="autoriza" style="width:auto;margin-top:.25rem"> El cliente autoriza el tratamiento de sus datos personales (Ley 1581 de 2012).</label></div>
  </div><div id="hist"></div><div class="acciones" style="margin-top:1rem"><button class="primario" id="b">Registrar solicitud</button></div></form><div id="res"></div>`);
  const f = $("#f"), v = (n) => f.elements[n];
  $("#buscar").onclick = (ev) => act(ev.target, async () => {
    const r = await api("/clientes/buscar?cedula_nit=" + encodeURIComponent(v("cedula_nit").value.trim()));
    if (!r.existe) { $("#hist").innerHTML = `<div class="nota">No existe un cliente con ese documento. Se creará uno nuevo con su cuenta.</div>`; $("#habeas").hidden = false; return; }
    ["nombre", "correo", "telefono", "tipo_usuario", "id_tipologia", "tipo_persona", "nombre_contacto", "cargo", "direccion", "ciudad", "departamento"].forEach((k) => { if (v(k)) v(k).value = r.cliente[k] ?? ""; });
    $("#habeas").hidden = true;
    $("#hist").innerHTML = `<div class="ok"><b>Cliente existente:</b> se cargaron sus datos (no se duplica). ${r.tiene_cuenta ? "Ya tiene cuenta." : "Aún no tiene cuenta: se creará."}</div>
      ${r.historial.cotizaciones.length ? `<p class="mini">Historial: ${r.historial.cotizaciones.map((c) => `${e(c.numero_cotizacion)}V${c.version} (${e(c.estado)})`).join(" · ")}</p>` : `<p class="mini">Sin cotizaciones anteriores.</p>`}`;
  });
  f.onsubmit = (ev) => { ev.preventDefault(); act($("#b"), async () => {
    const b = Object.fromEntries(new FormData(f)); b.autoriza_tratamiento_datos = f.elements.autoriza.checked; delete b.autoriza; if (!b.id_tipologia) delete b.id_tipologia;
    const r = await api("/solicitudes", { method: "POST", body: b });
    $("#res").innerHTML = `<div class="tarjeta"><h2>Solicitud registrada</h2><p>${r.cliente_nuevo ? "Se creó el cliente nuevo." : "Se usó el cliente existente."} Estado: ${eti("en tramite")}</p>
      ${r.clave_inicial ? `<div class="nota">Cuenta creada. La clave inicial se envió al correo del cliente. Clave: <span class="clave">${e(r.clave_inicial)}</span></div>` : ""}
      <div class="acciones"><a class="boton primario" href="#/cotizacion-nueva/${r.solicitud._id}">Crear la cotización</a><a class="boton" href="#/solicitudes">Ver solicitudes</a></div></div>`;
    f.hidden = true; $("#res").scrollIntoView({ behavior: "smooth" });
  }); };
}

/* ---------- Editor de cotización (RF-02) ---------- */
async function editorCotizacion({ cotId, solicitudId }) {
  const [catalogo, cot] = await Promise.all([api("/catalogo?activo=true"), cotId ? api("/cotizaciones/" + cotId) : null]);
  const sol = cot ? cot.solicitud : await api("/solicitudes/" + solicitudId);
  const cli = cot ? sol.id_cliente : sol.id_cliente;
  const S = { items: cot ? cot.items.map((i) => ({ ...i })) : [{ numero_item: 1, descripcion_item: "Descripción de la muestra a ensayar", id_servicio: "", cantidad: 1, precio_unitario: "" }],
    fecha_validez: cot?.fecha_validez || `${new Date().getFullYear()}-12-31`, plazo: cot?.plazo_entrega_dias_habiles || 15, op: cot?.observaciones_propuesta ?? "", os: cot?.observaciones_servicio ?? "" };
  const titulo = cot ? `<span class="numero-cot">${e(cot.etiqueta)}</span> ${eti(cot.estado)}` : `<h1>Nueva cotización</h1>`;
  marco("#/solicitudes", `<div class="cab"><div>${titulo}<div class="mini">${e(cli.nombre)} · ${e(cli.cedula_nit)} · ${e(cli.correo)}</div></div><div class="acciones"><a class="boton" href="#/solicitudes">Volver</a></div></div>
   <div class="nota">Plantilla 0039-2026V1 (formato CAT–ST–OC–F–002 v5). Puede editar todos los campos antes de enviar. Los textos fijos del formato no cambian.</div>
   <div class="tarjeta"><div class="rejilla"><div><label>Validez de la oferta</label><input type="date" id="fv" value="${e(S.fecha_validez)}"></div>
   <div><label>Entrega de resultados (días hábiles)</label><input type="number" min="1" id="pl" value="${S.plazo}"></div></div></div>
   <div id="items"></div>
   <div class="tarjeta"><div class="rejilla"><div class="ancho"><label>Observaciones de la propuesta técnica y económica</label><textarea id="op" placeholder="Si lo deja vacío se usa el texto estándar (tercerizados)">${e(S.op)}</textarea></div>
   <div class="ancho"><label>Observaciones del servicio (una por línea)</label><textarea id="os" style="min-height:8rem" placeholder="Si lo deja vacío se usa el texto estándar">${e(S.os)}</textarea></div></div></div>
   <div class="acciones"><button id="guardar" class="primario">${cot ? "Guardar cambios" : "Crear borrador"}</button>${cot ? `<button id="vista">Actualizar vista previa</button><button id="enviar" class="primario">Confirmar y enviar al cliente</button>` : ""}</div>
   ${cot ? `<h2 style="margin-top:1.5rem">Vista previa del PDF</h2><iframe class="vista-pdf" id="pdf" title="Vista previa de la cotización" src="/api/cotizaciones/${cot._id}/pdf"></iframe>` : ""}`);

  const pintar = () => {
    const grupos = {}; S.items.forEach((it, i) => (grupos[it.numero_item] ||= []).push([it, i]));
    const total = S.items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0), 0);
    $("#items").innerHTML = Object.keys(grupos).map(Number).sort((a, b) => a - b).map((n) => `<div class="bloque-item"><div class="cab" style="margin-bottom:.5rem"><h3>Ítem ${n}</h3><div class="acciones"><button class="chico" data-act="addEns" data-n="${n}">Agregar ensayo</button>${Object.keys(grupos).length > 1 ? `<button class="chico peligro" data-act="delItem" data-n="${n}">Quitar ítem</button>` : ""}</div></div>
      <label>Descripción de la muestra a ensayar</label><input data-g="${n}" data-k="descripcion_item" value="${e(grupos[n][0][0].descripcion_item)}">
      <div class="tabla-scroll"><table style="margin-top:.6rem;min-width:900px"><thead><tr><th>Ensayo</th><th>Código ref.</th><th>Método</th><th>Técnica</th><th class="num">Cant.</th><th class="num">Valor unitario</th><th class="num">Costo</th><th></th></tr></thead><tbody>
      ${grupos[n].map(([it, i]) => `<tr><td><select data-i="${i}" data-sel>${`<option value="">Seleccione…</option>` + catalogo.map((c) => `<option value="${c._id}" ${String(it.id_servicio?._id || it.id_servicio) === c._id ? "selected" : ""}>${e(c.nombre)}${c.tercerizado ? " **" : ""}</option>`).join("")}</select></td>
      <td><input data-i="${i}" data-k="codigo_referencia" value="${e(it.codigo_referencia ?? "")}" style="width:70px"></td><td><input data-i="${i}" data-k="metodo" value="${e(it.metodo ?? "")}"></td><td><input data-i="${i}" data-k="tecnica" value="${e(it.tecnica ?? "")}"></td>
      <td class="num"><input data-i="${i}" data-k="cantidad" type="number" min="0" step="any" value="${it.cantidad}" style="width:80px"></td><td class="num"><input data-i="${i}" data-k="precio_unitario" type="number" min="0" step="any" value="${it.precio_unitario}" style="width:110px"></td>
      <td class="num" id="c${i}">${money((Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0))}</td><td><button class="chico peligro" data-act="delEns" data-i="${i}" aria-label="Quitar ensayo">✕</button></td></tr>`).join("")}</tbody></table></div></div>`).join("")
      + `<div class="acciones"><button data-act="addItem">Agregar otro ítem (otra muestra)</button></div><div class="total-linea"><span>Total</span><b id="tot">${money(total)}</b></div>`;
  };
  const recalc = () => { S.items.forEach((it, i) => { const c = $("#c" + i); if (c) c.textContent = money((Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0)); }); $("#tot").textContent = money(S.items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0), 0)); };
  pintar();
  const cont = $("#items");
  cont.addEventListener("input", (ev) => { const t = ev.target;
    if (t.dataset.g) S.items.filter((i) => i.numero_item == t.dataset.g).forEach((i) => (i.descripcion_item = t.value));
    else if (t.dataset.k) { S.items[t.dataset.i][t.dataset.k] = t.value; recalc(); } });
  cont.addEventListener("change", (ev) => { const t = ev.target; if (t.dataset.sel === undefined) return;
    const c = catalogo.find((x) => x._id === t.value), it = S.items[t.dataset.i]; it.id_servicio = t.value;
    if (c) Object.assign(it, { codigo_referencia: c.codigo_referencia, metodo: c.metodologia, tecnica: c.tecnica, precio_unitario: c.precio, unidad: c.unidad }); pintar(); });
  cont.addEventListener("click", (ev) => { const b = ev.target.closest("[data-act]"); if (!b) return; const a = b.dataset.act, n = Number(b.dataset.n);
    if (a === "addEns") S.items.push({ numero_item: n, descripcion_item: S.items.find((i) => i.numero_item === n).descripcion_item, id_servicio: "", cantidad: 1, precio_unitario: "" });
    if (a === "delEns") S.items.splice(b.dataset.i, 1);
    if (a === "delItem") S.items = S.items.filter((i) => i.numero_item !== n);
    if (a === "addItem") S.items.push({ numero_item: Math.max(...S.items.map((i) => i.numero_item)) + 1, descripcion_item: "Descripción de la muestra a ensayar", id_servicio: "", cantidad: 1, precio_unitario: "" });
    if (!S.items.length) S.items.push({ numero_item: 1, descripcion_item: "Descripción de la muestra a ensayar", id_servicio: "", cantidad: 1, precio_unitario: "" });
    pintar(); });

  const guardar = async () => {
    const body = { fecha_validez: $("#fv").value, plazo_entrega_dias_habiles: $("#pl").value,
      items: S.items.map((i) => ({ numero_item: i.numero_item, descripcion_item: i.descripcion_item, id_servicio: i.id_servicio?._id || i.id_servicio, cantidad: i.cantidad, precio_unitario: i.precio_unitario, metodo: i.metodo, tecnica: i.tecnica, codigo_referencia: i.codigo_referencia, unidad: i.unidad })) };
    if ($("#op").value.trim()) body.observaciones_propuesta = $("#op").value; if ($("#os").value.trim()) body.observaciones_servicio = $("#os").value;
    if (S.items.some((i) => !i.id_servicio)) throw new Error("Elija el ensayo en todas las filas");
    return cot ? api("/cotizaciones/" + cot._id, { method: "PUT", body }) : api("/cotizaciones", { method: "POST", body: { ...body, id_solicitud: solicitudId } });
  };
  $("#guardar").onclick = (ev) => act(ev.target, async () => { const r = await guardar(); avisar("Guardado"); if (!cot) location.hash = "#/cotizacion/" + r._id; else $("#pdf").src = `/api/cotizaciones/${cot._id}/pdf?t=${Date.now()}`; });
  if (cot) {
    $("#vista").onclick = (ev) => act(ev.target, async () => { await guardar(); $("#pdf").src = `/api/cotizaciones/${cot._id}/pdf?t=${Date.now()}`; });
    $("#enviar").onclick = (ev) => act(ev.target, async () => {
      if (!confirm(`¿Enviar la cotización ${cot.etiqueta} a ${cli.correo}? Después de enviarla solo se puede modificar creando una versión nueva.`)) return;
      await guardar(); const r = await api(`/cotizaciones/${cot._id}/enviar`, { method: "POST" });
      avisar(r.msg, r.correo === "fallido" ? "error" : ""); if (r.clave_inicial) alert("Se creó la cuenta del cliente. Clave inicial: " + r.clave_inicial); location.hash = "#/cotizacion/" + cot._id + "?r=" + Date.now();
    });
  }
}

/* ---------- Detalle de cotización (RF-03) ---------- */
async function vistaCotizacion(id) {
  const cot = await api("/cotizaciones/" + id);
  if (esPersonal() && cot.estado === "borrador") return editorCotizacion({ cotId: id });
  const cli = cot.solicitud.id_cliente, pers = esPersonal();
  const pasos = ["Borrador", "Enviada", "Firmada"], idx = { borrador: 0, enviada: 1, firmada: 2, reemplazada: 1 }[cot.estado];
  marco(pers ? "#/solicitudes" : "#/mis-cotizaciones", `<div class="cab"><div><span class="numero-cot">${e(cot.etiqueta)}</span> ${eti(cot.estado)}<div class="mini">${e(cli.nombre)} · Valor total ${money(cot.valor_total)} · Válida hasta ${e(cot.fecha_validez)}</div></div>
   <div class="acciones"><a class="boton" href="${pers ? "#/solicitudes" : "#/mis-cotizaciones"}">Volver</a><a class="boton" href="/api/cotizaciones/${cot._id}/pdf" target="_blank" rel="noopener">Abrir PDF</a></div></div>
   <div class="pasos">${pasos.map((p, i) => `<span class="${i < idx ? "hecho" : i === idx ? "ahora" : ""}">${p}</span>`).join("")}</div>
   ${cot.estado === "reemplazada" ? `<div class="nota">Esta versión fue reemplazada por una más reciente.</div>` : ""}
   <div id="panel"></div><iframe class="vista-pdf" title="Cotización ${e(cot.etiqueta)}" src="/api/cotizaciones/${cot._id}/pdf"></iframe>`);
  const panel = $("#panel");
  if (cot.estado === "firmada") panel.innerHTML = `<div class="ok">Firmada ${cot.medio_aceptacion === "digital" ? "digitalmente" : "(" + e(cot.medio_aceptacion) + ")"} el ${fecha(cot.fecha_hora_firma || cot.fecha_subida)}${cot.nombre_firmante ? " por " + e(cot.nombre_firmante) : ""}.
    ${pers ? `<div class="mini">Huella SHA-256: ${e(cot.hash_pdf)} <button class="chico" id="integ">Verificar integridad</button></div>` : ""}</div>`;
  if (pers && cot.estado === "firmada") $("#integ").onclick = (ev) => act(ev.target, async () => { const r = await api(`/cotizaciones/${cot._id}/integridad`); avisar(r.integro ? "El PDF guardado no ha sido alterado" : "¡La huella no coincide!", r.integro ? "" : "error"); });
  if (pers && cot.estado === "enviada") {
    panel.innerHTML = `<div class="tarjeta"><div class="cab" style="margin-bottom:.5rem"><h2>Esperando la firma del cliente</h2><button id="nv">Modificar (crea versión nueva)</button></div>
      <p class="mini">Enviada el ${fecha(cot.fecha_envio)}. Si el cliente aceptó en persona u otro medio (por ejemplo respondió por WhatsApp), suba aquí la cotización firmada.</p>
      <form id="up" class="rejilla"><div><label>Medio de aceptación</label><select name="medio_aceptacion"><option value="presencial">Presencial</option><option value="whatsapp">WhatsApp (el cliente respondió por su cuenta)</option><option value="correo">Correo</option><option value="otro">Otro</option></select></div>
      <div><label>PDF firmado (máx. 10 MB)</label><input type="file" name="archivo" accept="application/pdf" required></div><div><label>Nombre de quien firma (opcional)</label><input name="nombre_firmante"></div><div><label>C.C. de quien firma (opcional)</label><input name="cc_firmante"></div>
      <div class="ancho"><button class="primario" id="bu">Registrar cotización firmada</button></div></form></div>`;
    $("#nv").onclick = (ev) => act(ev.target, async () => { const r = await api(`/cotizaciones/${cot._id}/nueva-version`, { method: "POST" }); location.hash = "#/cotizacion/" + r._id; });
    $("#up").onsubmit = (ev) => { ev.preventDefault(); act($("#bu"), async () => { await api(`/cotizaciones/${cot._id}/subir-firmada`, { method: "POST", form: new FormData(ev.target) }); avisar("Firma registrada"); vistaCotizacion(id); }); };
  }
  if (!pers && cot.estado === "enviada") panelFirma(cot, cli);
}

function panelFirma(cot, cli) {
  const p = $("#panel");
  p.innerHTML = `<div class="tarjeta"><h2>Firmar esta cotización</h2><p class="mini">Revise el PDF. Para firmar le enviaremos un código de 6 dígitos a su correo (vence en 10 minutos, 3 intentos).</p><div id="paso"></div></div>`;
  const paso = $("#paso");
  const p1 = () => { paso.innerHTML = `<button class="primario" id="pedir">Enviarme el código por correo</button>`; $("#pedir").onclick = (ev) => act(ev.target, async () => { const r = await api(`/cotizaciones/${cot._id}/firma/solicitar-codigo`, { method: "POST" }); avisar(r.msg); p2(); }); };
  const p2 = () => { paso.innerHTML = `<form id="fc" class="rejilla" style="align-items:end"><div><label>Código de 6 dígitos</label><input id="cod" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required></div><div class="acciones"><button class="primario" id="vc">Verificar</button><button type="button" id="otro">Pedir otro código</button></div></form>`;
    $("#fc").onsubmit = (ev) => { ev.preventDefault(); act($("#vc"), async () => { await api(`/cotizaciones/${cot._id}/firma/verificar-codigo`, { method: "POST", body: { codigo: $("#cod").value } }); p3(); }); }; $("#otro").onclick = (ev) => act(ev.target, async () => { const r = await api(`/cotizaciones/${cot._id}/firma/solicitar-codigo`, { method: "POST" }); avisar(r.msg); }); };
  const p3 = () => {
    paso.innerHTML = `<div class="ok">Código verificado. Tiene 15 minutos para firmar.</div><form id="ff"><label>Dibuje su firma</label><div class="firma-caja"><canvas id="cv" aria-label="Espacio para dibujar su firma"></canvas></div>
      <div class="acciones" style="margin:.4rem 0 .8rem"><button type="button" class="chico" id="limpiar">Borrar firma</button></div>
      <div class="rejilla"><div><label>Nombre completo</label><input id="nom" value="${e(cli.nombre)}" required minlength="3"></div><div><label>C.C. o NIT</label><input id="cc" value="${e(cli.cedula_nit)}" required></div></div>
      <label style="display:flex;gap:.5rem;align-items:flex-start;color:var(--tinta);margin:.8rem 0"><input type="checkbox" id="acepta" style="width:auto;margin-top:.25rem" required> Acepto las condiciones del servicio descritas en la oferta y sus anexos.</label><button class="primario" id="fb">Firmar cotización</button></form>`;
    const cv = $("#cv"), r = Math.max(window.devicePixelRatio || 1, 1); cv.width = cv.offsetWidth * r; cv.height = 190 * r; cv.getContext("2d").scale(r, r);
    if (!window.SignaturePad) { avisar("No se pudo cargar el módulo de firma. Revise su conexión e intente de nuevo.", "error"); return; }
    const sp = new window.SignaturePad(cv, { penColor: "#000" }); $("#limpiar").onclick = () => sp.clear();
    $("#ff").onsubmit = (ev) => { ev.preventDefault(); act($("#fb"), async () => {
      if (sp.isEmpty()) throw new Error("Dibuje su firma en el recuadro");
      const r2 = await api(`/cotizaciones/${cot._id}/firmar`, { method: "POST", body: { firma_png: sp.toDataURL("image/png"), nombre: $("#nom").value, cc: $("#cc").value, acepta: $("#acepta").checked } });
      avisar(r2.msg); vistaCotizacion(cot._id); }); };
  };
  p1();
}

/* ---------- Cliente: estado y listado ---------- */
async function vistaEstado() {
  const l = await api("/estado/mio");
  marco("#/estado", `<h1>Mi estado</h1>${l.length ? l.map((s) => `<div class="tarjeta"><div class="cab" style="margin-bottom:.4rem"><h2>${e(s.etapa)}</h2><span class="mini">Solicitud del ${fecha(s.fecha)}</span></div><p>${e(s.necesidad)}</p>
   ${s.cotizaciones.map((c) => `<p><a href="#/cotizacion/${c._id}"><b>${e(c.etiqueta)}</b></a> ${eti(c.estado)} <span class="mini">${e(c.paso)}</span></p>`).join("")}</div>`).join("") : `<div class="vacio">Todavía no tiene solicitudes. El laboratorio le avisará por correo cuando su cotización esté lista.</div>`}`);
}
async function vistaMisCotizaciones() {
  const l = await api("/cotizaciones");
  marco("#/mis-cotizaciones", `<h1>Mis cotizaciones</h1>${l.length ? `<div class="tarjeta tabla-scroll"><table><thead><tr><th>Cotización</th><th>Enviada</th><th class="num">Valor</th><th>Estado</th></tr></thead><tbody>${l.map((c) => `<tr><td><a href="#/cotizacion/${c._id}">${e(c.etiqueta)}</a></td><td>${fecha(c.fecha_envio)}</td><td class="num">${money(c.valor_total)}</td><td>${eti(c.estado)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="vacio">Aún no tiene cotizaciones.</div>`}`);
}

/* ---------- Clientes, catálogos, correos, auditoría ---------- */
async function vistaClientes() {
  marco("#/clientes", `<div class="cab"><h1>Clientes</h1><input id="q" placeholder="Buscar por nombre, cédula o correo" style="max-width:340px"></div><div id="lista"></div><div id="ed"></div>`);
  const cargar = async () => { const l = await api("/clientes?q=" + encodeURIComponent($("#q").value)); $("#lista").innerHTML = l.length ? `<div class="tarjeta tabla-scroll"><table><thead><tr><th>Nombre</th><th>Cédula/NIT</th><th>Correo</th><th>Teléfono</th><th>Estado</th><th></th></tr></thead><tbody>${l.map((c) => `<tr><td>${e(c.nombre)}</td><td>${e(c.cedula_nit)}</td><td>${e(c.correo)}</td><td>${e(c.telefono)}</td><td>${eti(c.estado)}</td><td><button class="chico" data-id="${c._id}">Editar</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="vacio">Sin resultados.</div>`; };
  await cargar(); let t; $("#q").oninput = () => { clearTimeout(t); t = setTimeout(cargar, 300); };
  $("#lista").onclick = async (ev) => { const id = ev.target.dataset.id; if (!id) return; const [c, tips] = await Promise.all([api("/clientes/" + id), api("/tipologias")]);
    const campo = (k, t, tipo = "text") => `<div><label>${t}</label><input name="${k}" type="${tipo}" value="${e(c[k] ?? "")}"></div>`;
    $("#ed").innerHTML = `<form class="tarjeta" id="fe"><h2>Editar a ${e(c.nombre)}</h2><div class="rejilla">${campo("nombre", "Nombre")}${campo("cedula_nit", "Cédula / NIT")}${campo("correo", "Correo (es su usuario de ingreso)", "email")}${campo("telefono", "Teléfono")}${campo("nombre_contacto", "Persona de contacto")}${campo("cargo", "Cargo")}${campo("direccion", "Dirección")}${campo("ciudad", "Ciudad")}${campo("departamento", "Departamento")}
      <div><label>Tipología</label><select name="id_tipologia"><option value="">—</option>${tips.map((x) => `<option value="${x._id}" ${String(c.id_tipologia) === x._id ? "selected" : ""}>${e(x.nombre)}</option>`).join("")}</select></div>
      <div><label>Tipo de usuario</label><select name="tipo_usuario"><option ${c.tipo_usuario === "externo" ? "selected" : ""}>externo</option><option ${c.tipo_usuario === "interno" ? "selected" : ""}>interno</option></select></div></div>
      <div class="acciones" style="margin-top:1rem"><button class="primario" id="gs">Guardar</button><button type="button" id="rc">Generar y enviar clave nueva</button></div></form>`;
    $("#ed").scrollIntoView({ behavior: "smooth" });
    $("#fe").onsubmit = (x) => { x.preventDefault(); act($("#gs"), async () => { const b = Object.fromEntries(new FormData(x.target)); if (!b.id_tipologia) delete b.id_tipologia; await api("/clientes/" + id, { method: "PUT", body: b }); avisar("Cliente actualizado"); cargar(); }); };
    $("#rc").onclick = (x) => act(x.target, async () => { if (!confirm("¿Generar una clave nueva y enviarla al correo del cliente?")) return; const r = await api(`/clientes/${id}/reenviar-clave`, { method: "POST" }); alert("Clave nueva (también enviada por correo): " + r.clave_inicial); }); };
}

async function vistaCatalogo() {
  const [serv, tips] = await Promise.all([api("/catalogo"), api("/tipologias")]);
  const adm = can("catalogo.administrar");
  marco("#/catalogo", `<h1>Catálogos</h1><div class="tarjeta tabla-scroll"><div class="cab"><h2>Servicios y ensayos</h2></div><table><thead><tr><th>Ref.</th><th>Ensayo</th><th>Método</th><th>Técnica</th><th class="num">Precio</th><th>Marcas</th><th>Disponible</th>${adm ? "<th></th>" : ""}</tr></thead><tbody>
   ${serv.map((s) => `<tr><td>${e(s.codigo_referencia)}</td><td>${e(s.nombre)}</td><td>${e(s.metodologia)}</td><td>${e(s.tecnica)}</td><td class="num">${money(s.precio)}</td><td>${s.tercerizado ? "** " : ""}${s.acreditado_res1619 ? "°" : ""}</td><td>${s.activo ? "Sí" : "No"}</td>${adm ? `<td><button class="chico" data-s="${s._id}">Editar</button></td>` : ""}</tr>`).join("")}</tbody></table></div>
   ${adm ? `<form class="tarjeta" id="fs"><h2 id="ts">Agregar ensayo</h2><div class="rejilla"><div><label>Nombre</label><input name="nombre" required></div><div><label>Código de referencia</label><input name="codigo_referencia"></div><div><label>Método</label><input name="metodologia"></div><div><label>Técnica</label><input name="tecnica"></div><div><label>Unidad</label><input name="unidad" value="%"></div><div><label>Precio unitario</label><input name="precio" type="number" min="0" required></div>
   <div><label><input type="checkbox" name="tercerizado" style="width:auto"> Tercerizado (**)</label><label><input type="checkbox" name="acreditado_res1619" style="width:auto"> Res. 1619 (°)</label><label><input type="checkbox" name="activo" checked style="width:auto"> Disponible</label></div></div><div class="acciones" style="margin-top:1rem"><button class="primario" id="bs">Guardar ensayo</button><button type="button" id="ns">Nuevo</button></div></form>` : ""}
   <div class="tarjeta"><h2>Tipologías SENOVA</h2><p>${tips.map((t) => `${e(t.nombre)}${t.activo ? "" : " (inactiva)"}`).join(" · ")}</p>${can("tipologias.administrar") ? `<form id="ft" class="acciones"><input name="nombre" placeholder="Nueva tipología" required style="max-width:280px"><button class="primario">Agregar</button></form>` : ""}</div>`);
  if (adm) { let edit = null; const f = $("#fs");
    $("#ns").onclick = () => { edit = null; f.reset(); $("#ts").textContent = "Agregar ensayo"; };
    document.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => { edit = serv.find((s) => s._id === b.dataset.s); $("#ts").textContent = "Editar " + edit.nombre; ["nombre", "codigo_referencia", "metodologia", "tecnica", "unidad", "precio"].forEach((k) => (f.elements[k].value = edit[k] ?? "")); ["tercerizado", "acreditado_res1619", "activo"].forEach((k) => (f.elements[k].checked = !!edit[k])); f.scrollIntoView({ behavior: "smooth" }); }));
    f.onsubmit = (ev) => { ev.preventDefault(); act($("#bs"), async () => { const b = Object.fromEntries(new FormData(f)); ["tercerizado", "acreditado_res1619", "activo"].forEach((k) => (b[k] = f.elements[k].checked)); b.precio = Number(b.precio);
      await api(edit ? "/catalogo/" + edit._id : "/catalogo", { method: edit ? "PUT" : "POST", body: b }); avisar("Guardado (las cotizaciones ya emitidas conservan su precio)"); vistaCatalogo(); }); }; }
  const ft = $("#ft"); if (ft) ft.onsubmit = (ev) => { ev.preventDefault(); act(ft.querySelector("button"), async () => { await api("/tipologias", { method: "POST", body: { nombre: ft.elements.nombre.value } }); vistaCatalogo(); }); };
}

async function vistaNotificaciones() {
  const l = await api("/notificaciones");
  marco("#/notificaciones", `<h1>Correos enviados</h1><p class="mini">Único canal de aviso: correo. Los correos solo llevan un aviso con enlace.</p>${l.length ? `<div class="tarjeta tabla-scroll"><table><thead><tr><th>Fecha</th><th>Para</th><th>Asunto</th><th>Tipo</th><th>Estado</th></tr></thead><tbody>${l.map((n) => `<tr><td>${fecha(n.fecha_envio)}</td><td>${e(n.destinatario_correo)}</td><td>${e(n.asunto)}</td><td>${e(n.tipo)}</td><td>${eti(n.estado_envio)}</td></tr>`).join("")}</tbody></table></div><p class="mini">“simulado” = el servidor no tiene Gmail configurado y el correo solo se imprimió en la consola.</p>` : `<div class="vacio">Aún no se han enviado correos.</div>`}`);
}
async function vistaAuditoria() {
  marco("#/auditoria", `<div class="cab"><h1>Auditoría</h1><select id="rs" style="max-width:200px"><option value="">Todos los resultados</option><option>exitoso</option><option>denegado</option><option>error</option></select></div><div id="t"></div>`);
  const cargar = async () => { const l = await api("/auditoria?limit=300" + ($("#rs").value ? "&resultado=" + $("#rs").value : "")); $("#t").innerHTML = `<div class="tarjeta tabla-scroll"><table><thead><tr><th>Fecha</th><th>Quién</th><th>Acción</th><th>RF</th><th>Resultado</th><th>Detalle</th><th>IP</th></tr></thead><tbody>${l.map((a) => `<tr><td>${fecha(a.fecha_hora)}</td><td>${e(a.nombre_usuario)}<div class="mini">${e(a.rol_al_momento)}</div></td><td>${e(a.tipo_accion)}</td><td>${e(a.requerimiento)}</td><td>${eti(a.resultado)}</td><td class="mini">${e(a.detalle || (a.valor_nuevo ? JSON.stringify(a.valor_nuevo) : ""))}</td><td class="mini">${e(a.ip_origen)}</td></tr>`).join("")}</tbody></table></div>`; };
  $("#rs").onchange = cargar; cargar();
}

/* ---------- Perfil (RF-23) ---------- */
async function vistaPerfil() {
  const cli = yo.rol === "Cliente" ? await api("/perfil/cliente") : null, tips = cli ? await api("/tipologias") : [];
  const campo = (k, t, v) => `<div><label>${t}</label><input name="${k}" value="${e(v ?? "")}"></div>`;
  marco("#/perfil", `<h1>Mi perfil</h1><form id="fp" class="tarjeta"><div class="rejilla">${cli
    ? campo("nombre", "Nombre", cli.nombre) + campo("telefono", "Teléfono", cli.telefono) + campo("nombre_contacto", "Persona de contacto", cli.nombre_contacto) + campo("cargo", "Cargo", cli.cargo) + campo("direccion", "Dirección", cli.direccion) + campo("ciudad", "Ciudad", cli.ciudad) + campo("departamento", "Departamento", cli.departamento) +
      `<div><label>Tipología SENOVA</label><select name="id_tipologia"><option value="">—</option>${tips.map((t) => `<option value="${t._id}" ${String(cli.id_tipologia) === t._id ? "selected" : ""}>${e(t.nombre)}</option>`).join("")}</select></div>`
    : campo("nombre", "Nombre", yo.nombre) + campo("telefono", "Teléfono", yo.telefono) + campo("cargo", "Cargo", yo.cargo)}</div>
    <p class="mini">Correo de ingreso: ${e(yo.correo)}${cli ? ". Para cambiar su cédula/NIT o correo, pídalo al laboratorio." : ""}</p><button class="primario" id="gp">Guardar perfil</button></form>
   <form id="fk" class="tarjeta"><h2>Cambiar contraseña</h2><div class="rejilla"><div><label>Contraseña actual</label><input name="actual" type="password" autocomplete="current-password" required></div><div><label>Contraseña nueva (mínimo 8)</label><input name="nueva" type="password" minlength="8" autocomplete="new-password" required></div></div><button class="primario" id="gk" style="margin-top:.8rem">Cambiar contraseña</button></form>`);
  $("#fp").onsubmit = (ev) => { ev.preventDefault(); act($("#gp"), async () => { const b = Object.fromEntries(new FormData(ev.target)); if (b.id_tipologia === "") delete b.id_tipologia; await api("/perfil", { method: "PUT", body: b }); await cargarYo(); avisar("Perfil actualizado"); }); };
  $("#fk").onsubmit = (ev) => { ev.preventDefault(); act($("#gk"), async () => { await api("/auth/cambiar-clave", { method: "POST", body: Object.fromEntries(new FormData(ev.target)) }); ev.target.reset(); avisar("Contraseña actualizada"); }); };
}

/* ---------- Rutas ---------- */
async function cargarYo() { try { yo = (await api("/auth/me")).usuario; } catch { yo = null; } }
const rutas = [
  [/^#\/login$/, vistaLogin, true], [/^#\/recuperar$/, vistaRecuperar, true],
  [/^#\/solicitudes$/, vistaSolicitudes], [/^#\/nueva-solicitud$/, vistaNuevaSolicitud], [/^#\/clientes$/, vistaClientes], [/^#\/catalogo$/, vistaCatalogo],
  [/^#\/notificaciones$/, vistaNotificaciones], [/^#\/auditoria$/, vistaAuditoria], [/^#\/perfil$/, vistaPerfil], [/^#\/estado$/, vistaEstado], [/^#\/mis-cotizaciones$/, vistaMisCotizaciones],
  [/^#\/cotizacion-nueva\/([a-f0-9]{24})$/, (id) => editorCotizacion({ solicitudId: id })], [/^#\/cotizacion\/([a-f0-9]{24})/, vistaCotizacion],
];
async function ruta() {
  const h = location.hash || "#/";
  if (yo === null) await cargarYo();
  const inicio = yo ? (esPersonal() ? "#/solicitudes" : "#/estado") : "#/login";
  const r = rutas.find(([re]) => re.test(h));
  if (!r || (h === "#/")) { location.hash = inicio; return; }
  if (!r[2] && !yo) { location.hash = "#/login"; return; }
  if (r[2] && yo) { location.hash = inicio; return; }
  const m = h.match(r[0]);
  try { await r[1](m[1]); } catch (x) { avisar(x.message, "error"); }
}
window.addEventListener("hashchange", ruta);
ruta();
