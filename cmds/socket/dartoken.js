import db from '#db';
import fs from 'fs';
import path from 'path';

const TOKEN_REMOVE_COMMANDS = ['removetoken', 'quitartoken', 'deltoken'];

function formatJid(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `${digits}@s.whatsapp.net` : null;
}

function generateToken() {
  const letters = () => Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
  const numbers = () => Math.floor(1000 + Math.random() * 9000).toString();
  return `${letters()}-${numbers()}`;
}

// Watcher to notify owner when tokens expire
setInterval(async () => {
  try {
    const expired = db.getExpiredUnnotifiedTokens(Date.now());
    if (!expired || expired.length === 0) return;
    const mainBotJid = global.sock?.user?.id?.split(':')[0] + '@s.whatsapp.net';
    const settings = db.getSettings(mainBotJid) || {};
    const ownerJid = settings.owner || (global.owner && global.owner.length ? global.owner[0] + '@s.whatsapp.net' : null);
    if (!ownerJid || !global.sock) return;
    for (const t of expired) {
      try {
        await global.sock.sendMessage(ownerJid, { text: `📌 El token de acceso de @${t.userId} (${t.token}) ha expirado.` }, { mentions: [t.userId + '@s.whatsapp.net'] });
        db.markTokenNotified(t.token);
      } catch (e) {}
    }
  } catch (e) { }
}, 60 * 60 * 1000);

// Función para promover un Sub a Premium (token-based)
async function upgradePremiumSession(userJid) {
  const userId = userJid.split('@')[0];
  const basePath = process.cwd();
  const subsPath = path.join(basePath, 'Sessions', 'Subs', userId);
  const premiumPath = path.join(basePath, 'Sessions', 'Premium', userId);

  const activeConn = (global.conns || []).find((conn) => conn?.user?.id?.split(':')[0] === userId);
  if (activeConn) {
    try { 
      activeConn.isReloading = true;
      activeConn.ws?.close(); 
    } catch (error) { 
      console.error('[upgradePremiumSession] Error closing socket:', error); 
    }
    global.conns = (global.conns || []).filter((conn) => conn !== activeConn);
  }

  if (fs.existsSync(subsPath)) {
    try {
      if (fs.existsSync(premiumPath)) fs.rmSync(premiumPath, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(premiumPath), { recursive: true });
      fs.renameSync(subsPath, premiumPath);
      console.log(`[upgradePremiumSession] Sesión ${userId} movida de Subs → Premium`);
    } catch (error) {
      console.error('[upgradePremiumSession] Error moving session:', error);
      try {
        if (fs.existsSync(premiumPath)) fs.rmSync(premiumPath, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(premiumPath), { recursive: true });
        const copyDirSync = (src, dest) => {
          fs.mkdirSync(dest, { recursive: true });
          fs.readdirSync(src).forEach(file => {
            const srcFile = path.join(src, file);
            const destFile = path.join(dest, file);
            fs.statSync(srcFile).isDirectory() 
              ? copyDirSync(srcFile, destFile)
              : fs.copyFileSync(srcFile, destFile);
          });
        };
        copyDirSync(subsPath, premiumPath);
        fs.rmSync(subsPath, { recursive: true, force: true });
        console.log(`[upgradePremiumSession] Sesión ${userId} copiada de Subs → Premium (fallback)`);
      } catch (copyError) {
        console.error('[upgradePremiumSession] Fallback copy failed:', copyError);
      }
    }
  }

  const metadataFile = path.join(premiumPath, 'metadata.json');
  if (fs.existsSync(metadataFile)) {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
      metadata.type = 'Premium';
      metadata.upgradedAt = new Date().toISOString();
      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    } catch (e) {
      console.error('[upgradePremiumSession] Error updating metadata:', e);
    }
  }

  const botJid = `${userId}@s.whatsapp.net`;
  db.getSettings(botJid);
  db.setSettings(botJid, 'type', 'Premium');
  
  setTimeout(async () => {
    try {
      const { startSubBot } = await import('./subs.js');
      await startSubBot(null, null, '', false, userId, '', false);
      console.log(`[upgradePremiumSession] Bot ${userId} reconectado como Premium`);
    } catch (error) {
      console.error('[upgradePremiumSession] Error reconectando bot:', error);
    }
  }, 2000);
}

