import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import contactHandler from "./api/contact";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4580;

app.use(express.json({ limit: "32kb" }));

// SMTP-backed contact form (same handler Vercel runs from api/contact.ts)
app.post("/api/contact", (req, res) => contactHandler(req, res));

// Boot Vite middleware or serve built asset files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server boots on http://localhost:${PORT}`);
  });
}

startServer();
