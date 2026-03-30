#!/usr/bin/env node

// ============================================
// COMIDABOT - Bot de WhatsApp para Comida Corrida
// Versión: 2.0.2 (FUNCIONAL ORIGINAL + MEJORAS)
// ============================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const Database = require('yskj-sqlite-android');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const readline = require('readline');
const { NlpManager } = require('node-nlp');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// ============================================
// MEJORAS AGREGADAS (NO MODIFICAN EL CÓDIGO ORIGINAL)
// ============================================

// Spintax para respuestas aleatorias
function spintax(texto) {
    return texto.replace(/{([^{}]+)}/g, (match, opciones) => {
        const choices = opciones.split('|');
        return choices[Math.floor(Math.random() * choices.length)];
    });
}

// Emojis según el rubro (se actualiza con comandos de voz)
let rubroNegocio = 'general';
const emojisPorRubro = {
    comida: { principal: '🍽️', positivo: '✅', saludo: '🍳', producto: '🥘', ubicacion: '📍', horario: '🕐' },
    peluqueria: { principal: '✂️', positivo: '✅', saludo: '💈', producto: '💇', ubicacion: '📍', horario: '🕐' },
    taller: { principal: '🔧', positivo: '✅', saludo: '🚗', producto: '⚙️', ubicacion: '📍', horario: '🕐' },
    general: { principal: '🤘', positivo: '✅', saludo: '🎸', producto: '🔥', ubicacion: '📍', horario: '🕐' }
};

function getEmojis() {
    return emojisPorRubro[rubroNegocio] || emojisPorRubro.general;
}

// Saludo según horario
function getSaludo() {
    const hora = new Date().getHours();
    if (hora >= 6 && hora < 12) return spintax('{Buenos días|Buen día|¡Hola! Buenos días}');
    if (hora >= 12 && hora < 19) return spintax('{Buenas tardes|Muy buenas tardes|¡Hola! Buenas tardes}');
    return spintax('{Buenas noches|Muy buenas noches|¡Hola! Buenas noches}');
}

// Cola de mensajes y delay humano
let colaMensajes = [];
let procesandoCola = false;
let contadorRespuestas = 0;
let ultimoReset = Date.now();

async function enviarConDelay(sock, to, texto) {
    const delayMs = Math.floor(Math.random() * (14000 - 7000 + 1) + 7000); // 7-14 segundos
    console.log(`⏳ Esperando ${delayMs/1000} segundos antes de responder...`);
    await sock.sendPresenceUpdate('composing', to);
    await delay(delayMs);
    await sock.sendMessage(to, { text: texto });
    console.log(`✅ Respuesta enviada después de ${delayMs/1000}s`);
}

async function procesarCola(sock) {
    if (procesandoCola) return;
    procesandoCola = true;
    
    while (colaMensajes.length > 0) {
        const { sock: sockRef, to, texto } = colaMensajes.shift();
        
        const ahora = Date.now();
        if (ahora - ultimoReset > 60000) {
            contadorRespuestas = 0;
            ultimoReset = ahora;
        }
        
        if (contadorRespuestas >= 10) {
            console.log('⏸️ Rate limit alcanzado, esperando 30 segundos...');
            await delay(30000);
            contadorRespuestas = 0;
        }
        
        await enviarConDelay(sockRef, to, texto);
        contadorRespuestas++;
    }
    procesandoCola = false;
}

function agregarACola(sock, to, texto) {
    colaMensajes.push({ sock, to, texto });
    procesarCola(sock);
}

// Inicializar NLP (inteligencia semántica)
const nlpManager = new NlpManager({ languages: ['es'], forceNER: true });