async function downgradePremiumSession(userJid) {
  const userId = userJid.split('@')[0];
  const basePath = process.cwd();
  const premiumPath = path.join(basePath, 'Sessions', 'Premium', userId);
  const subsPath = path.join(basePath, 'Sessions', 'Subs', userId);

  const activeConn = (global.conns || []).find((conn) => conn?.user?.id?.split(':')[0] === userId);
  if (activeConn) {
    try { 
      activeConn.isReloading = true;
      activeConn.ws?.close(); 
    } catch (error) { 
      console.error('[downgradePremiumSession] Error closing socket:', error); 
    }
    global.conns = (global.conns || []).filter((conn) => conn !== activeConn);
  }

  if (fs.existsSync(premiumPath)) {
    try {
      if (fs.existsSync(subsPath)) fs.rmSync(subsPath, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(subsPath), { recursive: true });
      fs.renameSync(premiumPath, subsPath);
      console.log(`[downgradePremiumSession] Sesión ${userId} movida de Premium → Subs`);
    } catch (error) {
      console.error('[downgradePremiumSession] Error moving session:', error);
      try {
        if (fs.existsSync(subsPath)) fs.rmSync(subsPath, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(subsPath), { recursive: true });
        const copyDirSync = (src, dest) => {
          fs.mkdirSync(dest, { recursive: true });
          fs.readdirSync(src).forEach(file => {
            const srcFile = path.join(src, file);
            const destFile = path.join(dest, file);
            fs.statSync(srcFile).isDirectory() 
              ? copyDirSync(srcFile, destFile)
              : fs.copyFileSync(srcFile, destFile);
          });
        };
        copyDirSync(premiumPath, subsPath);
        fs.rmSync(premiumPath, { recursive: true, force: true });
        console.log(`[downgradePremiumSession] Sesión ${userId} copiada de Premium → Subs (fallback)`);
      } catch (copyError) {
        console.error('[downgradePremiumSession] Fallback copy failed:', copyError);
      }
    }
  }

  const metadataFile = path.join(subsPath, 'metadata.json');
  if (fs.existsSync(metadataFile)) {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
      metadata.type = 'Sub';
      metadata.downgradedAt = new Date().toISOString();
      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    } catch (e) {
      console.error('[downgradePremiumSession] Error updating metadata:', e);
    }
  }

  const botJid = `${userId}@s.whatsapp.net`;
  db.getSettings(botJid);
  db.setSettings(botJid, 'type', 'Sub');
  
  setTimeout(async () => {
    try {
      const { startSubBot } = await import('./subs.js');
      await startSubBot(null, null, '', false, userId, '', false);
      console.log(`[downgradePremiumSession] Bot ${userId} reconectado como Sub`);
    } catch (error) {
      console.error('[downgradePremiumSession] Error reconectando bot:', error);
    }
  }, 2000);
}

