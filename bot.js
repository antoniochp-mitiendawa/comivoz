#!/usr/bin/env node

// ============================================
// COMIDABOT - Bot de WhatsApp para Comida Corrida
// Versión: 3.0.0 (DEFINITIVA - COMIDA CORRIDA)
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
// SPRINTAX (texto aleatorio)
// ============================================

function spintax(texto) {
    return texto.replace(/{([^{}]+)}/g, (match, opciones) => {
        const choices = opciones.split('|');
        return choices[Math.floor(Math.random() * choices.length)];
    });
}

// ============================================
// EMOJIS SEGÚN CONTEXTO
// ============================================

function getEmojiDesayuno() { return spintax('{🍳|🥓|🥞|☕|🌞}'); }
function getEmojiComida() { return spintax('{🍽️|🍲|🥘|🍛|🍜}'); }
function getEmojiUbicacion() { return spintax('{📍|🗺️|📌|🏠}'); }
function getEmojiHorario() { return spintax('{🕐|⏰|⌚|🕒}'); }
function getEmojiProducto() { return spintax('{🥘|🍗|🥩|🍚|🥗}'); }
function getEmojiSaludo() {
    const hora = new Date().getHours();
    if (hora >= 6 && hora < 12) return spintax('{☀️|🌅|🌞}');
    if (hora >= 12 && hora < 19) return spintax('{🌤️|☀️|😎}');
    return spintax('{🌙|🌜|✨}');
}

// ============================================
// SALUDO SEGÚN HORARIO
// ============================================

function getSaludo() {
    const hora = new Date().getHours();
    if (hora >= 6 && hora < 12) return spintax('{Buenos días|Buen día|¡Hola! Buenos días|Saludos, buenos días}');
    if (hora >= 12 && hora < 19) return spintax('{Buenas tardes|Muy buenas tardes|¡Hola! Buenas tardes|Saludos, buenas tardes}');
    return spintax('{Buenas noches|Muy buenas noches|¡Hola! Buenas noches|Saludos, buenas noches}');
}

// ============================================
// BASE DE DATOS (EXISTENTE, NO SE TOCA)
// ============================================

const AUTH_DIR = './auth_info';
const DB_DIR = './db';
const TEMP_AUDIO_DIR = './temp_audio';
const WHISPER_CLI = '/data/data/com.termux/files/home/.local/bin/whisper-cli';
const WHISPER_MODEL = '/data/data/com.termux/files/home/whisper.cpp/models/ggml-base.bin';
const NLP_MODEL_PATH = './db/nlp_model.nlp';

let db;
let adminID = null;
let modoCliente = false;
let horarioDesayunos = { inicio: "07:00", fin: "12:00" };
let horarioComidas = { inicio: "12:00", fin: "18:00" };
let precioFijoDesayunos = null;
let precioFijoComida = null;

// ============================================
// BASE DE DATOS (EXISTENTE, NO SE MODIFICA)
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
// FUNCIONES PARA GUARDAR INFORMACIÓN (EXISTENTES)
// ============================================

function guardarDesayuno(producto, precio, incluye = '') {
    const hoy = new Date().toISOString().split('T')[0];
    const stmt = db.prepare("INSERT INTO desayunos (producto, precio, incluye, fecha) VALUES (?, ?, ?, ?)");
    stmt.run(producto, precio, incluye, hoy);
    console.log(`💾 Desayuno guardado: ${producto} - $${precio}`);
}

function guardarPrimerTiempo(opcion) {
    const hoy = new Date().toISOString().split('T')[0];
    const stmt = db.prepare("INSERT INTO comida_primer_tiempo (opcion, fecha) VALUES (?, ?)");
    stmt.run(opcion, hoy);
    console.log(`💾 Primer tiempo guardado: ${opcion}`);
}

function guardarSegundoTiempo(opcion) {
    const hoy = new Date().toISOString().split('T')[0];
    const stmt = db.prepare("INSERT INTO comida_segundo_tiempo (opcion, fecha) VALUES (?, ?)");
    stmt.run(opcion, hoy);
    console.log(`💾 Segundo tiempo guardado: ${opcion}`);
}

function guardarTercerTiempo(opcion) {
    const hoy = new Date().toISOString().split('T')[0];
    const stmt = db.prepare("INSERT INTO comida_tercer_tiempo (opcion, fecha) VALUES (?, ?)");
    stmt.run(opcion, hoy);
    console.log(`💾 Tercer tiempo guardado: ${opcion}`);
}

