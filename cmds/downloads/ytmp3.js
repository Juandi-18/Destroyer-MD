import yts from "yt-search";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

const cmd = {
  command: ["play", "mp3", "ytmp3", "ytaudio", "playaudio"],
  category: "downloads",
  description: "Descargar una canción de YouTube.",
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    try {
      if (!args[0]) {
        return msg.reply("《✧》Por favor, menciona el nombre o URL del audio que deseas descargar");
      }

      const input = args.join(" ").trim();
      const video_id = getVideoId(input);
      const query = video_id ? `https://youtu.be/${video_id}` : input;

      let title = "audio";
      let url = query;
      let channel = "Desconocido";
      let duration = "Desconocido";
      let views = "0";
      let published = "Desconocido";
      let thumbnail = null;

      try {
        const info = video_id ? await yts({ videoId: video_id }) : (await yts(input))?.videos?.[0];

        if (info) {
          url = `https://youtu.be/${info.videoId || video_id}`;
          title = info.title || title;
          thumbnail = info.thumbnail || info.image || null;
          channel = info.author?.name || info.author || "Desconocido";
          duration = info.timestamp || "Desconocido";
          views = Number(info.views || 0).toLocaleString("en-US");
          published = info.ago || "Desconocido";

          const info_message = `➩ Descargando › *${title}*\n\n> ❖ Canal › *${channel}*\n> ⴵ Duración › *${duration}*\n> ❀ Vistas › *${views}*\n> ✩ Publicado › *${published}*\n> ❒ Enlace › *${url}*`;

          if (thumbnail) {
            await sock.sendMessage(msg.chat, { image: { url: thumbnail }, caption: info_message }, { quoted: msg });
          } else {
            await msg.reply(info_message);
          }
        }
      } catch {}

      // Se eliminó el mensaje de espera intermedio para evitar spam
      const filePath = await downloadWithYtdlp(url, title);

      if (!filePath) {
        return msg.reply("《✧》No se pudo descargar el audio, intenta más tarde.");
      }

      try {
        await sock.sendMessage(msg.chat, {
          audio: fs.readFileSync(filePath),
          mimetype: "audio/mpeg",
          fileName: path.basename(filePath),
        }, { quoted: msg });
      } finally {
        try { fs.unlinkSync(filePath); } catch {}
      }
    } catch (e) {
      await msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*.\n> [Error: *${e.message}*]`);
    }
  },
};

export default cmd;

async function downloadWithYtdlp(url, title) {
  const safeName = sanitizeFileName(title);
  const outPath = path.resolve("./tmp", `${safeName}_${Date.now()}.mp3`);

  await execAsync(
    `yt-dlp -f "bestaudio" -x --audio-format mp3 --audio-quality 0 -o "${outPath}" "${url}"`,
    { timeout: 120000 },
  );

  if (!fs.existsSync(outPath)) throw new Error("Archivo no generado");
  return outPath;
}

const getVideoId = (text = "") => {
  const match = String(text).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/);
  return match?.[1] || null;
};

const sanitizeFileName = (name = "audio") =>
  String(name)
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "audio";