export default {
  command: ['dartoken', 'quitartoken'],
  category: 'owner',
  description: 'Generar / quitar Tokens de acceso (30 días) para usuarios.',
  isOwner: true,
  run: async ({ msg, sock, args, command }) => {
    const mainBotNumber = global.sock?.user?.id?.split(':')[0];
    const mainBotJid = mainBotNumber ? `${mainBotNumber}@s.whatsapp.net` : null;
    const currentBotJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';

    const senderBase = (msg?.sender || '').split('@')[0];
    const isOwnerUser = (global.owner || []).map(n => n + '@s.whatsapp.net').includes(msg?.sender);
    const isSenderMainBot = msg?.sender === mainBotJid;

    // --- CANDADO GLOBAL: CONTROL DE ACCESO PARA OWNERS Y BOT PRINCIPAL ---
    if (!isOwnerUser && !isSenderMainBot) {
      return msg.reply(`❌ *[ACCESO DENEGADO]* ❌\n\nEste comando es de uso exclusivo para los Owners oficiales del sistema global y el Bot Principal. No tienes los permisos necesarios para ejecutarlo.`);
    }

    // Convertimos la lista de owners a JIDs puros
    const ownersListJids = (Array.isArray(global.owner) ? global.owner : [global.owner])
      .map(n => String(n).replace(/\D/g, '') + '@s.whatsapp.net');

    // El socket es válido si es el bot principal o si es un clon Premium que le pertenece a un Owner
    const isMainBot = currentBotJid === mainBotJid;
    const isOwnerPremiumSocket = ownersListJids.includes(currentBotJid);

    if (!isMainBot && !isOwnerPremiumSocket) {
      return msg.reply('❌ Este comando sólo puede ejecutarse desde el Bot Principal o desde un socket Premium oficial administrado por los Owners.');
    }

    const isRemove = TOKEN_REMOVE_COMMANDS.includes(command);
    const commandArgs = (args || []).filter(Boolean);
    const repliedUser = msg?.quoted?.sender || null;
    const mentionedUser = Array.isArray(msg?.mentionedJid) ? msg.mentionedJid.find(Boolean) : null;
    const replyOrMention = repliedUser || mentionedUser;
    const explicitTarget = formatJid(replyOrMention) || formatJid(commandArgs[0]) || formatJid(commandArgs[1]);

    const currentBotNumber = (sock.user?.id || '').split(':')[0];
    const senderNumber = (msg?.sender || '').split('@')[0];
    const targetNumber = explicitTarget ? explicitTarget.split('@')[0] : '';
    const targetJid = explicitTarget;

    // --- FILTRO 1: EXIGIR USUARIO OBJETIVO ANTES DE EVALUAR COMPROBACIONES ---
    if (!isRemove && !targetNumber) {
      return msg.reply(`《✧》 Menciona o responde al mensaje de un usuario.\n> Ejemplo: *!dartoken @usuario*`);
    }

    // --- FILTRO 2: CANDADO ABSOLUTO PARA EL BOT PRINCIPAL GLOBAL ---
    if (!isRemove && targetNumber === mainBotNumber) {
      return msg.reply(`👑 *[BOT PRINCIPAL]* 👑\n\nEste número es el Bot Principal (Owner) del sistema global. No puedes solicitar token para él.`);
    }

    // --- FILTRO 3: CANDADO DE SESIÓN YA PREMIUM EN DISCO O MEMORIA ---
    if (!isRemove) {
      const pathPremium = path.join('Sessions', 'Premium', targetNumber);
      const hasRealPremium = fs.existsSync(pathPremium) && fs.existsSync(path.join(pathPremium, 'creds.json'));
      const isPremiumActive = (Array.isArray(global.conns) && global.conns.some(c => c && c.userId === targetNumber && c.botType === 'Premium')) || hasRealPremium;

      if (isPremiumActive) {
        return msg.reply(`⚠️ *[SESIÓN PREMIUM ACTIVA]* ⚠️\n\nTeniendo una sesión activa e iniciada como Premium no puedes volver a solicitar un token de vinculación.`);
      }
    }

    // --- FILTRO 4: RESTRICCIÓN DE INSTANCIA ABSOLUTA PARA SUB-BOTS ---
    if (!isMainBot && !isOwnerPremiumSocket) {
      return msg.reply(`❌ Los SubBots no están autorizados para iniciar el proceso de vinculación por Token. Usa únicamente: .code o .qr.`);
    }

    // --- FILTRO 5: COMPROBACIÓN DE REGISTRO PREVIO COMO SUB-BOT (SOLO PARA MIGRACIÓN) ---
    if (!isRemove) {
      try {
        const base = process.cwd();
        const subsPath = path.join(base, 'Sessions', 'Subs', targetNumber);
        const hasSubsSession = fs.existsSync(subsPath) && fs.existsSync(path.join(subsPath, 'creds.json'));

        if (!hasSubsSession) {
          return msg.reply(`「⚠️」*¡ACCIÓN CANCELADA!*\n\nPara poder otorgarle un Token Premium a este usuario, primero es obligatorio que registre e inicie sesión como un sub-bot normal en el bot principal.`);
        }
      } catch (e) {}
    }

    if (isRemove) {
      const possible = commandArgs[0] || commandArgs[1] || '';
      const tokenLike = possible.toUpperCase().match(/^[A-Z0-9]{4}-[0-9]{4}$/);
      if (tokenLike) {
        const token = possible.toUpperCase();
        const rec = db.getTokenRecord(token);
        if (!rec) return msg.reply('❌ Token no encontrado.');
        db.invalidateToken(token);
        await downgradePremiumSession(rec.userId + '@s.whatsapp.net');
        return msg.reply(`✅ Token ${token} invalidado y sesión removida.`, { mentions: [rec.userId + '@s.whatsapp.net'] });
      }
      if (targetJid) {
        const userId = targetJid.split('@')[0];
        const targetNumber = userId;

        // --- VALIDACIÓN ESPECIAL 1: PROTEGER BOT PRINCIPAL ---
        if (targetNumber === mainBotNumber) {
          return msg.reply(`👑 [BOT PRINCIPAL] 👑\n\nEste número es el Bot Principal (Owner) del sistema global. No puedes denegar token para él.`);
        }

        // --- VALIDACIÓN ESPECIAL 2: CONTROL DE AUTO-REMOCIÓN PARA BOTS PREMIUM ---
        if (currentBotJid === targetJid && !isMainBot) {
          // Un bot Premium intenta quitarse el token a sí mismo
          if (isOwnerUser) {
            // Es Owner: permitir SOLO si en el grupo NO están el Bot Principal ni el Bot Premium del Owner
            if (msg.isGroup) {
              try {
                const groupMetadata = await sock.groupMetadata(msg.chat).catch(() => null);
                if (groupMetadata) {
                  const participantJids = new Set(groupMetadata.participants.map(p => p.id));
                  const hasMainBot = participantJids.has(mainBotJid);
                  const hasOwnerPremium = participantJids.has(currentBotJid);
                  if (hasMainBot || hasOwnerPremium) {
                    return msg.reply(`❌ Usa el Bot Principal o el Premium Autorizado presente en este grupo para quitar el token.`);
                  }
                }
              } catch (e) {}
            }
          } else {
            // No es Owner: bloquea auto-remoción completamente
            return msg.reply(`⚠️ [SESIÓN PREMIUM ACTIVA] ⚠️\n\nTeniendo una sesión activa e iniciada como Premium no puedes quitarte el token de vinculación pídele a un owner o al botprincipal.`);
          }
        }

        db.invalidateTokensByUser(userId);
        await downgradePremiumSession(targetJid);
        return msg.reply(`✅ Todos los tokens de @${userId} han sido invalidos y su sesión ha sido degradada.`, { mentions: [targetJid] });
      }
      return msg.reply('❌ Especifica un token o un usuario a quien quitar el token.');
    }

    // Flujo normal de generación
    const userJid = targetJid;
    if (!userJid) return msg.reply('❌ Especifica el usuario a quien dar el token.');
    const userId = userJid.split('@')[0];

    const existing = db.getActiveTokenByUser(userId);
    if (existing && existing.expiresAt > Date.now()) {
      return msg.reply(`❌ El usuario ya posee un token activo hasta ${new Date(existing.expiresAt).toLocaleString()}. No es acumulable.`);
    }

    let token = generateToken();
    while (db.getTokenRecord(token)) token = generateToken();
    const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
    const ownerId = (msg.sender || '').split('@')[0];
    db.createToken(token, userId, ownerId, expiresAt);

    try {
      const usedPrefix = '!'; 
      await sock.sendMessage(userJid, { text: `👑 Has recibido un Token de acceso:\n\nToken: *${token}*\nVálido hasta: ${new Date(expiresAt).toLocaleString()}\n\nUsa el comando en el Bot Principal:\n${usedPrefix}qrpremium ${token}\no\n${usedPrefix}codepremium ${token}\n\nNo compartas este token.` });
    } catch (e) {}

    await msg.reply(`✅ Token generado y enviado a @${userId}. Válido hasta ${new Date(expiresAt).toLocaleDateString()}`, { mentions: [userJid] });
  }
};