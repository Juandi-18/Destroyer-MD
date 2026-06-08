import fs from 'fs';
import path from 'path';
import db from '#db';

function getBotsFromFolder(basePath, folderName) {
  const folderPath = path.join(basePath, folderName);
  if (!fs.existsSync(folderPath)) return [];
  return fs.readdirSync(folderPath).filter((dir) => {
    const credsPath = path.join(folderPath, dir, 'creds.json');
    return fs.existsSync(credsPath);
  }).map((id) => id.replace(/\D/g, ''));
}

function getActiveBotNumbers() {
  const activeJids = new Set();
  if (global.conns && Array.isArray(global.conns)) {
    for (const conn of global.conns) {
      if (conn?.user?.id) {
        const jid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        activeJids.add(jid.split('@')[0]);
      }
    }
  }
  return activeJids;
}

export default {
  command: ['bots', 'sockets'],
  category: 'socket',
  description: 'Ver el número de bots activos divididos por rangos.',
  run: async ({ msg, sock, args, __dirname }) => {
    const from = msg.key.remoteJid;
    const isAll = args[0]?.toLowerCase() === 'all';
    const groupMetadata = msg.isGroup ? await sock.groupMetadata(from).catch(() => {}) : '';
    const groupParticipants = (groupMetadata?.participants || []).map(p => p.id);
    const mainBotJid = ((global.sock?.user?.id?.split(':')[0] ?? null) && (global.sock.user.id.split(':')[0] + '@s.whatsapp.net'));
    const basePath = path.join(__dirname, '../../Sessions');
    
    const activeBots = getActiveBotNumbers();
    
    // Escaneamos las dos carpetas de subconexiones de forma independiente
    const allSubs = getBotsFromFolder(basePath, 'Subs');
    const allPremium = getBotsFromFolder(basePath, 'Premium');
    
    // Filtramos solo los que se encuentran conectados actualmente a la RAM
    const subs = allSubs.filter(num => activeBots.has(num));
    const premiums = allPremium.filter(num => activeBots.has(num));
    
    // Añadimos la categoría Premium a la estructura de renderizado
    const categorizedBots = { Owner: [], Premium: [], Sub: [] };
    const mentionedJid = [];
    
    const formatBotInGroup = async (number, label) => {
      const jid = number + '@s.whatsapp.net';
      if (!groupParticipants.includes(jid)) return null;
      mentionedJid.push(jid);
      const data = db.getSettings(jid);
      const name = data?.namebot || 'Bot';
      return `- [${label} *${name}*] › @${number}`;
    };
    
    const formatBotAll = async (number, label) => {
      const jid = number + '@s.whatsapp.net';
      mentionedJid.push(jid);
      const data = db.getSettings(jid);
      const name = data?.namebot || 'Bot';
      return `- [${label} *${name}*] › @${number}`;
    };
    
    const formatBot = isAll ? formatBotAll : formatBotInGroup;
    const isMainActive = !!(global.sock?.user?.id);
    
    if (isMainActive && mainBotJid) {
      const inGroup = groupParticipants.includes(mainBotJid);
      if (isAll || inGroup) {
        const data = db.getSettings(mainBotJid);
        const name = data?.namebot || 'Bot';
        const number = mainBotJid.split('@')[0];
        mentionedJid.push(mainBotJid);
        categorizedBots.Owner.push(`- [Owner *${name}*] › @${number}`);
      }
    }
    
    // Mapeamos los bots Premium activos
    for (const num of premiums) {
      const line = await formatBot(num, '👑 Premium');
      if (line) categorizedBots.Premium.push(line);
    }

    // Mapeamos los bots normales activos
    for (const num of subs) {
      const line = await formatBot(num, 'Sub');
      if (line) categorizedBots.Sub.push(line);
    }
    
    const totalBots = (isMainActive ? 1 : 0) + subs.length + premiums.length;
    const totalShown = categorizedBots.Owner.length + categorizedBots.Sub.length + categorizedBots.Premium.length;
    
    let message = `ꕥ Números de Sockets activos *(${totalBots})*\n\n`;
    message += `ੈ❖‧₊˚ Principales › *${isMainActive ? 1 : 0}*\n`;
    message += `ੈ👑‧₊˚ Premiums › *${premiums.length}*\n`;
    message += `ੈ✿‧₊˚ Subs › *${subs.length}*\n\n`;
    
    if (isAll) {
      message += `➭ *Lista completa ›* ${totalShown}\n`;
    } else {
      message += `➭ *Bots en el grupo ›* ${totalShown}\n`;
    }
    
    // Renderizamos las tres categorías en orden de jerarquía
    for (const category of ['Owner', 'Premium', 'Sub']) {
      if (categorizedBots[category].length) {
        message += categorizedBots[category].join('\n') + '\n';
      }
    }
    
    await sock.sendMessage(msg.chat, { text: message.trim(), mentions: mentionedJid }, { quoted: msg });
  },
};