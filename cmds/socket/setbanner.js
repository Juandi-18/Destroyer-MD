import fetch from 'node-fetch';
import db from '#db';

function ensureProtocol(url = '') {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

async function uploadImage(buffer, mime) {
  const base64Data = buffer.toString('base64');
  const extension = mime.split('/')[1] || 'jpg';
  
  const res = await fetch('https://cdn.adoolab.xyz/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: `upload.${extension}`,
      data: base64Data,
      expiration: 'never'
    })
  });
  
  const json = await res.json();
  if (json?.url) return json.url;
  throw new Error('Error al subir la imagen al servidor CDN');
}

export default {
  command: ['setbanner', 'setbotbanner'],
  category: 'socket',
  description: 'Cambiar el banner del menú (Soporta link o responder a imagen).',
  run: async ({ msg, sock, args }) => {
    const idBot = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    let config = db.getSettings(idBot) || {};
    
    // Verificación estricta de privilegios de Socket/Owner
    const isOwner = [idBot, ...(config.owner ? [config.owner] : []), ...global.owner.map(num => num + '@s.whatsapp.net')].includes(msg.sender);
    if (!isOwner) return sock.reply(msg.chat, global.mess.socket, msg);
    
    const value = args.join(' ').trim();
    const q = msg.quoted || msg;
    const mime = (q.msg || q).mimetype || q.mediaType || '';
    let finalBannerUrl = '';

    // ESCENARIO A: El usuario proporcionó una URL directa por texto
    if (value && value.startsWith('http')) {
      finalBannerUrl = value;
    } 
    // ESCENARIO B: El usuario envió o citó una imagen válida
    else if (/image\/(png|jpe?g|gif)/.test(mime)) {
      await msg.reply('✿ Descargando y procesando imagen adjunta, por favor espera...');
      const mediaBuffer = await q.download();
      if (!mediaBuffer) return msg.reply('✎ Error: No se pudo descargar el archivo adjunto de los servidores de WhatsApp.');
      
      try {
        finalBannerUrl = await uploadImage(mediaBuffer, mime);
      } catch (uploadError) {
        return msg.reply(`✎ Error al subir la imagen al CDN: ${uploadError.message}`);
      }
    } 
    // INPUT INVÁLIDO
    else {
      return msg.reply(`✎ Uso incorrecto del comando.\n\n» *Opción 1:* Escribe \`${args[0] || '/'}setbanner http://link-de-la-imagen.jpg\`\n» *Opción 2:* Responde a una imagen con el comando \`${args[0] || '/'}setbanner\``);
    }

    // Guardar permanentemente en la base de datos SQLite
    db.setSettings(idBot, 'banner', finalBannerUrl);
    const newConfig = db.getSettings(idBot) || {};
    
    return msg.reply(`✿ ¡Banner del menú configurado con éxito!`);
  }
};
