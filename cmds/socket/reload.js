import { startSubBot } from './subs.js';
import fs from 'fs';
import path from 'path';
import { jidDecode } from 'baileys';
import db from '#db';

export default {
  command: ['reload'],
  category: 'socket',
  description: 'Recargar la conexión del bot.',
  run: async ({ msg, sock, args }) => {
    const botId = sock?.user?.id.split(':')[0] + '@s.whatsapp.net' || '';
    const botSettings = db.getSettings(botId) || {};
    const isOwner2 = [botId, ...(botSettings.owner ? [botSettings.owner] : []), ...((global).owner || []).map((num) => num + '@s.whatsapp.net')].includes(msg.sender);
    if (!isOwner2) return sock.reply(msg.chat, '《✧》 Este comando solo puede ser ejecutado por un Administrador del Socket.', msg);

    const rawId = sock.user?.id || '';
    const decoded = jidDecode(rawId);
    const cleanId = decoded?.user || rawId.split('@')[0];
    
    // Identificación 100% precisa comparando la memoria del socket
    const isPrincipal = sock === global.sock;

    const caption = '✿ *Reiniciando la conexión del bot de forma segura...*';
    await sock.reply(msg.chat, caption, msg);

    if (isPrincipal) {
      // Reiniciar el bot principal cerrando el WebSocket
      sock.isReloading = true;
      setTimeout(() => {
        try { sock.ws.close(); } catch (e) { console.error('Error cerrando socket principal:', e); }
      }, 1500);
    } else {
      // Para Sub-Bots y Premium Bots: buscar en ambas carpetas
      const botType = botSettings.type || 'Sub';
      const carpetaEsperada = botType === 'Premium' ? 'Premium' : 'Subs';
      let sessionPath = path.join('Sessions', carpetaEsperada, cleanId);
      
      // Si no existe en la carpeta esperada, buscar en la otra
      if (!fs.existsSync(sessionPath)) {
        const carpetaAlternativa = botType === 'Premium' ? 'Subs' : 'Premium';
        sessionPath = path.join('Sessions', carpetaAlternativa, cleanId);
      }
      
      // Si aún no existe, devolver error
      if (!fs.existsSync(sessionPath)) {
        return msg.reply(`《✧》 Error: No se encontró la sesión del ${botType} Bot en el directorio.`);
      }
      
      const phone = args[0] ? args[0].replace(/\D/g, '') : msg.sender.split('@')[0];
      const caption2 = `✿ *Sesión del ${botType} Bot reiniciada correctamente!*.`;
      sock.isReloading = true;
      setTimeout(() => {
        try { sock.ws.close(); } catch (e) { console.error('Error cerrando socket de recarga:', e); }
      }, 1500);
      setTimeout(() => {
        startSubBot(msg, null, caption2, false, phone, msg.chat, true);
      }, 5000);
    }
  },
};