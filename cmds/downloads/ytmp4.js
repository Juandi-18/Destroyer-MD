import yts from 'yt-search'
import fetch from 'node-fetch'

const cmd = {
  command: ['play2', 'mp4', 'ytmp4', 'ytvideo', 'playvideo'],
  category: 'downloads',
  description: 'Descargar un vídeo de YouTube.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    try {
      if (!args[0]) {
        return msg.reply('《✧》Por favor, menciona el nombre o URL del video que deseas descargar')
      }

      const input_text = args.join(' ').trim()
      const video_id = getVideoId(input_text)
      const query = video_id ? `https://youtu.be/${video_id}` : input_text

      let url = query
      let title = 'video'
      let thumbnail = null
      let channel = 'Desconocido'
      let duration = 'Desconocido'
      let views = '0'
      let published = 'Desconocido'

      try {
        const video_info = await getVideoInfo(query, video_id)

        if (video_info) {
          url = video_info.url || `https://youtu.be/${video_info.videoId}`
          title = video_info.title || title
          thumbnail = video_info.image || video_info.thumbnail || null
          channel = video_info.author?.name || video_info.author || 'Desconocido'
          duration = video_info.timestamp || 'Desconocido'
          views = Number(video_info.views || 0).toLocaleString('en-US');
          published = video_info.ago || 'Desconocido'

          const info_message = `➩ Descargando › *${title}*

> ❖ Canal › *${channel}*
> ⴵ Duración › *${duration}*
> ❀ Vistas › *${views}*
> ✩ Publicado › *${published}*
> ❒ Calidad › *${download_quality}*
> ❒ Enlace › *${url}*`

          if (thumbnail) {
            await sock.sendMessage(msg.chat, {
              image: { url: thumbnail },
              caption: info_message
            }, { quoted: msg })
          } else {
            await msg.reply(info_message)
          }
        }
      } catch {}

      if (!isYTUrl(url)) {
        return msg.reply('《✧》No encontré un video válido de YouTube.')
      }

      let video = null

      try {
        video = await getVideoFromYtdown(url)
      } catch (e) {
        return msg.reply(`《✧》No se pudo descargar el *video*, intenta más tarde.\n> ${e.message}`)
      }

      if (!video?.url) {
        return msg.reply('《✧》No se pudo descargar el *video*, intenta más tarde.')
      }

      title = video.title || title
      channel = video.channel || channel
      duration = video.duration || duration
      thumbnail = thumbnail || video.thumbnail || makeYoutubeThumbnail(video.video_id || getVideoId(url))

      const file_size = video.size_bytes || parseFileSize(video.size)
      const size_text = file_size ? formatBytes(file_size) : (video.size || 'Desconocido')
      const send_as_document = file_size ? file_size > max_video_size : false
      const file_name = sanitizeFileName(video.filename || video.title || title) + '.mp4'

      const caption = `乂 *Video descargado*

> ❖ Canal › *${channel}*
> ⴵ Duración › *${duration}*
> ❒ Calidad › *${video.quality || download_quality}*
> ❒ Tamaño › *${size_text}*`

      if (send_as_document) {
        const thumb_buffer = await makeJpegThumbnail(thumbnail).catch(() => null)

        await sendVideoAsDocument(sock, msg, video.url, file_name, caption, thumb_buffer)
        return
      }

      try {
        await sock.sendMessage(msg.chat, {
          video: { url: video.url },
          fileName: file_name,
          mimetype: 'video/mp4',
          caption
        }, { quoted: msg })
      } catch {
        const thumb_buffer = await makeJpegThumbnail(thumbnail).catch(() => null)

        await sendVideoAsDocument(sock, msg, video.url, file_name, caption, thumb_buffer)
      }
    } catch (e) {
      await msg.reply(
        `> An unexpected error occurred while executing command *${usedPrefix + command}*.\n> [Error: *${e.message}*]`
      )
    }
  }
}

export default cmd

const download_quality = '720p'
const max_video_size = 68 * 1024 * 1024

const config = {
  timeout: 45000,
  poll_attempts: 30,
  poll_delay: 1500
}

const endpoints = {
  proxy: 'https://app.ytdown.to/proxy.php'
}

const page = {
  origin: 'https://app.ytdown.to',
  referer: 'https://app.ytdown.to/es29/'
}

const defaults = {
  user_agent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'
}

const headers = {
  proxy() {
    return {
      accept: '*/*',
      'accept-language': 'es-US,es-419;q=0.9,es;q=0.8',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      origin: page.origin,
      referer: page.referer,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': defaults.user_agent,
      'x-requested-with': 'XMLHttpRequest'
    }
  },

  image() {
    return {
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'user-agent': defaults.user_agent
    }
  }
}