function guardarAcompanamiento(descripcion) {
    const hoy = new Date().toISOString().split('T')[0];
    const stmt = db.prepare("INSERT INTO acompanamientos (tipo, descripcion, fecha) VALUES (?, ?, ?)");
    stmt.run('incluye', descripcion, hoy);
    console.log(`💾 Acompañamiento guardado: ${descripcion}`);
}

function obtenerDesayunos() {
    const stmt = db.prepare("SELECT producto, precio, incluye FROM desayunos ORDER BY id");
    return stmt.all();
}

function obtenerPrimerTiempo() {
    const stmt = db.prepare("SELECT opcion FROM comida_primer_tiempo ORDER BY id");
    return stmt.all().map(r => r.opcion);
}

function obtenerSegundoTiempo() {
    const stmt = db.prepare("SELECT opcion FROM comida_segundo_tiempo ORDER BY id");
    return stmt.all().map(r => r.opcion);
}

function obtenerTercerTiempo() {
    const stmt = db.prepare("SELECT opcion FROM comida_tercer_tiempo ORDER BY id");
    return stmt.all().map(r => r.opcion);
}

function obtenerAcompanamientos() {
    const stmt = db.prepare("SELECT descripcion FROM acompanamientos ORDER BY id");
    return stmt.all().map(r => r.descripcion);
}

function eliminarDesayuno(producto) {
    const stmt = db.prepare("DELETE FROM desayunos WHERE producto = ?");
    stmt.run(producto);
    console.log(`🗑️ Desayuno eliminado: ${producto}`);
}

function eliminarPrimerTiempo(opcion) {
    const stmt = db.prepare("DELETE FROM comida_primer_tiempo WHERE opcion = ?");
    stmt.run(opcion);
}

function eliminarSegundoTiempo(opcion) {
    const stmt = db.prepare("DELETE FROM comida_segundo_tiempo WHERE opcion = ?");
    stmt.run(opcion);
}

function eliminarTercerTiempo(opcion) {
    const stmt = db.prepare("DELETE FROM comida_tercer_tiempo WHERE opcion = ?");
    stmt.run(opcion);
}

// ============================================
// TRANSCRIPCIÓN DE VOZ (EXISTENTE)
// ============================================

