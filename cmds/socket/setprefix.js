import GraphemeSplitter from 'grapheme-splitter';
import db from '#db';

export default {
  command: ['setprefix', 'setbotprefix'],
  category: 'socket',
  description: 'Cambiar el prefijo del bot apuntando a un bot específico mediante mención.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const idBot = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    let config = db.getSettings(idBot) || {};
    
    // Validar si el remitente es el Admin global o el dueño de este socket específico
    const isOwner2 = [idBot, ...(config.owner ? [config.owner] : []), ...global.owner.map(num => num + '@s.whatsapp.net')].includes(msg.sender);
    if (!isOwner2) return sock.reply(msg.chat, global.mess.socket, msg);

    // 🔍 COMPROBACIÓN DE OBJETIVO ESPECÍFICO (Filtro por Mención)
    // Revisamos si hay algún JID mencionado en el mensaje de WhatsApp
    const mentionedJids = Array.isArray(msg?.mentionedJid) ? msg.mentionedJid : [];
    
    if (mentionedJids.length > 0) {
      // Si el bot actual NO está dentro de la lista de usuarios mencionados, ignora el comando en silencio
      if (!mentionedJids.includes(idBot)) {
        return; // Detiene la ejecución de este clon de inmediato sin responder
      }
    }

    // Limpiamos los argumentos para extraer los prefijos reales quitando la mención si existe
    // De esta manera args solo tendrá el prefijo deseado (ej: si puso "!setprefix # @clon", solo procesará "#")
    const cleanArgs = args.filter(arg => !arg.includes('@'));
    const value = cleanArgs.join(' ').trim();
    const defaultPrefix = ["#", "/", "!", "."];

    if (!value) {
      const lista = config.prefix === 1 ? '`sin prefijos`' : (Array.isArray(config.prefix) ? config.prefix : [config.prefix || '/']).map(p => `\`${p}\``).join(', ');
      return msg.reply(`❀ Por favor, elige cualquiera de los siguientes métodos de prefijos.\n\n> *○ Only-Prefix* » ${usedPrefix + command} *.*\n> *○ Multi-Prefix* » ${usedPrefix + command} *!/.#*\n> *○ No-Prefix* » ${usedPrefix + command} *noprefix*\n\n*Uso Dirigido:* ${usedPrefix + command} # @NombreDelBot\n\nꕥ Actualmente este bot está usando: ${lista}`);
    }

    if (value.toLowerCase() === 'reset') {
      db.setSettings(idBot, 'prefix', defaultPrefix);
      return sock.reply(msg.chat, `❀ Se han restaurado los prefijos predeterminados para este Socket: *${defaultPrefix.join(' ')}*`, msg);
    }

    if (value.toLowerCase() === 'noprefix') {
      db.setSettings(idBot, 'prefix', 1);
      return msg.reply(`❀ Se cambió al modo sin prefijos para este Socket correctamente.\n> Ahora responderá a los comandos *sin prefijos*.`);
    }

    const splitter = new GraphemeSplitter();
    const graphemes = splitter.splitGraphemes(value);
    const lista = [];
    
    for (const g of graphemes) {
      if (/^[a-zA-Z]+$/.test(g)) continue; // Saltar letras
      if (!lista.includes(g)) lista.push(g);
    }

    if (lista.length === 0) return sock.reply(msg.chat, 'ꕥ No se detectaron prefijos válidos. Debes incluir al menos un símbolo o emoji.', msg);
    if (lista.length > 6) return sock.reply(msg.chat, 'ꕥ Máximo 6 prefijos permitidos.', msg);

    // Guardar los nuevos prefijos del socket en la base de datos SQLite
    db.setSettings(idBot, 'prefix', lista);
    return sock.reply(msg.chat, `❀ Se cambió el prefijo de este Socket a *${lista.join(' ')}* correctamente.`, msg);
  },
};