import db from '#db';

export default {
  command: ['dellevel', 'quitarnivel'],
  category: 'owner',
  description: 'Quitar niveles a un usuario.',
  isOwner: true, 
  run: async ({ msg, sock, args, isOwner }) => {
    // Definir quién es el bot
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    // Validar si quien escribe es el Dueño O el propio Bot
    if (!isOwner && msg.sender !== botJid) {
      return msg.reply("❌ Este comando es exclusivo para mis dueños.");
    }

    const who = msg.mentionedJid?.[0] || msg.quoted?.sender;
    if (!who) return msg.reply(`《✧》 Menciona o responde al mensaje de un usuario.`);
    if (!args[0] || isNaN(args[0])) return msg.reply(`《✧》 Ingresa la cantidad de niveles a quitar.`);

    const amount = parseInt(args[0]);
    if (amount <= 0) return msg.reply(`《✧》 La cantidad debe ser mayor a 0.`);

    const user = db.getUser(who);
    if (!user) return msg.reply(`「✎」 El usuario no está registrado en la base de datos.`);

    const currentLevel = user.level || 0;

    // Calculamos el nuevo nivel y lo fijamos en 0 si el resultado es negativo
    let newLevel = currentLevel - amount;
    if (newLevel < 0) {
      newLevel = 0; 
    }

    db.setUser(who, 'level', newLevel);
    msg.reply(` Se han quitado niveles. @${who.split('@')[0]} ahora es nivel *${newLevel}*.`, { mentions: [who] });
  }
};