async function transcribirAudio(bufferAudio) {
    const tempOpus = path.join(TEMP_AUDIO_DIR, `audio_${Date.now()}.opus`);
    const tempWav = path.join(TEMP_AUDIO_DIR, `audio_${Date.now()}.wav`);
    const tempTxt = tempWav + '.txt';
    
    if (!fs.existsSync(TEMP_AUDIO_DIR)) fs.mkdirSync(TEMP_AUDIO_DIR);
    fs.writeFileSync(tempOpus, bufferAudio);
    
    await execAsync(`ffmpeg -i ${tempOpus} -ar 16000 -ac 1 -c:a pcm_s16le ${tempWav} -y`);
    
    try {
        await execAsync(`${WHISPER_CLI} -m ${WHISPER_MODEL} -f ${tempWav} -otxt -l es -t 4`);
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
// IA - NLP CON NER (MEJORADO)
// ============================================

let nlpManager = null;

async function initNLP() {
    nlpManager = new NlpManager({ languages: ['es'], forceNER: true, autoSave: false });
    
    // ============================================
    // PROMPT ESPECÍFICO PARA COMIDA CORRIDA
    // ============================================
    
    // Sinónimos para desayunos
    nlpManager.addDocument('es', 'desayunos', 'servicio.desayuno');
    nlpManager.addDocument('es', 'desayuno', 'servicio.desayuno');
    nlpManager.addDocument('es', 'qué hay de desayuno', 'servicio.desayuno');
    nlpManager.addDocument('es', 'qué desayunos tienen', 'servicio.desayuno');
    
    // Sinónimos para comida corrida
    nlpManager.addDocument('es', 'comida corrida', 'servicio.comida');
    nlpManager.addDocument('es', 'comida', 'servicio.comida');
    nlpManager.addDocument('es', 'qué hay de comer', 'servicio.comida');
    nlpManager.addDocument('es', 'menú del día', 'servicio.comida');
    nlpManager.addDocument('es', 'qué comidas tienen', 'servicio.comida');
    
    // Sinónimos para ubicación
    nlpManager.addDocument('es', 'dónde están', 'cliente.ubicacion');
    nlpManager.addDocument('es', 'dónde estás ubicado', 'cliente.ubicacion');
    nlpManager.addDocument('es', 'cuál es tu dirección', 'cliente.ubicacion');
    nlpManager.addDocument('es', 'en qué calle están', 'cliente.ubicacion');
    nlpManager.addDocument('es', 'cómo llegar', 'cliente.ubicacion');
    
    // Sinónimos para horario
    nlpManager.addDocument('es', 'qué horario tienen', 'cliente.horario');
    nlpManager.addDocument('es', 'a qué hora abren', 'cliente.horario');
    nlpManager.addDocument('es', 'cuándo atienden', 'cliente.horario');
    nlpManager.addDocument('es', 'horario de atención', 'cliente.horario');
    
    // Instrucciones del dueño para guardar información
    nlpManager.addDocument('es', 'el negocio se llama {nombre}', 'admin.guardar.nombre');
    nlpManager.addDocument('es', 'mi negocio se llama {nombre}', 'admin.guardar.nombre');
    nlpManager.addDocument('es', 'el nombre del negocio es {nombre}', 'admin.guardar.nombre');
    nlpManager.addDocument('es', 'le puse por nombre {nombre}', 'admin.guardar.nombre');
    nlpManager.addDocument('es', 'registra el nombre como {nombre}', 'admin.guardar.nombre');
    
    nlpManager.addDocument('es', 'estamos en {ubicacion}', 'admin.guardar.ubicacion');
    nlpManager.addDocument('es', 'la dirección es {ubicacion}', 'admin.guardar.ubicacion');
    nlpManager.addDocument('es', 'nos ubicamos en {ubicacion}', 'admin.guardar.ubicacion');
    
    nlpManager.addDocument('es', 'los desayunos son de {horario}', 'admin.guardar.horario.desayunos');
    nlpManager.addDocument('es', 'desayunos de {horario}', 'admin.guardar.horario.desayunos');
    nlpManager.addDocument('es', 'las comidas son de {horario}', 'admin.guardar.horario.comidas');
    nlpManager.addDocument('es', 'comida corrida de {horario}', 'admin.guardar.horario.comidas');
    
    nlpManager.addDocument('es', '{producto} cuesta {precio} pesos', 'admin.guardar.desayuno');
    nlpManager.addDocument('es', 'tenemos {producto} a {precio}', 'admin.guardar.desayuno');
    nlpManager.addDocument('es', 'el {producto} vale {precio}', 'admin.guardar.desayuno');
    
    nlpManager.addDocument('es', 'primer tiempo {opcion}', 'admin.guardar.primer_tiempo');
    nlpManager.addDocument('es', 'el primer tiempo es {opcion}', 'admin.guardar.primer_tiempo');
    nlpManager.addDocument('es', 'segundo tiempo {opcion}', 'admin.guardar.segundo_tiempo');
    nlpManager.addDocument('es', 'el segundo tiempo es {opcion}', 'admin.guardar.segundo_tiempo');
    nlpManager.addDocument('es', 'tercer tiempo {opcion}', 'admin.guardar.tercer_tiempo');
    nlpManager.addDocument('es', 'el tercer tiempo es {opcion}', 'admin.guardar.tercer_tiempo');
    
    nlpManager.addDocument('es', 'incluye {acompanamiento}', 'admin.guardar.acompanamiento');
    nlpManager.addDocument('es', 'la comida incluye {acompanamiento}', 'admin.guardar.acompanamiento');
    
    nlpManager.addDocument('es', 'el precio de la comida corrida es {precio}', 'admin.guardar.precio_comida');
    nlpManager.addDocument('es', 'la comida corrida cuesta {precio}', 'admin.guardar.precio_comida');
    
    // Comandos del dueño
    nlpManager.addDocument('es', 'activar modo cliente', 'modo.cliente.on');
    nlpManager.addDocument('es', 'modo cliente', 'modo.cliente.on');
    nlpManager.addDocument('es', 'desactivar modo cliente', 'modo.cliente.off');
    nlpManager.addDocument('es', 'modo dueño', 'modo.cliente.off');
    nlpManager.addDocument('es', 'activar modo dueño', 'modo.cliente.off');
    nlpManager.addDocument('es', 'salir modo cliente', 'modo.cliente.off');
    nlpManager.addDocument('es', 'volver modo dueño', 'modo.cliente.off');
    
    nlpManager.addDocument('es', 'elimina {producto}', 'admin.eliminar.desayuno');
    nlpManager.addDocument('es', 'borra {producto}', 'admin.eliminar.desayuno');
    nlpManager.addDocument('es', 'ya no tenemos {producto}', 'admin.eliminar.desayuno');
    
    nlpManager.addDocument('es', 'reiniciar base de datos', 'admin.reiniciar');
    nlpManager.addDocument('es', 'limpiar todo', 'admin.reiniciar');
    
    // Agradecimientos
    nlpManager.addDocument('es', 'gracias', 'cliente.gracias');
    nlpManager.addDocument('es', 'muchas gracias', 'cliente.gracias');
    nlpManager.addDocument('es', 'gracias por la información', 'cliente.gracias');
    
    // Entrenar
    await nlpManager.train();
    console.log('🧠 IA entrenada (prompt específico para comida corrida)');
    
    // Guardar modelo entrenado
    await nlpManager.save(NLP_MODEL_PATH);
    console.log('💾 Modelo NLP guardado en archivo');
}

async function cargarNLP() {
    if (fs.existsSync(NLP_MODEL_PATH)) {
        nlpManager = new NlpManager({ languages: ['es'] });
        await nlpManager.load(NLP_MODEL_PATH);
        console.log('📂 Modelo NLP cargado desde archivo');
    } else {
        await initNLP();
    }
}

async function procesarConIA(texto, esAdmin) {
    const result = await nlpManager.process('es', texto);
    const intent = result.intent;
    const entities = result.entities;
    
    console.log(`🧠 IA: Intención=${intent} | Entidades=${JSON.stringify(entities)}`);
    
    // Extraer entidades
    const nombre = entities.nombre ? entities.nombre : null;
    const ubicacion = entities.ubicacion ? entities.ubicacion : null;
    const horario = entities.horario ? entities.horario : null;
    const producto = entities.producto ? entities.producto : null;
    const precio = entities.precio ? entities.precio : null;
    const opcion = entities.opcion ? entities.opcion : null;
    const acompanamiento = entities.acompanamiento ? entities.acompanamiento : null;
    
    // ============================================
    // PROCESAR INSTRUCCIONES DEL DUEÑO
    // ============================================
    
    if (esAdmin && !modoCliente) {
        if (intent === 'admin.guardar.nombre' && nombre) {
            guardarConfig('nombre_negocio', nombre);
            return spintax(`{✅ Listo|✅ Guardado|✅ Registrado} ${getEmojiDesayuno()} El nombre del negocio es *${nombre}*.`);
        }
        
        if (intent === 'admin.guardar.ubicacion' && ubicacion) {
            guardarConfig('ubicacion', ubicacion);
            return spintax(`{✅ Ubicación guardada|✅ Dirección registrada} ${getEmojiUbicacion()} *${ubicacion}*`);
        }
        
        if (intent === 'admin.guardar.horario.desayunos' && horario) {
            const partes = horario.split('a');
            if (partes.length === 2) {
                horarioDesayunos = { inicio: partes[0].trim(), fin: partes[1].trim() };
                guardarConfig('horario_desayunos', JSON.stringify(horarioDesayunos));
            }
            return spintax(`{✅ Horario de desayunos guardado|✅ Listo} ${getEmojiHorario()} *${horario}*`);
        }
        
        if (intent === 'admin.guardar.horario.comidas' && horario) {
            const partes = horario.split('a');
            if (partes.length === 2) {
                horarioComidas = { inicio: partes[0].trim(), fin: partes[1].trim() };
                guardarConfig('horario_comidas', JSON.stringify(horarioComidas));
            }
            return spintax(`{✅ Horario de comidas guardado|✅ Listo} ${getEmojiHorario()} *${horario}*`);
        }
        
        if (intent === 'admin.guardar.desayuno' && producto) {
            guardarDesayuno(producto, precio || 'consultar');
            return spintax(`{✅ Desayuno guardado|✅ Registrado} ${getEmojiDesayuno()} *${producto}* ${precio ? `- $${precio}` : ''}`);
        }
        
        if (intent === 'admin.guardar.primer_tiempo' && opcion) {
            guardarPrimerTiempo(opcion);
            return spintax(`{✅ Primer tiempo guardado|✅ Listo} ${getEmojiComida()} *${opcion}*`);
        }
        
        if (intent === 'admin.guardar.segundo_tiempo' && opcion) {
            guardarSegundoTiempo(opcion);
            return spintax(`{✅ Segundo tiempo guardado|✅ Listo} ${getEmojiComida()} *${opcion}*`);
        }
        
        if (intent === 'admin.guardar.tercer_tiempo' && opcion) {
            guardarTercerTiempo(opcion);
            return spintax(`{✅ Tercer tiempo guardado|✅ Listo} ${getEmojiComida()} *${opcion}*`);
        }
        
        if (intent === 'admin.guardar.acompanamiento' && acompanamiento) {
            guardarAcompanamiento(acompanamiento);
            return spintax(`{✅ Acompañamiento guardado|✅ Listo} ${getEmojiComida()} *${acompanamiento}*`);
        }
        
        if (intent === 'admin.guardar.precio_comida' && precio) {
            precioFijoComida = precio;
            guardarConfig('precio_fijo_comida', precio);
            return spintax(`{✅ Precio de comida corrida guardado|✅ Listo} ${getEmojiComida()} *$${precio} MXN*`);
        }
        
        if (intent === 'admin.eliminar.desayuno' && producto) {
            eliminarDesayuno(producto);
            return spintax(`{✅ Eliminado|✅ Borrado} ${getEmojiDesayuno()} *${producto}*`);
        }
        
        if (intent === 'admin.reiniciar') {
            limpiarDia();
            return spintax(`{✅ Base de datos reiniciada|✅ Todo limpio} ${getEmojiDesayuno()} Listo para un nuevo día.`);
        }
        
        if (intent === 'modo.cliente.on') {
            modoCliente = true;
            return spintax(`{🧪 Modo cliente activado|🧪 Modo prueba activado} ${getEmojiDesayuno()} Ahora te responderé como cliente.`);
        }
        
        if (intent === 'modo.cliente.off') {
            modoCliente = false;
            return spintax(`{✅ Modo dueño activado|✅ Modo administrador activado} ${getEmojiDesayuno()} Ahora puedes darme instrucciones.`);
        }
    }
    
    // ============================================
    // RESPUESTAS PARA CLIENTES
    // ============================================
    
    if (!esAdmin || modoCliente) {
        // Obtener información guardada
        const nombreNegocio = obtenerConfig('nombre_negocio');
        const ubicacion = obtenerConfig('ubicacion');
        const horarioDesayunoStr = `${horarioDesayunos.inicio} a ${horarioDesayunos.fin}`;
        const horarioComidaStr = `${horarioComidas.inicio} a ${horarioComidas.fin}`;
        
        const desayunos = obtenerDesayunos();
        const primerTiempo = obtenerPrimerTiempo();
        const segundoTiempo = obtenerSegundoTiempo();
        const tercerTiempo = obtenerTercerTiempo();
        const acompanamientos = obtenerAcompanamientos();
        
        const horaActual = new Date().getHours();
        const esHorarioDesayuno = (horaActual >= parseInt(horarioDesayunos.inicio.split(':')[0]) && horaActual < parseInt(horarioComidas.inicio.split(':')[0]));
        const esHorarioComida = (horaActual >= parseInt(horarioComidas.inicio.split(':')[0]) && horaActual < 20);
        
        if (intent === 'servicio.desayuno') {
            if (desayunos.length === 0) {
                return spintax(`{${getSaludo()}|Hola} ${getEmojiDesayuno()} Por el momento no tengo desayunos registrados para hoy.`);
            }
            let respuesta = `${getSaludo()} ${getEmojiDesayuno()} *Desayunos disponibles:*\n\n`;
            for (const d of desayunos) {
                respuesta += `• ${d.producto}`;
                if (d.precio && d.precio !== 'consultar') respuesta += ` - *$${d.precio}*`;
                respuesta += `\n`;
            }
            if (ubicacion) respuesta += `\n${getEmojiUbicacion()} ¡Te esperamos en *${ubicacion}*!`;
            return respuesta;
        }
        
        if (intent === 'servicio.comida') {
            if (primerTiempo.length === 0 && segundoTiempo.length === 0 && tercerTiempo.length === 0) {
                return spintax(`{${getSaludo()}|Hola} ${getEmojiComida()} Por el momento no tengo comida corrida registrada para hoy.`);
            }
            let respuesta = `${getSaludo()} ${getEmojiComida()} *Comida Corrida de hoy:*\n\n`;
            if (primerTiempo.length > 0) respuesta += `🍲 *Primer tiempo:* ${primerTiempo.join(', ')}\n\n`;
            if (segundoTiempo.length > 0) respuesta += `🍚 *Segundo tiempo:* ${segundoTiempo.join(', ')}\n\n`;
            if (tercerTiempo.length > 0) respuesta += `🍗 *Tercer tiempo:* ${tercerTiempo.join(', ')}\n\n`;
            if (acompanamientos.length > 0) respuesta += `🥤 *Incluye:* ${acompanamientos.join(', ')}\n\n`;
            if (precioFijoComida) respuesta += `💰 *Precio único: $${precioFijoComida} MXN*\n\n`;
            if (ubicacion) respuesta += `${getEmojiUbicacion()} ¡Te esperamos en *${ubicacion}*!`;
            return respuesta;
        }
        
        if (intent === 'cliente.ubicacion') {
            if (ubicacion) {
                return spintax(`{${getSaludo()}|Claro|Por supuesto} ${getEmojiUbicacion()} Nos ubicamos en *${ubicacion}*. ¡Te esperamos!`);
            }
            return spintax(`{${getSaludo()}|Disculpa} ${getEmojiUbicacion()} Aún no tengo la ubicación registrada.`);
        }
        
        if (intent === 'cliente.horario') {
            let respuesta = `${getSaludo()} ${getEmojiHorario()} *Horarios:*\n`;
            respuesta += `🍳 Desayunos: *${horarioDesayunoStr}*\n`;
            respuesta += `🍽️ Comidas: *${horarioComidaStr}*`;
            if (ubicacion) respuesta += `\n\n${getEmojiUbicacion()} ¡Te esperamos en *${ubicacion}*!`;
            return respuesta;
        }
        
        if (intent === 'cliente.gracias') {
            return spintax(`{¡A ti!|Un placer|Gracias a ti|Saludos} ${getEmojiDesayuno()} ¡Que tengas un excelente día!`);
        }
        
        // Si el cliente pregunta por algo que no existe en BD
        if (producto || intent === 'None') {
            // Verificar si el producto está en desayunos
            const desayunosList = obtenerDesayunos();
            const existe = desayunosList.some(d => d.producto.toLowerCase().includes(producto?.toLowerCase() || ''));
            
            if (!existe && producto) {
                let respuesta = spintax(`{¡Qué crees!|¡Ay!|¡Disculpa!} ${getEmojiDesayuno()} Ese producto no lo tenemos en este momento.`);
                
                if (desayunosList.length > 0) {
                    respuesta += ` Pero mira, te ofrecemos: `;
                    const nombres = desayunosList.map(d => `${d.producto}${d.precio && d.precio !== 'consultar' ? ` *$${d.precio}*` : ''}`);
                    respuesta += nombres.join(', ');
                }
                
                if (ubicacion) respuesta += ` ${getEmojiUbicacion()} ¡Ya sabes dónde estamos en *${ubicacion}*!`;
                respuesta += ` ${getEmojiDesayuno()} ¡Te esperamos!`;
                return respuesta;
            }
        }
        
        // Respuesta por defecto para saludos sin contexto
        if (esHorarioDesayuno && desayunos.length > 0) {
            let respuesta = `${getSaludo()} ${getEmojiDesayuno()} Aún tenemos desayunos: `;
            const nombres = desayunos.map(d => `${d.producto}${d.precio && d.precio !== 'consultar' ? ` *$${d.precio}*` : ''}`);
            respuesta += nombres.join(', ');
            if (ubicacion) respuesta += ` ${getEmojiUbicacion()} ¡Te esperamos en *${ubicacion}*!`;
            return respuesta;
        }
        
        if (esHorarioComida && (primerTiempo.length > 0 || segundoTiempo.length > 0 || tercerTiempo.length > 0)) {
            let respuesta = `${getSaludo()} ${getEmojiComida()} Nuestra comida corrida de hoy es: `;
            if (tercerTiempo.length > 0) respuesta += `${tercerTiempo.slice(0, 2).join(', ')}`;
            if (precioFijoComida) respuesta += ` por *$${precioFijoComida}*`;
            if (ubicacion) respuesta += ` ${getEmojiUbicacion()} ¡Te esperamos en *${ubicacion}*!`;
            return respuesta;
        }
    }
    
    return null;
}

// ============================================
// INTERPRETACIÓN SEMÁNTICA (EXISTENTE - RESPALDO)
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
    if (texto.includes('modo dueño')) instruccion.tipo = 'modo_cliente_off';
    if (texto.includes('activar modo dueño')) instruccion.tipo = 'modo_cliente_off';
    if (texto.includes('salir modo cliente')) instruccion.tipo = 'modo_cliente_off';
    if (texto.includes('en qué modo')) instruccion.tipo = 'consultar_modo';
    
    return instruccion;
}

// ============================================
// RESPUESTAS AL CLIENTE (EXISTENTES - RESPALDO)
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
    const desayunos = obtenerDesayunos();
    
    if (desayunos.length === 0) {
        await agregarACola(sock, to, spintax(`{${getSaludo()}|Hola} ${getEmojiDesayuno()} Por el momento no tenemos desayunos registrados para hoy.`));
        return;
    }
    
    let mensaje = `${getSaludo()} ${getEmojiDesayuno()} *Desayunos disponibles:*\n\n`;
    for (const d of desayunos) {
        mensaje += `• ${d.producto}`;
        if (d.precio && d.precio !== 'consultar') mensaje += ` - *$${d.precio}*`;
        mensaje += `\n`;
    }
    const ubicacion = obtenerConfig('ubicacion');
    if (ubicacion) mensaje += `\n${getEmojiUbicacion()} ¡Te esperamos en *${ubicacion}*!`;
    
    await agregarACola(sock, to, mensaje);
}

