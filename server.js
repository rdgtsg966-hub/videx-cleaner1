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
    // Primeiro, ler a duração
    ffmpeg.ffprobe(inputPath, (err, info) => {
      if (err) {
        console.error("Erro ffprobe:", err);
        return res.status(500).send("Erro ao analisar vídeo.");
      }

      const duration = info.format.duration || 0;

      // Garantir que nunca fique negativo
      const cutDuration = Math.max(1, duration - 3);

      // Filtro de blur na marca d'água Shopee
      // 30% largura, 15% altura, y=75%
      const filterGraph =
        "[0:v]split=2[base][crop];" +
        "[crop]crop=iw*0.30:ih*0.15:0:ih*0.75,boxblur=20:20[blurred];" +
        "[base][blurred]overlay=0:main_h*0.75[outv]";

      ffmpeg(inputPath)
        .complexFilter(filterGraph)
        .outputOptions([
          "-map [outv]",
          "-map 0:a? -c:a aac -b:a 128k"
        ])
        .duration(cutDuration)
        .on("error", (err) => {
          console.error("Erro no FFmpeg:", err.message);
          res.status(500).send("Erro no FFmpeg: " + err.message);

          try { fs.unlinkSync(inputPath); } catch {}
          try { fs.unlinkSync(outputPath); } catch {}
        })
        .on("end", () => {
          fs.readFile(outputPath, (err, data) => {
            if (err) {
              console.error("Erro lendo arquivo final:", err);
              return res.status(500).send("Erro ao ler vídeo final.");
            }

            res.setHeader("Content-Type", "video/mp4");
            res.send(data);

            try { fs.unlinkSync(inputPath); } catch {}
            try { fs.unlinkSync(outputPath); } catch {}
          });
        })
        .save(outputPath);
    });

  } catch (e) {
    console.error("Erro geral:", e);
    return res.status(500).send("Erro interno: " + e.message);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("API rodando na porta " + port));
