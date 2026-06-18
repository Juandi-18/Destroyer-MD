import { startSubBot } from './subs.js';
import fs from 'fs';
import path from 'path';
import { jidDecode } from 'baileys';
import db from '#db';

export default {
  command: ['reload'],
  category: 'socket',
  description: 'Recargar la conexión del bot actual o de un Sub/Premium remotamente vía mención.',
  run: async ({ msg, sock, args }) => {
    const botId = sock?.user?.id.split(':')[0] + '@s.whatsapp.net' || '';
    const botSettings = db.getSettings(botId) || {};
    
    // Validar si es owner global o dueño asignado
    const isOwner2 = [
      botId, 
      ...(botSettings.owner ? [botSettings.owner] : []), 
      ...((global).owner || []).map((num) => num + '@s.whatsapp.net')
    ].includes(msg.sender);
    
    if (!isOwner2) return sock.reply(msg.chat, '《✧》 Este comando solo puede ser ejecutado por un Administrador del Socket.', msg);

    const rawId = sock.user?.id || '';
    const decoded = jidDecode(rawId);
    const cleanId = decoded?.user || rawId.split('@')[0];
    
    // Identificación precisa del Bot Principal
    const isPrincipal = sock === global.sock;

    // 🔍 CAPTURA DEL TARGET DE REINICIO REMOTO (Mención o número)
    const mentionedJid = Array.isArray(msg?.mentionedJid) ? msg.mentionedJid.find(Boolean) : null;
    const rawTarget = args[0] ? args[0].replace(/\D/g, '') : '';
    const targetNumber = mentionedJid ? mentionedJid.split('@')[0] : rawTarget;

    // 🔥 SI ESTAMOS EN EL BOT PRINCIPAL Y HAY UN OBJETIVO ESPECÍFICO: REINICIO REMOTO
    if (isPrincipal && targetNumber) {
      const targetJid = `${targetNumber}@s.whatsapp.net`;
      const targetSettings = db.getSettings(targetJid) || {};
      const botType = targetSettings.type || 'Sub';
      const carpetaEsperada = botType === 'Premium' ? 'Premium' : 'Subs';
      let sessionPath = path.join('Sessions', carpetaEsperada, targetNumber);

      if (!fs.existsSync(sessionPath)) {
        const carpetaAlternativa = botType === 'Premium' ? 'Subs' : 'Premium';
        sessionPath = path.join('Sessions', carpetaAlternativa, targetNumber);
      }

      if (!fs.existsSync(sessionPath)) {
        return msg.reply(`《✧》 Error: No se encontró la sesión del @${targetNumber} en el almacenamiento.`, { mentions: [targetJid] });
      }

      const remoteCaption = `✿ *Comando Remoto:* El Bot Principal está reiniciando la conexión de @${targetNumber} (${botType} Bot) de forma segura...`;
      await sock.sendMessage(msg.chat, { text: remoteCaption, mentions: [targetJid] }, { quoted: msg });

      // Tumbar el socket viejo de la RAM si está colgado
      const targetIndex = (global.conns || []).findIndex((c) => c && c.userId === targetNumber);
      if (targetIndex !== -1) {
        const activeConn = global.conns[targetIndex];
        try { activeConn.isReloading = true; } catch (e) {}
        try { activeConn.ws?.close(); } catch (e) {}
        try { global.conns.splice(targetIndex, 1); } catch (e) {}
      }

      // Volver a levantar el subbot de forma remota tras 4 segundos
      setTimeout(async () => {
        try {
          const captionSuccess = `✅ *La sesión del ${botType} Bot de @${targetNumber} ha sido restaurada con éxito desde el Principal.*`;
          await startSubBot(null, null, '', false, targetNumber, '', false, botType);
          await sock.sendMessage(msg.chat, { text: captionSuccess, mentions: [targetJid] }, { quoted: msg });
        } catch (err) {
          console.error(`[Remote Reload Error]:`, err);
        }
      }, 4000);

      return; // Salir para que no aplique el autoreinicio al principal
    }

    // -------------------------------------------------------------------------
    // ⚙️ FLUJO TRADICIONAL AUTÓNOMO (Si se usa sin argumentos o en un clon)
    // -------------------------------------------------------------------------
    const caption = '✿ *Reiniciando la conexión del bot de forma segura...*';
    await sock.reply(msg.chat, caption, msg);

    if (isPrincipal) {
      // Reiniciar el bot principal cerrando el WebSocket
      sock.isReloading = true;
      setTimeout(() => {
        try { sock.ws.close(); } catch (e) { console.error('Error cerrando socket principal:', e); }
      }, 1500);
    } else {
      // Para Sub-Bots y Premium Bots locales
      const botType = botSettings.type || 'Sub';
      const carpetaEsperada = botType === 'Premium' ? 'Premium' : 'Subs';
      let sessionPath = path.join('Sessions', carpetaEsperada, cleanId);
      
      if (!fs.existsSync(sessionPath)) {
        const carpetaAlternativa = botType === 'Premium' ? 'Subs' : 'Premium';
        sessionPath = path.join('Sessions', carpetaAlternativa, cleanId);
      }
      
      if (!fs.existsSync(sessionPath)) {
        return msg.reply(`《✧》 Error: No se encontró la sesión del ${botType} Bot en el directorio.`);
      }
      
      const phone = cleanId;
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