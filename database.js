import mongoose from "mongoose";

/** Conecta a MongoDB (MONGO_URL). Reintenta cada 5 s si falla. */
export default async function dbConnection() {
  const url = process.env.MONGO_URL;
  if (!url) {
    console.error("Falta MONGO_URL en el archivo .env");
    return;
  }
  try {
    await mongoose.connect(url);
    console.log("MongoDB conectado");
  } catch (e) {
    console.error("Error conectando a MongoDB:", e.message, "- reintentando en 5 s");
    setTimeout(dbConnection, 5000);
  }
}
