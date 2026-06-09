import makeWASocket, { Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, DisconnectReason, jidDecode, useMultiFileAuthState } from 'baileys';
import NodeCache from 'node-cache';
import main from '#main';
import events from '#events';
import qrcode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { smsg, patchGroupMetadata } from '#serialize';
import db from '#db';

if (!global.conns) global.conns = [];
let reintentos = {};
let commandFlags = {};
const cleanJid = (jid = '') => jid.replace(/:\d+/, '').split('@')[0];
const msgRetryCounterCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const userDevicesCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

function getClient(client) {
  const userId = client?.user?.id?.split(':')[0];
  if (!userId) return client;
  return global.conns?.find((c) => c?.user?.id?.split(':')[0] === userId) || client;
}

function normalizePhone(input) {
  let s = String(input).replace(/\D/g, '');
  if (!s) return '';
  if (s.startsWith('0')) s = s.replace(/^0+/, '');
  if (s.length === 10 && s.startsWith('3')) s = '57' + s;
  if (s.startsWith('52') && !s.startsWith('521') && s.length >= 12) s = '521' + s.slice(2);
  if (s.startsWith('54') && !s.startsWith('549') && s.length >= 11) s = '549' + s.slice(2);
  return s;
}

export async function startSubBot(msg, client, caption = '', isCode = false, phone = '', chatId = '', isCommand = false) {
  const id = phone || (msg?.sender || '').split('@')[0];
  
  // Validar que el id no sea vacío ni "undefined"
  if (!id || id === 'undefined' || id.length < 2) {
    console.error(chalk.red(`[ ERROR ] ID inválido para Sub-Bot: "${id}". Se requiere un número válido.`));
    return null;
  }
  
  // Detección dinámica de la jerarquía según los metadatos del usuario
  const user = db.getUser(msg?.sender || id + '@s.whatsapp.net');
  const isPremiumUser = user?.premiumTime && user.premiumTime > Date.now();
  const senderId = msg?.sender || id + '@s.whatsapp.net';

  const premiumFolder = `./Sessions/Premium/${id}`;
  const subsFolder = `./Sessions/Subs/${id}`;
  let carpetaDestino = isPremiumUser ? 'Premium' : 'Subs';
  let sessionFolder = `./Sessions/${carpetaDestino}/${id}`;

  // si el usuario es premium pero su sesión todavía está en Subs, migrar automáticamente
  if (isPremiumUser && fs.existsSync(subsFolder) && !fs.existsSync(premiumFolder)) {
    try {
      fs.mkdirSync(path.dirname(premiumFolder), { recursive: true });
      fs.renameSync(subsFolder, premiumFolder);
      console.log(chalk.gray(`[ ✿ ] Sesión migrada automáticamente Subs → Premium: ${id}`));
    } catch (error) {
      console.error('[ auto-migrate Subs→Premium ] Error:', error);
      const copyDirSync = (src, dest) => {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach((file) => {
          const srcFile = path.join(src, file);
          const destFile = path.join(dest, file);
          if (fs.statSync(srcFile).isDirectory()) copyDirSync(srcFile, destFile);
          else fs.copyFileSync(srcFile, destFile);
        });
      };
      copyDirSync(subsFolder, premiumFolder);
      fs.rmSync(subsFolder, { recursive: true, force: true });
      console.log(chalk.gray(`[ ✿ ] Sesión copiada automáticamente Subs → Premium: ${id}`));
    }
    sessionFolder = premiumFolder;
  }

  // si el usuario ya no es premium pero su sesión está en Premium, degradarla automáticamente
  if (!isPremiumUser && fs.existsSync(premiumFolder) && !fs.existsSync(subsFolder)) {
    try {
      fs.mkdirSync(path.dirname(subsFolder), { recursive: true });
      fs.renameSync(premiumFolder, subsFolder);
      console.log(chalk.gray(`[ ✿ ] Sesión migrada automáticamente Premium → Subs: ${id}`));
    } catch (error) {
      console.error('[ auto-migrate Premium→Subs ] Error:', error);
      const copyDirSync = (src, dest) => {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach((file) => {
          const srcFile = path.join(src, file);
          const destFile = path.join(dest, file);
          if (fs.statSync(srcFile).isDirectory()) copyDirSync(srcFile, destFile);
          else fs.copyFileSync(srcFile, destFile);
        });
      };
      copyDirSync(premiumFolder, subsFolder);
      fs.rmSync(premiumFolder, { recursive: true, force: true });
      console.log(chalk.gray(`[ ✿ ] Sesión copiada automáticamente Premium → Subs: ${id}`));
    }
    sessionFolder = subsFolder;
  }

  if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

  // Guardar metadato para prevenir confusión de credenciales
  const metadataFile = path.join(sessionFolder, 'metadata.json');
  if (!fs.existsSync(metadataFile)) {
    fs.writeFileSync(metadataFile, JSON.stringify({
      createdAt: new Date().toISOString(),
      type: carpetaDestino,
      ownerJid: senderId,
      originalPhone: id
    }, null, 2));
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
  const { version } = await fetchLatestBaileysVersion();
  const msgStore = new Map();
  const msgLimit = 500;
  console.info = () => {};
  
  const socks = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.windows('Chrome'),
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
    shouldIgnoreJid: (jid) => jid.endsWith('@broadcast'),
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    keepAliveIntervalMs: 30_000,
    msgRetryCounterCache,
    userDevicesCache,
    getMessage: async (key) => msgStore.get(key.remoteJid + ':' + key.id),
  });
  
  patchGroupMetadata(socks);
  socks.isCommand = isCommand;
  socks.senderId = senderId;
  socks.chatId = chatId;
  socks.client = client || socks;
  socks.isCode = isCode;
  socks.sessionFolder = sessionFolder;
  socks.botType = carpetaDestino;
  
  let sentMsg = null;
  let msgCode = null;
  let timerBorrador = null;

  const limpiarMensajesVinculacion = async () => {
    if (timerBorrador) { clearTimeout(timerBorrador); timerBorrador = null; }
    try { if (sentMsg && socks.client && socks.chatId) { await socks.client.sendMessage(socks.chatId, { delete: sentMsg.key }); sentMsg = null; } } catch {}
    try { if (msgCode && socks.client && socks.chatId) { await socks.client.sendMessage(socks.chatId, { delete: msgCode.key }); msgCode = null; } } catch {}
  };

  socks.ev.on('creds.update', saveCreds);
  socks.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      const decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
    }
    return jid;
  };
  
  let bootTime = Date.now();
  let botReady = false;
  socks.ev.on('messages.upsert', async ({ messages, type }) => {
    if (!botReady) return;
    if (type !== 'notify') return;
    for (const raw of messages) {
      if (raw?.message && raw?.key?.id) {
        const sid = raw.key.remoteJid + ':' + raw.key.id;
        msgStore.set(sid, raw.message);
        if (msgStore.size > msgLimit) msgStore.delete(msgStore.keys().next().value);
      }
      try {
        if (!raw?.message || raw.key?.remoteJid === 'status@broadcast') continue;
        if ((raw.messageTimestamp * 1000) < bootTime - 15_000) continue;
        if (raw.message.ephemeralMessage) raw.message = raw.message.ephemeralMessage.message;
        const m = await smsg(socks, raw);
        if (typeof main === 'function') main(socks, m, messages).catch((err) => console.error('[ ✿  ]  Main Owner »', err?.message));
      } catch (e) { console.log(e); }
    }
  });
  
  try { await events(socks, msg); } catch (err) { console.log(chalk.gray(`[ EVENT ERROR  ]  → ${err}`)); }
  
  socks.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (connection === 'open') {
      bootTime = Date.now();
      botReady = true;
      socks.uptime = Date.now();
      socks.userId = cleanJid(socks.user?.id?.split('@')[0]);
      const botDir = socks.userId + '@s.whatsapp.net';
      const settings = db.getSettings(botDir) || {};
      const nuevoTipo = carpetaDestino === 'Premium' ? 'Premium' : 'Sub';

      // SOLO actualizamos la base de datos si el tipo de bot cambió realmente
      if (settings.type !== nuevoTipo) {
        try {
          db.setSettings(botDir, 'type', nuevoTipo);
        } catch (e) { console.error('[ ✿ ] Error actualizando settings:', e); }
      }
      
      // Evitar entradas duplicadas y logs repetidos al reconectar/revivir sockets
      if (!Array.isArray(global.conns)) global.conns = [];
      const existingIndexByFolder = global.conns.findIndex((c) => c && c.sessionFolder === socks.sessionFolder);
      const existingIndexByUser = global.conns.findIndex((c) => c && c.userId === socks.userId);
      let didLog = false;
      if (existingIndexByFolder !== -1) {
        if (global.conns[existingIndexByFolder] !== socks) {
          try { global.conns[existingIndexByFolder]?.ws?.close?.(); } catch {}
          global.conns[existingIndexByFolder] = socks;
          didLog = true;
        }
      } else if (existingIndexByUser !== -1) {
        if (global.conns[existingIndexByUser] !== socks) {
          try { global.conns[existingIndexByUser]?.ws?.close?.(); } catch {}
          global.conns[existingIndexByUser] = socks;
          didLog = true;
        }
      } else {
        global.conns.push(socks);
        didLog = true;
      }
      delete reintentos[socks.userId || id];
      if (didLog) {
        const connectionLabel = carpetaDestino === 'Premium' ? 'BOT-PREMIUM' : 'SUB-BOT';
        console.log(chalk.gray(`[ ✿  ]  ${connectionLabel} conectado: ${socks.userId}`));
      }
      
      await limpiarMensajesVinculacion();

      const sentFlagFile = path.join(socks.sessionFolder, 'msg_sent.flag');
      const hasSentMessage = fs.existsSync(sentFlagFile);
      if (msg && socks.isCommand && !hasSentMessage && socks.client && socks.chatId) {
        const mensajeConfirmacion = carpetaDestino === 'Premium' 
          ? `👑 ¡Felicidades! Has conectado un nuevo Socket de tipo *Premium* con acceso total sin restricciones.` 
          : `✎ Has conectado un nuevo Socket de tipo *Sub*.`;

        await socks.client.sendMessage(socks.chatId, { text: mensajeConfirmacion }, { quoted: msg });
        fs.writeFileSync(sentFlagFile, '1');
        socks.isCommand = false;
        if (commandFlags[socks.senderId]) delete commandFlags[socks.senderId];
      }
    }
    
    if (connection === 'close') {
      const botId = socks.userId || id;
      const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.reason || 0;

      const cleanupOldConn = () => {
        const index = global.conns.findIndex((c) => c && c.sessionFolder === socks.sessionFolder);
        if (index !== -1) {
          global.conns.splice(index, 1);
          console.log(chalk.gray(`[ ✿ ] Sub-Bot ${botId} removido de conexiones activas.`));
        }
        // NUEVO: Limpiar también de global.loadingBots
        if (global.loadingBots) {
          global.loadingBots.delete(botId);
          global.loadingBots.delete(socks.userId);
        }
      };

      if (socks.isLoggingOut || socks.isReloading) {
        cleanupOldConn();
        delete reintentos[botId];
        await limpiarMensajesVinculacion();
        if (socks.isLoggingOut && fs.existsSync(sessionFolder)) {
          setTimeout(() => {
            try {
              fs.rmSync(sessionFolder, { recursive: true, force: true });
              console.log(chalk.gray(`[ ✿ ] Sesión limpiada: ${sessionFolder}`));
            }
            catch (e) { console.error(`[ ✿  ] No se pudo eliminar ${sessionFolder}:`, e); }
          }, 3000);
        }
        return;
      }

      if ([401, 403].includes(reason)) {
        reintentos[botId] = (reintentos[botId] || 0) + 1;
        if (reintentos[botId] <= 5) {
          console.log(chalk.gray(`[ ✿  ]  SUB-BOT ${botId} Desautenticado (${reason}), intento ${reintentos[botId]}/5...`));
          setTimeout(() => startSubBot(msg, getClient(client), caption, isCode, phone, chatId, isCommand), 8000);
        } else {
          console.log(chalk.gray(`[ ✿  ]  SUB-BOT ${botId} Falló permanentemente (${reason}). Limpiando sesión.`));
          delete reintentos[botId];
          cleanupOldConn();
          await limpiarMensajesVinculacion();
          if (fs.existsSync(sessionFolder)) {
            setTimeout(() => {
              try {
                fs.rmSync(sessionFolder, { recursive: true, force: true });
                console.log(chalk.gray(`[ ✿ ] Sesión fallida eliminada: ${sessionFolder}`));
              } catch (e) { console.error(`[ ✿  ] No se pudo eliminar ${sessionFolder}:`, e); }
            }, 3000);
          }
        }
        return;
      }
      cleanupOldConn();
      console.log(chalk.gray(`[ ✿  ]  SUB-BOT ${botId} reconectando en 5s...`));
      setTimeout(() => startSubBot(msg, getClient(client), caption, isCode, phone, chatId, isCommand), 5000);
    }
    
    if (qr && isCode && phone && socks.client && chatId && senderId && commandFlags[senderId]) {
      try {
        let codeGen = await socks.requestPairingCode(phone);
        codeGen = codeGen.match(/.{1,4}/g)?.join('-') || codeGen;
        
        if (msg) {
          sentMsg = await socks.client.sendMessage(chatId, { text: caption }, { quoted: msg });
          msgCode = await socks.client.sendMessage(chatId, { text: codeGen }, { quoted: msg });
        }
        delete commandFlags[senderId];
        
        timerBorrador = setTimeout(async () => { await limpiarMensajesVinculacion(); }, 60000);
      } catch (err) { console.error('[Código Error]', err); }
    }
    
    if (qr && !isCode && socks.client && chatId && senderId && commandFlags[senderId]) {
      try {
        if (msg) {
          sentMsg = await socks.client.sendMessage(chatId, { image: await qrcode.toBuffer(qr, { scale: 8 }), caption }, { quoted: msg });
        }
        delete commandFlags[senderId];
        timerBorrador = setTimeout(async () => { await limpiarMensajesVinculacion(); }, 60000);
      } catch (err) { console.error('[QR Error]', err); }
    }
  });
  return socks;
}

