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
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// --- PERSISTENCIA Y MEMORIA LOCAL ---
if (!fs.existsSync("./base_datos.json")) {
    fs.writeFileSync("./base_datos.json", JSON.stringify({ bot_num: null, propietario_num: null, nombre_negocio: "Mi Negocio", menu: "No configurado", horario: "No configurado" }));
}
let db = JSON.parse(fs.readFileSync("./base_datos.json", "utf-8"));

// --- MOTOR DE VARIACIÓN HUMANA (SPINTAX) ---
function spintax(texto) {
    return texto.replace(/{([^{}]+)}/g, (match, opciones) => {
        const lista = opciones.split('|');
        return lista[Math.floor(Math.random() * lista.length)];
    });
}

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }), // Silencio absoluto de logs técnicos innecesarios
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: false, // NO pedir historial (Evita spam y consumo)
        shouldSyncHistoryGroupMessages: false, // IGNORAR grupos
        markOnlineOnConnect: true
    });

    // --- VINCULACIÓN INICIAL ---
    if (!sock.authState.creds.registered) {
        console.log("\n--- REGISTRO DE IDENTIDAD ---");
        const bNum = await question('1. Número del BOT (ej: 521...): ');
        db.bot_num = bNum.replace(/[^0-9]/g, '');

        const pNum = await question('2. Número del DUEÑO (ej: 521...): ');
        db.propietario_num = pNum.replace(/[^0-9]/g, '');

        fs.writeFileSync("./base_datos.json", JSON.stringify(db, null, 2));
        
        try {
            const codigo = await sock.requestPairingCode(db.bot_num);
            console.log("\n------------------------------------");
            console.log("TU CÓDIGO DE VINCULACIÓN ES: " + codigo); 
            console.log("------------------------------------\n");
        } catch (e) { console.log("Error en vinculación: ", e); }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const errorStatus = lastDisconnect.error?.output?.statusCode;
            if (errorStatus !== DisconnectReason.loggedOut) iniciarBot();
        } else if (connection === 'open') {
            console.log("\n[!] RADAR ACTIVADO: Escuchando notificaciones de entrada...\n");
        }
    });

    // --- INTERCEPTOR DE NOTIFICACIONES ---
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return; // Solo procesar notificaciones en tiempo real

        const m = messages[0];
        if (!m.message) return;

        const idRemitente = m.key.remoteJid;
        
        // FILTRO ANTI-GRUPOS
        if (idRemitente.endsWith('@g.us')) return;

        const numLimpio = idRemitente.replace(/[^0-9]/g, '');
        // Detección de Autoridad (Bot o Dueño)
        const esAutoridad = numLimpio.includes(db.bot_num) || numLimpio.includes(db.propietario_num);

        console.log(`[Notificación] De: ${numLimpio} | Tipo: ${Object.keys(m.message)[0]}`);

        if (esAutoridad) {
            // RESPUESTAS AL DUEÑO
            const texto = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase();
            if (texto === 'test') {
                await sock.sendPresenceUpdate('composing', idRemitente);
                await delay(1000);
                await sock.sendMessage(idRemitente, { text: spintax("{✅|✔️} {Conexión interceptada correctamente|Radar activo}. {Soy tu Bot|Sistema listo}, Jefe.") });
            }
        } else {
            // RESPUESTA AUTOMÁTICA A CLIENTES (Humanizada)
            const textoCliente = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase();
            const disparadores = ["hola", "buen", "informacion", "menu"];

            if (disparadores.some(d => textoCliente.includes(d))) {
                const hora = new Date().getHours();
                let saludo = hora < 12 ? "{Buenos días|Buen día}" : hora < 19 ? "{Buenas tardes|Feliz tarde}" : "{Buenas noches|Feliz noche}";

                await sock.sendPresenceUpdate('composing', idRemitente);
                await delay(4000); // Tiempo de "escritura" realista

                let msg = spintax(`${saludo} {👋|😊|✨}\n\n`);
                msg += spintax(`Bienvenido a *${db.nombre_negocio}*. {Dinos en qué podemos ayudarte.|¿Qué se te antoja hoy?}`);
                
                await sock.sendMessage(idRemitente, { text: msg });
            }
        }
    });
}

iniciarBot();
