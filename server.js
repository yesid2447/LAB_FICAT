import express from "express";
import * as dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import dbConnection from "./database.js";
import rutas from "./routes/index.js";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 4500;
    this.publicPath = path.join(__dirname, "public");
    this.revisarEntorno();
    this.middlewares();
    this.conexionBd();
  }
  revisarEntorno() {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) { console.error("Falta JWT_SECRET (mínimo 16 caracteres) en .env"); process.exit(1); }
  }
  middlewares() {
    const app = this.app;
    app.disable("x-powered-by");
    app.set("trust proxy", 1);
    app.use(express.json({ limit: "1mb" }));
    app.use(cookieParser());
    app.use(cors({ origin: process.env.BASE_URL || true, credentials: true }));
    app.use(morgan("dev"));
    app.use((req, res, next) => { res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "SAMEORIGIN", "Referrer-Policy": "same-origin" }); next(); });
    app.use(express.static(this.publicPath));
    app.use("/api", rutas);
    app.use("/life", (req, res) => res.send("El servidor esta funcionando"));
    app.use("/api/*", (req, res) => res.status(404).json({ msg: "La ruta solicitada no existe" }));
    app.get("*", (req, res) => res.sendFile(path.join(this.publicPath, "index.html")));
    app.use((err, req, res, next) => {
      console.error(err);
      if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ msg: "El archivo supera 10 MB" });
      res.status(500).json({ msg: "Ocurrió un error en el servidor" });
    });
  }
  async conexionBd() { await dbConnection(); }
  listen() { this.app.listen(this.port, () => console.log(`Servidor en http://localhost:${this.port}`)); }
}
export default Server;
