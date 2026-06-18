import fetch from 'node-fetch';
import chalk from 'chalk';
import db from '#db';

export default {
  command: ['gif', 'giphy', 'tenor'],
  category: 'downloads',
  description: 'Busca y envía de 2 a 3 GIFs reales en bucle desde Tenor v1 sin textos intermedios.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    // 💡 CAPTURA DE ESPACIOS: Recuperamos la frase completa sin mutilaciones del main.js
    const fullText = msg.text || '';
    const commandOffset = usedPrefix.length + command.length;
    let query = fullText.slice(commandOffset).trim();

    if (!query && args[0]) {
      query = args.join(' ');
    }

    if (!query) {
      return msg.reply(`《✧》 *Uso Incorrecto* ✧》\n\nPor favor, ingresa el nombre o palabra clave del GIF que deseas buscar.\n\n*Ejemplo:* ${usedPrefix + command} mario bros`);
    }

    await msg.reply(`🔍 *Buscando GIFs de:* \`"${query}"\`...\n> Por favor, espere un momento.`);

    // --- REGISTRO ESTADÍSTICO EN LA BASE DE DATOS ---
    try {
      let botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
      const settings = db.getSettings(botJid) || {};
      settings.commandsejecut = (settings.commandsejecut || 0) + 1;
      db.setSettings(botJid, 'commandsejecut', settings.commandsejecut);
    } catch (e) {
      console.error(chalk.red(`[DB GIF STATS ERROR]:`), e);
    }

    try {
      // Conectamos a la API v1 con la clave estable de Tenor
      const url = `https://api.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=LIVDSRZULELA&limit=3`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      const results = data.results || [];

      if (results.length === 0) {
        return msg.reply(`❌ No se encontraron GIFs que coincidan con la búsqueda: *"${query}"*.`);
      }

      // Despachamos los archivos de forma individual en ráfaga continua.
      // Eliminamos el mensaje de "Resultados de animación para..." para una entrega más limpia.
      for (const item of results) {
        const media = item.media?.[0];
        const gifUrl = media?.mp4?.url || media?.tinymp4?.url || media?.gif?.url;
        
        if (gifUrl) {
          await sock.sendMessage(msg.chat, {
            video: { url: gifUrl },
            gifPlayback: true // ◄ Fuerza el formato GIF real en bucle automático
          }, { quoted: msg });
          
          // Delay mínimo de 300ms para asegurar el envío correcto en los sockets de Baileys
          await new Promise(res => setTimeout(res, 300));
        }
      }

    } catch (error) {
      console.error(chalk.red(`[GIF TENOR V1 INDIVIDUAL ERROR]:`), error);
      await msg.reply(`> Hubo un error al conectar con el servidor de Tenor.\n> [Error: *${error.message}*]`);
    }
  },
};