class Ytdown {
  constructor(options = {}) {
    this.url = options.url || ''
    this.quality = this.normalizeQuality(options.quality || download_quality)
    this.timeout = Number(options.timeout || config.timeout)
    this.poll_attempts = Number(options.poll_attempts || config.poll_attempts)
    this.poll_delay = Number(options.poll_delay || config.poll_delay)
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  normalizeQuality(quality) {
    const value = String(quality || '').toLowerCase().trim()
    return value.endsWith('p') ? value : `${value}p`
  }

  extractVideoId(input) {
    const text = String(input || '').trim()

    if (/^[a-zA-Z0-9_-]{11}$/.test(text)) {
      return text
    }

    try {
      const url = new URL(text)
      const host = url.hostname.replace(/^www\./, '')

      if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0]

        if (/^[a-zA-Z0-9_-]{11}$/.test(id)) {
          return id
        }
      }

      if (host.endsWith('youtube.com')) {
        const id = url.searchParams.get('v')

        if (/^[a-zA-Z0-9_-]{11}$/.test(id || '')) {
          return id
        }

        const match = url.pathname.match(/\/(shorts|embed|live|v)\/([a-zA-Z0-9_-]{11})/)

        if (match) {
          return match[2]
        }
      }
    } catch {}

    const match = text.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/|\/v\/)([a-zA-Z0-9_-]{11})/)

    return match?.[1] || null
  }

  normalizeUrl(input) {
    const video_id = this.extractVideoId(input)

    if (!video_id) {
      throw new Error('No se encontró un video_id válido')
    }

    return `https://youtu.be/${video_id}`
  }

  async fetchTimeout(url, options = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      })
    } finally {
      clearTimeout(timer)
    }
  }

  async parseJson(response) {
    const text = await response.text()

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`)
    }

    try {
      return JSON.parse(text)
    } catch {
      throw new Error(`Respuesta JSON inválida: ${text.slice(0, 300)}`)
    }
  }

  async request(url) {
    const body = new URLSearchParams({ url })

    const response = await this.fetchTimeout(endpoints.proxy, {
      method: 'POST',
      headers: headers.proxy(),
      body
    })

    return await this.parseJson(response)
  }

  getApi(json) {
    if (!json?.api) {
      throw new Error('La respuesta no contiene api')
    }

    return json.api
  }

  findQuality(items = []) {
    const videos = items.filter(item => String(item?.type || '').toLowerCase() === 'video')

    const selected = videos.find(item => {
      const media_url = String(item?.mediaUrl || '').toLowerCase()
      const media_res = String(item?.mediaRes || '').toLowerCase()
      const media_quality = String(item?.mediaQuality || '').toLowerCase()

      return (
        media_url.endsWith(`/${this.quality}`) ||
        media_res.endsWith(`x${this.quality.replace('p', '')}`) ||
        media_quality === this.quality
      )
    })

    if (!selected) {
      const available = videos.map(item => ({
        quality: String(item?.mediaUrl || '').split('/').pop() || null,
        resolution: item?.mediaRes || null,
        size: item?.mediaFileSize || null
      }))

      throw new Error(`No se encontró la calidad ${this.quality}. Disponibles: ${JSON.stringify(available)}`)
    }

    return selected
  }

  async info(input = this.url) {
    const source = this.normalizeUrl(input)
    const json = await this.request(source)
    const api = this.getApi(json)

    if (api.status !== 'ok') {
      throw new Error(api.message || `Estado inválido: ${api.status}`)
    }

    const media = this.findQuality(api.mediaItems)

    return {
      source,
      video_id: api.id || this.extractVideoId(source),
      title: api.title || null,
      thumbnail: api.imagePreviewUrl || media.mediaThumbnail || null,
      duration: media.mediaDuration || null,
      channel: api.userInfo?.name || null,
      quality: this.quality,
      media
    }
  }

  async resolve(media_url) {
    let last = null

    for (let i = 0; i < this.poll_attempts; i++) {
      const json = await this.request(media_url)
      const api = this.getApi(json)

      last = api

      if (api.status === 'completed' && api.fileUrl && /^https?:\/\//i.test(api.fileUrl)) {
        const size_bytes =
          parseFileSize(api.fileSizeBytes) ||
          parseFileSize(api.fileSize) ||
          parseFileSize(api.estimatedFileSize)

        return {
          file_name: api.fileName || null,
          file_size: api.fileSize || api.estimatedFileSize || (size_bytes ? formatBytes(size_bytes) : null),
          file_size_bytes: size_bytes,
          download: api.fileUrl,
          view: api.viewUrl || null,
          progress: api.progress || api.percent || 'Completed'
        }
      }

      if (api.status === 'failed' || api.status === 'error') {
        throw new Error(api.message || 'La conversión falló')
      }

      await this.sleep(this.poll_delay)
    }

    throw new Error(`Tiempo agotado esperando descarga. Último estado: ${JSON.stringify(last)}`)
  }

  async run(input = this.url) {
    try {
      const data = await this.info(input)
      const file = await this.resolve(data.media.mediaUrl)

      const size_bytes =
        file.file_size_bytes ||
        parseFileSize(file.file_size) ||
        parseFileSize(data.media.mediaFileSize)

      const format = String(data.media.mediaExtension || 'mp4').replace(/^\./, '').toLowerCase()

      return {
        status: true,
        result: {
          source: data.source,
          video_id: data.video_id,
          title: data.title,
          channel: data.channel,
          thumbnail: data.thumbnail,
          duration: data.duration,
          quality: data.quality,
          format,
          size: file.file_size || data.media.mediaFileSize || (size_bytes ? formatBytes(size_bytes) : null),
          size_bytes,
          filename: file.file_name || data.title,
          download: file.download,
          view: file.view
        }
      }
    } catch (error) {
      return {
        status: false,
        error: error.message
      }
    }
  }
}

const isYTUrl = (url = '') =>
  /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url)

const getVideoId = (text = '') => {
  const match = String(text).match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/
  )

  return match?.[1] || null
}

const sanitizeFileName = (name = 'video') =>
  cleanExtension(name)
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'video'

function cleanExtension(name = 'video') {
  return String(name || 'video').replace(/\.(mp4|mkv|webm|mov|avi)$/i, '')
}

async function getVideoInfo(input, video_id) {
  if (video_id) {
    try {
      const info = await yts({ videoId: video_id })

      if (info?.videoId) {
        return {
          ...info,
          url: `https://youtu.be/${info.videoId}`,
          image: info.thumbnail || info.image
        }
      }
    } catch {}
  }

  const search = await yts(input)
  const video = search.videos?.[0] || search.all?.find(v => v.type === 'video')

  return video || null
}

