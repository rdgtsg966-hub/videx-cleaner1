# Videx Shopee Cleaner (Backend)

Backend em Node.js para remover a faixa inferior (marca d'água) de vídeos da Shopee usando FFmpeg.

## Rotas

- `GET /` → health-check simples.
- `POST /clean` → recebe JSON `{ "url": "https://..." }` com o link direto do MP4 (com marca) e devolve o MP4 com a parte inferior cortada.

## Uso com o Worker

No Cloudflare Worker, após obter `watermarkVideo`, faça:

```js
const cleanReq = await fetch("https://videx.space/clean", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: watermarkVideo })
});

if (cleanReq.ok) {
  const cleanedVideo = await cleanReq.arrayBuffer();
  return new Response(cleanedVideo, {
    headers: {
      "Content-Type": "video/mp4",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
```

Certifique-se de que o FFmpeg está instalado no servidor.
