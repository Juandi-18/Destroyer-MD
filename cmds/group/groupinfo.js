import ws from 'ws';
import fs from 'fs';
import databaseModule from '#db'; // Importamos el objeto completo para acceder al motor crudo

// Extraemos la conexión directa a SQLite abierta en database.js
const sqliteDB = databaseModule.db; 

export default {
  command: ['gp', 'groupinfo'],
  category: 'group',
  description: 'Ver la información del grupo.',
  run: async ({ msg, sock, usedPrefix, command, groupMetadata, participants }) => {
    try {
      const groupName = groupMetadata?.subject || 'Grupo de WhatsApp';
      const groupAdmins = participants.filter(p => (p.admin === 'admin' || p.admin === 'superadmin')) || [];
      const totalParticipants = participants.length;
      
      const botId = sock.user.id.split(':')[0] + "@s.whatsapp.net";
      const botSettings = databaseModule.getSettings(botId) || {};
      const botname = botSettings.botname || 'Bot';
      const monedas = botSettings.currency || 'Coins';

      // 1. Extraemos de forma limpia la lista de números reales del grupo (sin dominios)
      const currentNumbers = participants.map(p => p.id ? p.id.split('@')[0] : '').filter(Boolean);

      if (currentNumbers.length === 0) {
        return msg.reply('《✧》 Error al procesar los participantes del grupo.');
      }

      // 2. Construimos una consulta SQL directa para traer la suma exacta de monedas del grupo actual
      const placeholders = currentNumbers.map(() => '?').join(',');
      const queryEconomy = `
        SELECT 
          COUNT(DISTINCT user_id) as registrados,
          SUM(COALESCE(coins, 0) + COALESCE(bank, 0)) as total_dinero
        FROM chat_users 
        WHERE chat_id = ? 
          AND (user_id IN (${placeholders}) OR substr(user_id, 1, instr(user_id, '@') - 1) IN (${placeholders}))
      `;

      // Ejecutamos la consulta inyectando los parámetros limpios en el motor SQLite
      const economyResult = sqliteDB.prepare(queryEconomy).get(msg.chat, ...currentNumbers, ...currentNumbers) || {};
      
      const registeredUsersInGroup = economyResult.registrados || 0;
      const totalCoins = economyResult.total_dinero || 0;

      // 3. Procesamos los personajes atrapados (Claims) del grupo usando el mismo filtro estricto
      const chatUsersRows = sqliteDB.prepare(`
        SELECT user_id, characters FROM chat_users 
        WHERE chat_id = ?
      `).all(msg.chat) || [];

      let claimedCount = 0;
      for (const row of chatUsersRows) {
        if (!row.user_id) continue;
        const cleanRowId = row.user_id.split('@')[0];
        
        // Si el usuario guardado en la base de datos no está en el grupo de WhatsApp, se ignora
        if (!currentNumbers.includes(cleanRowId)) continue;

        let userChars = row.characters;
        if (userChars && typeof userChars === 'string') {
          try { userChars = JSON.parse(userChars); } catch { userChars = []; }
        }
        if (Array.isArray(userChars)) {
          claimedCount += userChars.length;
        }
      }

      // 4. Procesar el total de personajes existentes en el JSON del sistema
      const charactersFilePath = './core/characters.json';
      let totalCharacters = 0;

      if (fs.existsSync(charactersFilePath)) {
        const data = await fs.promises.readFile(charactersFilePath, 'utf-8');
        const structure = JSON.parse(data || '{}');
        const allCharacters = Object.values(structure).flatMap(s => Array.isArray(s?.characters) ? s.characters : []);
        totalCharacters = allCharacters.length;
      }

      const claimRate = totalCharacters > 0 ? ((claimedCount / totalCharacters) * 100).toFixed(2) : '0.00';
      
      const chatData = databaseModule.getChat(msg.chat) || {};
      const rawPrimary = typeof chatData.primaryBot === 'string' ? chatData.primaryBot : '';
      const botprimary = rawPrimary.endsWith('@s.whatsapp.net') ? `@${rawPrimary.split('@')[0]}` : 'Aleatorio';

      const settings = {
        bot: chatData.isBanned ? '✘ Desactivado' : '✓ Activado',
        antilinks: chatData.antilinks ? '✓ Activado' : '✘ Desactivado',
        antistatus: chatData.antistatus ? '✓ Activado' : '✘ Desactivado',
        welcome: chatData.welcome ? '✓ Activado' : '✘ Desactivado',
        goodbye: chatData.goodbye ? '✓ Activado' : '✘ Desactivado',
        alerts: chatData.alerts ? '✓ Activado' : '✘ Desactivado',
        gacha: chatData.gacha ? '✓ Activado' : '✘ Desactivado',
        economy: chatData.economy ? '✓ Activado' : '✘ Desactivado',
        nsfw: chatData.nsfw ? '✓ Activado' : '✘ Desactivado',
        adminmode: chatData.adminonly ? '✓ Activado' : '✘ Desactivado',
        botprimary: botprimary
      };

      // --- CAMBIO CLAVE: AGREGADO DE 'en-US' A TODOS LOS SEPARADORES ---
      let message = `*「✿」Grupo ◢ ${groupName} ◤*\n\n`;
      message += `❖ Bot Principal › *${settings.botprimary}*\n`;
      message += `♤ Admins › *${groupAdmins.length.toLocaleString('en-US')}*\n`;
      message += `❒ Usuarios › *${totalParticipants.toLocaleString('en-US')}*\n`;
      message += `ꕥ Registrados › *${registeredUsersInGroup.toLocaleString('en-US')}*\n`;
      message += `✿ Claims › *${claimedCount.toLocaleString('en-US')} (${claimRate}%)*\n`;
      message += `♡ Personajes › *${totalCharacters.toLocaleString('en-US')}*\n`;
      message += `⛁ Dinero › *${totalCoins.toLocaleString('en-US')} ${monedas}*\n\n`;
      // -----------------------------------------------------------------

      message += `➪ *Configuraciones:*\n`;
      message += `✐ ${botname} › *${settings.bot}*\n`;
      message += `✐ AntiLinks › *${settings.antilinks}*\n`;
      message += `✐ AntiStatus › *${settings.antistatus}*\n`;
      message += `✐ Bienvenida › *${settings.welcome}*\n`;
      message += `✐ Despedida › *${settings.goodbye}*\n`;
      message += `✐ Alertas › *${settings.alerts}*\n`;
      message += `✐ Gacha › *${settings.gacha}*\n`;
      message += `✐ Economía › *${settings.economy}*\n`;
      message += `✐ Nsfw › *${settings.nsfw}*\n`;
      message += `✐ ModoAdmin › *${settings.adminmode}*`;

      const mentionOw = groupMetadata?.owner ? groupMetadata.owner : '';
      const mentions = [rawPrimary, mentionOw].filter(Boolean);

      await sock.sendMessage(msg.chat, { text: message.trim(), mentions });
    } catch (e) {
      console.error(e);
      await msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again.\n> [Error: *${e.message}*]`);
    }
  }
};