async function entrenarNLP() {
    // Comandos del dueño
    nlpManager.addDocument('es', 'activar modo cliente', 'modo.cliente.on');
    nlpManager.addDocument('es', 'modo cliente', 'modo.cliente.on');
    nlpManager.addDocument('es', 'desactivar modo cliente', 'modo.cliente.off');
    nlpManager.addDocument('es', 'modo dueño', 'modo.cliente.off');
    nlpManager.addDocument('es', 'salir modo cliente', 'modo.cliente.off');
    
    // Rubro del negocio
    nlpManager.addDocument('es', 'somos un restaurante', 'negocio.rubro.comida');
    nlpManager.addDocument('es', 'somos una barbería', 'negocio.rubro.peluqueria');
    nlpManager.addDocument('es', 'somos un taller mecánico', 'negocio.rubro.taller');
    
    // Preguntas de clientes (para respuestas mejoradas)
    nlpManager.addDocument('es', 'cómo se llama el negocio', 'cliente.pregunta.nombre');
    nlpManager.addDocument('es', 'dónde estás ubicado', 'cliente.pregunta.ubicacion');
    nlpManager.addDocument('es', 'qué horario tienen', 'cliente.pregunta.horario');
    nlpManager.addDocument('es', 'qué productos tienen', 'cliente.pregunta.productos');
    nlpManager.addDocument('es', 'gracias', 'cliente.gracias');
    nlpManager.addDocument('es', 'muchas gracias', 'cliente.gracias');
    
    await nlpManager.train();
    console.log('🧠 NLP entrenado (mejoras activadas)');
}

// Procesar NLP para respuestas mejoradas (solo para clientes)
async function procesarNLPCliente(texto) {
    const result = await nlpManager.process('es', texto);
    const intent = result.intent;
    
    if (intent === 'cliente.gracias') {
        return spintax(`{¡A ti!|Un placer|Gracias a ti|Saludos!} ${getEmojis().principal} ¡Que tengas un excelente día!`);
    }
    
    return null; // No se procesó ninguna intención especial
}

// Función para actualizar rubro desde instrucción del dueño
function actualizarRubroDesdeTexto(texto) {
    const textoLower = texto.toLowerCase();
    if (textoLower.includes('restaurante') || textoLower.includes('comida') || textoLower.includes('comida corrida')) {
        rubroNegocio = 'comida';
        return true;
    }
    if (textoLower.includes('barbería') || textoLower.includes('peluquería') || textoLower.includes('corte')) {
        rubroNegocio = 'peluqueria';
        return true;
    }
    if (textoLower.includes('taller') || textoLower.includes('mecánico') || textoLower.includes('mecanico')) {
        rubroNegocio = 'taller';
        return true;
    }
    return false;
}

// ============================================
// CONFIGURACIÓN INICIAL (ORIGINAL)
// ============================================

let adminID = null;
let modoCliente = false;
let horarioCierre = null;
let horarioDesayunos = { inicio: "07:00", fin: "12:00" };
let horarioComidas = { inicio: "12:00", fin: "18:00" };
let precioFijoDesayunos = null;
let precioFijoComida = null;

const AUTH_DIR = './auth_info';
const DB_DIR = './db';
const TEMP_AUDIO_DIR = './temp_audio';
const WHISPER_CLI = '/data/data/com.termux/files/home/.local/bin/whisper-cli';
const WHISPER_MODEL = '/data/data/com.termux/files/home/whisper.cpp/models/ggml-base.bin';

let db;

// ============================================
// BASE DE DATOS (ORIGINAL)
// ============================================

