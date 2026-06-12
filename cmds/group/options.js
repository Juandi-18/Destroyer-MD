import db from '#db';
export default {
  command: ['welcome', 'bienvenida', 'goodbye', 'despedida', 'alerts', 'alertas', 'nsfw', 'modosexo', 'modo', 'sexmode', 'antilink', 'antienlaces', 'antilinks', 'antistatus', 'antiestados', 'rpg', 'economy', 'economia', 'gacha', 'adminonly', 'onlyadmin'],
  category: 'group',
  description: 'Configurar opciones del grupo.',
  isAdmin: true,
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    let chatData = db.getChat(msg.chat);
    const botId = sock.user.id.split(':')[0] + "@s.whatsapp.net";
    const botSettings = db.getSettings(botId) || {};
    const botname = botSettings.botname || 'Bot';
    const stateArg = args.join(' ').toLowerCase().trim();
    const mapTerms = {
      antilinks: 'antilinks',
      antienlaces: 'antilinks',
      antilink: 'antilinks',
      antistatus: 'antistatus',
      antiestados: 'antistatus',
      welcome: 'welcome',
      bienvenida: 'welcome',
      goodbye: 'goodbye',
      despedida: 'goodbye',
      alerts: 'alerts',
      alertas: 'alerts',
      economy: 'economy',
      economia: 'economy',
      adminonly: 'adminonly',
      onlyadmin: 'adminonly',
      nsfw: 'modosexo',
      modo: 'modosexo',
      sexmode: 'modosexo',
      rpg: 'gacha',
      gacha: 'gacha'
    };
    const featureNames = {
      antilinks: 'el *AntiEnlace*',
      antistatus: 'el *AntiEstado*',
      welcome: 'el mensaje de *Bienvenida*',
      goodbye: 'el mensaje de *Despedida*',
      alerts: 'las *Alertas*',
      economy: 'los comandos de *Economía*',
      gacha: 'los comandos de *Gacha*',
      adminonly: 'el modo *Solo Admin*',
      modosexo: 'los comandos de *Modo Adulto / Sexo*'
    };
    const featureTitles = {
      antilinks: 'AntiEnlace',
      antistatus: 'AntiEstado',
      welcome: 'Bienvenida',
      goodbye: 'Despedida',
      alerts: 'Alertas',
      economy: 'Economía',
      gacha: 'Gacha',
      adminonly: 'AdminOnly',
      modosexo: 'Modo Sexo'
    };
    const messages = {
      antilinks: `> Si el *antienlace* está activado, *${botname}* eliminará a todos los usuarios que envíen links de otros grupos.`,
      antistatus: `> Si el *antiestado* está activado, *${botname}* eliminará a todos los usuarios que envié o mencionen al grupo en sus estado.`,
      welcome: `> Si el mensaje de bienvenida está activado, *${botname}* enviará un mensaje de bienvenida a los nuevos miembros del grupo.`,
      goodbye: `> Si el mensaje de despedida está activado, *${botname}* enviará un mensaje de despedida en el momento que un usuario abandone el grupo.`,
      alerts: `> Si las alertas están activadas, *${botname}* avisará a los administradores cuando se realicen cambios en admins.`,
      modosexo: `> Si el *Modo Sexo* está activado, *${botname}* permitirá contenido y comandos de entretenimiento adulto en el grupo.`,
      adminonly: `> Si el modo *Solo Admin* está activado, solo los administradores podrán utilizar los comandos de *${botname}*.`
    };
    const normalizedKey = mapTerms[command] || command;
    const current = normalizedKey === 'modosexo'
      ? (chatData.modosexo === true || chatData.modosexo === 1 || chatData.nsfw === true || chatData.nsfw === 1)
      : (chatData[normalizedKey] === true || chatData[normalizedKey] === 1);
    const estado = current ? '✓ Activado' : '✗ Desactivado';
    const nombreBonito = featureNames[normalizedKey] || `la función *${normalizedKey}*`;
    const titulo = featureTitles[normalizedKey] || normalizedKey;
    const types = messages[normalizedKey] || "";
    if (!stateArg) {
      if (normalizedKey === 'modosexo') {
        return msg.reply(`⚙️ *CONFIGURACIÓN DEL MÓDULO*\n\nPara cambiar el estado de este grupo usa:\n👉 *${usedPrefix}modo sexo* (Para activarlo)\n👉 *${usedPrefix}modo chill* (Para apagarlo)`);
      }
      return sock.reply(msg.chat, `*✩ ${titulo} (✿❛◡❛)*\n\nꕥ Un administrador puede activar o desactivar ${nombreBonito} utilizando:\n\n● _Habilitar ›_ *${usedPrefix + normalizedKey} enable*\n● _Deshabilitar ›_ *${usedPrefix + normalizedKey} disable*\n\n❒ *Estado actual ›* ${estado}\n${types}`, msg);
    }
    if (normalizedKey === 'modosexo') {
      if (!['sexo', 'modo sexo', 'chill', 'modo chill'].includes(stateArg)) {
        return msg.reply('⚠️ Comando inválido. Escribe únicamente *modo sexo* o *modo chill*.');
      }
    }
    const enabled = normalizedKey === 'modosexo'
      ? ['sexo', 'modo sexo'].includes(stateArg)
      : ['on', 'enable'].includes(stateArg);
    const newValue = enabled ? 1 : 0;
    if ((chatData[normalizedKey] === 1 && enabled) || (chatData[normalizedKey] === 0 && !enabled) || (chatData[normalizedKey] === true && enabled) || (chatData[normalizedKey] === false && !enabled)) {
      return msg.reply(`✎ *${titulo}* ya estaba *${enabled ? 'activado' : 'desactivado'}*.`);
    }
    chatData[normalizedKey] = newValue;
    db.setChat(msg.chat, normalizedKey, newValue);    return msg.reply(`✎ Has *${enabled ? 'activado' : 'desactivado'}* ${nombreBonito}.`);
  }
};
