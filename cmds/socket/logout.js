import fs from 'fs';
import path from 'path';
import { jidDecode } from 'baileys';
import db from '#db';

export default {
  command: ['logout'],
  category: 'socket',
  description: 'Cerrar sesión del bot.',
  run: async ({ msg, sock, usedPrefix, command }) => {
    const idBot = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const config = db.getSettings(idBot) || {};
    const isOwner2 = [idBot, ...(config.owner ? [config.owner] : []), ...global.owner.map(num => num + '@s.whatsapp.net')].includes(msg.sender);
    if (!isOwner2) return sock.reply(msg.chat, global.mess.socket, msg);
    const rawId = sock.user?.id || '';
    const decoded = jidDecode(rawId);
    const cleanId = decoded?.user || rawId.split('@')[0];
    const basePath = 'Sessions';
    const premiumPath = path.join(basePath, 'Premium', cleanId);
    const subsPath = path.join(basePath, 'Subs', cleanId);
    const sessionPath = fs.existsSync(premiumPath) ? premiumPath : (fs.existsSync(subsPath) ? subsPath : null);

    if (!sessionPath) {
      return msg.reply('《✧》 Este comando solo puede ser usado desde una instancia de Sub-Bot o Premium Bot.');
    }

    const botType = sessionPath.includes(path.join('Sessions', 'Premium')) ? 'Premium' : 'Sub';
    const reconnectCommand = botType === 'Premium' ? 'codepremium' : 'code';

    try {
      await msg.reply(`《✧》 Cerrando sesión del Socket ${botType}...`);
      sock.isLoggingOut = true;
      await sock.logout();
      setTimeout(() => {
        if (fs.existsSync(sessionPath)) {
          if (botType === 'Premium') {
            console.log(`《✧》 Sesión Premium de ${cleanId} desconectada de la RAM. Los archivos físicos permanecen intactos en el disco.`);
          } else {
            // Si es un Sub gratuito normal, sí se borra por completo de la faz de la tierra
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log(`《✧》 Sesión de SubBot ${cleanId} eliminada por completo de ${sessionPath}`);
          }
        }
      }, 5000);
    } catch (e) {
      await msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`);
    }
  },
};