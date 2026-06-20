import { GoogleGenAI } from '@google/genai';
import fetch from 'node-fetch';
import db from '#db';

if (!global.geminiCooldowns) {
  global.geminiCooldowns = new Map();
}

const langs = { typescript: 'ts', javascript: 'js', python: 'py', html: 'html', css: 'css', java: 'java', cpp: 'cpp', c: 'c', json: 'json', bash: 'sh', sql: 'sql', rust: 'rs', go: 'go', php: 'php', ruby: 'rb' };

function detectLanguage(query, response) {
  const q = query.toLowerCase();
  const r = response;
  if (/typescript/i.test(q)) return 'typescript';
  if (/\bpython\b/i.test(q)) return 'python';
  if (/\bhtml\b/i.test(q)) return 'html';
  if (/\bcss\b/i.test(q)) return 'css';
  if (/\bjava\b(?!script)/i.test(q)) return 'java';
  if (/\bc\+\+|cpp\b/i.test(q)) return 'cpp';
  if (/\bjson\b/i.test(q)) return 'json';
  if (/\bbash\b|\bshell\b/i.test(q)) return 'bash';
  if (/\bsql\b/i.test(q)) return 'sql';
  if (/\brust\b/i.test(q)) return 'rust';
  if (/\bgolang\b|\bgo\b/i.test(q)) return 'go';
  if (/\bphp\b/i.test(q)) return 'php';
  if (/\bruby\b/i.test(q)) return 'ruby';
  if (/javascript/i.test(q)) return 'javascript';
  const asksCode = /(c[oó]digo|code|programa|script|funci[oó]n|clase|m[eé]todo|algoritmo|actualiza|edita|crea|implementa)/i.test(q);
  if (!asksCode) return null;
  if (/def |import \w+\n|print\s*\(|:\n\s{4}/i.test(r)) return 'python';
  if (/<html|<div|<body|<span|<head/i.test(r)) return 'html';
  if (/\{[\s\S]*color:|margin:|padding:|font-/i.test(r)) return 'css';
  if (/public\s+class|System\.out\.print/i.test(r)) return 'java';
  if (/#include\s*<|int main\s*\(/i.test(r)) return 'cpp';
  if (/SELECT |INSERT |UPDATE |DELETE |CREATE TABLE/i.test(r)) return 'sql';
  if (/fn main\(\)|let mut |println!\(/i.test(r)) return 'rust';
  if (/func \w+\(|package main|fmt\.Print/i.test(r)) return 'go';
  if (/<\?php|\$[a-z_]+\s*=/i.test(r)) return 'php';
  if (/def initialize|\.each do |puts /i.test(r)) return 'ruby';
  if (/\{["'][\w]+["']\s*:/i.test(r) && !/function|const|let|var/.test(r)) return 'json';
  if (/function|class\s+\w|const |let |var |=>|\bimport\b|\bexport\b|console\.log/i.test(r)) {
    return /:\s*(string|number|boolean|void|any)\b|interface\s+\w|<\w+>/i.test(r) ? 'typescript' : 'javascript';
  }
  return null;
}

export default {
  command: ['ia', 'geminis'],
  category: 'utils',
  description: 'IA con Múltiples Bases de Datos, Visión, y Respaldo Inteligente.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    let text = args.join(' ').trim();
    if (!text && msg.body) text = msg.body.trim();

    if (text.toLowerCase().startsWith('geminis')) {
      text = text.slice(7).trim();
    }

    if (!text) {
      return msg.reply(`《✧》 Escriba una *petición* o una *instrucción* para Destroyer GenAI.`);
    }

    const COOLDOWN_TIME = 4000; 
    const cooldownKey = `${msg.chat}-${msg.sender}`;
    const lastUsed = global.geminiCooldowns.get(cooldownKey);
    const ahora = Date.now();

    if (lastUsed && (ahora - lastUsed) < COOLDOWN_TIME) {
      const tiempoRestante = ((COOLDOWN_TIME - (ahora - lastUsed)) / 1000).toFixed(1);
      await msg.react('⏳');
      return msg.reply(`⏳ *[SISTEMA ANTIESPAM]*\n───────────────────\nJuandi, estás enviando peticiones demasiado rápido.\n\n> ⏱️ Por favor, espera *${tiempoRestante} segundos* antes de volver a consultar a Gemini.`);
    }

    global.geminiCooldowns.set(cooldownKey, ahora);

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const settings = db.getSettings(botJid);
    const user = db.getUser(msg.sender);
    const username = user?.name || 'usuario';
    const botname = settings.botname || 'Bot';
    
    const basePrompt = `Tu nombre es ${botname} y fuiste creada por |𝔇ĕ𝐬†𝓻⊙γĕ𝓻𒆜. Tu estilo es divertido e inteligente. Habla con el usuario por su nombre: ${username}.`;

    const cleanText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const requiereImagen = /(crea|imagina|dibuja|genera|disena|haz una foto|haz una imagen|haz un dibujo|muestrame un)/i.test(cleanText);
    const esLetraDeCancion = /(letra|lyrics|cancion)/i.test(cleanText);
    const requiresVision = msg.quoted && (msg.quoted.message?.imageMessage || msg.quoted.message?.documentMessage?.mimetype?.startsWith('image/'));

    try {
      const { key } = await sock.sendMessage(msg.chat, { text: `🧠 *[DESTROYER MULTIMEDIA ENGINE]* 🧠\n───────────────────\n📡 *Estado:* Conectando a APIs centrales...\n⚡ *Módulo:* \`${requiereImagen ? 'Pollinations Image Engine' : (esLetraDeCancion ? 'Multi-Scraper Lyrics DB' : (requiresVision ? 'Gemini 3.5 Vision' : 'Gemini 3.5 Flash'))}\`\n───────────────────\n_Procesando flujos de datos en tiempo real..._` }, { quoted: msg });
      await msg.react('🕒');

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      let partsPayload = [{ text: text }];

      if (msg.quoted) {
        const quotedMsg = msg.quoted.message;
        const imageMessage = quotedMsg?.imageMessage;
        const documentMessage = quotedMsg?.documentMessage || quotedMsg?.documentWithCaptionMessage?.message?.documentMessage;
        
        if (imageMessage && imageMessage.mimetype) {
          const buffer = await sock.downloadMediaMessage(msg.quoted);
          if (buffer) {
            partsPayload.unshift({ inlineData: { mimeType: imageMessage.mimetype, data: buffer.toString('base64') } });
          }
        } else if (documentMessage && documentMessage.mimetype) {
          const buffer = await sock.downloadMediaMessage(msg.quoted);
          if (buffer) {
            partsPayload.unshift({ inlineData: { mimeType: documentMessage.mimetype, data: buffer.toString('base64') } });
          }
        }
      }

      let responseText = null;

      if (requiereImagen) {
        let imageBufferResult = null;
        let textResult = '';

        try {
          const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=1024&height=1024&nologo=true`;
          const imageRes = await fetch(imageUrl);
          if (imageRes.ok) {
            imageBufferResult = await imageRes.buffer();
            textResult = `🎨 _Imagen generada con éxito vía Destroyer Engine._`;
          }
        } catch (backupErr) {
          console.error('[Error en Motor Gráfico]:', backupErr.message);
        }

        if (imageBufferResult) {
          await msg.react('🎨');
          await sock.sendMessage(msg.chat, { text: `✅ *Proceso de diseño completado exitosamente.*`, edit: key });
          await sock.sendMessage(msg.chat, { image: imageBufferResult, caption: textResult }, { quoted: msg });
          return;
        } else {
          await msg.react('❌');
          return sock.sendMessage(msg.chat, { text: '《✧》 No se pudo generar la imagen debido a las restricciones actuales. Intenta más tarde.', edit: key });
        }
      } else if (esLetraDeCancion) {
        // 🎵 SISTEMA MULTI-SCRAPER: Busca en 2 bases de datos distintas antes de rendirse
        try {
          const songQuery = text.replace(/(buscame|busca|internet|en|la|letra|de|cancion|lyrics|geminis|por|favor|quiero)/gi, '').trim();
          
          // Base de datos 1: Some Random API (Muy buena con Rock en Español y metadatos)
          try {
            const sraRes = await fetch(`https://some-random-api.com/lyrics?title=${encodeURIComponent(songQuery)}`);
            const sraJson = await sraRes.json();
            if (sraJson && sraJson.lyrics) {
              responseText = `🎵 *${sraJson.title}*\n👤 *${sraJson.author}*\n───────────────────\n\n${sraJson.lyrics}`;
            }
          } catch (e) {
            console.log('[Info]: Falló SRA, pasando a Popcat DB...');
          }

          // Base de datos 2: Popcat (Si la Base 1 no encontró nada)
          if (!responseText) {
            const popcatRes = await fetch(`https://api.popcat.xyz/lyrics?song=${encodeURIComponent(songQuery)}`);
            const popcatJson = await popcatRes.json();
            if (popcatJson && popcatJson.lyrics) {
              responseText = `🎵 *${popcatJson.title}*\n👤 *${popcatJson.artist}*\n───────────────────\n\n${popcatJson.lyrics}`;
            } else {
              throw new Error("No se encontró en las 2 bases de datos.");
            }
          }
        } catch (lyricsErr) {
          console.log('[Aviso Lyrics]:', lyricsErr.message);
        }
      }

      // Si no fue imagen ni letra, O si el scraper multi-base falló
      if (!responseText && !requiereImagen) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash', // Usamos el modelo top que tienes en tu consola
            contents: [{ role: 'user', parts: partsPayload }],
            config: {
              systemInstruction: basePrompt,
              temperature: 0.5,
              maxOutputTokens: 2048,
              tools: [{ googleSearch: {} }]
            }
          });
          if (response && response.text) responseText = response.text;
        } catch (err) {
          console.log('[Error Google API]:', err.message);
          responseText = null;
        }
      }

      // 🛡️ CASCADA DE RESPALDO INTELIGENTE (LA CURA A LA "CEGUERA")
      if (!responseText && !requiereImagen) {
        if (requiresVision) {
          // Si pediste analizar una imagen y Google falló (Cuota 429), NO vamos a Delirius porque es ciego.
          await msg.react('❌');
          return sock.sendMessage(msg.chat, { text: '《✧》 Mis procesadores visuales primarios están saturados (Límite de Cuota de API). Por favor, intenta enviarme la imagen de nuevo en un par de minutos.', edit: key });
        } else {
          // Si era texto normal, sí podemos usar a Delirius tranquilamente
          try {
            const res = await fetch(`${global.APIs.delirius.url}/ia/gptprompt?text=${encodeURIComponent(text)}&prompt=${encodeURIComponent(basePrompt)}`);
            const json = await res.json();
            if (json?.status && json?.data && json.data !== 'Error: No response') responseText = json.data;
          } catch {}
        }
      }

      if (!responseText && !requiereImagen) {
        await msg.react('❌');
        return sock.sendMessage(msg.chat, { text: '《✧》 Las centrales se encuentran congestionadas en este momento. Intenta de nuevo.', edit: key });
      }

      const clean = responseText.trim();
      const lang = detectLanguage(text, clean);

      if (lang) {
        const ext = langs[lang] ?? 'txt';
        const filename = `ꕥ respuesta.${ext}`;
        const tableData = { 
          title: `✎ ${botname} Engine`, 
          headers: ['Módulo', 'Estado'], 
          rows: [ ['Lenguaje', lang.toUpperCase()], ['Contexto', 'Directo Nativo'], ['Estructura', 'Petición Única'] ] 
        };
        await sock.sendMessage(msg.chat, { text: `✅ *Bloque de código ${lang.toUpperCase()} generado exitosamente.*`, edit: key });
        await sock.sendCodeMessage(msg.chat, filename, clean, msg, tableData);
      } else {
        await sock.sendMessage(msg.chat, { text: clean, edit: key });
      }

      await msg.react('✔️');

    } catch (e) {
      if (!e.message?.includes('429') && !e.message?.includes('503')) {
        console.error(e);
        await msg.reply(`> Ocurrió un error inesperado en las centrales multimedia de Destroyer.\n> [Error: *${e.message}*]`);
      }
    }
  },
};