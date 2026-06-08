import db from '#db';

export default {
  command: ['addmoney', 'platacomocancha'],
  category: 'owner',
  description: 'Agregar dinero a un usuario.',
  isOwner: true, 
  run: async ({ msg, sock, args, isOwner }) => {
    // Definir quién es el bot
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    // Validar si quien escribe es el Dueño O el propio Bot
    if (!isOwner && msg.sender !== botJid) {
      return msg.reply("❌ Este comando es exclusivo para mis dueños.");
    }

    const MAX_LIMIT = 999999999999999;
    const who = msg.quoted?.sender || msg.mentionedJid?.[0];
    
    if (!who) return msg.reply(`《✧》 Menciona o responde a alguien.`);
    if (!args[0] || isNaN(args[0])) return msg.reply(`《✧》 Ingresa una cantidad válida.`);
    
    const amount = parseInt(args[0]);
    const user = db.getChatUser(msg.chat, who);
    const totalActual = (user.coins || 0) + (user.bank || 0);

    if (totalActual + amount > MAX_LIMIT) {
      return msg.reply(`⚠️ Superarías el límite de *${MAX_LIMIT.toLocaleString()}* monedas.`);
    }

    db.setChatUser(msg.chat, who, 'bank', (user.bank || 0) + amount);
    // Cambiado a 'en-US' para fijar el separador por comas
    msg.reply(` Agregaste *¥${amount.toLocaleString('en-US')}* al banco de @${who.split('@')[0]}`, { mentions: [who] });
  }
};