async function getVideoFromYtdown(url) {
  const client = new Ytdown({
    url,
    quality: download_quality
  })

  const res = await client.run()

  if (!res?.status || !res?.result?.download) {
    throw new Error(res?.error || 'API sin resultado válido')
  }

  return {
    url: res.result.download,
    title: res.result.title || null,
    channel: res.result.channel || null,
    thumbnail: res.result.thumbnail || null,
    duration: res.result.duration || null,
    video_id: res.result.video_id || null,
    filename: res.result.filename || res.result.title || null,
    quality: res.result.quality || download_quality,
    format: res.result.format || 'mp4',
    size: res.result.size || null,
    size_bytes: res.result.size_bytes || null,
    source: res.result.source || url,
    view: res.result.view || null
  }
}

async function makeJpegThumbnail(thumbnail) {
  if (!thumbnail) return null

  const res = await fetch(thumbnail, {
    headers: headers.image()
  })

  if (!res.ok) {
    throw new Error(`No se pudo descargar miniatura: HTTP ${res.status}`)
  }

  const buffer = Buffer.from(await res.arrayBuffer())

  return buffer.length ? buffer : null
}

function makeYoutubeThumbnail(video_id) {
  if (!video_id) return null
  return `https://i.ytimg.com/vi/${video_id}/hqdefault.jpg`
}

async function sendVideoAsDocument(sock, msg, url, fileName, caption, jpegThumbnail) {
  await sock.sendMessage(msg.chat, {
    document: { url },
    mimetype: 'video/mp4',
    fileName,
    caption,
    ...(jpegThumbnail ? { jpegThumbnail } : {})
  }, { quoted: msg })
}

function parseFileSize(size) {
  if (size === null || typeof size === 'undefined') return null

  if (typeof size === 'number') {
    return Number.isFinite(size) && size > 0 ? Math.round(size) : null
  }

  const raw = String(size).trim()
  if (!raw) return null

  const match = raw.match(/([\d.,]+)\s*(bytes?|b|kb|kib|mb|mib|gb|gib)?/i)
  if (!match) return null

  let value_text = match[1]

  if (value_text.includes(',') && value_text.includes('.')) {
    value_text = value_text.replace(/,/g, '')
  } else {
    value_text = value_text.replace(',', '.')
  }

  const value = Number(value_text)
  if (!Number.isFinite(value) || value <= 0) return null

  const unit = String(match[2] || 'b').toLowerCase()

  const multipliers = {
    b: 1,
    byte: 1,
    bytes: 1,
    kb: 1024,
    kib: 1024,
    mb: 1024 ** 2,
    mib: 1024 ** 2,
    gb: 1024 ** 3,
    gib: 1024 ** 3
  }

  return Math.round(value * (multipliers[unit] || 1))
}

function formatBytes(bytes = 0) {
  if (!bytes || Number.isNaN(bytes)) return 'Desconocido'

  const units = ['B', 'KB', 'MB', 'GB']
  let size = Number(bytes)
  let unit = 0

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }

  return `${size.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`
}