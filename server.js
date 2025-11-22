import express from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs";

const app = express();
const upload = multer({ dest: "/tmp" });

ffmpeg.setFfmpegPath(ffmpegStatic);

app.post("/process-video", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("Nenhum arquivo recebido.");
  }

  const inputPath = req.file.path;
  const outputPath = `/tmp/out_${Date.now()}.mp4`;

  try {
    // 1) Descobrir duração do vídeo
    ffmpeg.ffprobe(inputPath, (err, info) => {
      if (err) {
        console.error("Erro ffprobe:", err);
        return res.status(500).send("Erro ao analisar vídeo.");
      }

      const duration = info.format.duration || 0;
      const cutDuration = duration > 3 ? duration - 3 : duration;

      // 2) Filtro de blur suave na marca d'água + corte final
      // Região aproximada da marca d'água Shopee (inferior esquerda):
      // 30% da largura, 15% da altura, começando em 75% da altura.
      const filterGraph =
        "[0:v]split[v0][v1];" +
        "[v0]crop=iw*0.30:ih*0.15:0:ih*0.75,boxblur=20:20[wm];" +
        "[v1][wm]overlay=0:main_h*0.75[out]";

      ffmpeg(inputPath)
        .complexFilter(filterGraph, "out")
        .outputOptions([
          "-map [out]",   // vídeo filtrado
          "-map 0:a?",    // áudio original se existir
          "-c:a copy"     // copia o áudio
        ])
        .setDuration(cutDuration) // corta os últimos 3 segundos
        .output(outputPath)
        .on("end", () => {
          // 3) Enviar arquivo final
          fs.readFile(outputPath, (errRead, data) => {
            if (errRead) {
              console.error("Erro ao ler arquivo final:", errRead);
              return res.status(500).send("Erro ao ler vídeo final.");
            }

            res.setHeader("Content-Type", "video/mp4");
            res.setHeader(
              "Content-Disposition",
              'attachment; filename="shopee-editado.mp4"'
            );
            res.send(data);

            // limpar arquivos temporários
            fs.unlink(inputPath, () => {});
            fs.unlink(outputPath, () => {});
          });
        })
        .on("error", (errFfmpeg) => {
          console.error("Erro no FFmpeg:", errFfmpeg.message);
          res.status(500).send("Erro no FFmpeg: " + errFfmpeg.message);
          fs.unlink(inputPath, () => {});
          fs.unlink(outputPath, () => {});
        })
        .run();
    });
  } catch (e) {
    console.error("Erro geral:", e);
    res.status(500).send("Erro interno: " + e.message);
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("API rodando na porta " + port));