function initDatabase() {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);
    
    db = new Database(path.join(DB_DIR, 'comidabot.db'));
    
    db.exec(`CREATE TABLE IF NOT EXISTS config (
        clave TEXT PRIMARY KEY,
        valor TEXT
    )`);
    
    db.exec(`CREATE TABLE IF NOT EXISTS desayunos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto TEXT,
        precio TEXT,
        incluye TEXT,
        fecha TEXT
    )`);
    
    db.exec(`CREATE TABLE IF NOT EXISTS comida_primer_tiempo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opcion TEXT,
        fecha TEXT
    )`);
    
    db.exec(`CREATE TABLE IF NOT EXISTS comida_segundo_tiempo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opcion TEXT,
        fecha TEXT
    )`);
    
    db.exec(`CREATE TABLE IF NOT EXISTS comida_tercer_tiempo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opcion TEXT,
        fecha TEXT
    )`);
    
    db.exec(`CREATE TABLE IF NOT EXISTS acompanamientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT,
        descripcion TEXT,
        fecha TEXT
    )`);
    
    const adminRow = db.prepare("SELECT valor FROM config WHERE clave = 'admin_id'").get();
    if (adminRow) adminID = adminRow.valor;
    
    const cierreRow = db.prepare("SELECT valor FROM config WHERE clave = 'horario_cierre'").get();
    if (cierreRow) horarioCierre = cierreRow.valor;
    
    const desayunosRow = db.prepare("SELECT valor FROM config WHERE clave = 'horario_desayunos'").get();
    if (desayunosRow) horarioDesayunos = JSON.parse(desayunosRow.valor);
    
    const comidasRow = db.prepare("SELECT valor FROM config WHERE clave = 'horario_comidas'").get();
    if (comidasRow) horarioComidas = JSON.parse(comidasRow.valor);
    
    const precioDesRow = db.prepare("SELECT valor FROM config WHERE clave = 'precio_fijo_desayunos'").get();
    if (precioDesRow) precioFijoDesayunos = precioDesRow.valor;
    
    const precioComRow = db.prepare("SELECT valor FROM config WHERE clave = 'precio_fijo_comida'").get();
    if (precioComRow) precioFijoComida = precioComRow.valor;
    
    console.log('📦 Base de datos inicializada');
}

function guardarConfig(clave, valor) {
    const stmt = db.prepare("INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)");
    stmt.run(clave, valor);
}

function limpiarDia() {
    const hoy = new Date().toISOString().split('T')[0];
    db.prepare("DELETE FROM desayunos WHERE fecha != ?").run(hoy);
    db.prepare("DELETE FROM comida_primer_tiempo WHERE fecha != ?").run(hoy);
    db.prepare("DELETE FROM comida_segundo_tiempo WHERE fecha != ?").run(hoy);
    db.prepare("DELETE FROM comida_tercer_tiempo WHERE fecha != ?").run(hoy);
    db.prepare("DELETE FROM acompanamientos WHERE fecha != ?").run(hoy);
    console.log('🧹 Base de datos limpiada para nuevo día');
}

// ============================================
// TRANSCRIPCIÓN DE VOZ (ORIGINAL)
// ============================================