async function responderComidaCompleta(sock, to) {
    const primerTiempo = obtenerPrimerTiempo();
    const segundoTiempo = obtenerSegundoTiempo();
    const tercerTiempo = obtenerTercerTiempo();
    const acompanamientos = obtenerAcompanamientos();
    
    if (primerTiempo.length === 0 && segundoTiempo.length === 0 && tercerTiempo.length === 0) {
        await agregarACola(sock, to, spintax(`{${getSaludo()}|Hola} ${getEmojiComida()} Por el momento no tengo comida corrida registrada para hoy.`));
        return;
    }
    
    let mensaje = `${getSaludo()} ${getEmojiComida()} *Comida Corrida de hoy:*\n\n`;
    if (primerTiempo.length > 0) mensaje += `🍲 *Primer tiempo:* ${primerTiempo.join(', ')}\n\n`;
    if (segundoTiempo.length > 0) mensaje += `🍚 *Segundo tiempo:* ${segundoTiempo.join(', ')}\n\n`;
    if (tercerTiempo.length > 0) mensaje += `🍗 *Tercer tiempo:* ${tercerTiempo.join(', ')}\n\n`;
    if (acompanamientos.length > 0) mensaje += `🥤 *Incluye:* ${acompanamientos.join(', ')}\n\n`;
    if (precioFijoComida) mensaje += `💰 *Precio único: $${precioFijoComida} MXN*\n\n`;
    
    const ubicacion = obtenerConfig('ubicacion');
    if (ubicacion) mensaje += `${getEmojiUbicacion()} ¡Te esperamos en *${ubicacion}*!`;
    
    await agregarACola(sock, to, mensaje);
}

