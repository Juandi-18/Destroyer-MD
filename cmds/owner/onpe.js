import axios from 'axios';
import db from '#db';

let cacheData = null;
let cacheTime = 0;

export default {
  command: ['onpe', 'votos', 'resultados', 'segundavuelta'],
  category: 'owner',
  description: 'Muestra los resultados oficiales globales reales de la ONPE con eventos automatizados al 100% y anuncios VIP.',
  admin: false,
  botAdmin: false,

  run: async ({ msg, sock, usedPrefix, command }) => {
    try {
      await msg.react('🕒');

      db.setCreate('chat_users', [msg.chat, msg.sender], 'onpeQueries', 0);
      let currentQueries = db.getChatUser(msg.chat, msg.sender)?.onpeQueries || 0;
      db.setChatUser(msg.chat, msg.sender, 'onpeQueries', currentQueries + 1);

      const tiempoActual = Date.now();
      
      if (cacheData && (tiempoActual - cacheTime < 15000)) { 
          await sock.sendMessage(msg.chat, { text: cacheData }, { quoted: msg });
          return await msg.react('✔️');
      }

      const headersBypassWAF = {
        'authority': 'resultadosegundavuelta.onpe.gob.pe',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'es-PE,es-419;q=0.9,es;q=0.8,en;q=0.7',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'origin': 'https://resultadosegundavuelta.onpe.gob.pe',
        'referer': 'https://resultadosegundavuelta.onpe.gob.pe/main/resumen',
        'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not.A/Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        'cookie': '_ga=GA1.1.256397367.1780980001; _ga_THMBN2T4BS=GS2.1.s1781045601$o5$g1$t1781051880$j60$l0$h1774431208'
      };

      const urlTotales = 'https://resultadosegundavuelta.onpe.gob.pe/presentacion-backend/resumen-general/totales?idEleccion=10&tipoFiltro=eleccion';
      const urlGlobal = 'https://resultadosegundavuelta.onpe.gob.pe/presentacion-backend/resumen-general/participantes?idEleccion=10&tipoFiltro=eleccion';

      const [resTotales, resGlobal] = await Promise.all([
        axios.get(urlTotales, { headers: headersBypassWAF, timeout: 8000 }),
        axios.get(urlGlobal, { headers: headersBypassWAF, timeout: 8000 })
      ]);

      const jsonTotales = resTotales.data;
      const jsonGlobal = resGlobal.data;

      if (typeof jsonTotales === 'string' || typeof jsonGlobal === 'string') {
        throw new Error("BLOQUEO_WAF");
      }

      const dataActas = jsonTotales?.data || {};
      const avanceContabilizadas = parseFloat(dataActas?.actasContabilizadas || 0).toFixed(3);
      
      let corteOficial = 'Sin datos';
      if (dataActas?.fechaActualizacion) {
        const fecha = new Date(parseInt(dataActas.fechaActualizacion));
        corteOficial = fecha.toLocaleString('es-PE', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
      }

      const lGlobal = jsonGlobal?.data || [];
      const gS = lGlobal.find(c => c.nombreCandidato?.includes('SANCHEZ')) || {};
      const gK = lGlobal.find(c => c.nombreCandidato?.includes('FUJIMORI')) || {};

      if (!gS.nombreCandidato || !gK.nombreCandidato) {
        throw new Error('JSON_INCOMPLETO');
      }

      const totalVotosS = parseInt(gS.totalVotosValidos || 0);
      const porcGlobalS = parseFloat(gS.porcentajeVotosValidos || 0).toFixed(3);

      const totalVotosK = parseInt(gK.totalVotosValidos || 0);
      const porcGlobalK = parseFloat(gK.porcentajeVotosValidos || 0).toFixed(3);

      const textoFinal = `» ˚୨•(=^●ω●^=)• ⊹ 𝐑𝐄𝐒𝐔𝐋𝐓𝐀 𝐎𝐍𝐏𝐄 ⊹\n\n` +
                         `🗳️ *CONTEO EN VIVO SEGUNDA VUELTA*\n` +
                         `⏱️ *Corte Oficial ONPE:* ${corteOficial}\n` +
                         `📈 *Actas Contabilizadas Totales:* ${avanceContabilizadas}%\n\n` +
                         `------------------------------------\n\n` +
                         `👒 *${gS.nombreCandidato.toUpperCase()}*\n` +
                         `_${gS.nombreAgrupacionPolitica || 'JUNTOS POR EL PERÚ'}_\n` +
                         `> *Porcentaje Global:* ${porcGlobalS}%\n` +
                         `> *Votos Totales:* ${totalVotosS.toLocaleString('es-PE')}\n\n` +
                         `🍊 *${gK.nombreCandidato.toUpperCase()}*\n` +
                         `_${gK.nombreAgrupacionPolitica || 'FUERZA POPULAR'}_\n` +
                         `> *Porcentaje Global:* ${porcGlobalK}%\n` +
                         `> *Votos Totales:* ${totalVotosK.toLocaleString('es-PE')}\n\n` +
                         `------------------------------------\n` +
                         `_📢 Sincronizado dinámicamente en tiempo real (Fuente: ONPE)._\n` +
                         `╰───────────────────────╯`;

      cacheData = textoFinal;
      cacheTime = tiempoActual;

      await sock.sendMessage(msg.chat, { text: textoFinal }, { quoted: msg });
      await msg.react('✔️');

      // 🏆 DETECTOR AUTOMÁTICO DE CIERRE AL 100%
      if (parseFloat(avanceContabilizadas) >= 100.000) {
        console.log('--- [DESTROYER MONITOR] Conteo al 100% Detectado. Ejecutando protocolo... ---');
        
        let urlFotoGanador = '';
        let mensajeGanador = '';
        let nuevoNombreGrupo = '';
        let esVictoriaKeiko = totalVotosK > totalVotosS;

        // Definimos las listas de excluidos VIP según el caso
        const vipKeiko = ['51937748963@s.whatsapp.net', '51976461817@s.whatsapp.net'];
        const vipSanchez = ['51982219982@s.whatsapp.net', '573108615379@s.whatsapp.net'];
        const excluidosFinales = esVictoriaKeiko ? vipKeiko : vipSanchez;

        if (esVictoriaKeiko) {
          urlFotoGanador = 'https://scontent.fchm1-1.fna.fbcdn.net/v/t39.30808-6/719190170_122245148438105211_3387691587448129228_n.jpg?stp=dst-jpg_tt6&cstp=mx1122x1402&ctp=s640x640&_nc_cat=107&ccb=1-7&_nc_sid=833d8c&_nc_ohc=4BtiPIAC9XEQ7kNvwHJuBu5&_nc_oc=AdopJJf7tloF7BbsYhVsEHdFRNhjJdgfVxXkyA0YdW0Gwsu1yr4KGldrK9SXDI1FWoQnM6bgP2x9GrNkmgVojK1f&_nc_zt=23&_nc_ht=scontent.fchm1-1.fna&_nc_gid=rqfSrPKx83ySZm9lG1n68Q&_nc_ss=7b289&oh=00_Af-su9RhP9t3U5Kb8lL0jJaziCkn9Y94xh8AwlY94w-mmw&oe=6A2ED14B';
          mensajeGanador = `VIVA EL PRESIDENTE KEIKO SOFIA FUJIMORI HIGUCHI`;
          nuevoNombreGrupo = `Keiko Presidente 2026`;
        } else {
          urlFotoGanador = 'https://scontent.fchm1-1.fna.fbcdn.net/v/t39.30808-6/716190543_1009250298352453_8410448401220420667_n.jpg?stp=dst-jpg_tt6&cstp=mx1080x1080&ctp=p526x296&_nc_cat=100&ccb=1-7&_nc_sid=833d8c&_nc_ohc=RhYphDsmgAUQ7kNvwGulaHj&_nc_oc=Adp79RnNCsv-6DyURt64Mgo_ZtD_US27F1MPPkosmeBDKE8Ie_pf_SFuNjTjGLhix0GXFqzMF4sMb8Luy4I7elYp&_nc_zt=23&_nc_ht=scontent.fchm1-1.fna&_nc_gid=UToCtlmWn69j5qpzOyAEQQ&_nc_ss=7b289&oh=00_Af9rmZgdJMt1KpOMlRRGezgnornrMHndxKSD834NfxDZTg&oe=6A2EB9F9';
          mensajeGanador = `VIVA EL PRESIDENTE ROBERTO HELBERT SANCHEZ PALOMINO`;
          nuevoNombreGrupo = `Sanchez Presidente 2026`;
        }

        // Acción A: Cambiar la foto del grupo
        try {
          const resImg = await axios.get(urlFotoGanador, { responseType: 'arraybuffer' });
          const bufferImg = Buffer.from(resImg.data, 'binary');
          await sock.updateProfilePicture(msg.chat, bufferImg);
        } catch (imgError) {
          console.error('[DESTROYER ERROR] No se pudo cambiar la foto:', imgError.message);
        }

        // Acción B: Cambiar el nombre del grupo
        try {
          await sock.groupUpdateSubject(msg.chat, nuevoNombreGrupo);
        } catch (nameError) {
          console.error('[DESTROYER ERROR] No se pudo cambiar el nombre:', nameError.message);
        }

        // Acción C: Spamear 3 veces la foto del ganador
        for (let i = 0; i < 3; i++) {
          await sock.sendMessage(msg.chat, { 
            image: { url: urlFotoGanador }, 
            caption: `🏆 *RESULTADOS OFICIALES AL 100%*\n\n📢 ${mensajeGanador}` 
          });
          await new Promise(res => setTimeout(res, 800));
        }

        // ⏳ ESPERA DE 3 SEGUNDOS ANTES DEL REPORTE DE MIGRACIONES
        await new Promise(res => setTimeout(res, 3000));

        // ✈️ ACCIÓN D: REPORTE DE MIGRACIONES DINÁMICO EXCLUYENDO A LOS VIP
        let groupMetadata;
        try {
          groupMetadata = await sock.groupMetadata(msg.chat);
          let participantes = groupMetadata.participants.map(p => p.id);

          // Filtro crucial: Sacamos de la lista a los amigos premiados para que no se repitan en las fugas
          participantes = participantes.filter(id => !excluidosFinales.includes(id));

          participantes.sort(() => Math.random() - 0.5);
          const cantidadElegidos = participantes.length < 10 ? participantes.length : 10;
          const elegidos = participantes.slice(0, cantidadElegidos);

          const destinos = [
            'ya compró pasaje de ida a Chile sin retorno.',
            'está pidiendo asilo político urgente en España.',
            'se va a ir a esconder en los cerros de Moche hasta el 2031.',
            'fue visto cruzando la frontera de Ecuador a pie.',
            'está rematando su PC en Marketplace para fugarse a Canadá.',
            'está buscando un container que lo lleve oculto a Estados Unidos.',
            'ya borró sus cuentas y se mudó a la selva profunda.',
            'está tramitando la nacionalidad boliviana de emergencia.',
            'se va a quedar encerrado en su cuarto los próximos 5 años.',
            'ya está haciendo cola afuera del aeropuerto Jorge Chávez.'
          ];

          let reporteTexto = `✈️ *REPORTE OFICIAL DE MIGRACIONES EN EL GRUPO*\n`;
          reporteTexto += `_Detectando usuarios con alto riesgo de fuga post-elecciones..._\n\n`;

          elegidos.forEach((jid, index) => {
            reporteTexto += `🏃‍♂️ ${index + 1}. @${jid.split('@')[0]} ${destinos[index]}\n`;
          });

          reporteTexto += `\n_📢 Control migratorio automatizado por DestroyerBot-MD._`;

          await sock.sendMessage(msg.chat, { text: reporteTexto, mentions: elegidos });

        } catch (migraError) {
          console.error('[DESTROYER ERROR] Error en reporte de migraciones:', migraError.message);
        }

        // ⏳ ESPERA DE 3 SEGUNDOS ANTES DE CERRAR EL GRUPO Y PREMIAR A LOS VIP
        await new Promise(res => setTimeout(res, 3000));

        // 🔒 ACCIÓN E: CLAUSURA DEL GRUPO Y ANUNCIO GLOBAL VIP
        try {
          // Cerramos el chat para simular el control total
          await sock.groupSettingUpdate(msg.chat, 'announcement');
          
          let textoAnuncio = `📢 *ANUNCIO GLOBAL PRESIENCIAL 2026*\n\n`;
          
          if (esVictoriaKeiko) {
            textoAnuncio += `👑 El nuevo régimen ha tomado el control del chat.\n\n` +
                            `➡️ @51937748963 ahora se convertirá en ahijado de Keiko y será guardaespaldas de Kyara.\n\n` +
                            `➡️ @51976461817 será su segundo ahijado y será guardaespaldas de Kaori.`;
          } else {
            textoAnuncio += `✊ La revolución popular se ha consolidado en el grupo.\n\n` +
                            `➡️ @51982219982 se convirtió en la mano derecha de Roberto y recibirá 10 hectáreas de terreno en Oxapampa y Tambogrande.\n\n` +
                            `➡️ @573108615379 recibirá un sueldo de $1,000,000 de dólares anuales por su voto estratégico.`;
          }

          textoAnuncio += `\n\n_🔒 El chat permanecerá cerrado por 1 minuto para leer las actas presidenciales._`;

          // Enviamos el mensaje arrobando orgánicamente a los involucrados
          await sock.sendMessage(msg.chat, { text: textoAnuncio, mentions: excluidosFinales });

          // ⏳ CONTADOR DE 1 MINUTO PARA VOLVER A ABRIR EL GRUPO
          setTimeout(async () => {
            try {
              await sock.groupSettingUpdate(msg.chat, 'not_announcement');
              await sock.sendMessage(msg.chat, { text: `🔓 *Gabinete Terminado:* El grupo ha sido reabierto. ¡Que empiece el debate!` });
            } catch (openError) {
              console.error('[DESTROYER ERROR] No se pudo reabrir el grupo:', openError.message);
            }
          }, 60000); // 60000ms = 1 minuto justo

        } catch (closeError) {
          console.error('[DESTROYER ERROR] Error en protocolo de clausura VIP:', closeError.message);
        }
      }

    } catch (e) {
      console.error('Error en ejecución ONPE Global:', e.message);

      if (cacheData) {
        await msg.react('✔️');
        return await sock.sendMessage(msg.chat, { 
          text: cacheData + `\n\n_(📌 Mostrando última actualización en caché local debido a alta demanda en el servidor ONPE)._` 
        }, { quoted: msg });
      }

      await msg.react('❌');
      await msg.reply(`» ˚୨•(=^●ω●^=)• ⊹ 𝐎𝐍𝐏𝐄 𝐒𝐓𝐀𝐓𝐔𝐒 ⊹\n\n` +
                      `⚠️ *Servidor temporalmente congestionado.*\n\n` +
                      `El Firewall perimetral limitó las peticiones por ráfagas desde esta red.\n\n` +
                      `🔗 *Avance manual:* https://resultadosegundavuelta.onpe.gob.pe/main/resumen`);
    }
  }
};