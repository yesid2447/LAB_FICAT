import mongoose from "mongoose";

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "archivos" });

/** Guarda un Buffer en GridFS y devuelve su ObjectId. */
export function guardarArchivo(buffer, filename, contentType, metadata = {}) {
  return new Promise((resolve, reject) => {
    const up = bucket().openUploadStream(filename, { contentType, metadata });
    up.on("error", reject);
    up.on("finish", () => resolve(up.id));
    up.end(buffer);
  });
}

/** Lee un archivo de GridFS como Buffer (null si no existe). */
export async function leerArchivo(id) {
  if (!id) return null;
  const chunks = [];
  try {
    for await (const c of bucket().openDownloadStream(new mongoose.Types.ObjectId(id))) chunks.push(c);
  } catch { return null; }
  return Buffer.concat(chunks);
}
