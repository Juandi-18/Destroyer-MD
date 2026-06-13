import fetch from 'node-fetch'
import db from '#db';

export default {
  command: ['danbooru', 'dbooru'],
  category: 'modosexo',
  description: 'Buscar imágenes en Danbooru en modo sexo.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    try {
      const chat = db.getChat(msg.chat);
      const modoEnabled = chat.modosexo === 1 || chat.modosexo === true || chat.nsfw === 1 || chat.nsfw === true;
      if (!modoEnabled) return msg.reply(`ꕥ El contenido de *Modo Sexo* está desactivado en este grupo.

Un *administrador* puede activarlo con el comando:
» *${usedPrefix}modo sexo*`)
      if (!args[0]) return sock.reply(msg.chat, `《✧》 Debes especificar tags para buscar\n> Ejemplo » *${usedPrefix + command} neko*`, msg)
      await msg.react('🕒')
      const tag = args[0].replace(/\s+/g, '_')
      const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tag)}`
      const res = await fetch(url)
      const json = await res.json()
      const mediaList = json.map(p => p?.file_url).filter(u => typeof u === 'string' && /\.(jpe?g|png|gif)$/.test(u))
      if (!mediaList.length) return sock.reply(msg.chat, `《✧》 No se encontraron resultados para ${tag}`, msg)
      const media = mediaList[Math.floor(Math.random() * mediaList.length)]
      const caption = `ꕥ Resultados para » ${tag}`
      await sock.sendMessage(msg.chat, { image: { url: media }, caption, mentions: [msg.sender] })
      await msg.react('✔️')
    } catch (e) {
      await msg.react('✖️')
      await msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`)
    }
  }
}