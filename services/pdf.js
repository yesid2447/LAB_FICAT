import puppeteer from "puppeteer";

let navegador;
async function getNavegador() {
  if (navegador?.connected) return navegador;
  navegador = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  return navegador;
}

/** Convierte HTML en PDF tamano Carta (Puppeteer + Chromium). */
export async function htmlAPdf(html) {
  const page = await (await getNavegador()).newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    return Buffer.from(await page.pdf({ format: "Letter", printBackground: true, preferCSSPageSize: true }));
  } finally {
    await page.close();
  }
}
export const cerrarNavegador = async () => { if (navegador) await navegador.close(); };
