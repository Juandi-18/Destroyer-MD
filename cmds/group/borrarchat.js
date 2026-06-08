import db from '#db';
import { delay } from 'baileys';

export default {
  command: ['del', 'borrar', 'delete', 'borrachat'],
  category: 'group',
  description: 'Borra mensajes del chat.',

  run: async ({ msg, sock, args, isOwner, isBotAdmins }) => {
    if (!msg.isGroup) {
      return msg.reply("《✧》 Este comando solo funciona en grupos.");
    }
    
    if (!isBotAdmins) {
      return msg.reply("⚠️ Necesito ser *Administrador* del grupo para poder borrar mensajes de otros.");
    }

    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const isBot = msg.sender === botJid;
    const isPrivileged = isOwner || isBot;

    // Límite de 50 para Dueño/Bot, 10 para usuarios normales
    const limit = isPrivileged ? 50 : 10;

    // Caso 1: Borrar un mensaje específico al que se le responde
    if (!args[0] && msg.quoted) {
        try {
            await sock.sendMessage(msg.chat, { delete: msg.quoted.key });
            // SE QUITÓ: La línea que borraba tu propio comando (msg.key)
        } catch (e) {
            msg.reply("「✎」 No pude borrar el mensaje. Puede que sea muy antiguo o no tenga permisos.");
        }
        return;
    }

    // Caso 2: Borrar una cantidad N de mensajes anteriores
    if (args[0]) {
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) {
            return msg.reply("《✧》 Ingresa una cantidad válida para borrar. Ejemplo: *del 5*");
        }

        if (amount > limit) {
            return msg.reply(`⚠️ Límite superado. Tu rango solo permite borrar hasta *${limit}* mensajes a la vez.`);
        }

        if (!global.msgCache || !global.msgCache[msg.chat] || global.msgCache[msg.chat].length < amount) {
            return msg.reply(`「✎」 No tengo suficientes mensajes recientes guardados en mi memoria.`);
        }

        const cache = global.msgCache[msg.chat];
        
        // 🌟 MODIFICACIÓN: Tomamos la cantidad exacta de mensajes previos, dejando fuera el último (tu comando)
        const toDelete = cache.slice(-(amount + 1), -1);

        // Borramos los mensajes con un delay de 2 segundos
        for (const key of toDelete) {
            try {
                await sock.sendMessage(msg.chat, { delete: key });
                await delay(2000); // ⏱️ Pausa de 2 segundos por mensaje
            } catch (e) {
                // Ignoramos errores individuales
            }
        }

        // Limpiamos la caché removiendo únicamente los elementos que fueron eliminados
        global.msgCache[msg.chat] = cache.filter(k => !toDelete.includes(k));
        
    } else {
        msg.reply(`《✧》 Responde a un mensaje para borrarlo, o usa *del [cantidad]* para borrar varios.`);
    }
  }
};