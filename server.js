import express from "express";
import fs from "fs";
import { exec } from "child_process";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

app.post("/process", async (req, res) => {
  try {
    const videoUrl = req.body.video_url;
    if (!videoUrl) {
      return res.status(400).json({ error: "video_url não enviado" });
    }

    const input = "/tmp/input.mp4";
    const output = `/tmp/out_${Date.now()}.mp4`;

    // Baixar o vídeo usando fetch NATIVO DO NODE
    const response = await fetch(videoUrl);
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(input, Buffer.from(arrayBuffer));

    // Filtro blur fino (12%)
    const filterGraph =
      "[0:v]split=2[base][crop];" +
      "[crop]crop=iw*0.35:ih*0.12:0:(ih*0.50 - ih*0.06),boxblur=3:3[blurred];" +
      "[base][blurred]overlay=0:(main_h/2 - overlay_h/2)[outv]";

    // Comando FFmpeg
    const cmd = `
      ffmpeg -i ${input} \
      -filter_complex "${filterGraph}" \
      -map "[outv]" -map 0:a? \
      -c:v libx264 -preset fast -c:a aac -b:a 128k \
      -t $(ffprobe -v error -show_entries format=duration -of csv=p=0 ${input} | awk '{print $1 - 3}') \
      -y ${output}
    `;

    exec(cmd, (err) => {
      if (err) {
        return res.json({
          error: true,
          message: "Erro no FFmpeg",
          detalhe: err.message
        });
      }

      // Servir arquivo final via URL pública
      const publicUrl = `${req.protocol}://${req.get("host")}/file/${output.split("/").pop()}`;

      res.json({
        error: false,
        video_url: publicUrl
      });
    });
  } catch (e) {
    res.json({ error: true, message: e.message });
  }
});

app.get("/file/:name", (req, res) => {
  const filePath = `/tmp/${req.params.name}`;
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Not found");
  }

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Disposition", `attachment; filename="${req.params.name}"`);
  
  return res.sendFile(filePath);
});


app.listen(3000, () => console.log("Render FFmpeg rodando..."));
