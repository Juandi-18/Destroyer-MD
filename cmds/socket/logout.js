import fs from 'fs';
import path from 'path';
import { jidDecode } from 'baileys';
import db from '#db';

export default {
  command: ['logout'],
  category: 'socket',
  description: 'Cerrar sesión del bot actual o de un clon remotamente mediante mención o número.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const idBot = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const config = db.getSettings(idBot) || {};
    
    // Validar si es owner global o dueño del clon
    const isGlobalOwner = (global.owner || []).map(num => num + '@s.whatsapp.net').includes(msg.sender);
    const isSocketOwner = [idBot, ...(config.owner ? [config.owner] : [])].includes(msg.sender) || isGlobalOwner;
    
    if (!isSocketOwner) return sock.reply(msg.chat, global.mess.socket, msg);

    const isPrincipal = sock === global.sock;
    let targetSock = sock;
    let cleanId = sock.user?.id?.split(':')[0];

    // 🔍 CAPTURA DEL TARGET REMOTO (Mención o número en argumentos)
    const mentionedJid = Array.isArray(msg?.mentionedJid) ? msg.mentionedJid.find(Boolean) : null;
    const rawTarget = args[0] ? args[0].replace(/\D/g, '') : '';
    const targetNumber = mentionedJid ? mentionedJid.split('@')[0] : rawTarget;

    // 🔥 MODIFICACIÓN PARA LOGOUT TARGET VIA BOT PRINCIPAL
    if (isPrincipal && targetNumber) {
      if (!isGlobalOwner) {
        return msg.reply('《✧》 Solo un Owner Global puede cerrar la sesión de otros sockets de forma remota.');
      }

      // Buscar la conexión activa en la RAM de global.conns
      const targetConn = (global.conns || []).find(c => c && c.userId === targetNumber);
      
      if (targetConn) {
        targetSock = targetConn;
        cleanId = targetNumber;
      } else {
        // Fallback: Si no está en RAM pero existe su registro en la DB, tomamos su ID para limpiar el disco
        cleanId = targetNumber;
      }
    } 
    // Si el Admin lo usa en el principal SIN argumentos, busca un clon en el grupo actual (Tu lógica vieja)
    else if (isPrincipal && !targetNumber) {
      if (isGlobalOwner && msg.isGroup) {
        const targetConn = (global.conns || []).find(c => c && c.chatId === msg.chat && c !== global.sock);
        if (targetConn) {
          targetSock = targetConn;
          cleanId = targetConn.user?.id?.split(':')[0];
        } else {
          return msg.reply(`《✧》 Para cerrar un bot específico de forma remota usa:\n*${usedPrefix + command} @usuario* o *${usedPrefix + command} [número]*`);
        }
      } else {
        return msg.reply('《✧》 No puedes cerrar la sesión del Bot Principal de esta manera.');
      }
    }

    // Identificar las rutas físicas basándonos en el ID objetivo determinado
    const basePath = 'Sessions';
    const premiumPath = path.join(basePath, 'Premium', cleanId);
    const subsPath = path.join(basePath, 'Subs', cleanId);
    const sessionPath = fs.existsSync(premiumPath) ? premiumPath : (fs.existsSync(subsPath) ? subsPath : null);

    if (!sessionPath) {
      return msg.reply(`《✧》 Error: No se encontró la ruta física de la sesión para el número @${cleanId}`, { mentions: [`${cleanId}@s.whatsapp.net`] });
    }

    const botType = sessionPath.includes(path.join('Sessions', 'Premium')) ? 'Premium' : 'Sub';

    try {
      await sock.sendMessage(msg.chat, {
        text: `《✧》 El Admin Global ha ordenado el *Logout Definitivo* del Socket *${botType}* (@${cleanId}). Desconectando y limpiando recursos...`,
        mentions: [`${cleanId}@s.whatsapp.net`]
      }, { quoted: msg });

      // Si el socket está vivo en la RAM, le inyectamos la bandera y ejecutamos el logout nativo de Baileys
      if (targetSock && targetSock.user?.id?.split(':')[0] === cleanId) {
        targetSock.isLoggingOut = true;
        await targetSock.logout().catch(() => {});
      }
      
      // Esperamos un momento para que Baileys complete el deslogueo en los servidores de WhatsApp
      setTimeout(() => {
        // Remover de la RAM global
        if (global.conns && Array.isArray(global.conns)) {
          const index = global.conns.findIndex((c) => c && c.userId === cleanId);
          if (index !== -1) global.conns.splice(index, 1);
        }

        // 👑 PRESERVACIÓN DE RANGOS PREMIUM E INVALIDACIÓN CONTROLADA
        if (fs.existsSync(sessionPath)) {
          if (botType === 'Premium') {
            // Eliminar solo creds.json para desvincular el QR del teléfono de forma real,
            // pero dejamos la carpeta intacta con su metadata para que el token no se destruya de la DB
            const credsFile = path.join(sessionPath, 'creds.json');
            if (fs.existsSync(credsFile)) fs.unlinkSync(credsFile);
            
            console.log(`《✧》 Sesión Premium de ${cleanId} desvinculada. Carpeta de almacenamiento preservada intacta en el disco.`);
          } else {
            // Si es un clon normal gratuito, limpiamos la carpeta física por completo de la Sessions
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log(`《✧》 Sesión de SubBot ${cleanId} eliminada físicamente de la carpeta Subs.`);
          }
        }
      }, 4000);

    } catch (e) {
      await msg.reply(`> Error crítico al ejecutar logout remoto: *${e.message}*`);
    }
  },
};