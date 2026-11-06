/** Devuelve { antes, despues } solo con los campos que cambiaron (para Auditoria). */
export function diferencias(antes, despues, campos) {
  const a = {}, d = {};
  for (const k of campos) {
    if (despues[k] === undefined) continue;
    if (String(antes[k] ?? "") !== String(despues[k] ?? "")) { a[k] = antes[k] ?? null; d[k] = despues[k]; }
  }
  return { antes: a, despues: d, cambio: Object.keys(d).length > 0 };
}
