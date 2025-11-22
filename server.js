import express from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs";

const app = express();
const upload = multer({ dest: "/tmp" });

ffmpeg.setFfmpegPath(ffmpegStatic);

app.post("/process-video", upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).send("Nenhum arquivo recebido.");

  const inputPath = req.file.path;
  const outputPath = `/tmp/out_${Date.now()}.mp4`;

  try {
    ffmpeg.ffprobe(inputPath, (err, info) => {
      if (err) return res.status(500).send("Erro ao analisar vídeo.");

      const duration = info.format.duration || 0;
      const finalDuration = Math.max(1, duration - 3); // nunca negativo

      // Filtro blur
const filterGraph =
  "[0:v]split=2[base][crop];" +
  "[crop]crop=iw*0.35:ih*0.22:0:(ih*0.50 - ih*0.11),boxblur=3:3[blurred];" +
  "[base][blurred]overlay=0:(main_h/2 - overlay_h/2)[outv]";



      const command = ffmpeg(inputPath)
        .complexFilter(filterGraph)
        .outputOptions([
          "-map", "[outv]",
          "-map", "0:a?",
          "-c:v", "libx264",
          "-preset", "fast",
          "-c:a", "aac",
          "-b:a", "128k"
        ])
        .duration(finalDuration)
        .on("error", err => {
          return res.status(500).send("Erro no FFmpeg: " + err.message);
        })
        .on("end", () => {
          fs.readFile(outputPath, (err, data) => {
            if (err) return res.status(500).send("Erro ao ler vídeo final.");

            res.setHeader("Content-Type", "video/mp4");
            res.send(data);

            try { fs.unlinkSync(inputPath); } catch {}
            try { fs.unlinkSync(outputPath); } catch {}
          });
        })
        .save(outputPath);
    });

  } catch (e) {
    return res.status(500).send("Erro interno: " + e.message);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("API rodando na porta " + port));
