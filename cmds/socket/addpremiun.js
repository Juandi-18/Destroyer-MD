import db from '#db';
import fs from 'fs';
import path from 'path';

const PREMIUM_REMOVE_COMMANDS = ['removepremium', 'quitarpremium', 'delpremium'];

function formatJid(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `${digits}@s.whatsapp.net` : null;
}

// NUEVA: Función para promover un Sub a Premium
async function upgradePremiumSession(userJid) {
  const userId = userJid.split('@')[0];
  const basePath = process.cwd();
  const subsPath = path.join(basePath, 'Sessions', 'Subs', userId);
  const premiumPath = path.join(basePath, 'Sessions', 'Premium', userId);

  // Desconectar la sesión activa
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

  // Mover sesión de Subs a Premium
  if (fs.existsSync(subsPath)) {
    try {
      // Eliminar Premium si existe (Subs tiene prioridad cuando actualizamos)
      if (fs.existsSync(premiumPath)) fs.rmSync(premiumPath, { recursive: true, force: true });
      
      // Crear carpeta Premium si no existe
      fs.mkdirSync(path.dirname(premiumPath), { recursive: true });
      
      // Mover la sesión
      fs.renameSync(subsPath, premiumPath);
      console.log(`[upgradePremiumSession] Sesión ${userId} movida de Subs → Premium`);
    } catch (error) {
      console.error('[upgradePremiumSession] Error moving session:', error);
      // Fallback: copiar en lugar de mover
      try {
        if (fs.existsSync(premiumPath)) fs.rmSync(premiumPath, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(premiumPath), { recursive: true });
        
        // Función auxiliar para copiar recursivamente
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

  // Actualizar metadatos
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

  // Actualizar BD
  const botJid = `${userId}@s.whatsapp.net`;
  db.getSettings(botJid);
  db.setSettings(botJid, 'type', 'Premium');
  
  // Reconectar después de un pequeño delay
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

  // Desconectar la sesión activa
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

  // Mover sesión de Premium a Subs
  if (fs.existsSync(premiumPath)) {
    try {
      // Eliminar Subs si existe
      if (fs.existsSync(subsPath)) fs.rmSync(subsPath, { recursive: true, force: true });
      
      // Crear carpeta Subs si no existe
      fs.mkdirSync(path.dirname(subsPath), { recursive: true });
      
      // Mover la sesión
      fs.renameSync(premiumPath, subsPath);
      console.log(`[downgradePremiumSession] Sesión ${userId} movida de Premium → Subs`);
    } catch (error) {
      console.error('[downgradePremiumSession] Error moving session:', error);
      // Fallback: copiar en lugar de mover
      try {
        if (fs.existsSync(subsPath)) fs.rmSync(subsPath, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(subsPath), { recursive: true });
        
        // Función auxiliar para copiar recursivamente
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

  // Actualizar metadatos
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

  // Actualizar BD
  const botJid = `${userId}@s.whatsapp.net`;
  db.getSettings(botJid);
  db.setSettings(botJid, 'type', 'Sub');
  
  // Reconectar después de un pequeño delay
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
  command: ['addpremium', 'darpremium', 'removepremium', 'quitarpremium', 'delpremium'],
  category: 'owner',
  description: 'Darle pase Premium a un usuario por una cantidad de días o quitarle el premium.',
  isOwner: true,
  run: async ({ msg, sock, args, command }) => {
    const isRemove = PREMIUM_REMOVE_COMMANDS.includes(command);
    const commandArgs = args.filter(Boolean);
    let who = msg.quoted?.sender || msg.mentionedJid?.[0];

    if (!who) {
      if (isRemove) {
        who = formatJid(commandArgs[0]);
      } else {
        who = formatJid(commandArgs[1]) || formatJid(commandArgs[0]);
      }
    }

    if (!who) {
      return msg.reply(`《✧》 Menciona o responde al mensaje de un usuario.${isRemove ? '\n> Ejemplo: *!removepremium @usuario*' : '\n> Ejemplo: *!addpremium 30 @usuario*'}`);
    }

    if (isRemove) {
      db.setUser(who, 'premiumTime', 0);
      await downgradePremiumSession(who);
      return msg.reply(`👑 El Premium de @${who.split('@')[0]} ha sido removido con éxito.\n\n> Si tenía un Socket Premium activo, se cerró y ahora su sesión se manejará como SubBot.`, { mentions: [who] });
    }

    if (!commandArgs[0] || isNaN(commandArgs[0])) {
      return msg.reply(`《✧》 Ingresa la cantidad de días Premium. Ejemplo: *!addpremium 30 @usuario*`);
    }

    const dias = parseInt(commandArgs[0]);
    const tiempoAdicional = dias * 24 * 60 * 60 * 1000;
    const user = db.getUser(who);
    let tiempoActual = user.premiumTime || 0;

    if (tiempoActual < Date.now()) {
      tiempoActual = Date.now();
    }

    const nuevoVencimiento = tiempoActual + tiempoAdicional;
    db.setUser(who, 'premiumTime', nuevoVencimiento);

    const fechaFormat = new Date(nuevoVencimiento).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    // NUEVO: Verificar si el usuario tenía un Sub y moverlo a Premium
    const userId = who.split('@')[0];
    const basePath = process.cwd();
    const subsPath = path.join(basePath, 'Sessions', 'Subs', userId);
    const premiumPath = path.join(basePath, 'Sessions', 'Premium', userId);
    
    let sessionWasUpgraded = false;
    if (fs.existsSync(subsPath) && !fs.existsSync(premiumPath)) {
      // El usuario tenía un Sub, hay que promoverlo a Premium
      sessionWasUpgraded = true;
      await upgradePremiumSession(who);
      
      const messageUpgrade = `👑 ¡Pase *Premium* activado con éxito!\n\n> 👤 *Usuario ›* @${userId}\n> ⏳ *Días agregados ›* ${dias} días\n> 📅 *Vence el ›* ${fechaFormat}\n\n✅ *Sesión Actualizada:*\n> 📂 Movido de SubBot → Premium\n> 🔑 El Socket reconectará en 2 segundos con privilegios Premium\n> ⚡ Ahora tiene acceso a TODAS las funciones Premium`;
      
      return msg.reply(messageUpgrade, { mentions: [who] });
    }

    // Si ya tenía Premium, solo actualizamos la fecha
    await msg.reply(`👑 ¡Pase *Premium* renovado con éxito!\n\n> 👤 *Usuario ›* @${userId}\n> ⏳ *Días agregados ›* ${dias} días\n> 📅 *Vence el ›* ${fechaFormat}`, { mentions: [who] });
  }
};