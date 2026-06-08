import db from '#db';
import fs from 'fs';
import path from 'path';

const PREMIUM_REMOVE_COMMANDS = ['removepremium', 'quitarpremium', 'delpremium'];

function formatJid(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `${digits}@s.whatsapp.net` : null;
}

async function downgradePremiumSession(userJid) {
  const userId = userJid.split('@')[0];
  const basePath = process.cwd();
  const premiumPath = path.join(basePath, 'Sessions', 'Premium', userId);
  const subsPath = path.join(basePath, 'Sessions', 'Subs', userId);

  const activeConn = (global.conns || []).find((conn) => conn?.user?.id?.split(':')[0] === userId);
  if (activeConn) {
    try { activeConn.ws?.close(); } catch (error) { console.error('[downgradePremiumSession] Error closing socket:', error); }
    global.conns = (global.conns || []).filter((conn) => conn !== activeConn);
  }

  if (fs.existsSync(premiumPath)) {
    try {
      if (fs.existsSync(subsPath)) fs.rmSync(subsPath, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(subsPath), { recursive: true });
      fs.renameSync(premiumPath, subsPath);
    } catch (error) {
      console.error('[downgradePremiumSession] Error moving session:', error);
      try {
        fs.rmSync(subsPath, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(subsPath), { recursive: true });
        fs.renameSync(premiumPath, subsPath);
      } catch (moveError) {
        console.error('[downgradePremiumSession] Fallback failed:', moveError);
      }
    }
  }

  const botJid = `${userId}@s.whatsapp.net`;
  db.getSettings(botJid);
  db.setSettings(botJid, 'type', 'Sub');
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

    await msg.reply(`👑 ¡Pase *Premium* activado con éxito!\n\n> 👤 *Usuario ›* @${who.split('@')[0]}\n> ⏳ *Días agregados ›* ${dias} días\n> 📅 *Vence el ›* ${fechaFormat}`, { mentions: [who] });
  }
};