function msToTime(ms) {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0
    ? `${minutes} minuto${minutes !== 1 ? 's' : ''} y ${seconds} segundo${seconds !== 1 ? 's' : ''}`
    : `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
}

export default {
  command: ['code', 'qr', 'codepremium', 'qrpremium'],
  category: 'socket',
  description: 'Gestionar bots subbots tradicionales y Premium.',
  run: async ({ msg, sock, args, usedPrefix, command, __dirname }) => {
    const mainBotJid = global.sock?.user?.id?.split(':')[0] + '@s.whatsapp.net';
    const currentBotJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const isRunningOnSubBot = currentBotJid !== mainBotJid;

    const user = db.getUser(msg.sender);
    const isPremium = user.premiumTime && user.premiumTime > Date.now();
    let isPremiumRequest = /premium/i.test(command);

    // --- REGLAS DE RESTRICCIÓN DE JERARQUÍA ---
    if (isRunningOnSubBot) {
      const basePath = 'Sessions';
      const numberId = sock.user.id.split(':')[0];
      const isCurrentBotPremium = fs.existsSync(path.join(basePath, 'Premium', numberId));

      if (isCurrentBotPremium) {
        if (!isPremiumRequest) {
          return sock.reply(msg.chat, `👑 Al ser usuario de un *Bot Premium*, tus invitaciones se generan automáticamente en calidad Alta Gama. Por favor, usa exclusivamente: *${usedPrefix}codepremium* o *${usedPrefix}qrpremium*.`, msg);
        }
      } else {
        if (isPremiumRequest) {
          return sock.reply(msg.chat, `❌ Los *SubBots Normales* no tienen autorización para emitir credenciales de Alta Gama. Ese comando es exclusivo del Bot Principal.`, msg);
        }
      }
    } else {
      if (isPremiumRequest && !isPremium) {
        return sock.reply(msg.chat, `❌ No tienes una suscripción *Premium* activa. Ponte en contacto con el Owner para adquirir tu pase 👑.`, msg);
      }
    }

    if (!isPremium) {
      db.setCreate('users', msg.sender, 'Subs', 0);
      const lastRequest = user.Subs || 0;
      if (Date.now() - lastRequest < 80000) {
        const remainingTime = (lastRequest + 80000) - Date.now();
        return sock.reply(msg.chat, `ꕥ Debes esperar *${msToTime(remainingTime)}* para volver a intentar vincular un socket.`, msg);
      }
    }

    const basePath = 'Sessions';
    const allSubs = fs.existsSync(path.join(basePath, 'Subs')) ? fs.readdirSync(path.join(basePath, 'Subs')) : [];
    const allPremiums = fs.existsSync(path.join(basePath, 'Premium')) ? fs.readdirSync(path.join(basePath, 'Premium')) : [];
    const totalActiveClones = allSubs.length + allPremiums.length;
    
    if (totalActiveClones >= 50) {
      return sock.reply(msg.chat, '✐ No se han encontrado espacios disponibles para registrar un `Sub-Bot`.', msg);
    }

    commandFlags[msg.sender] = true;

    const rtx = '`✤` Vincula tu *SubBot Normal* usando el *código.*\n\n> ✥ Sigue las *instrucciones*\n\n*›* Click en los *3 puntos*\n*›* Toque *dispositivos vinculados*\n*›* Vincular *nuevo dispositivo*\n*›* Selecciona *Vincular con el número de teléfono*\n\n⚠️ *`Nota`*: Este clon gratuito tendrá comandos de descargas e IA deshabilitados.';
    const rtx2 = '`✤` Vincula tu *SubBot Normal* usando *código qr.*\n\n*›* Dispositivos vinculados ➜ Escanear QR.\n⚠️ *`Nota`*: Este clon gratuito tendrá comandos de descargas e IA deshabilitados.';
    
    const rtxPremium = '`👑 SUBCONEXIÓN PREMIUM 👑`\n\nVincula tu *Bot Espejo de Alta Gama* usando el *código.*\n\n> ✧ *¡Beneficios Premium Activos!* ➜ Acceso ilimitado a todos los comandos de descargas (YouTube, TikTok, Facebook, adult), herramientas de Inteligencia Artificial avanzadas, respuestas más veloces y libre de Cooldown.';
    const rtx2Premium = '`👑 SUBCONEXIÓN PREMIUM 👑`\n\nEscanea el código *QR* generado para activar tu *Bot Espejo con Acceso Absoluto* sin restricciones.';

    const isCode = /code/i.test(command);
    const isCommand = true;
    const caption = isPremiumRequest ? (isCode ? rtxPremium : rtx2Premium) : (isCode ? rtx : rtx2);
    
    const fullArgs = args.join(' ');
    const separatorIndex = fullArgs.search(/[|•\/]/);
    const rawPhone = separatorIndex === -1 ? fullArgs.trim() : fullArgs.slice(separatorIndex + 1).trim();
    const phone = normalizePhone(rawPhone || msg.sender.split('@')[0]);
    
    await startSubBot(msg, sock, caption, isCode, phone, msg.chat, isCommand);
    
    if (!isPremium) {
      db.setUser(msg.sender, 'Subs', Date.now());
    }
  },
};