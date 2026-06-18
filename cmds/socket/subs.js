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

export async function startSubBot(msg, client, caption = '', isCode = false, phone = '', chatId = '', isCommand = false, forceType = null) {
  const id = phone || (msg?.sender || '').split('@')[0];
  
  if (!id || id === 'undefined' || id.length < 2) {
    console.error(chalk.red(`[ ERROR ] ID inválido para Sub-Bot: "${id}". Se requiere un número válido.`));
    return null;
  }

  if (global.loadingBots) global.loadingBots.add(id);
  
  const user = db.getUser(msg?.sender || id + '@s.whatsapp.net');
  const hasTokenUser = !!db.getActiveTokenByUser(id);
  const isPremiumUser = (user?.tokenExpires && user.tokenExpires > Date.now()) || hasTokenUser;
  const senderId = msg?.sender || id + '@s.whatsapp.net';

  const premiumFolder = `./Sessions/Premium/${id}`;
  const subsFolder = `./Sessions/Subs/${id}`;
  let carpetaDestino = forceType ? forceType : (isPremiumUser ? 'Premium' : 'Subs');
  let sessionFolder = `./Sessions/${carpetaDestino}/${id}`;

  if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

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
  
  // ⚡ CORRECCIÓN QUIRÚRGICA: Variables movidas aquí para encapsularlas por instancia clon
  let bootTime = Date.now();
  let botReady = false;
  
  let sentMsg = null;
  let msgCode = null;
  let timerBorrador = null;

  const limpiarMensajesVinculacion = async () => {
    if (timerBorrador) { clearTimeout(timerBorrador); timerBorrador = null; }
    try { if (sentMsg && socks.client && socks.chatId) { await socks.client.sendMessage(socks.chatId, { delete: sentMsg.key }); sentMsg = null; } } catch {}
    try { if (msgCode && socks.client && socks.chatId) { await socks.client.sendMessage(socks.chatId, { delete: msgCode.key }); msgCode = null; } } catch {}
  };

  socks.ev.on('creds.update', async () => {
    try {
      if (fs.existsSync(sessionFolder)) {
        await saveCreds();
      }
    } catch (e) {
      console.error('[ ✿ ] Error controlado en creds.update (guardado evitado):', e.message);
    }
  });

  socks.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      const decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
    }
    return jid;
  };
  
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
      botReady = false; // Forzamos un reset momentáneo para limpiar caché
      socks.uptime = Date.now();
      socks.userId = cleanJid(socks.user?.id?.split('@')[0]);
      
      // Forzar flush de notificaciones pendientes y reactivación limpia del handler de mensajes
      setTimeout(() => {
        botReady = true;
        console.log(chalk.greenBright(`[ ✿ ] SUB-BOT ${socks.userId} flujo de eventos message.upsert reactivado y descongelado con éxito.`));
      }, 2000);
      
      const botDir = socks.userId + '@s.whatsapp.net';
      const settings = db.getSettings(botDir) || {};
      const nuevoTipo = carpetaDestino === 'Premium' ? 'Premium' : 'Sub';

      if (settings.type !== nuevoTipo) {
        try {
          db.setSettings(botDir, 'type', nuevoTipo);
        } catch (e) { console.error('[ ✿ ] Error actualizando settings:', e); }
      }
      
      if (!Array.isArray(global.conns)) global.conns = [];
      const existingIndexByFolder = global.conns.findIndex((c) => c && c.sessionFolder === socks.sessionFolder);
      const existingIndexByUser = global.conns.findIndex((c) => c && c.userId === socks.userId);
      let didLog = false;
      
      if (existingIndexByFolder !== -1) {
        if (global.conns[existingIndexByFolder] !== socks) {
          try { global.conns[existingIndexByFolder].isReplacing = true; } catch (e) {}
          try { global.conns[existingIndexByFolder]?.ws?.close?.(); } catch {}
          global.conns[existingIndexByFolder] = socks;
          didLog = true;
        }
      } else if (existingIndexByUser !== -1) {
        if (global.conns[existingIndexByUser] !== socks) {
          try { global.conns[existingIndexByUser].isReplacing = true; } catch (e) {}
          try { global.conns[existingIndexByUser]?.ws?.close?.(); } catch {}
          global.conns[existingIndexByUser] = socks;
          didLog = true;
        }
      } else {
        global.conns.push(socks);
        didLog = true;
      }
      if (global.loadingBots) global.loadingBots.delete(socks.userId || id);
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
      const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode || lastDisconnect?.reason || 0;
      const errorMessage = lastDisconnect?.error?.message || 'Sin mensaje de error';
      
      console.log(chalk.bgMagenta.white.bold(' DEBUG SUB-BOT '), chalk.magenta(`[${id}] Cierre detectado. Código: ${statusCode} | Mensaje: ${errorMessage}`));

      const cleanupOldConn = () => {
        const index = global.conns.findIndex((c) => c && c.sessionFolder === socks.sessionFolder);
        if (index !== -1) {
          global.conns.splice(index, 1);
          console.log(chalk.gray(`[ ✿ ] Sub-Bot ${botId} removido de conexiones activas.`));
        }
        if (global.loadingBots) {
          global.loadingBots.delete(botId);
          global.loadingBots.delete(socks.userId);
        }
      };

      if (socks.isLoggingOut || socks.isReloading || socks.isReplacing) {
        const targetId = socks.userId || id;
        cleanupOldConn();
        delete reintentos[botId];
        await limpiarMensajesVinculacion();

        // CAPTURA Y LANZAMIENTO DE MIGRACIÓN:
        // Si el clon viejo era un Sub normal pero en la DB ya se actualizó a Premium, forzamos su encendido VIP
        if (socks.isReloading && socks.botType === 'Sub') {
          try {
            const targetBotJid = `${targetId}@s.whatsapp.net`;
            const currentSettings = db.getSettings(targetBotJid) || {};
            if (currentSettings.type === 'Premium') {
              console.log(chalk.cyanBright(`[ ✿ ] MIGRACIÓN CONTROLADA: Levantando bot ${targetId} en el canal Premium.`));
              setTimeout(() => startSubBot(msg, getClient(client), caption, isCode, targetId, chatId, isCommand, 'Premium'), 2500);
              return;
            }
          } catch (e) { console.error('[Error en puente de migración]:', e); }
        }

        if (socks.isLoggingOut && fs.existsSync(sessionFolder)) {
          setTimeout(() => {
            try {
              fs.rmSync(sessionFolder, { recursive: true, force: true });
              console.log(chalk.gray(`[ ✿ ] Sesión limpiada: ${sessionFolder}`));
            } catch (e) { console.error(`[ ✿  ] No se pudo eliminar ${sessionFolder}:`, e); }
          }, 3000);
        }
        return;
      }

      // 1. MANEJO DE CONFLICTO REAL O STREAM DAÑADO CRÍTICO (440)
      if (statusCode === 440 || errorMessage.toLowerCase().includes('conflict')) {
        console.log(chalk.yellowBright(`[ ✿ ] SUB-BOT ${botId} detectó conflicto real (${statusCode}). Limpiando sesión física y RAM.`));
        cleanupOldConn();
        
        if (fs.existsSync(sessionFolder)) {
          try {
            fs.rmSync(sessionFolder, { recursive: true, force: true });
            console.log(chalk.gray(`[ ✿ ] Carpeta de sesión eliminada por conflicto real: ${sessionFolder}`));
          } catch (e) {
            console.error(`[ ✿ ] Error eliminando carpeta en conflicto:`, e);
          }
        }
        return;
      }

      // 2. MANEJO DE REINICIO CONTROLADO (515 - RESTART REQUIRED / STREAM ERRORED NO CRÍTICO)
      if (statusCode === 515 || errorMessage.toLowerCase().includes('restart required') || errorMessage.toLowerCase().includes('stream errored')) {
        console.log(chalk.cyanBright(`[ ✿ ] SUB-BOT ${botId} requiere reinicio controlado (${statusCode}). Reintentando conexión en 5s sin borrar archivos físicos.`));
        cleanupOldConn();
        
        // No borramos la carpeta física para permitir que Baileys termine de procesar las credenciales
        setTimeout(() => startSubBot(msg, getClient(client), caption, isCode, phone, chatId, isCommand), 5000);
        return;
      }

      // 3. MANEJO DE DESAUTENTICACIÓN REAL (401 / LOGGED OUT)
      if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
        const isAwaitingAuth = !socks.user?.id;

        if (isAwaitingAuth || socks.isCommand) {
          console.log(chalk.yellowBright(`[ ✿ ] DEBUG SUB-BOT [${id}] Ignorando borrado 401: Sesión en vinculación activa.`));
          return;
        }

        if (!socks.isReplacing && !socks.isReloading) {
          console.log(chalk.redBright(`[ ✿ ] SUB-BOT ${id} Desautenticado (401) real. Limpiando recursos de forma segura...`));
          try { delete reintentos[botId]; } catch (e) {}
          try { cleanupOldConn(); } catch (e) {}
          try { await limpiarMensajesVinculacion(); } catch (e) {}

          if (fs.existsSync(sessionFolder)) {
            if (carpetaDestino === 'Premium') {
              // PROTECCIÓN PREMIUM: No borramos la carpeta física si es un bot Premium deslogueado
              console.log(chalk.cyanBright(`[ ✿ ] Sesión Premium de ${id} preservada en el almacenamiento local de forma segura.`));
            } else {
              // Si es sub normal, se elimina la basura
              fs.rmSync(sessionFolder, { recursive: true, force: true });
              console.log(chalk.gray(`[ ✿ ] Sesión eliminada permanentemente por desvinculación real: ${sessionFolder}`));
            }
          }
        } else {
          console.log(chalk.yellowBright(`[ ✿ ] SUB-BOT ${id} Ignorando borrado físico 401 debido a inicialización/reemplazo controlado.`));
        }
        return;
      }

      // 4. MANEJO DE EXPIRACIÓN DE VINCULACIÓN (408 - TIMEOUT / QR EXPIRED)
      if (statusCode === 408 || errorMessage.toLowerCase().includes('qr refs attempts ended')) {
        const isNeverConnected = !socks.user?.id;
        
        // Solo proceder con limpieza definitiva si la sesión nunca llegó a conectarse
        // y no estamos en un proceso controlado de recarga/reemplazo, y no es Premium
        if (isNeverConnected && !socks.isReloading && !socks.isReplacing && socks.botType !== 'Premium') {
          console.log(chalk.redBright(`[ ✿ ] TIMEOUT (${statusCode}): La vinculación de ${id} expiró. Limpiando recursos...`));
          
          cleanupOldConn();
          try { delete reintentos[botId]; } catch (e) {}
          try { await limpiarMensajesVinculacion(); } catch (e) {}
          
          if (fs.existsSync(sessionFolder)) {
            try { fs.rmSync(sessionFolder, { recursive: true, force: true }); } catch (e) {}
          }
          
          try {
            const targetBotJid = `${id}@s.whatsapp.net`;
            const currentSettings = db.getSettings(targetBotJid) || {};
            // Solo borrar de la DB si es un sub gratuito abandonado y no un bot Premium legítimo
            if (currentSettings.type !== 'Premium') {
              db.deletedb('settings', targetBotJid);
              console.log(chalk.gray(`[ ✿ ] Registros de SQLite removidos de forma segura para evitar conflictos.`));
            }
          } catch (e) {}
          
          return;
        }
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
  description: 'Gestionar bots subbots tradicionales y Tokens.',
  run: async ({ msg, sock, args, usedPrefix, command, __dirname }) => {
    const mainBotJid = global.sock?.user?.id?.split(':')[0] + '@s.whatsapp.net';
    const currentBotJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const isRunningOnSubBot = currentBotJid !== mainBotJid;

    const user = db.getUser(msg.sender);
    const tokenCommands = ['codetoken', 'qrtoken', 'codepremium', 'qrpremium'];
    const isTokenRequest = tokenCommands.includes(command);

    // --- 1. DETERMINAR ID OBJETIVO REAL ---
    const fullArgs = args.join(' ').trim();
    const separatorIndex = fullArgs.search(/[|•\/]/);
    const rawArg = separatorIndex === -1 ? fullArgs : fullArgs.slice(separatorIndex + 1).trim();
    const senderNumeric = msg.sender.split('@')[0];

    const isOwner = (() => {
      if (!global.owner) return false;
      
      // 1. Convertimos la lista de owners globales a JIDs puros con su formato correcto
      const ownersList = (Array.isArray(global.owner) ? global.owner : [global.owner])
        .map(n => String(n).replace(/\D/g, '') + '@s.whatsapp.net');

      // 2. Obtenemos el JID del bot actual que está corriendo esta instancia clon
      const currentBotFullJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

      // 3. El bypass es válido si este clon le pertenece directamente a un número de la lista de Owners
      return ownersList.includes(currentBotFullJid);
    })();

    let id = cleanJid(senderNumeric);
    if (rawArg && isOwner) {
      const isTokenFormat = rawArg.toUpperCase().match(/^[A-Z0-9]{4}-[0-9]{4}$/);
      if (!isTokenFormat) {
        const provided = cleanJid(rawArg);
        if (provided) id = provided;
      }
    }

    const phone = id;
    const mainBotNumber = global.sock?.user?.id?.split(':')[0];

    // --- CANDADO 1: DETECTAR SI EL OBJETIVO ES EL BOT PRINCIPAL GLOBAL ---
    if (id === mainBotNumber) {
      return sock.reply(msg.chat, `👑 *[BOT PRINCIPAL]* 👑\n\nEste número es el Bot Principal (Owner) del sistema global. No puedes solicitar códigos de emparejamiento para él.`, msg);
    }

    // --- CANDADO 2: COMPROBACIÓN FÍSICA Y EN MEMORIA DE RANGOS ---
    const pathSub = path.join('Sessions', 'Subs', id);
    const pathPremium = path.join('Sessions', 'Premium', id);
    const hasRealSub = fs.existsSync(pathSub) && fs.existsSync(path.join(pathSub, 'creds.json'));
    const hasRealPremium = fs.existsSync(pathPremium) && fs.existsSync(path.join(pathPremium, 'creds.json'));

    const isConnectedInRAMPremium = Array.isArray(global.conns) && global.conns.some(c => c && c.userId === id && c.botType === 'Premium');
    const isConnectedInRAMSub = Array.isArray(global.conns) && global.conns.some(c => c && c.userId === id && c.botType === 'Sub');

    const isPremiumActive = isConnectedInRAMPremium || hasRealPremium;

    // Revisamos si el usuario tiene un Token Premium ACTIVO en la base de datos
    const activeTokenRecord = db.getActiveTokenByUser(id);
    const hasActiveToken = activeTokenRecord && activeTokenRecord.expiresAt > Date.now();

    // BLOQUEO 1: Ya tiene una sesión Premium operando (RAM o credenciales vivas)
    if (isPremiumActive) {
      return sock.reply(msg.chat, `⚠️ *[SESIÓN PREMIUM ACTIVA]* ⚠️\n\nTeniendo una sesión activa e iniciada como Premium no puedes volver a solicitar un código de vinculación.`, msg);
    }

    // BLOQUEO 2: Es Premium (deslogueado/sin credenciales) intentando usar !code normal
    if (!isTokenRequest && hasActiveToken) {
      const userJidReal = `${id}@s.whatsapp.net`;
      try {
        await sock.sendMessage(userJidReal, { text: `👑 *RECORDATORIO DE TOKEN PREMIUM* 👑\n\nTu token de acceso activo es: *${activeTokenRecord.token}*\n\nÚsalo para reconectar tu sesión con el comando:\n${usedPrefix}codepremium ${activeTokenRecord.token}` });
      } catch (e) {
        console.error("Error enviando token al privado:", e);
      }

      return sock.reply(msg.chat, `⚠️ *[SESIÓN PREMIUM ACTIVA]* ⚠️\n\nTeniendo una sesión activa e iniciada como Premium no puedes solicitar un código Sub normal.\n\nPara reconectarte, debes usar obligatoriamente:\n*${usedPrefix}codepremium [tu-token]*\n\n> ✎ Te he enviado un recordatorio de tu token al privado.`, msg);
    }

    // BLOQUEO 3: Es un Sub-Bot normal operando
    if ((isConnectedInRAMSub || hasRealSub) && !isTokenRequest) {
      return sock.reply(msg.chat, `⚠️ *[SESIÓN SUB-BOT ACTIVA]* ⚠️\n\nTu número ya está conectado como un Sub-Bot Normal. Si deseas subir al rango Premium, debes adquirir un Token y usar '${usedPrefix}codepremium'.`, msg);
    }

    // --- FLUJO EXCLUSIVO PARA PETICIONES PREMIUM (!codepremium / !qrpremium) ---
    if (isTokenRequest) {
      const providedToken = args[0] || '';
      if (!providedToken) {
        return sock.reply(msg.chat, `⚠️ *[TOKEN REQUERIDO]* ⚠️\n\nPara vincularte al rango Premium, es obligatorio que ingreses el token físico al lado del comando.\n\n*Uso correcto:* .codepremium [TU-TOKEN]\n*Ejemplo:* .codepremium ABCD-1234`, msg);
      }

      const tokenRecord = db.getTokenRecord(providedToken.toUpperCase());

      // Limpieza de emergencia para asegurar que ambos IDs sean solo dígitos puros de WhatsApp
      const cleanDbUserId = tokenRecord?.userId ? String(tokenRecord.userId).replace(/\D/g, '') : '';
      const cleanCurrentId = id ? String(id).replace(/\D/g, '') : '';

      if (!tokenRecord || tokenRecord.active !== 1 || tokenRecord.expiresAt <= Date.now() || cleanDbUserId !== cleanCurrentId) {
        return sock.reply(msg.chat, `❌ Token inválido, expirado o no pertenece a este número. Pídele un token válido a un Owner.`, msg);
      }

      // Si el usuario ya tiene la carpeta Premium física (cerró sesión con logout pero sus archivos siguen ahí)
      if (hasRealPremium || fs.existsSync(path.join('Sessions', 'Premium', id))) {
        await sock.reply(msg.chat, `🔄 *[RECONEXIÓN PREMIUM DETECTADA]* 🔄\n\nTu sesión Premium histórica ha sido localizada en el disco. El sistema está levantando tu bot en el canal VIP de forma automática. Por favor, espera unos segundos...`, msg);
        
        try {
          // Forzamos el arranque limpio de persistencia (isCode = false, isCommand = false)
          await startSubBot(null, null, '', false, id, '', false, 'Premium');
        } catch (e) {
          console.error('[Premium Reconnection Error]:', e);
        }
        return;
      }

      // Si el usuario ya está conectado como Sub-Bot gratuito, aplicamos la MIGRACIÓN EN CALIENTE
      if (hasRealSub || isConnectedInRAMSub) {
        const successMessage = "👑 *¡ACCESO PREMIUM DETECTADO CON ÉXITO!* 👑\n\nTu token ha sido verificado. El sistema está cerrando tu sesión gratuita de forma segura para migrarte al canal Premium de alto rendimiento. Por favor, espera unos segundos a que se complete el reinicio.";
        await sock.reply(msg.chat, successMessage, msg);

        try {
          const subsDir = path.join('Sessions', 'Subs', id);
          const premDir = path.join('Sessions', 'Premium', id);

          let activeIndex = -1;
          if (Array.isArray(global.conns)) {
            activeIndex = global.conns.findIndex((c) => c && c.userId === id);
          }

          if (activeIndex !== -1) {
            const activeConn = global.conns[activeIndex];
            try { activeConn.isReloading = true; } catch (e) {}
            try { activeConn.ws?.close?.(); } catch (e) {}
            try { global.conns.splice(activeIndex, 1); } catch (e) {}
          }

          await new Promise((res) => setTimeout(res, 1500));

          if (fs.existsSync(subsDir)) {
            fs.mkdirSync(path.dirname(premDir), { recursive: true });
            fs.renameSync(subsDir, premDir);
          }
          try { db.setSettings(`${id}@s.whatsapp.net`, 'type', 'Premium'); } catch (e) {}
          await startSubBot(null, null, '', false, id, '', false, 'Premium');
        } catch (e) {
          console.error('[Token Migration] Error:', e);
        }
        return; // Termina aquí porque ya se reinició como Premium.
      }
      
      // Si NO está conectado como Sub (ej: perdió sesión), dejamos que el flujo avance
      // para que el bot genere el código/qr de emparejamiento como Premium.
    }

    // --- CONTINUACIÓN DEL FLUJO NORMAL ---
    if (!isPremiumActive) {
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
    
    const rtxToken = '`👑 SUBCONEXIÓN TOKEN 👑`\n\nVincula tu *Bot Espejo con Token* usando el *código.*\n\n> ✧ *¡Beneficios de Token Activos!* ➜ Acceso ilimitado a todos los comandos de descargas (YouTube, TikTok, Facebook, adult), herramientas de Inteligencia Artificial avanzadas, respuestas más veloces y libre de Cooldown.';
    const rtx2Token = '`👑 SUBCONEXIÓN TOKEN 👑`\n\nEscanea el código *QR* generado para activar tu *Bot Espejo con Acceso Absoluto* sin restricciones.';

    const isCode = /code/i.test(command);
    const isCommand = true;
    const caption = isTokenRequest ? (isCode ? rtxToken : rtx2Token) : (isCode ? rtx : rtx2);

    try {
      if (Array.isArray(global.conns)) {
        const oldIndex = global.conns.findIndex(c => c && c.userId === id);
        if (oldIndex !== -1) {
          try { global.conns[oldIndex].isReloading = true; } catch (e) {}
          try { global.conns[oldIndex].ws?.close?.(); } catch (e) {}
          global.conns.splice(oldIndex, 1);
        }
      }
    } catch (e) { /* ignore */ }

    try {
      const botJid = id + '@s.whatsapp.net';
      const existingSettings = db.getSettings(botJid) || {};
      try { db.getSettings(botJid); } catch (e) {}
      try { db.setSettings(botJid, 'type', isTokenRequest ? 'Premium' : 'Sub'); } catch (e) {}
      if (!existingSettings.owner) {
        try { db.setSettings(botJid, 'owner', msg.sender); } catch (e) {}
      }
    } catch (e) { /* ignore */ }

    await startSubBot(msg, sock, caption, isCode, phone, msg.chat, isCommand);
    
    if (!isPremiumActive) {
      db.setUser(msg.sender, 'Subs', Date.now());
    }
  },
};