// ============================================
// COLA DE MENSAJES Y DELAY HUMANO (CORREGIDO)
// ============================================

let colaMensajes = [];
let procesandoCola = false;
let contadorRespuestas = 0;
let ultimoReset = Date.now();

async function enviarConDelay(sock, to, texto) {
    const delayMs = Math.floor(Math.random() * (14000 - 6000 + 1) + 6000);
    console.log(`⏳ Esperando ${(delayMs/1000).toFixed(1)} segundos antes de responder...`);
    await delay(delayMs);
    await sock.sendMessage(to, { text: texto });
    console.log(`📤 Respuesta enviada a ${to.split('@')[0]}: "${texto.substring(0, 100)}${texto.length > 100 ? '...' : ''}"`);
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
        
        if (contadorRespuestas >= 15) {
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

// ============================================
// PROCESAMIENTO DE MENSAJES (CORREGIDO)
// ============================================

async function procesarMensaje(sock, msg, sender, messageText, esVoz) {
    const esAdmin = (adminID === sender);
    
    console.log(`📩 De: ${sender.split('@')[0]} | "${messageText}"`);
    
    // Intentar con IA primero
    const respuestaIA = await procesarConIA(messageText, esAdmin);
    if (respuestaIA) {
        agregarACola(sock, sender, respuestaIA);
        return;
    }
    
    // Respaldo: interpretación manual
    if (esAdmin && !modoCliente) {
        const instruccion = interpretarInstruccion(messageText);
        switch (instruccion.tipo) {
            case 'agregar':
                agregarACola(sock, sender, spintax(`{✅ Información registrada|✅ Guardado} ${getEmojiDesayuno()} Procesando...`));
                break;
            case 'eliminar':
                agregarACola(sock, sender, spintax(`{✅ Eliminado|✅ Borrado} ${getEmojiDesayuno()}`));
                break;
            case 'actualizar':
                agregarACola(sock, sender, spintax(`{✅ Actualizado|✅ Modificado} ${getEmojiDesayuno()}`));
                break;
            case 'reiniciar':
                limpiarDia();
                agregarACola(sock, sender, spintax(`{✅ Base de datos reiniciada|✅ Todo limpio} ${getEmojiDesayuno()}`));
                break;
            case 'modo_cliente_on':
                modoCliente = true;
                agregarACola(sock, sender, spintax(`{🧪 Modo cliente activado|🧪 Modo prueba activado} ${getEmojiDesayuno()}`));
                break;
            case 'modo_cliente_off':
                modoCliente = false;
                agregarACola(sock, sender, spintax(`{✅ Modo dueño activado|✅ Modo administrador activado} ${getEmojiDesayuno()}`));
                break;
            default:
                agregarACola(sock, sender, spintax(`{✅ Instrucción recibida|✅ Recibido} ${getEmojiDesayuno()}`));
        }
        return;
    }
    
    // Cliente o admin en modo cliente
    const horaActual = new Date().getHours();
    const esHorarioDesayunoActual = (horaActual >= parseInt(horarioDesayunos.inicio.split(':')[0]) && horaActual < parseInt(horarioComidas.inicio.split(':')[0]));
    const desayunos = obtenerDesayunos();
    
    if (esHorarioDesayunoActual && desayunos.length > 0) {
        await responderDesayunos(sock, sender);
    } else {
        await responderComidaCompleta(sock, sender);
    }
}

// ============================================
// INICIO DEL BOT (VINCULACIÓN ORIGINAL)
// ============================================

async function startBot() {
    console.log("🚀 Iniciando ComidaBot...");
    initDatabase();
    await cargarNLP();
    
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
                console.log("🎧 Esperando instrucciones por voz...");
                console.log("💬 Esperando preguntas de clientes...");
            }
        }
    });
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        // CORRECCIÓN: Procesar todos los mensajes del lote
        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;
            
            const sender = msg.key.remoteJid;
            
            // Filtrar solo cuentas individuales
            if (sender.includes('@g.us')) continue;
            if (sender.includes('@broadcast')) continue;
            if (sender.includes('@newsletter')) continue;
            if (!sender.includes('@s.whatsapp.net') && !sender.includes('@lid')) continue;
            
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
                        continue;
                    }
                    
                    messageText = await transcribirAudio(buffer);
                    console.log(`🎤 Transcripción: ${messageText}`);
                } catch (error) {
                    console.error("❌ Error descargando audio:", error.message);
                    continue;
                }
            } else {
                continue;
            }
            
            // Verificar si es la respuesta de verificación del dueño
            if (adminID === null && sender !== 'status@broadcast') {
                adminID = sender;
                guardarConfig('admin_id', adminID);
                console.log(`✅ Dueño verificado: ${adminID}`);
                await sock.sendMessage(sender, { text: "✅ Eres el administrador. Puedes darme instrucciones por voz." });
                continue;
            }
            
            await procesarMensaje(sock, msg, sender, messageText, esVoz);
        }
    });
    
    // Vincular el bot si no hay sesión
    if (!fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
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
