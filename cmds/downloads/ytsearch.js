import yts from 'yt-search'
import { getBuffer } from '#serialize'

export default {
  command: ['ytsearch', 'search', 'yts'],
  category: 'downloads',
  description: 'Buscar videos de YouTube.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    try {
      if (!args || !args[0]) {
        return msg.reply('《✧》 Por favor, Ingrese el título de un vídeo.')
      }    

      // Unificamos todas las palabras del argumento en una sola búsqueda
      const query = args.join(' ').trim()
      const ress = await yts(query)
      const armar = ress.all

      // Validación de seguridad por si YouTube no devuelve resultados
      if (!armar || armar.length === 0) {
        return msg.reply('《✧》 No se encontraron resultados para tu búsqueda.')
      }

      // Intentamos obtener la miniatura del primer resultado de forma segura
      let Ibuff = null
      if (armar[0]?.image || armar[0]?.thumbnail) {
        Ibuff = await getBuffer(armar[0].image || armar[0].thumbnail).catch(() => null)
      }

      let teks2 = armar.map((v) => {
        switch (v.type) {
          case 'video':
            // Forzamos el uso de comas ('en-US') en las vistas del buscador
            const formattedViews = v.views ? Number(v.views).toLocaleString('en-US') : 'Desconocido'
            return `➩ *Título ›* *${v.title}* > ⴵ *Duración ›* ${v.timestamp || 'Desconocido'}
> ❖ *Subido ›* ${v.ago || 'Desconocido'}
> ✿ *Vistas ›* ${formattedViews}
> ❒ *Url ›* ${v.url}`.trim()
            
          case 'channel':
            return `> ❖ *Canal ›* *${v.name}*
> ❒ *Url ›* ${v.url}
> ❀ *Subscriptores ›* ${v.subCountLabel || 'Desconocido'}
> ✿ *Videos totales ›* ${v.videoCount || 0}`.trim()
        }
      }).filter((v) => v).join('\n\n╾۪〬─ ┄۫╌ ׄ┄┈۪ ─〬 ׅ┄╌ ۫┈ ─ׄ─۪〬 ┈ ┄۫╌ ─ׄ〬╼\n\n')    

      // Si se logró descargar el búfer de la imagen, la mandamos; de lo contrario mandamos solo texto
      if (Ibuff) {
        await sock.sendMessage(msg.chat, { image: Ibuff, caption: teks2.trim() }, { quoted: msg })
      } else {
        await msg.reply(teks2.trim())
      }

    } catch (e) {
      await msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*.\n> [Error: *${e.message}*]`)
    }
  },
}