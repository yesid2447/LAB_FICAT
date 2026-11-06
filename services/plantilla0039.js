import { esc, fmtMoneda, fmtCant } from "../helpers/utils.js";

/**
 * HTML del formato oficial CAT-ST-OC-F-002 (Oferta de servicios). El diseno y los textos
 * fijos vienen de Plantillas.estructura; el sistema SOLO llena los campos variables.
 * datos = { cot, cliente, tipologia, items[], plantilla, elaboro{nombre,cargo}, logo, firmaLab, firmaCliente, acepta{nombre,cc} }
 */
export function htmlOferta(d) {
  const { cot, cliente: c, plantilla: p, items } = d;
  const t = p.estructura.textos;
  const numero = `${cot.numero_cotizacion}V${cot.version}`;
  const obsLineas = (s) => String(s || "").split("\n").filter((x) => x.trim()).map((x) => `<div>${esc(x)}</div>`).join("");
  const lista = (arr) => arr.map((x) => `<div>${x}</div>`).join("");

  // Items agrupados por numero_item
  const grupos = {};
  items.forEach((i) => (grupos[i.numero_item] ||= []).push(i));
  let subtotal = 0;
  const bloquesItems = Object.keys(grupos).sort((a, b) => a - b).map((n) => {
    const filas = grupos[n];
    const costoItem = filas.reduce((s, f) => s + f.costo_ensayo, 0);
    subtotal += costoItem;
    return `
    <tr><td colspan="8" class="barra2">Ítem ${n} - ${esc(filas[0].descripcion_item || "Descripción de la muestra a ensayar")}</td></tr>
    <tr class="cab"><td>Código de referencia</td><td>Ensayo</td><td>Unidades</td><td>Método</td><td>Técnica</td><td>Cantidad</td><td>Valor unitario</td><td>Costo del ensayo</td></tr>
    ${filas.map((f, idx) => `<tr class="fila ${idx === 0 ? "primera" : ""}">
      <td>${esc(f.codigo_referencia || "*")}</td>
      <td>${esc(f.nombre_ensayo)}${f.tercerizado ? "**" : ""}${f.acreditado_res1619 ? '<span class="rojo">°</span>' : ""}</td>
      <td>${esc(f.unidad)}</td><td>${esc(f.metodo)}</td><td>${esc(f.tecnica)}</td>
      <td>${fmtCant(f.cantidad)}</td><td>${fmtMoneda(f.precio_unitario)}</td><td>${fmtMoneda(f.costo_ensayo)}</td></tr>`).join("")}
    <tr class="tot"><td colspan="6"></td><td class="tl">Costo del ítem</td><td>${fmtMoneda(costoItem)}</td></tr>`;
  }).join("");

  const hayTerc = items.some((i) => i.tercerizado);
  const obsProp = cot.observaciones_propuesta ?? (hayTerc ? t.observacion_tercerizado : "");
  const firmaLab = d.firmaLab ? `<img src="${d.firmaLab}" class="firma-lab">` : "";
  const firmaCli = d.firmaCliente ? `<img src="${d.firmaCliente}" class="firma-cli">` : "";
  const nombreAcepta = d.acepta?.nombre ?? c.nombre, ccAcepta = d.acepta?.cc ?? c.cedula_nit;
  const seccion = (titulo, arr) => `<tr><td class="barra">${esc(titulo)}</td></tr><tr><td class="texto">${lista(arr)}</td></tr>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  @page { size: Letter; margin: 0.28in; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Calibri, Carlito, "Liberation Sans", Arial, sans-serif; font-size: 10.5px; color: #000; width: 1120px; zoom: 0.69; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td { padding: 1px 4px; vertical-align: middle; }
  .marco { border: 1px solid #000; }
  .barra { background: #39a900; color: #fff; font-weight: bold; text-align: center; font-style: italic; font-size: 10.5px; padding: 1px; }
  .barra2 { background: #39a900; color: #fff; font-weight: bold; text-align: center; font-style: italic; padding: 1px; }
  .etq { background: #39a900; color: #fff; font-weight: bold; text-align: center; font-size: 10px; }
  .val { text-align: center; border-bottom: 1px solid #000; }
  .cab td { background: #39a900; color: #fff; font-weight: bold; text-align: center; height: 34px; }
  .fila td { text-align: center; border-bottom: 1px solid #000; height: 15px; }
  .fila.primera td { height: 26px; }
  .tot td { text-align: center; border-bottom: 1px solid #000; } .tl { background: #39a900; color: #fff; font-weight: bold; }
  .rojo { color: #e00; } .texto { padding: 12px 2px 12px 2px; line-height: 1.35; font-size: 10.3px; }
  .enc td { vertical-align: middle; } .titulo { font-size: 17px; font-weight: bold; font-style: italic; text-decoration: underline; text-align: center; }
  .lab { font-size: 8.5px; font-style: italic; font-weight: bold; text-align: center; line-height: 1.25; }
  .cot { text-align: center; font-style: italic; font-weight: bold; } .num { color: #e00; font-size: 12px; font-weight: bold; }
  .firma-lab { height: 52px; display: block; margin: 0 auto; } .firma-cli { max-height: 38px; max-width: 220px; display: block; margin: 0 auto; }
  .elab { height: 150px; vertical-align: bottom; text-align: center; font-weight: bold; font-size: 10px; line-height: 1.25; padding-bottom: 0; }
  .acepta td.l { background: #39a900; color: #fff; font-weight: bold; text-align: center; width: 24%; } .acepta td.v { text-align: center; border-bottom: 1px solid #000; }
  tr { page-break-inside: avoid; }
  </style></head><body><div class="marco">
  <table class="enc"><colgroup><col style="width:17%"><col style="width:33%"><col style="width:34%"><col style="width:16%"></colgroup><tr style="height:96px">
    <td style="text-align:center">${d.logo ? `<img src="${d.logo}" style="height:78px">` : ""}</td>
    <td colspan="1" style="border:0"><div class="titulo">Oferta de servicios</div><div class="lab" style="margin-top:14px">${t.encabezado_laboratorio.map(esc).join("<br>")}</div></td>
    <td style="border-left:1px solid #000;border-right:1px solid #000"><div class="cot" style="font-size:12px">Cotización No.</div><div class="cot num" style="margin:8px 0">${esc(numero)}</div><div class="cot" style="font-size:13px">Fecha de emisión:</div><div class="cot num" style="margin-top:8px;color:#e00;font-size:12px">${esc(cot.fecha_emision)}</div></td>
    <td class="cot" style="font-size:9px">Código<br>${esc(p.codigo_formato)}<br><br>Aprobación<br>${esc(p.fecha_aprobacion_formato)}<br><br>Versión<br>${esc(p.version_formato)}</td></tr></table>
  <table><tr><td class="barra">1. Datos del cliente</td></tr></table>
  <table><colgroup><col style="width:9%"><col style="width:26%"><col style="width:15%"><col style="width:11%"><col style="width:39%"></colgroup>
   ${[["Cliente", c.nombre, "Departamento", c.departamento], ["NIT / C.C.", c.cedula_nit, "Persona de contacto", c.nombre_contacto], ["Dirección", c.direccion, "Clasificación/Tipología", d.tipologia],
      ["Ciudad", c.ciudad, "Correo electrónico", c.correo], ["Cargo", c.cargo, "Celular y/o Teléfono", c.telefono]].map(([a, b, e, f]) =>
      `<tr><td class="etq" style="font-size:9px">${a}</td><td class="val" colspan="2" style="width:35%">${esc(b)}</td><td class="etq" colspan="1" style="font-size:9px">${e}</td><td class="val">${esc(f)}</td></tr>`).join("")}
   <tr><td class="etq" style="font-size:9px">Validez de la oferta</td><td class="val" colspan="2">${esc(cot.fecha_validez)}</td><td class="etq" style="font-size:9px">Entrega de resultados</td><td class="val">${cot.plazo_entrega_dias_habiles} días hábiles contados a partir de la fecha de recepción de la muestra</td></tr></table>
  <table><tr><td class="barra">2. Propuesta técnica y económica</td></tr></table>
  <table><colgroup><col style="width:10%"><col style="width:19%"><col style="width:9%"><col style="width:21%"><col style="width:16%"><col style="width:8%"><col style="width:8.5%"><col style="width:8.5%"></colgroup>${bloquesItems}
   <tr class="tot"><td colspan="6" style="text-align:center;background:#39a900;color:#fff;font-weight:bold;border:0;border-bottom:1px solid #fff">Observaciones de la propuesta técnica y económica</td><td class="tl">Subtotal</td><td>${fmtMoneda(subtotal)}</td></tr>
   <tr class="tot"><td colspan="6" style="text-align:left;font-weight:bold;font-size:10px;padding:1px 0">${esc(obsProp)}</td><td class="tl">Total</td><td>${fmtMoneda(subtotal)}</td></tr></table>
  <table><tr><td class="barra">Observaciones del servicio</td></tr><tr><td class="texto" style="padding:9px 2px">${cot.observaciones_servicio != null ? obsLineas(cot.observaciones_servicio) : lista(t.observaciones_servicio)}</td></tr></table>
  <table><tr><td class="barra">Elaborada y emitida por</td></tr>
   <tr><td class="elab">${firmaLab}<div>______________________________</div><div>${esc(d.elaboro.nombre)}</div><div>${esc(d.elaboro.cargo1)}</div><div>${esc(d.elaboro.cargo2)}</div></td></tr></table>
  <table class="acepta"><tr><td class="barra" colspan="2">${esc(t.titulo_acepto)}</td></tr>
   <tr><td class="l">Nombre</td><td class="v">${esc(nombreAcepta)}</td></tr>
   <tr><td class="l" style="height:34px">Firma de aceptación</td><td class="v" style="height:34px">${firmaCli}</td></tr>
   <tr><td class="l">C.C.</td><td class="v">${esc(ccAcepta)}</td></tr></table>
  <table><tr><td class="barra">3. Anexo de cotizaciones</td></tr>
   ${t.secciones.map((s) => seccion(s.titulo, s.lineas)).join("")}</table>
  </div></body></html>`;
}
