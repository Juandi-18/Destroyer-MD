import { getDevice, prepareWAMessageMedia } from 'baileys';
import moment from 'moment-timezone';
import { bodyMenu, menuObject } from '#system/commands';
import db from '#db';

function normalize(text = '') {
  text = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  return text.endsWith('s') ? text.slice(0, -1) : text;
}

function ensureProtocol(url = '') {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default {
  command: ['allmenu', 'help', 'menu', 'ayuda'],
  category: 'main',
  description: 'Ver el menú de comandos.',
  run: async ({ msg, sock, args, usedPrefix, command, text }) => {
    try {
      const now = new Date();
      const colombianTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Caracas' }));
      const tiempo = colombianTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/,/g, '');
      const tempo = moment.tz('America/Caracas').format('hh:mm A');
      const botId = sock?.user?.id.split(':')[0] + '@s.whatsapp.net';
      const botSettings = db.getSettings(botId) || {};
      const botname = (botSettings.botname || 'Destroyer').replace(/Yuki Suou|Yuki/gi, 'Destroyer');
      const namebot = (botSettings.namebot || 'Destroyer').replace(/Yuki Suou|Yuki/gi, 'Destroyer');
      const displayBotName = botSettings.botname || 'Destroyer';
      const bannerUrl = botSettings.banner || 'https://cdn.adoolab.xyz/dl/c0d8325f.jpeg';
      const owner = botSettings.owner || '';
      const canalId = botSettings.newsletter_id || '';
      const canalName = botSettings.nameid || '';
      const prefix = botSettings.prefix;
      const targetLink = ensureProtocol(botSettings.link || global.links?.api?.channel || 'https://discord.gg/q7hCyhJyZ8');
      const mainBotId = global.sock?.user?.id?.split(':')[0] + '@s.whatsapp.net';
      const isOficialBot = botId === mainBotId;
      const botType = isOficialBot ? 'Principal/Owner' : (botSettings.type === 'Premium' ? '𝐏𝐫𝐞𝐦-𝐁𝐨𝐭' : 'Sub Bot');
      const users = db.getUser();
      const usersCount = users?.length || 0;
      const device = getDevice(msg.key.id);
      const userGlobal = db.getUser(msg.sender);
      const sender = userGlobal?.name || msg.pushName || 'Usuario';
      const time = sock.uptime ? formatearMs(Date.now() - sock.uptime) : "Desconocido";

      const alias = {
        anime: ['anime', 'reacciones'],
        downloads: ['downloads', 'descargas'],
        economia: ['economia', 'economy', 'eco'],
        gacha: ['gacha', 'rpg'],
        grupo: ['grupo', 'group'],
        modosexo: ['modosexo', 'sexmode', '+18'],
        profile: ['profile', 'perfil'],
        sockets: ['sockets', 'bots'],
        stickers: ['stickers', 'sticker'],
        utils: ['utils', 'utilidades', 'herramientas']
      };

      // Clonamos el objeto de comandos original para no alterar el archivo base global
      const sections = { ...menuObject };

      // --- FILTRADO DINÁMICO DE CATEGORÍA MODO SEXO ---
      if (global.modosexoBlockedGroups.includes(msg.chat)) {
        delete alias.modosexo;      // Lo quitamos de la búsqueda por categoría individual (!menu modosexo)
        delete sections.modosexo;   // Lo removemos del renderizado general del menú completo (!menu)
      }
      // -----------------------------------------------------------

      const input = normalize(args[0] || '');
      const cat = Object.keys(alias).find(k => alias[k].map(normalize).includes(input));
      const category = `${cat ? ` para \`${cat}\`` : '. *(˶ᵔ ᵕ ᵔ˶)*'}`;

      if (args[0] && !cat) {
        return msg.reply(`《✧》 La categoria *${args[0]}* no existe, las categorias disponibles son: *${Object.keys(alias).join(', ')}*.\n> Para ver la lista completa escribe *${usedPrefix}menu*\n> Para ver los comandos de una categoría escribe *${usedPrefix}menu [categoría]*\n> Ejemplo: *${usedPrefix}menu anime*`);
      }

      const content = cat ? String(sections[cat] || '') : Object.values(sections).map(s => String(s || '')).join('\n\n');
      let menu = bodyMenu ? String(bodyMenu || '') + '\n\n' + content : content;

      const replacements = {
        $owner: owner ? (!isNaN(owner.replace(/@s\.whatsapp\.net$/, '')) ? (db.getUser(owner))?.name || owner.split('@')[0] : owner) : 'Oculto por privacidad',
        $botType: botType,
        $device: device,
        $tiempo: tiempo,
        $tempo: tempo,
        $users: usersCount.toLocaleString(),
        $link: targetLink,
        $cat: category,
        $sender: sender,
        $botname: botname,
        $namebot: namebot,
        $prefix: usedPrefix,
        $uptime: time
      };

      for (const [key, value] of Object.entries(replacements)) {
        menu = menu.replace(new RegExp(`\\${key}`, 'g'), value);
      }

      // Construcción del mensaje con banner
      try {
        await sock.sendMessage(msg.chat, bannerUrl.includes('.mp4') || bannerUrl.includes('.webm') ? {
          video: { url: bannerUrl },
          gifPlayback: true,
          caption: menu.trim(),
          contextInfo: {
            mentionedJid: [owner, msg.sender]
          }
        } : {
          text: menu.trim(),
          linkPreview: targetLink && bannerUrl ? (await prepareWAMessageMedia({ image: { url: bannerUrl } }, { upload: sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }).then(({ imageMessage }) => ({
            'canonical-url': targetLink,
            'matched-text': targetLink,
            title: displayBotName,
            description: `${botSettings.namebot || 'Bot'}, mᥲძᥱ ᥕі𝗍һ ᑲᥡ ⁱᵃᵐ|𝔇ĕ𝐬†𝓻⊙γ𒆜`,
            jpegThumbnail: imageMessage?.jpegThumbnail ? Buffer.from(imageMessage.jpegThumbnail) : undefined,
            highQualityThumbnail: imageMessage || undefined
          }))) : undefined,
          contextInfo: {
            mentionedJid: [owner, msg.sender]
          }
        }, { quoted: msg });
      } catch (e) {
        console.error('Error crítico en envío de help:', e);
        await sock.sendMessage(msg.chat, { text: menu.trim() }, { quoted: msg });
      }
    } catch (e) {
      await msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`);
    }
  }
};

function formatearMs(ms) {
  const segundos = Math.floor(ms / 1000);
  const minutes = Math.floor(segundos / 60);
  const horas = Math.floor(minutes / 60);
  const dias = Math.floor(horas / 24);
  return [dias && `${dias}d`, `${horas % 24}h`, `${minutes % 60}m`, `${segundos % 60}s`].filter(Boolean).join(" ");
}