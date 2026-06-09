import fetch from 'node-fetch';
import db from '#db';

export default {
  command: ['onpe', 'votos', 'resultados', 'segundavuelta'],
  category: 'owner',
  description: 'Muestra los resultados oficiales en tiempo real de la segunda vuelta de la ONPE jalando el backend real.',
  admin: false,
  botAdmin: false,

  run: async ({ msg, sock, usedPrefix, command }) => {
    try {
      await msg.react('🕒');

      // Registro básico en la base de datos de YukiBot
      db.setCreate('chat_users', [msg.chat, msg.sender], 'onpeQueries', 0);
      let currentQueries = db.getChatUser(msg.chat, msg.sender)?.onpeQueries || 0;
      db.setChatUser(msg.chat, msg.sender, 'onpeQueries', currentQueries + 1);

      // Cabeceras de camuflaje para evitar el bloqueo del firewall (Cloudflare)
      const headersCamuflaje = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Origin': 'https://resultadosegundavuelta.onpe.gob.pe',
        'Referer': 'https://resultadosegundavuelta.onpe.gob.pe/main/resumen',
        'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Connection': 'keep-alive'
      };

      // Definimos las dos URLs del backend que descubriste en tus capturas
      const urlTotales = 'https://resultadosegundavuelta.onpe.gob.pe/presentacion-backend/resumen-general/totales?idEleccion=10&tipoFiltro=eleccion';
      const urlParticipantes = 'https://resultadosegundavuelta.onpe.gob.pe/presentacion-backend/resumen-general/participantes?idEleccion=10&tipoFiltro=eleccion';

      // Hacemos las dos peticiones al mismo tiempo para máxima velocidad de respuesta
      const [resTotales, resParticipantes] = await Promise.all([
        fetch(urlTotales, { headers: headersCamuflaje, timeout: 9000 }),
        fetch(urlParticipantes, { headers: headersCamuflaje, timeout: 9000 })
      ]);

      // Controlamos si el servidor nos bota un HTML antibots
      if (resTotales.headers.get("content-type")?.includes("text/html") || resParticipantes.headers.get("content-type")?.includes("text/html")) {
        throw new Error("PÁGINA_HTML_DETECTADA");
      }

      if (!resTotales.ok || !resParticipantes.ok) throw new Error('Servidores centrales de la ONPE saturados.');

      const jsonTotales = await resTotales.json();
      const jsonParticipantes = await resParticipantes.json();

      // 1. Procesamos los datos de Actas (jsonTotales)
      const dataActas = jsonTotales?.data;
      const avanceContabilizadas = dataActas?.actasContabilizadas || '0.00';
      
      // Convertimos el timestamp Unix a hora local peruana legible
      let horaActualizacion = 'Sin datos';
      if (dataActas?.fechaActualizacion) {
        const fecha = new Date(dataActas.fechaActualizacion);
        horaActualizacion = fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) + ' (Corte ONPE)';
      }

      // 2. Procesamos los datos de Candidatos (jsonParticipantes)
      const listaCandidatos = jsonParticipantes?.data || [];
      if (!listaCandidatos || listaCandidatos.length < 2) throw new Error('Estructura de candidatos incompleta.');

      // Clasificamos de forma dinámica buscando por el nombre para que no importe el orden en el que lleguen
      const keikoData = listaCandidatos.find(c => c.nombreCandidato?.includes('FUJIMORI')) || listaCandidatos[0];
      const sanchezData = listaCandidatos.find(c => c.nombreCandidato?.includes('SANCHEZ')) || listaCandidatos[1];

      // Datos Keiko
      const candidatoK = keikoData?.nombreCandidato || 'KEIKO FUJIMORI';
      const partidoK = keikoData?.nombreAgrupacionPolitica || 'FUERZA POPULAR';
      const votosK = keikoData?.totalVotosValidos?.toLocaleString('es-PE') || '0';
      const porcentajeK = keikoData?.porcentajeVotosValidos || '0.00';

      // Datos Roberto Sánchez
      const candidatoS = sanchezData?.nombreCandidato || 'ROBERTO SÁNCHEZ';
      const partidoS = sanchezData?.nombreAgrupacionPolitica || 'JUNTOS POR EL PERÚ';
      const votosS = sanchezData?.totalVotosValidos?.toLocaleString('es-PE') || '0';
      const porcentajeS = sanchezData?.porcentajeVotosValidos || '0.00';

      // Armamos la interfaz estética de YukiBot / Destroyer
      const textoFinal = `» ˚୨•(=^●ω●^=)• ⊹ 𝐑𝐄𝐒𝐔𝐋𝐓𝐀𝐃𝐎𝐒 𝐎𝐍𝐏𝐄 ⊹\n\n` +
                         `🗳️ *SEGUNDA VUELTA ELECTORAL*\n` +
                         `⏱️ *Última actualización:* ${horaActualizacion}\n\n` +
                         `📈 *Actas Contabilizadas:* ${avanceContabilizadas}%\n\n` +
                         `------------------------------------\n\n` +
                         `👒 *${candidatoS}*\n` +
                         `_${partidoS}_\n` +
                         `> *Porcentaje:* ${porcentajeS}%\n` +
                         `> *Votos:* ${votosS}\n\n` +
                         `🍊 *${candidatoK}*\n` +
                         `_${partidoK}_\n` +
                         `> *Porcentaje:* ${porcentajeK}%\n` +
                         `> *Votos:* ${votosK}\n\n` +
                         `------------------------------------\n` +
                         `_📢 Sincronizado en tiempo real con la base de datos de la ONPE._\n` +
                         `╰ׅ͜─֟͜─͜─ٞ͜─͜─๊͜─͜─๋͜─⃔═̶፝֟͜═̶⃔─๋͜─͜─͜─๊͜─ٞ͜─͜─֟͜┈ࠢ͜╯ׅ`;

      await sock.sendMessage(msg.chat, { text: textoFinal }, { quoted: msg });
      await msg.react('✔️');

    } catch (e) {
      await msg.react('❌');
      console.error('Error ONPE:', e);

      let mensajeError = `⚠️ *Servidor no disponible*\n\n> El sistema oficial de la ONPE está tardando en procesar las solicitudes de datos.`;
      if (e.message === "PÁGINA_HTML_DETECTADA") {
          mensajeError = `⚠️ *Filtro de seguridad activado*\n\n> La ONPE ha bloqueado temporalmente la conexión automatizada desde servidores externos.`;
      }

      await msg.reply(`» ˚୨•(=^●ω●^=)• ⊹ 𝐎𝐍𝐏𝐄 𝐒𝐓𝐀𝐓𝐔𝐒 ⊹\n\n` +
                      `${mensajeError}\n\n` +
                      `🔗 *Verifica el avance manualmente aquí:*\n` +
                      `https://resultadosegundavuelta.onpe.gob.pe/main/resumen`);
    }
  }
};