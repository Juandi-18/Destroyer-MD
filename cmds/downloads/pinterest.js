import fetch from 'node-fetch'

export default {
  command: ['pinterest', 'pin'],
  category: 'downloads',
  description: 'Buscar y descargar imágenes de Pinterest.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const text = args.join(' ')
    const isPinterestUrl = /^https?:\/\//.test(text)
    if (!text) {
      return msg.reply('《✧》 Por favor, ingresa un término de búsqueda o un enlace de Pinterest.')
    }
    try {
      if (isPinterestUrl) {
        const data = await getPinterestDownload(text)
        if (!data) return msg.reply('ꕥ No se pudo obtener el contenido.')
        const caption = `ㅤ۟∩　ׅ　★　ׅ　🅟𝖨𝖭 🅓ownload　ׄᰙ　\n\n${data.title ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Título* › ${data.title}\n` : ''}${data.description ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Descripción* › ${data.description}\n` : ''}${data.author ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Autor* › ${data.author}\n` : ''}${data.username ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Usuario* › ${data.username}\n` : ''}${data.followers ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Seguidores* › ${data.followers}\n` : ''}${data.uploadDate ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Fecha* › ${data.uploadDate}\n` : ''}${data.likes ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Likes* › ${data.likes}\n` : ''}${data.comments ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Comentarios* › ${data.comments}\n` : ''}${data.views ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Vistas* › ${data.views}\n` : ''}${data.saved ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Guardados* › ${data.saved}\n` : ''}${data.format ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Formato* › ${data.format}\n` : ''}𖣣ֶㅤ֯⌗ ☆  ⬭ *Enlace* › ${text}`
        if (data.type === 'video') {
          await sock.sendMessage(msg.chat, { video: { url: data.url }, caption, mimetype: 'video/mp4', fileName: 'pin.mp4' }, { quoted: msg })
        } else if (data.type === 'image') {
          await sock.sendMessage(msg.chat, { image: { url: data.url }, caption }, { quoted: msg })
        } else {
          throw new Error('Contenido no soportado.')
        }
      } else {
        const results = await getPinterestSearch(text)
        if (!results || results.length === 0) {
          return msg.reply(`《✧》 No se encontraron resultados para *${text}*.`)
        }
        const medias = results.slice(0, 10).map(r => ({ 
          type: r.type === 'video' ? 'video' : 'image', 
          data: { url: r.image }, 
          caption: `ㅤ۟∩　ׅ　★　ׅ　🅟𝖨𝖭 🅢earch　ׄᰙ　\n\n${r.title ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Título* › ${r.title}\n` : ''}${r.description ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Descripción* › ${r.description}\n` : ''}${r.name ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Autor* › ${r.name}\n` : ''}${r.username ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Usuario* › ${r.username}\n` : ''}${r.followers ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Seguidores* › ${r.followers}\n` : ''}${r.likes ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Likes* › ${r.likes}\n` : ''}${r.created_at ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Fecha* › ${r.created_at}\n` : ''}`
        }))
        await sock.sendAlbumMessage(msg.chat, medias, { quoted: msg })
      }
    } catch (e) {
      await msg.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`)
    }
  }
}

async function getPinterestDownload(url) {
  const apis = [
    { endpoint: `${global.APIs.yuki.url}/dl/pinterest?url=${encodeURIComponent(url)}&key=${global.APIs.yuki.key}`, extractor: (res) => {
        if (!res.status || !res.result?.best?.url) return null
        const isVideo = res.result.isVideo || false
        const bestUrl = res.result.best.url
        return { type: isVideo ? 'video' : 'image', title: null, description: null, author: null, username: null, uploadDate: null, likes: null, format: isVideo ? 'mp4' : 'jpg', url: bestUrl }
      }
    },
    { endpoint: `${global.APIs.axi.url}/down/pinterest?url=${encodeURIComponent(url)}`, extractor: (res) => {
        if (!res.status || !res.resultado?.url) return null
        const urlVideo = res.resultado.url
        const isVideo = urlVideo.includes('.mp4')
        return { type: isVideo ? 'video' : 'image', title: res.resultado.titulo || null, author: res.resultado.autor || null, format: isVideo ? 'mp4' : 'jpg', url: urlVideo, thumbnail: res.resultado.thumbnail || null }
      }
    },
    { endpoint: `${global.APIs.delirius.url}/download/pinterestdl?url=${encodeURIComponent(url)}`, extractor: (res) => {
        if (!res.status || !res.data?.download?.url) return null
        const dl = res.data.download
        const isVideo = dl.type === 'video'
        return { type: dl.type || (isVideo ? 'video' : 'image'), title: res.data.title || null, description: res.data.description || null, author: res.data.author_name || null, username: res.data.username || null, followers: res.data.followers || null, uploadDate: res.data.upload || null, likes: res.data.likes || null, comments: res.data.comments || null, format: isVideo ? 'mp4' : 'jpg', url: dl.url, thumbnail: res.data.thumbnail || null, source: res.data.source || null }
      }
    },
    { endpoint: `${global.APIs.vreden.url}/api/v1/download/pinterest?url=${encodeURIComponent(url)}`, extractor: (res) => {
        if (!res.status || !res.result?.media_urls?.length) return null
        const media = res.result.media_urls.find(m => m.quality === 'original') || res.result.media_urls[0]
        if (!media?.url) return null
        return { type: media.type, title: res.result.title || null, description: res.result.description || null, author: res.result.uploader?.full_name || null, username: res.result.uploader?.username || null, uploadDate: res.result.created_at || null, likes: res.result.statistics?.saved || null, views: res.result.statistics?.views || null, saved: res.result.statistics?.saved || null, format: media.type, url: media.url }
      }
    }
  ]

  for (const { endpoint, extractor } of apis) {
    try {
      const res = await fetch(endpoint).then(r => r.json())
      const result = extractor(res)
      if (result) return result
    } catch {}
    await new Promise(r => setTimeout(r, 500))
  }
  return null
}

async function getPinterestSearch(query) {
  const apis = [
    { endpoint: `${global.APIs.yuki.url}/search/pinterest?query=${encodeURIComponent(query)}&key=${global.APIs.yuki.key}`, extractor: (res) => {
        if (!res.status || !Array.isArray(res.data) || !res.data.length) return null
        return res.data.map(d => ({ type: 'image', title: d.title === '-' ? null : d.title, description: d.description === ' ' ? null : d.description, name: d.full_name || null, username: d.username || null, followers: d.followers, likes: d.likes, created_at: d.created, image: d.hd || d.mini || null }))
      }
    },
    { endpoint: `${global.APIs.yuki.url}/search/pinterestvideo?query=${encodeURIComponent(query)}&key=${global.APIs.yuki.key}`, extractor: (res) => {
        if (!res.status || !res.data?.videos?.length) return null
        return res.data.videos.map(d => ({ type: 'video', title: d.title || null, image: d.thumb || null, likes: d.likes, duration: d.duration, url: d.dl || null }))
      }
    },
    { endpoint: `${global.APIs.delirius.url}/search/pinterestv2?text=${encodeURIComponent(query)}`, extractor: (res) => {
        if (!res.status || !Array.isArray(res.data) || !res.data.length) return null
        return res.data.map(d => ({ type: 'image', title: d.title === '-' ? null : d.title, description: d.description === ' ' ? null : d.description, name: d.name || null, username: d.username || null, followers: d.followers, likes: d.likes, created_at: d.created_at, image: d.image || null }))
      }
    },
    { endpoint: `${global.APIs.delirius.url}/search/pinterestvideo?query=${encodeURIComponent(query)}`, extractor: (res) => {
        if (!res.status || !Array.isArray(res.data) || !res.data.length) return null
        return res.data.map(d => ({ type: 'video', title: d.title || null, description: d.description || null, name: d.author?.full_name || null, username: d.author?.username || null, followers: d.author?.followers || null, likes: d.likes, created_at: d.created_at, image: d.thumbnail || null, url: d.video || null }))
      }
    },
    { endpoint: `${global.APIs.siputzx.url}/api/s/pinterest?query=${encodeURIComponent(query)}&type=image`, extractor: (res) => {
        if (!res.status || !Array.isArray(res.data) || !res.data.length) return null
        return res.data.map(d => ({ type: d.type || 'image', title: d.grid_title || null, description: d.description === ' ' ? null : d.description, name: d.pinner?.full_name || null, username: d.pinner?.username || null, followers: d.pinner?.follower_count || null, likes: d.reaction_counts?.['1'] || null, created_at: d.created_at, image: d.image_url || d.video_url || d.gif_url || null, url: d.video_url || null }))
      }
    },
    { endpoint: `${global.APIs.vreden.url}/api/v2/search/pinterest?query=${encodeURIComponent(query)}&limit=20&type=images`, extractor: (res) => {
        if (!res.status || !res.result?.result?.length) return null
        return res.result.result.map(d => {
          const media = d.media_urls?.[0] || {}
          return { type: media.type || 'image', title: d.title || null, description: d.description || null, name: d.uploader?.full_name || null, username: d.uploader?.username || null, followers: d.uploader?.followers || null, created_at: null, image: media.url || media.thumbnail || null, url: media.type === 'video' ? media.url : null, duration: media.duration_ms ? `${Math.floor(media.duration_ms / 1000)}s` : null }
        })
      }
    },
    { endpoint: `${global.APIs.neoapis.url}/api/search/pinterest?query=${encodeURIComponent(query)}`, extractor: (res) => {
        if (!res.status || !Array.isArray(res.data) || !res.data.length) return null
        return res.data.map(d => ({ type: 'image', title: d.title || null, name: d.username || null, username: d.username || null, image: d.image || null, source: d.source || null }))
      }
    },
    { endpoint: `${global.APIs.ootaizumi.url}/search/pinterest?query=${encodeURIComponent(query)}`, extractor: (res) => {
        if (!res.status || !Array.isArray(res.result) || !res.result.length) return null
        return res.result.map(d => ({ type: d.media?.video ? 'video' : 'image', title: d.title || null, description: d.description || null, name: d.uploader?.full_name || null, username: d.uploader?.username || null, image: d.media?.images?.orig?.url || d.media?.images?.large?.url || d.media?.images?.medium?.url || null, url: d.media?.video?.url || null }))
      }
    }
  ]

  for (const { endpoint, extractor } of apis) {
    try {
      const res = await fetch(endpoint).then(r => r.json())
      const results = extractor(res)
      if (results?.length) return results
    } catch {}
    await new Promise(r => setTimeout(r, 500))
  }
  return []
}