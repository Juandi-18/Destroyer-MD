import { prepareWAMessageMedia } from 'baileys';
import os from 'os';
import db from '#db';

function ensureProtocol(url = '') {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default {
  command: ['infobot', 'botinfo'],
  category: 'main',
  description: 'Obtener información del bot.',
  run: async ({ msg, sock, usedPrefix, command, text }) => {
    const botId = sock.user.id.split(':')[0] + "@s.whatsapp.net";
    const botSettings = db.getSettings(botId) || {};
    const botname = botSettings.botname || 'Destroyer';
    const namebot = botSettings.namebot || 'Destroyer';
    const monedas = botSettings.currency || 'Yenes';
    const bannerUrl = botSettings.banner || 'https://cdn.adoolab.xyz/dl/c0d8325f.jpeg';
    const prefijo = botSettings.prefix;
    const owner = botSettings.owner || '';
    const targetLink = ensureProtocol(botSettings.link || 'https://discord.gg/q7hCyhJyZ8');
    
    // --- LÓGICA DE IDENTIDAD CORREGIDA (IGUAL A HELP.JS) ---
    // Comparar directamente con el socket principal
    const mainBotId = global.sock?.user?.id?.split(':')[0] + '@s.whatsapp.net';
    const isPrincipal = botId === mainBotId;
    const botType = isPrincipal 
        ? 'Principal/Owner' 
        : (botSettings.type === 'Premium' ? '𝐏𝐫𝐞𝐦-𝐁𝐨𝐭' : 'Sub Bot');
    
    let desar = 'Oculto';
    if (owner && !isNaN(owner.replace(/@s\.whatsapp\.net$/, ''))) {
      const userData = db.getUser(owner);
      desar = userData?.genre || 'Oculto';
    }
    
    const platform = os.type();
    const now = new Date();
    const colombianTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const nodeVersion = process.version;
    const sistemaUptime = rTime(os.uptime());
    const uptime = process.uptime();
    const uptimeDate = new Date(colombianTime.getTime() - uptime * 1000);
    const formattedUptimeDate = uptimeDate.toLocaleString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/^./, m => m.toUpperCase());

    const message = `✐ Información del bot *${botname}!*

✿ *Nombre Corto ›* ${namebot}
✿ *Nombre Largo ›* ${botname}
✦ *Moneda ›* ${monedas}
✦ *Prefijo${Array.isArray(prefijo) && prefijo.length > 1 ? 's' : ''} ›* ${prefijo === 1 ? '`sin prefijos`' : (Array.isArray(prefijo) ? prefijo : [prefijo || '/']).map(p => `\`${p}\``).join(', ')}

❒ *Tipo ›* ${botType}
❒ *Plataforma ›* ${platform}
❒ *NodeJS ›* ${nodeVersion}
❒ *Activo desde ›* ${formattedUptimeDate}
❒ *Sistema Activo ›* ${sistemaUptime}
❒ *${desar === 'Hombre' ? 'Dueño' : desar === 'Mujer' ? 'Dueña' : 'Dueño(a)'} ›* ${owner ? (!isNaN(owner.replace(/@s\.whatsapp\.net$/, '')) ? `@${owner.split('@')[0]}` : owner) : "Oculto por privacidad"}

> \`Enlace:\` ${targetLink}`.trim();

    try {
      await sock.sendMessage(msg.chat, bannerUrl.includes('.mp4') || bannerUrl.includes('.webm') ? {
        video: { url: bannerUrl },
        gifPlayback: true,
        caption: message,
        contextInfo: { mentionedJid: [owner, msg.sender] }
      } : {
        text: message,
        linkPreview: targetLink && bannerUrl ? (await prepareWAMessageMedia({ image: { url: bannerUrl } }, { upload: sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }).then(({ imageMessage }) => ({
          'canonical-url': targetLink,
          'matched-text': targetLink,
          title: botname,
          description: `${namebot}, mᥲძᥱ ᥕі𝗍һ ᑲᥡ ⁱᵃᵐ|𝔇ĕ𝐬†𝓻⊙γ𒆜`,
          jpegThumbnail: imageMessage?.jpegThumbnail ? Buffer.from(imageMessage.jpegThumbnail) : undefined,
          highQualityThumbnail: imageMessage || undefined
        }))) : undefined,
        contextInfo: { mentionedJid: [owner, msg.sender] }
      }, { quoted: msg });
    } catch (e) {
      console.error('Error crítico en infobot:', e);
      await sock.sendMessage(msg.chat, { text: message }, { quoted: msg });
    }
  }
};

function rTime(seconds) {
  seconds = Number(seconds);
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const dDisplay = d > 0 ? d + (d === 1 ? " día, " : " días, ") : "";
  const hDisplay = h > 0 ? h + (h === 1 ? " hora, " : " horas, ") : "";
  const mDisplay = m > 0 ? m + (m === 1 ? " minuto, " : " minutos, ") : "";
  const sDisplay = s > 0 ? s + (s === 1 ? " segundo" : " segundos") : "";
  return dDisplay + hDisplay + mDisplay + sDisplay;
}