import db from '#db';

export default {
  command: ['delmoney', 'quitarplata'],
  category: 'owner',
  description: 'Quitar dinero o crear deuda.',
  isOwner: true,
  run: async ({ msg, sock, args, isOwner }) => {
    // Definir quién es el bot
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    // Validar si quien escribe es el Dueño O el propio Bot
    if (!isOwner && msg.sender !== botJid) {
      return msg.reply("❌ Este comando es exclusivo para mis dueños.");
    }

    const who = msg.quoted?.sender || msg.mentionedJid?.[0];
    if (!who) return msg.reply(`《✧》 Menciona o responde a alguien.`);
    if (!args[0] || isNaN(args[0])) return msg.reply(`《✧》 Ingresa la cantidad.`);
    
    const amount = parseInt(args[0]);
    const user = db.getChatUser(msg.chat, who);
    
    // Restamos del banco (permitimos valores negativos para deuda)
    db.setChatUser(msg.chat, who, 'bank', (user.bank || 0) - amount);
    
    msg.reply(` Se descontaron *¥${amount.toLocaleString()}* al banco de @${who.split('@')[0]}`, { mentions: [who] });
  }
};