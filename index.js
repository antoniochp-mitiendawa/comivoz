const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore,
    delay,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");
const fs = require("fs");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const altQuestion = (text) => new Promise((resolve) => rl.question(text, resolve));

// --- PERSISTENCIA Y BLINDAJE DE DATOS ---
if (!fs.existsSync("./base_datos.json")) {
    fs.writeFileSync("./base_datos.json", JSON.stringify({ bot_num: null, propietario_num: null, nombre_negocio: "Negocio", menu: "No configurado", horario: "No configurado" }));
}
let db = JSON.parse(fs.readFileSync("./base_datos.json", "utf-8"));

// --- MOTOR DE HUMANIZACIÓN (SPINTAX) ---
function aplicarSpintax(texto) {
    return texto.replace(/{([^{}]+)}/g, (match, opciones) => {
        const lista = opciones.split('|');
        return lista[Math.floor(Math.random() * lista.length)];
    });
}

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    const { version, isLatest } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, 
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        generateHighQualityLinkPreview: true,
    });

    // --- CONFIGURACIÓN DE IDENTIDAD INICIAL ---
    if (!sock.authState.creds.registered) {
        console.log("\n--- CONFIGURACIÓN DE SEGURIDAD (VINCULACIÓN) ---");
        const nBot = await altQuestion('1. Introduce el número del BOT (ej: 521...): ');
        db.bot_num = nBot.replace(/[^0-9]/g, '');

        const nProp = await altQuestion('2. Introduce el número del DUEÑO/PROPIETARIO: ');
        db.propietario_num = nProp.replace(/[^0-9]/g, '');

        fs.writeFileSync("./base_datos.json", JSON.stringify(db, null, 2));
        
        try {
            const codigo = await sock.requestPairingCode(db.bot_num);
            console.log("\n------------------------------------");
            console.log("TU CÓDIGO DE VINCULACIÓN: " + codigo); 
            console.log("------------------------------------\n");
        } catch (e) { console.log("Error en Pairing: ", e); }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) iniciarBot();
        } else if (connection === 'open') {
            console.log("\n[!] SISTEMA CONECTADO | WAKE-LOCK OK | ANTI-GRUPOS ACTIVO\n");
        }
    });

    // --- ESCUCHA DE MENSAJES ---
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;

        const idRemitente = m.key.remoteJid;

        // BLINDAJE 1: IGNORAR GRUPOS (Solo chats privados)
        if (idRemitente.endsWith('@g.us')) return;

        const numLimpio = idRemitente.replace(/[^0-9]/g, '');
        const esAutoridad = numLimpio.includes(db.bot_num) || numLimpio.includes(db.propietario_num);
        const mensajeTipo = Object.keys(m.message)[0];

        if (esAutoridad) {
            // Lógica para Dueño
            if (mensajeTipo === 'audioMessage') {
                await sock.sendPresenceUpdate('record', idRemitente);
                await delay(2500);
                await sock.sendMessage(idRemitente, { text: aplicarSpintax("{Entendido|Recibido|Copiado}, Jefe. {Procesando tu audio localmente...|Analizando la instrucción de voz...} {⌛|🎧|✨}") });
            } else {
                const texto = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase();
                if (texto === 'test') {
                    await sock.sendPresenceUpdate('composing', idRemitente);
                    await delay(1200);
                    await sock.sendMessage(idRemitente, { text: aplicarSpintax("{✅|✔️} {Conexión blindada|Servicio operativo}. Te reconozco como {Autoridad|Jefe|Dueño}.") });
                }
            }
        } else {
            // Lógica para Clientes (Humanizada)
            const textoCliente = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase();
            const disparadores = ["hola", "buen", "menu", "informacion", "precio"];
            
            if (disparadores.some(d => textoCliente.includes(d))) {
                const horaActual = new Date().getHours();
                let saludoReloj = horaActual < 12 ? "{Buenos días|Buen día|Excelente mañana}" : horaActual < 19 ? "{Buenas tardes|Feliz tarde}" : "{Buenas noches|Feliz noche}";

                await sock.sendPresenceUpdate('composing', idRemitente);
                await delay(3500); // Typing humano

                let respuestaFinal = aplicarSpintax(`${saludoReloj} {👋|😊|✨}\n\n`);
                respuestaFinal += aplicarSpintax(`Bienvenido a *${db.nombre_negocio}*. {Es un placer saludarte.|¿Cómo podemos ayudarte?|Dinos qué se te antoja hoy.}`);
                
                await sock.sendMessage(idRemitente, { text: respuestaFinal });
            }
        }
    });
}

iniciarBot();
