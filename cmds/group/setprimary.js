import fs from 'fs';
import path from 'path';
import db from '#db';

const getBotsFromFolder = (folderName, __dirname) => {
  const basePath = path.join(__dirname, '../../Sessions', folderName)
  if (!fs.existsSync(basePath)) return []
  return fs.readdirSync(basePath).filter((dir) => fs.existsSync(path.join(basePath, dir, 'creds.json'))).map((id) => id.replace(/\D/g, '') + '@s.whatsapp.net')
}

const getAllowedBots = (mainBotJid, __dirname) => {
  const subs = getBotsFromFolder('Subs', __dirname)
  return [...new Set([...subs, mainBotJid])]
}

export default {
  command: ['setprimary'],
  category: 'group',
  description: 'Establecer un bot como primario del grupo.',
  isAdmin: true,
  run: async ({ msg, sock, usedPrefix, command, groupMetadata, participants, __dirname }) => {
    try {
      let chat = db.getChat(msg.chat);
      const who = msg.mentionedJid?.[0] || msg.quoted?.sender || null;
      if (!who) {
        return sock.reply(msg.chat, `《✧》 Por favor menciona un bot para convertirlo en primario.`, msg);
      }
      const groupParticipants = participants.map(p => p.id);
      const mainBotJid = ((global.sock?.user?.id?.split(':')[0] ?? null) && ((global.sock?.user?.id?.split(':')[0] ?? null) && (global.sock.user.id.split(':')[0] + '@s.whatsapp.net')));
      const allowedBots = getAllowedBots(mainBotJid, __dirname);
      if (!allowedBots.includes(who)) {
        return sock.reply(msg.chat, `《✧》 El usuario mencionado no es una instancia de Sub-Bot.`, msg);
      }
      if (!groupParticipants.includes(who)) {
        return sock.reply(msg.chat, `《✧》 El bot mencionado no está presente en este grupo.`, msg);
      }
      if (chat.primaryBot === who) {
        return sock.reply(msg.chat, `「✿」 @${who.split('@')[0]} ya es el Bot principal del Grupo.`, msg, { mentions: [who] });
      }
      chat.primaryBot = who;
      db.setChat(msg.chat, 'primaryBot', who);
      await sock.reply(msg.chat, `ꕥ Se ha establecido a @${who.split('@')[0]} como bot primario de este grupo.\n> Ahora todos los comandos de este grupo serán ejecutados por @${who.split('@')[0]}.`, msg, { mentions: [who] });
    } catch (e) {
      console.error(e);
      await msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`);
    }
  },
};