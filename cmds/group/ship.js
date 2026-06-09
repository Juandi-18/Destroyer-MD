import fetch from 'node-fetch';
import db from '#db';

// Símbolos estéticos idénticos a los que usas en shares.js
const symbols = ['(⁠◠⁠‿⁠◕⁠)', '˃͈◡˂͈', '૮(˶ᵔᵕᵔ˶)ა', '(づ｡◕‿‿◕｡)づ', '(✿◡‿◡)', '(✿✪‿✪｡)', '(*≧ω≦)', '(✧ω✧)', '(✪ω✪)'];
function getRandomSymbol() { return symbols[Math.floor(Math.random() * symbols.length)]; }

export default {
  command: ['ship', 'pareja', 'shippear'],
  category: 'anime',
  description: 'Calcula compatibilidad entre dos usuarios y guarda el resultado en la base de datos.',
  admin: false,
  botAdmin: false,

  run: async ({ msg, sock, usedPrefix, command, participants }) => {
    const prefix = usedPrefix || '';
    let persona1;
    let persona2;

    // 1. Detección y validación de los objetivos a shippear
    if (msg.mentionedJid && msg.mentionedJid.length >= 2) {
      persona1 = msg.mentionedJid[0];
      persona2 = msg.mentionedJid[1];
    } else if (msg.quoted) {
      persona1 = msg.sender;
      persona2 = msg.quoted.sender;
    } else if (msg.mentionedJid && msg.mentionedJid.length === 1) {
      persona1 = msg.sender;
      persona2 = msg.mentionedJid[0];
    } else {
      return sock.sendMessage(msg.chat, {
        text: `*⚠️ Uso incorrecto del comando*\n\n` +
              `Puedes usarlo de estas formas:\n` +
              `» *${prefix}ship* @persona1 @persona2\n` +
              `» *${prefix}ship* @persona\n` +
              `» Responder al mensaje de alguien con *${prefix}ship*`
      }, { quoted: msg });
    }

    if (persona1 === persona2) {
      return sock.sendMessage(msg.chat, { text: `*❌ ¡No puedes shippearte contigo mismo! Intenta buscar a alguien más.*` }, { quoted: msg });
    }

    // 2. Generación del porcentaje diario invariable
    const hoy = new Date().toDateString();
    const combinacionIds = [persona1, persona2].sort().join('') + hoy;
    let hash = 0;
    for (let i = 0; i < combinacionIds.length; i++) {
      hash = combinacionIds.charCodeAt(i) + ((hash << 5) - hash);
    }
    const porcentaje = Math.abs(hash % 101);

    // 3. Selección de diagnósticos y llamadas directas a interacciones SFW de tu API
    let mensaje;
    let interactionType;

    if (porcentaje <= 20) {
      mensaje = `💔 *Resultado:* ${porcentaje}%\n\n> *Diagnóstico:* Definitivamente el uno para el otro... pero para mantenerse a kilómetros de distancia. No hay química aquí.`;
      interactionType = 'slap'; // Usa tu bofetada o reacción fría de la API
    } else if (porcentaje <= 50) {
      mensaje = `🌱 *Resultado:* ${porcentaje}%\n\n> *Diagnóstico:* Su amor recién está floreciendo o tal vez solo se ven como buenos amigos. ¡Falta un empujón o un par de salidas!`;
      interactionType = 'shy'; // Reacción tímida/sonrojada de tu API
    } else if (porcentaje <= 85) {
      mensaje = `💖 *Resultado:* ${porcentaje}%\n\n> *Diagnóstico:* ¡Hay una atracción muy fuerte aquí! Tienen un nivel de afecto bastante alto y el destino los está mirando de cerca.`;
      interactionType = 'hug'; // Reacción de abrazo de tu API
    } else {
      mensaje = `👑 *Resultado:* ${porcentaje}%\n\n> *Diagnóstico:* ¡EL AMOR DE SU VIDA! 💍 Están destinados a estar juntos por el resto de la eternidad. Un amor puro, legendario y perfecto.`;
      interactionType = 'kiss'; // Reacción de beso de tu API
    }

    // Nombres extraídos de tu base de datos SQLite tal como en shares.js
    const fromName = db.getUser(persona1)?.name || '@' + persona1.split('@')[0];
    const toName = db.getUser(persona2)?.name || '@' + persona2.split('@')[0];

    const textoFinal = `» ˚୨•(=^●ω●^=)• ⊹ 𝐒𝐇𝐈𝐏 𝐌𝐄𝐓𝐄𝐑 ⊹\n\n` +
                       `👥 *Pareja:* \`${fromName}\`  𝘹  \`${toName}\` ${getRandomSymbol()}\n\n` +
                       `${mensaje}\n\n` +
                       `╰ׅ͜─֟͜─͜─ٞ͜─͜─๊͜─͜─๋͜─⃔═̶፝֟͜═̶⃔─๋͜─͜─͜─๊͜─ٞ͜─͜─֟͜┈ࠢ͜╯ׅ`;

    // 4. Guardado e Historial en la Base de Datos SQLite
    const shipData = {
      persona1,
      persona2,
      porcentaje,
      resultado: mensaje,
      fecha: new Date().toISOString(),
      autor: msg.sender
    };

    db.setCreate('chat_users', [msg.chat, msg.sender], 'shipHistory', []);
    db.setCreate('chat_users', [msg.chat, msg.sender], 'lastShip', null);

    const existingHistory = db.getChatUser(msg.chat, msg.sender).shipHistory;
    let shipHistory = [];
    if (Array.isArray(existingHistory)) shipHistory = existingHistory;
    else if (typeof existingHistory === 'string' && existingHistory) {
      try { shipHistory = JSON.parse(existingHistory); } catch { shipHistory = []; }
    }
    shipHistory.unshift(shipData);
    if (shipHistory.length > 10) shipHistory = shipHistory.slice(0, 10);
    db.setChatUser(msg.chat, msg.sender, 'shipHistory', shipHistory);
    db.setChatUser(msg.chat, msg.sender, 'lastShip', shipData);

    // 5. Consumo de la API Yuki e inyección del Buffer de Video (GIF) a WhatsApp
    try {
      await msg.react('🕒');
      
      // Construimos la URL usando tus variables globales idéntico a shares.js
      const apiResponse = await fetch(`${global.APIs.yuki.url}/sfw/interaction?inter=${interactionType}&key=${global.APIs.yuki.key}`);
      const json = await apiResponse.json();
      const mediaUrl = json?.result || json?.url || json?.data;

      if (!mediaUrl) throw new Error('La API de interacciones no devolvió ninguna URL válida.');

      // Descargamos el video a un ArrayBuffer en memoria (Igual que en waifu.js)
      const fetchMedia = await fetch(mediaUrl);
      const gifBuffer = Buffer.from(await fetchMedia.arrayBuffer());

      // Enviamos el buffer multimedia directo al chat sin almacenar archivos basura en la PC
      await sock.sendMessage(msg.chat, {
        video: gifBuffer,
        gifPlayback: true,
        caption: textoFinal,
        mentions: [persona1, persona2]
      }, { quoted: msg });

      await msg.react('✔️');

    } catch (err) {
      console.error('Error en el multimedia de Ship:', err);
      await msg.react('✖️');
      // Si la API falla, el bot envía el diagnóstico en texto plano para no congelar la experiencia
      await sock.sendMessage(msg.chat, {
        text: textoFinal,
        mentions: [persona1, persona2]
      }, { quoted: msg });
    }
  }
};