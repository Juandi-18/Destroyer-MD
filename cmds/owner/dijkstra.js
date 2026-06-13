import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { downloadContentFromMessage } from 'baileys';

// 🧠 Memoria RAM de alta prioridad para gestionar el bucle interactivo sin prefijos
const dijkstraSessions = new Map();
let globalHookSet = false;

export default {
  command: ['dijkstra', 'ruta', 'calcularruta'],
  category: 'owner',
  description: 'Módulo de Dijkstra interactivo optimizado para VS Code y Termux.',
  
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const chat = msg.chat;
    const sender = msg.sender;

    // 🔐 FILTRO DE SEGURIDAD
    const numeroOwner = '51982219982@s.whatsapp.net'; 
    if (sender !== numeroOwner) {
      return await msg.reply('⚠️ *ACCESO DENEGADO:* Este comando es de prioridad científica y solo puede ser ejecutado por el desarrollador del bot.');
    }

    if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp', { recursive: true });
    const sessionKey = `${chat}-${sender}`;

    // 🔥 CONFIGURACIÓN DEL ESCUCHADOR TEMPORAL GLOBAL (BYPASS DE PREFIJOS)
    if (!globalHookSet && sock.ev) {
      globalHookSet = true;
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const mRaw = messages[0];
        if (!mRaw?.message || mRaw.key.fromMe) return;

        // Extraer texto limpio
        const txt = (mRaw.message.conversation || mRaw.message.extendedTextMessage?.text || '').trim();
        
        // 🔒 FILTRO ANTI-DUPLICADOS: Ignorar por completo si el mensaje empieza con un prefijo o comando
        if (txt.startsWith('!') || txt.startsWith('.') || txt.toLowerCase().includes(command)) return;

        const snd = mRaw.key.participant || mRaw.key.remoteJid;
        const cht = mRaw.key.remoteJid;
        const k = `${cht}-${snd}`;

        // Validar si el usuario tiene una sesión interactiva activa
        if (!dijkstraSessions.has(k)) return;
        let s = dijkstraSessions.get(k);
        if (s.step === 0) return; 

        const fakeMsg = {
          chat: cht,
          sender: snd,
          text: txt,
          reply: async (text) => sock.sendMessage(cht, { text }, { quoted: mRaw }),
          react: async (emoji) => sock.sendMessage(cht, { react: { text: emoji, key: mRaw.key } })
        };

        await handleInteractiveLoop(fakeMsg, sock, s, k);
      });
    }

    // =========================================================================
    // PASO 0: DETECTAR Y VALIDAR ARCHIVO EXCEL
    // =========================================================================
    let documentMessage = null;
    if (msg.message?.documentMessage) documentMessage = msg.message.documentMessage;
    else if (msg.quoted?.message?.documentMessage) documentMessage = msg.quoted.message.documentMessage;

    const isXlsx = documentMessage && (
      documentMessage.mimetype?.includes('excel') || 
      documentMessage.mimetype?.includes('spreadsheetml') || 
      documentMessage.fileName?.toLowerCase().endsWith('.xlsx')
    );

    if (!isXlsx) {
      return await msg.reply(`📊 *¡Módulo Dijkstra Híbrido!* 🗺️\n\nPor favor, responde/cita el archivo *Excel (.xlsx)* usando:\n👉 *${usedPrefix}${command}* (Para iniciar paso a paso)\n👉 *${usedPrefix}${command} N1 N25* (Para cálculo directo en una línea)`);
    }

    // Capturar argumentos preventivos por si se ejecuta en una sola línea
    const argOrigen = args[0]?.trim().toUpperCase();
    const argDestino = args[1]?.trim().toUpperCase();

    await msg.react('🕒');

    try {
      const stream = await downloadContentFromMessage(documentMessage, 'document');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

      if (buffer.length === 0) throw new Error('El archivo Excel se encuentra vacío.');

      const userRaw = sender.split('@')[0];
      const excelPath = path.join('./tmp', `matriz_${userRaw}.xlsx`);
      fs.writeFileSync(excelPath, buffer);

      // CASO A: Ejecución directa en una sola línea (Ej: !ruta N1 N16)
      if (argOrigen && argDestino && argOrigen !== 'TERMINAR' && argOrigen !== 'CANCELAR') {
        let temporarySession = {
          excelPath: excelPath,
          history: [],
          numeroOperacion: 1,
          userRaw: userRaw,
          origen: argOrigen,
          destino: argDestino,
          step: 2 
        };
        dijkstraSessions.set(sessionKey, temporarySession);
        await handleInteractiveLoop(msg, sock, temporarySession, sessionKey);
        return;
      }

      // CASO B: Inicializar el modo conversacional paso a paso (Ej: !ruta)
      dijkstraSessions.set(sessionKey, {
        step: 1, 
        excelPath: excelPath,
        history: [],
        numeroOperacion: 1,
        userRaw: userRaw,
        origen: null,
        destino: null
      });

      return await msg.reply(`✅ *Matriz simétrica cargada con éxito.*\n\n📊 *OPERACIÓN DE RUTA Nº 1*\n👉 Escribe el nombre del **Nodo de Origen (Inicio)** (Ej: N1):`);

    } catch (err) {
      console.error(err);
      return await msg.reply(`❌ Error al inicializar el archivo Excel: ${err.message}`);
    }
  }
};

