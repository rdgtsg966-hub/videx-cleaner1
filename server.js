import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import { exec } from "child_process";

const app = express();
app.use(express.json({ limit: "200mb" }));

// Health-check simples
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Videx Shopee Cleaner API online." });
});

// Endpoint que recebe URL de vídeo da Shopee (com marca) e devolve MP4 sem a faixa inferior
app.post("/clean", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) {
      return res.status(400).json({ error: true, message: "URL ausente no body." });
    }

    // Baixar o vídeo original
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!response.ok) {
      return res.status(500).json({
        error: true,
        message: "Falha ao baixar o vídeo de origem.",
        status: response.status
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const inputPath = `/tmp/in_${Date.now()}.mp4`;
    const outputPath = `/tmp/out_${Date.now()}.mp4`;

    fs.writeFileSync(inputPath, Buffer.from(arrayBuffer));

    // Comando FFmpeg: remove ~15% do rodapé (onde fica a marca d'água)
    const cmd = `ffmpeg -y -i "${inputPath}" -vf "crop=in_w:in_h*0.85:0:0" -c:a copy "${outputPath}"`;

    await new Promise((resolve, reject) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          console.error("FFmpeg erro:", err, stderr);
          return reject(err);
        }
        resolve();
      });
    });

    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({
        error: true,
        message: "Falha ao gerar vídeo limpo."
      });
    }

    const cleanedBuffer = fs.readFileSync(outputPath);

    // Limpar arquivos temporários
    try {
      fs.unlinkSync(inputPath);
    } catch {}
    try {
      fs.unlinkSync(outputPath);
    } catch {}

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.send(cleanedBuffer);
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: true,
      message: "Erro interno no cleaner: " + e.message,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Videx Shopee Cleaner rodando na porta ${PORT}`);
});