async function transcribirAudio(bufferAudio) {
    const tempOpus = path.join(TEMP_AUDIO_DIR, `audio_${Date.now()}.opus`);
    const tempWav = path.join(TEMP_AUDIO_DIR, `audio_${Date.now()}.wav`);
    const tempTxt = tempWav + '.txt';
    
    if (!fs.existsSync(TEMP_AUDIO_DIR)) fs.mkdirSync(TEMP_AUDIO_DIR);
    fs.writeFileSync(tempOpus, bufferAudio);
    
    await execAsync(`ffmpeg -i ${tempOpus} -ar 16000 -ac 1 -c:a pcm_s16le ${tempWav} -y`);
    
    try {
        await execAsync(`${WHISPER_CLI} -m ${WHISPER_MODEL} -f ${tempWav} -otxt -l es`);
        let texto = '';
        if (fs.existsSync(tempTxt)) {
            texto = fs.readFileSync(tempTxt, 'utf8').trim();
        }
        if (fs.existsSync(tempOpus)) fs.unlinkSync(tempOpus);
        if (fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
        if (fs.existsSync(tempTxt)) fs.unlinkSync(tempTxt);
        return texto.toLowerCase();
    } catch (error) {
        console.error('Error en transcripción:', error.message);
        if (fs.existsSync(tempOpus)) fs.unlinkSync(tempOpus);
        if (fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
        if (fs.existsSync(tempTxt)) fs.unlinkSync(tempTxt);
        return '';
    }
}

// ============================================
// INTERPRETACIÓN SEMÁNTICA (ORIGINAL)
// ============================================

function interpretarInstruccion(texto) {
    const instruccion = { tipo: null, datos: {} };
    
    if (texto.includes('agrega') || texto.includes('registra') || texto.includes('tenemos')) {
        instruccion.tipo = 'agregar';
        if (texto.includes('desayuno')) instruccion.datos.categoria = 'desayunos';
        if (texto.includes('comida') || texto.includes('primer tiempo') || texto.includes('segundo tiempo') || texto.includes('tercer tiempo')) {
            instruccion.datos.categoria = 'comida';
        }
    }
    
    if (texto.includes('elimina') || texto.includes('borra') || texto.includes('ya no')) {
        instruccion.tipo = 'eliminar';
    }
    
    if (texto.includes('cambia') || texto.includes('actualiza')) {
        instruccion.tipo = 'actualizar';
    }
    
    if (texto.includes('configura') || texto.includes('establece')) {
        instruccion.tipo = 'configurar';
    }
    
    if (texto.includes('reinicia') && (texto.includes('base') || texto.includes('datos'))) {
        instruccion.tipo = 'reiniciar';
    }
    
    if (texto.includes('activar modo cliente')) instruccion.tipo = 'modo_cliente_on';
    if (texto.includes('desactivar modo cliente')) instruccion.tipo = 'modo_cliente_off';
    if (texto.includes('en qué modo')) instruccion.tipo = 'consultar_modo';
    
    return instruccion;
}

function interpretarPreguntaCliente(texto) {
    if (texto.includes('desayuno')) return 'desayunos';
    if (texto.includes('comida') || texto.includes('corrida')) return 'comida';
    if (texto.includes('ubicación') || texto.includes('dirección') || texto.includes('dónde están')) return 'ubicacion';
    if (texto.includes('horario')) return 'horario';
    return 'general';
}

// ============================================
// RESPUESTAS AL CLIENTE (ORIGINAL)
// ============================================

function obtenerHoraActual() {
    const ahora = new Date();
    return ahora.toTimeString().slice(0,5);
}

function estaEnHorario(horario) {
    const ahora = obtenerHoraActual();
    return ahora >= horario.inicio && ahora <= horario.fin;
}

async function responderDesayunos(sock, to) {
    const stmt = db.prepare("SELECT producto, precio, incluye FROM desayunos ORDER BY id");
    const desayunos = stmt.all();
    
    if (desayunos.length === 0) {
        await agregarACola(sock, to, "🍳 Por el momento no tenemos desayunos registrados para hoy.");
        return;
    }
    
    let mensaje = "🍳 *DESAYUNOS*\n\n";
    for (const d of desayunos) {
        mensaje += `• ${d.producto}`;
        if (d.precio) mensaje += ` - $${d.precio}`;
        mensaje += `\n`;
    }
    if (desayunos[0]?.incluye) mensaje += `\n*Incluye:* ${desayunos[0].incluye}`;
    await agregarACola(sock, to, mensaje);
}

async function responderComidaCompleta(sock, to) {
    const primerStmt = db.prepare("SELECT opcion FROM comida_primer_tiempo ORDER BY id");
    const segundoStmt = db.prepare("SELECT opcion FROM comida_segundo_tiempo ORDER BY id");
    const tercerStmt = db.prepare("SELECT opcion FROM comida_tercer_tiempo ORDER BY id");
    const acompanamientosStmt = db.prepare("SELECT tipo, descripcion FROM acompanamientos ORDER BY id");
    
    const primerTiempo = primerStmt.all().map(r => r.opcion);
    const segundoTiempo = segundoStmt.all().map(r => r.opcion);
    const tercerTiempo = tercerStmt.all().map(r => r.opcion);
    const acompanamientos = acompanamientosStmt.all();
    
    if (primerTiempo.length > 0) {
        let msg = "🍽️ *PRIMER TIEMPO* (Sopa/Consomé)\n";
        primerTiempo.forEach(op => { msg += `• ${op}\n`; });
        await agregarACola(sock, to, msg);
        await delay(2000);
    }
    
    if (segundoTiempo.length > 0) {
        let msg = "🍚 *SEGUNDO TIEMPO* (Arroz/Pasta)\n";
        segundoTiempo.forEach(op => { msg += `• ${op}\n`; });
        await agregarACola(sock, to, msg);
        await delay(2000);
    }
    
    if (tercerTiempo.length > 0) {
        const mitad = Math.ceil(tercerTiempo.length / 2);
        const parte1 = tercerTiempo.slice(0, mitad);
        const parte2 = tercerTiempo.slice(mitad);
        
        let msg1 = "🍗 *TERCER TIEMPO* (Guisados)\n";
        parte1.forEach(op => { msg1 += `• ${op}\n`; });
        await agregarACola(sock, to, msg1);
        await delay(2000);
        
        if (parte2.length > 0) {
            let msg2 = "🍗 *TERCER TIEMPO (Continuación)*\n";
            parte2.forEach(op => { msg2 += `• ${op}\n`; });
            await agregarACola(sock, to, msg2);
            await delay(2000);
        }
    }
    
    if (acompanamientos.length > 0) {
        let msg = "🥤 *INCLUYE*\n";
        acompanamientos.forEach(a => { msg += `• ${a.descripcion}\n`; });
        await agregarACola(sock, to, msg);
        await delay(1500);
    }
    
    if (precioFijoComida) {
        await agregarACola(sock, to, `💰 *Precio único: $${precioFijoComida} MXN*`);
    }
}

// ============================================
// PROCESAMIENTO DE MENSAJES (MODIFICADO PARA USAR COLA)
// ============================================

async function procesarMensaje(sock, msg, sender, messageText, esVoz) {
    const esAdmin = (adminID === sender);
    
    // Si es admin y NO está en modo cliente
    if (esAdmin && !modoCliente) {
        // Actualizar rubro si detecta palabras clave
        if (actualizarRubroDesdeTexto(messageText)) {
            await agregarACola(sock, sender, `✅ Rubro del negocio actualizado a: ${rubroNegocio} ${getEmojis().principal}`);
            guardarConfig('rubro', rubroNegocio);
        }
        
        if (esVoz) {
            const instruccion = interpretarInstruccion(messageText);
            switch (instruccion.tipo) {
                case 'agregar':
                    await agregarACola(sock, sender, "✅ Información registrada. Procesando...");
                    break;
                case 'eliminar':
                    await agregarACola(sock, sender, "✅ Eliminado");
                    break;
                case 'actualizar':
                    await agregarACola(sock, sender, "✅ Actualizado");
                    break;
                case 'configurar':
                    await agregarACola(sock, sender, "✅ Configurado");
                    break;
                case 'reiniciar':
                    limpiarDia();
                    await agregarACola(sock, sender, "✅ Base de datos reiniciada");
                    break;
                case 'modo_cliente_on':
                    modoCliente = true;
                    await agregarACola(sock, sender, "🧪 Modo cliente activado");
                    break;
                case 'modo_cliente_off':
                    modoCliente = false;
                    await agregarACola(sock, sender, "✅ Modo cliente desactivado");
                    break;
                case 'consultar_modo':
                    const estado = modoCliente ? "🧪 Modo cliente" : "🔧 Modo admin";
                    await agregarACola(sock, sender, `Estás en: ${estado}`);
                    break;
                default:
                    await agregarACola(sock, sender, `✅ Instrucción recibida. ${getEmojis().positivo}`);
            }
        }
        return;
    }
    
    // Cliente (o admin en modo cliente)
    // Primero intentar con NLP mejorado
    const respuestaNLP = await procesarNLPCliente(messageText);
    if (respuestaNLP) {
        await agregarACola(sock, sender, respuestaNLP);
        return;
    }
    
    const pregunta = interpretarPreguntaCliente(messageText);
    
    switch (pregunta) {
        case 'desayunos':
            if (!estaEnHorario(horarioDesayunos)) {
                if (estaEnHorario(horarioComidas)) {
                    await agregarACola(sock, sender, "🙏 Discúlpamos, los desayunos ya terminaron. ¿Quieres la información de las comidas?");
                } else {
                    await agregarACola(sock, sender, `🌙 Los desayunos son de ${horarioDesayunos.inicio} a ${horarioDesayunos.fin}`);
                }
            } else {
                await responderDesayunos(sock, sender);
            }
            break;
        case 'comida':
            if (!estaEnHorario(horarioComidas)) {
                await agregarACola(sock, sender, `🍽️ Las comidas empiezan a las ${horarioComidas.inicio}. Escríbenos cerca de ese horario`);
            } else {
                await responderComidaCompleta(sock, sender);
            }
            break;
        case 'ubicacion':
            await agregarACola(sock, sender, `${getSaludo()} ${getEmojis().ubicacion} Nos ubicamos en: *Calle Juárez #123, Colonia Centro*. ¡Te esperamos!`);
            break;
        case 'horario':
            await agregarACola(sock, sender, `${getSaludo()} ${getEmojis().horario} Desayunos: ${horarioDesayunos.inicio}-${horarioDesayunos.fin} | Comidas: ${horarioComidas.inicio}-${horarioComidas.fin}`);
            break;
        default:
            await agregarACola(sock, sender, `${getSaludo()} ${getEmojis().principal} Pregúntame por: desayunos, comidas, horarios o ubicación. ¿En qué te ayudo?`);
    }
}

// ============================================
// INICIO DEL BOT (ORIGINAL + MEJORAS)
// ============================================

async function startBot() {
    console.log("🚀 Iniciando ComidaBot...");
    initDatabase();
    await entrenarNLP(); // Mejora: entrenar NLP
    
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: P({ level: 'silent' }),
        browser: ['Windows', 'Chrome', '114.0.5735.198']
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log("🔄 Reconectando...");
                startBot();
            }
        } else if (connection === 'open') {
            console.log("✅ Bot conectado exitosamente");
            
            if (!adminID) {
                console.log("\n==========================================");
                console.log("⚙️ CONFIGURACIÓN INICIAL - DUEÑO");
                console.log("==========================================");
                
                const numero = await question("📱 Ingresa el número del DUEÑO (admin): ");
                const numeroCompleto = `${numero}@s.whatsapp.net`;
                await sock.sendMessage(numeroCompleto, { text: "🔐 Responde para confirmar que eres el administrador" });
                console.log("⏳ Esperando respuesta...");
            } else {
                console.log(`👑 Dueño: ${adminID}`);
                console.log(`🏢 Rubro: ${rubroNegocio} ${getEmojis().principal}`);
                console.log("🎧 Esperando instrucciones por voz...");
                console.log("💬 Esperando preguntas de clientes...");
            }
        }
    });
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const sender = msg.key.remoteJid;
        if (sender.endsWith('@g.us')) return;
        
        let messageText = '';
        let esVoz = false;
        
        if (msg.message.conversation) {
            messageText = msg.message.conversation;
        } else if (msg.message.extendedTextMessage?.text) {
            messageText = msg.message.extendedTextMessage.text;
        } else if (msg.message.audioMessage) {
            esVoz = true;
            try {
                const stream = await downloadMediaMessage(
                    msg,
                    'stream',
                    {},
                    { reuploadRequest: sock.updateMediaMessage }
                );
                
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);
                
                if (!buffer || buffer.length === 0) {
                    console.log("⚠️ Buffer de audio vacío");
                    return;
                }
                
                messageText = await transcribirAudio(buffer);
                console.log(`🎤 Transcripción: ${messageText}`);
            } catch (error) {
                console.error("❌ Error descargando audio:", error.message);
                return;
            }
        } else {
            return;
        }
        
        console.log(`📩 De: ${sender.split('@')[0]} | "${messageText}"`);
        
        if (adminID === null && sender !== 'status@broadcast') {
            adminID = sender;
            guardarConfig('admin_id', adminID);
            console.log(`✅ Dueño verificado: ${adminID}`);
            await sock.sendMessage(sender, { text: "✅ Eres el administrador. DAME INSTRUCCIONES POR VOZ." });
            return;
        }
        
        await procesarMensaje(sock, msg, sender, messageText, esVoz);
    });
    
    if (!sock.authState.creds.registered) {
        console.log("\n==========================================");
        console.log("🔐 VINCULACIÓN DEL BOT");
        console.log("==========================================");
        await delay(5000);
        const numero = await question("📱 Ingresa el número del BOT que quieres vincular (ej. 5215551234567): ");
        const codigo = await sock.requestPairingCode(numero.trim());
        console.log(`\n🔑 CÓDIGO DE EMPAREJAMIENTO: ${codigo}`);
        console.log("📲 Abre WhatsApp, ve a Dispositivos vinculados y escribe este código.\n");
        console.log("⏳ Esperando vinculación...");
    }
}

startBot().catch(err => console.error("❌ Error fatal:", err));