// =============================================================================
// MÁQUINA DE ESTADOS INTERACTIVA CON BLINDAJE DE CADENAS DE TEXTO
// =============================================================================
async function handleInteractiveLoop(msg, sock, session, sessionKey) {
  const input = msg.text?.trim().toUpperCase() || '';
  if (!input) return;

  // Interceptar comandos de parada manual
  if (input.includes('TERMINAR') || input.includes('CANCELAR')) {
    session.step = 3;
    await handleInteractiveLoop({ text: 'N', chat: msg.chat, sender: msg.sender, react: () => {}, reply: () => {} }, sock, session, sessionKey);
    return;
  }

  // ESTADO 3: EVALUAR CONTINUACIÓN DE CADENA (S/N)
  if (session.step === 3) {
    if (input === 'S') {
      session.numeroOperacion += 1;
      session.step = 1; 
      session.origen = null;  
      session.destino = null; 
      dijkstraSessions.set(sessionKey, session);
      return await sock.sendMessage(msg.chat, { text: `•`.repeat(40) + `\n📊 *OPERACIÓN DE RUTA Nº ${session.numeroOperacion}*\n` + `•`.repeat(40) + `\n\n👉 Escribe el nuevo **Nodo de Origen (Inicio)**:` });
    } else if (input === 'N') {
      if (session.history && session.history.length > 0) {
        let csvContent = '\ufeffOperacion,Trayecto,Ruta Completa,Distancia Total\n';
        session.history.forEach((h) => {
          csvContent += `"${h.operacion}","${h.trayecto}","${h.ruta}",${h.distancia}\n`;
        });

        const reportPath = path.join('./tmp', `reporte_completo_dijkstra_${session.userRaw}.csv`);
        fs.writeFileSync(reportPath, csvContent, 'utf-8');

        // Despachar el reporte de la bitácora final
        await sock.sendMessage(msg.chat, {
          document: { url: reportPath },
          mimetype: 'text/csv',
          fileName: 'reporte_completo_dijkstra.csv',
          caption: `🟢 *Excel Guardado Exitosamente (Modo Compacto)*\n\nSe consolidaron tus ${session.history.length} consultas en la bitácora ordenada local.`
        });

        if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
      }

      if (fs.existsSync(session.excelPath)) fs.unlinkSync(session.excelPath);
      dijkstraSessions.delete(sessionKey); 
      return await sock.sendMessage(msg.chat, { text: '👋 ¡Programa finalizado correctamente! Sesión interactiva cerrada.' });
    } else {
      return await sock.sendMessage(msg.chat, { text: '⚠️ Entrada inválida. Por favor responde únicamente con *S* o *N*:' });
    }
  }

  // ESTADO 1: CAPTURAR ORIGEN
  if (session.step === 1) {
    session.origen = input;
    session.step = 2; 
    dijkstraSessions.set(sessionKey, session);
    return await sock.sendMessage(msg.chat, { text: `📍 Origen fijado en: *${input}*\n\n👉 Ahora escribe el **Nodo de Destino (Fin)** (Ej: N25):` });
  }

  // ESTADO 2: CAPTURAR DESTINO Y CORRER PYTHON
  if (session.step === 2) {
    const origen = session.origen;
    const destino = session.destino || input;
    session.destino = destino;

    const excelPath = session.excelPath;
    const outputImg = path.join('./tmp', `mapa_${session.userRaw}.png`);
    const scriptPyPath = path.join('./tmp', `dijkstra_${session.userRaw}.py`);

    // Inyección de Python compactada y corregida (len(nodos))
    const pythonCode = `
import sys
import pandas as pd
import networkx as nx
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

sys.stdout.reconfigure(encoding='utf-8')

def run():
    try:
        df = pd.read_excel(r"${excelPath.replace(/\\/g, '\\\\')}", index_col=0)
        G = nx.Graph()
        nodos = list(df.index)
        for i in range(len(nodos)):
            for j in range(i + 1, len(nodos)):
                valor = df.iloc[i, j]
                try: peso = float(valor)
                except: peso = 0.0
                if pd.notna(peso) and peso > 0:
                    G.add_edge(nodos[i], nodos[j], weight=peso)

        if "${origen}" not in G or "${destino}" not in G:
            print("ERROR: Los nodos especificados no existen en el Excel.")
            return

        try:
            distancia = nx.dijkstra_path_length(G, "${origen}", "${destino}", weight='weight')
            ruta = nx.dijkstra_path(G, "${origen}", "${destino}", weight='weight')
        except nx.NetworkXNoPath:
            print("ERROR: No existe una ruta disponible entre estos nodos.")
            return

        pos = nx.kamada_kawai_layout(G)
        fig, ax = plt.subplots(figsize=(10, 7))
        
        colores = []
        for node in G.nodes():
            if node == "${origen}": colores.append("green")
            elif node == "${destino}": colores.append("red")
            elif node in ruta: colores.append("orange")
            else: colores.append("skyblue")
            
        edge_labels = nx.get_edge_attributes(G, 'weight')
        edge_labels_fmt = {k: f"{int(v)}" for k, v in edge_labels.items()}

        nx.draw_networkx_edges(G, pos, width=1.2, alpha=0.3, edge_color="gray", ax=ax)
        if len(ruta) > 1:
            nx.draw_networkx_edges(G, pos, edgelist=list(zip(ruta[:-1], ruta[1:])), width=5, edge_color='crimson', ax=ax)
        nx.draw_networkx_nodes(G, pos, node_color=colores, node_size=800, ax=ax)
        nx.draw_networkx_labels(G, pos, font_size=9, font_weight="bold", ax=ax)
        nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels_fmt, font_size=8, ax=ax)
        
        ruta_consola = " -> ".join(map(str, ruta))
        ax.set_title(f"Ruta Optima: {' ➔ '.join(map(str, ruta))}\\nDistancia Minima Total = {int(distancia)}", fontsize=11)
        ax.axis("off")
        
        plt.tight_layout()
        plt.savefig(r"${outputImg.replace(/\\/g, '\\\\')}", format='png', dpi=150)
        plt.close()
        print(f"OK|{int(distancia)}|{ruta_consola}")
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == '__main__': run()
`;
    fs.writeFileSync(scriptPyPath, pythonCode, 'utf-8');

    // Detector dinámico de entorno
    const isAndroid = process.platform === 'android' || process.platform === 'linux';
    const pythonCommand = isAndroid ? 'python3' : 'python';

    exec(`${pythonCommand} "${scriptPyPath}"`, { encoding: 'utf-8' }, async (error, stdout, stderr) => {
      if (fs.existsSync(scriptPyPath)) fs.unlinkSync(scriptPyPath);

      if (error || stderr) {
        console.error(stderr || error);
        if (fs.existsSync(excelPath)) fs.unlinkSync(excelPath);
        dijkstraSessions.delete(sessionKey);
        return await sock.sendMessage(msg.chat, { text: '❌ Error interno en la compilación gráfica de Python. Sesión cerrada.' });
      }

      const respuesta = stdout.trim();
      if (respuesta.startsWith('ERROR')) {
        if (fs.existsSync(excelPath)) fs.unlinkSync(excelPath);
        dijkstraSessions.delete(sessionKey);
        return await sock.sendMessage(msg.chat, { text: `⚠️ *Fallo en los parámetros:* ${respuesta.replace('ERROR: ', '')}\n\nSesión cerrada.` });
      }

      const [status, distancia, rutaConsola] = respuesta.split('|');
      const rutaWhatsApp = rutaConsola.replace(/ -> /g, ' ➔ ');

      session.history.push({
        operacion: `Operación ${session.numeroOperacion}`,
        trayecto: `${origen} hasta ${destino}`,
        ruta: rutaWhatsApp,
        distancia: parseInt(distancia)
      });

      if (fs.existsSync(outputImg)) {
        await sock.sendMessage(msg.chat, {
          image: { url: outputImg },
          caption: `🎯 *RESULTADOS DE LA OPERACIÓN ${session.numeroOperacion}*\n\n🏁 *Trayecto:* ${origen} ➔ ${destino}\n🛣️ *Ruta Óptima:* ${rutaWhatsApp}\n📏 *Distancia Mínima:* ${distancia}`
        });
        fs.unlinkSync(outputImg);
      }

      session.step = 3; 
      dijkstraSessions.set(sessionKey, session);

      return await sock.sendMessage(msg.chat, { 
        text: `📊 ¿Deseas realizar otra operación de ruta?\n\n👉 Responde *S* para calcular un nuevo tramo.\n👉 Responde *N* para guardar la bitácora unificada y exportar tu reporte final en Excel.`
      });
    });
    return;
  }
}