import db from '#db';

// Usamos la misma constante matemática de tu comando de niveles principal
const growth = Math.pow(Math.PI / Math.E, 1.618) * Math.E * 0.75;

function getMinXpForLevel(level, multiplier = 2) {
  const mult = (typeof multiplier === 'number' && multiplier > 0) ? multiplier : 2;
  if (level <= 0) return 0;
  level = Math.floor(level);
  return Math.round(Math.pow(level, growth) * mult) + 1;
}

export default {
  command: ['addlevel', 'obtenernivel'],
  category: 'owner',
  description: 'Añadir niveles y ajustar la experiencia correspondiente de un usuario.',
  isOwner: true,
  run: async ({ msg, sock, args, isOwner }) => {
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    if (!isOwner && msg.sender !== botJid) {
      return msg.reply("❌ Este comando es exclusivo para mis dueños.");
    }

    const who = msg.mentionedJid?.[0] || msg.quoted?.sender;
    if (!who) return msg.reply(`《✧》 Menciona o responde al mensaje de un usuario.`);
    if (!args[0] || isNaN(args[0])) return msg.reply(`《✧》 Ingresa la cantidad de niveles a añadir.`);

    const amount = parseInt(args[0]);
    if (amount <= 0) return msg.reply(`《✧》 La cantidad debe ser mayor a 0.`);

    const user = db.getUser(who);
    if (!user) return msg.reply(`「✎」 El usuario no está registrado en la base de datos.`);

    const currentLevel = user.level || 0;
    const MAX_LEVEL = 999999;

    if (currentLevel + amount > MAX_LEVEL) {
      return msg.reply(`⚠️ Límite superado. El nivel máximo es *${MAX_LEVEL}*. Si añades esta cantidad, el usuario llegaría al nivel ${currentLevel + amount}.\n> Nivel actual: *${currentLevel}*`);
    }

    const newLevel = currentLevel + amount;
    
    // 🧠 CÁLCULO DE EXPERIENCIA: Obtenemos el nuevo piso de XP para el nivel resultante
    const activeMultiplier = global.multiplier || 2;
    const newXp = getMinXpForLevel(newLevel, activeMultiplier);

    // Guardamos de forma sincronizada ambos valores en tu SQLite
    db.setUser(who, 'level', newLevel);
    db.setUser(who, 'exp', newXp);

    msg.reply(`✅ Se han añadido *${amount}* niveles.\n@${who.split('@')[0]} ahora es nivel *${newLevel}* y su experiencia se ajustó a *${newXp.toLocaleString('es-PE')} XP*.`, { mentions: [who] });
  }
};