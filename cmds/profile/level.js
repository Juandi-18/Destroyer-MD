import db from '#db';

const growth = Math.pow(Math.PI / Math.E, 1.618) * Math.E * 0.75;

function xpRange(level, multiplier = 2) {
  const mult = (typeof multiplier === 'number' && multiplier > 0) ? multiplier : 2;
  if (level < 0) throw new TypeError('level cannot be negative value');  
  level = Math.floor(level);
  
  const min = level === 0 ? 0 : Math.round(Math.pow(level, growth) * mult) + 1;
  const max = Math.round(Math.pow(level + 1, growth) * mult);  
  
  return { min, max, xp: max - min };
}

export default {
  command: ['level', 'lvl'],
  category: 'profile',
  description: 'Ver tu nivel y experiencia actual balanceada con detección de nombre dinámica.',
  run: async ({ msg, sock, text }) => {
    const chatId = msg.chat;
    const who = msg.mentionedJid?.[0] || msg.quoted?.sender || msg.sender;
    const user = db.getUser(who);
    
    if (!user) {
      return msg.reply(`「✎」 El usuario mencionado no está registrado en el bot.`);
    }

    const activeMultiplier = global.multiplier || 2;
    
    // 🧠 AUTO-LEVEL EN CALIENTE: Calculamos el nivel real que le corresponde según su XP total
    let nivelReal = 0;
    let limites = xpRange(nivelReal, activeMultiplier);
    
    while (user.exp >= limites.max) {
      nivelReal++;
      limites = xpRange(nivelReal, activeMultiplier);
    }

    // Si el nivel guardado en la DB es menor al real, lo actualizamos silenciosamente para corregir el bug
    if (!user.level || user.level < nivelReal) {
      user.level = nivelReal;
    }

    // Ahora los cálculos de progreso siempre van a cuadrar a la perfección
    const { min, xp } = limites;
    let progresoActual = user.exp - min;
    if (progresoActual < 0) progresoActual = 0;
    
    let porcentaje = Math.floor((progresoActual / xp) * 100);
    if (porcentaje > 100) porcentaje = 100;

    const allUsers = db.getUser();
    const users = allUsers.map(u => ({ ...u, jid: u.id }));
    const sortedLevel = users.sort((a, b) => (b.level || 0) - (a.level || 0));
    const rank = sortedLevel.findIndex(u => u.jid === who) + 1;

    // 🔄 DETECCIÓN DINÁMICA DE NOMBRE ANTI-BUG:
    // 1. Busca el nombre guardado en tu DB (user.name).
    // 2. Si no existe, intenta jalar el pushName de WhatsApp (msg.pushName) si es el mismo remitente.
    // 3. Como última opción segura, pinta su número de teléfono limpio.
    const nombrePersona = user.name || (who === msg.sender ? msg.pushName : null) || who.split('@')[0];

    const txt = `*「✿」Usuario* ◢ ${nombrePersona} ◤\n\n` +
                `❖ Nivel › *${user.level}*\n` +
                `☆ Experiencia › *${user.exp?.toLocaleString() || 0}*\n` +
                `➨ Progreso › *${progresoActual} => ${xp}* _(${porcentaje}%)_\n` +
                `✐ Puesto › *#${rank}*\n` +
                `❒ Comandos ejecutados › *${user.usedcommands?.toLocaleString() || 0}*`;
                
    await sock.sendMessage(chatId, { text: txt, mentions: [who] }, { quoted: msg });
  }
};