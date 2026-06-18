import db from '#db';
import path from 'path';
import { jidDecode } from 'baileys';

const paisesData = {
  '51': {
    pais: 'Perú',
    ciudades: ['Lima', 'Trujillo', 'Arequipa', 'Chiclayo', 'Piura', 'Cusco', 'Huancayo', 'Chimbote'],
    operadores: ['Movistar Perú', 'Claro Perú', 'Entel Perú', 'Bitel'],
    ipRango: '190.113.'
  },
  '52': {
    pais: 'México',
    ciudades: ['Puebla', 'CDMX', 'Guadalajara', 'Monterrey', 'Tijuana', 'León', 'Juárez', 'Querétaro'],
    operadores: ['Telcel', 'Movistar México', 'AT&T México', 'Altan Redes'],
    ipRango: '187.210.'
  },
  '57': {
    pais: 'Colombia',
    ciudades: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Pereira'],
    operadores: ['Claro Colombia', 'Movistar Colombia', 'Tigo', 'Wom'],
    ipRango: '181.132.'
  },
  '54': {
    pais: 'Argentina',
    ciudades: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'San Miguel de Tucumán'],
    operadores: ['Personal', 'Movistar Argentina', 'Claro Argentina'],
    ipRango: '190.18.'
  },
  '56': {
    pais: 'Chile',
    ciudades: ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta', 'Temuco'],
    operadores: ['Entel Chile', 'Movistar Chile', 'Claro Chile', 'WOM Chile'],
    ipRango: '200.111.'
  }
};


const secretosGraciosos = [
  { carpeta: '.system_recovery_cache', peso: '42.5 GB', contenido: 'Videos de porno furro HD, stickers de Piolín y fotos de Shrek embarazado.' },
  { carpeta: '.android_secure_priv', peso: '18.2 GB', contenido: 'Fotos de su ex con filtro de payaso, audios llorando por ella y edits de anime otakus.' },
  { carpeta: '.whatsapp_backup_hidden', peso: '89.4 GB', contenido: 'Capturas de pantalla hablando solo, memes de primaria y 14 gigas de gemidos en audios.' },
  { carpeta: '.miui_gallery_vault', peso: '61.1 GB', contenido: 'Fotos suyas fingiendo ser Aesthetic frente al espejo y tareas sin abrir desde 2024.' },
  { carpeta: '.cloud_sync_private_data', peso: '5.7 GB', contenido: 'Historial de Google buscando "cómo enamorar a una IA" y 400 fotos de patas.' }
];

export default {
  command: ['doxear', 'doxeo', 'track'],
  category: 'fun',
  description: 'Simular un doxeo falso hiperrealista conectado al ecosistema del bot.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    // 🔍 1. CAPTURA DEL USUARIO OBJETIVO (Mención, Respuesta o Texto)
    const repliedUser = msg?.quoted?.sender || null;
    const mentionedUser = Array.isArray(msg?.mentionedJid) ? msg.mentionedJid.find(Boolean) : null;
    
    const fullArgs = args.join(' ').trim();
    let rawTarget = fullArgs.replace(/\D/g, '');
    let targetJid = repliedUser || mentionedUser || (rawTarget ? `${rawTarget}@s.whatsapp.net` : null);

    if (!targetJid) {
      return msg.reply(`《✧》 Menciona o responde al mensaje de un usuario para procesar el rastreo.\n> Ejemplo: *${usedPrefix + command} @usuario*`);
    }

    const targetNumber = targetJid.split('@')[0];

    // 🗂️ 2. CONEXIÓN A LA BASE DE DATOS (#db) - Extraer datos reales del objetivo
    const targetSettings = db.getSettings(targetJid) || {};
    const targetUser = db.getUser(targetJid) || {};
    
    // Detectar el nombre personalizado del bot si es un clon o usar su nombre de registro
    const realBotName = targetSettings?.namebot || targetUser?.name || 'Usuario Común';
    const systemType = targetSettings?.type || 'Usuario Gratuito';

    // 🗺️ 3. DETECCIÓN INTELIGENTE DE PAÍS
    let prefix = '';
    if (targetNumber.startsWith('51')) prefix = '51';
    else if (targetNumber.startsWith('52')) prefix = '52';
    else if (targetNumber.startsWith('57')) prefix = '57';
    else if (targetNumber.startsWith('54')) prefix = '54';
    else if (targetNumber.startsWith('56')) prefix = '56';

    const infoPais = paisesData[prefix] || {
      pais: 'Latinoamérica',
      ciudades: ['Zona Central', 'Sector Desconocido', 'Área Restringida'],
      operadores: ['Operador Genérico LTE', 'Red Satelital Pública'],
      ipRango: '192.168.'
    };

    // Seleccionar datos verídicos mezclados al azar
    const ciudad = infoPais.ciudades[Math.floor(Math.random() * infoPais.ciudades.length)];
    const operador = infoPais.operadores[Math.floor(Math.random() * infoPais.operadores.length)];
    const secreto = secretosGraciosos[Math.floor(Math.random() * secretosGraciosos.length)];

    // Generar parámetros técnicos simulados para el impacto visual
    const ipFinal = infoPais.ipRango + Math.floor(Math.random() * 254) + '.' + Math.floor(Math.random() * 254);
    const latitud = (Math.random() * (15 - 1) + 1).toFixed(6);
    const longitud = (Math.random() * (75 - 70) + 70).toFixed(6);
    const bateria = Math.floor(Math.random() * (98 - 15) + 15);
    const ramLibre = (Math.random() * (3.8 - 0.2) + 0.2).toFixed(2);

    // 📝 4. CONSTRUCCIÓN DEL MENSAJE ESTÉTICO HIPERREALISTA
    let textoDoxeo = `📡 *[PROCESANDO RASTREO SATELITAL]* 📡\n`;
    textoDoxeo += `─────────────────────────\n`;
    textoDoxeo += `🎯 *Objetivo:* @${targetNumber}\n`;
    textoDoxeo += `👤 *Identificador DB:* \`${realBotName}\`\n`;
    textoDoxeo += `🛡️ *Rango de Red:* \`${systemType}\`\n`;
    textoDoxeo += `🇨🇱 *País Base:* ${infoPais.pais}\n`;
    textoDoxeo += `📍 *Ciudad/Región:* ${ciudad}\n`;
    textoDoxeo += `📶 *Proveedor Móvil:* ${operador}\n`;
    textoDoxeo += `🌐 *Dirección IP:* ${ipFinal}\n`;
    textoDoxeo += `🧭 *Coordenadas:* -${latitud}, -${longitud}\n`;
    textoDoxeo += `📱 *Batería Remota:* ${bateria}%\n`;
    textoDoxeo += `🧠 *RAM Libre de Instancia:* ${ramLibre} GB\n`;
    textoDoxeo += `─────────────────────────\n`;
    textoDoxeo += `📂 *📂 CARPETA OCULTA DETECTADA (EXTRACCIÓN COMPLETA):* 📂\n`;
    textoDoxeo += `> 📁 *Ruta:* \`sdcard/Android/data/${secreto.carpeta}\`\n`;
    textoDoxeo += `> 📦 *Tamaño:* ${secreto.peso}\n`;
    textoDoxeo += `> 🔞 *Contenido:* ${secreto.contenido}\n`;
    textoDoxeo += `───────────────────────`;

    // 🚀 5. ENVÍO DIRECTO CON MENCIONES HABILITADAS
    await sock.sendMessage(msg.chat, { 
      text: textoDoxeo, 
      mentions: [targetJid] 
    }, { quoted: msg });
  }
};