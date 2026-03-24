const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");
const fs = require("fs");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// Cargar Memoria Local
let db = JSON.parse(fs.readFileSync("./base_datos.json", "utf-8"));

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, 
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
    });

    // Proceso de Vinculación (Pairing Code)
    if (!sock.authState.creds.registered) {
        console.log("\n--- CONFIGURACION DE VINCULACION (DESDE CERO) ---");
        const numeroInput = await question('Introduce tu número de WhatsApp (ej: 5215512345678): ');
        const numeroLimpio = numeroInput.replace(/[^0-9]/g, '');
        
        // Guardamos este número como dueño automáticamente
        db.dueño = numeroLimpio + "@s.whatsapp.net";
        fs.writeFileSync("./base_datos.json", JSON.stringify(db, null, 2));

        try {
            const codigo = await sock.requestPairingCode(numeroLimpio);
            console.log("\n************************************");
            console.log("TU CODIGO DE VINCULACION ES: " + codigo); 
            console.log("************************************\n");
        } catch (error) {
            console.log("Error en vinculación: ", error);
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'close') iniciarBot();
        else if (connection === 'open') {
            console.log("\n[!] BOT CONECTADO Y BLINDADO LOCALMENTE\n");
        }
    });

    // Escucha de mensajes y audios
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const idRemitente = m.key.remoteJid;
        const esDueño = idRemitente === db.dueño;
        const mensajeTipo = Object.keys(m.message)[0];

        // LÓGICA PARA EL DUEÑO (Reconocimiento de Audio/Voz)
        if (esDueño) {
            if (mensajeTipo === 'audioMessage') {
                await sock.sendMessage(idRemitente, { text: "He recibido tu audio, Jefe. Estoy procesando la información localmente..." });
                // Aquí se integrará la librería de transcripción local en el siguiente paso
            }
        } 
        
        // LÓGICA PARA CLIENTES (Información)
        else {
            const textoCliente = m.message.conversation || m.message.extendedTextMessage?.text || "";
            if (textoCliente.toLowerCase().includes("hola") || textoCliente.toLowerCase().includes("menu")) {
                let respuesta = `*${db.nombre_negocio}*\n\n`;
                respuesta += `🍴 *Menú de hoy:* ${db.menu}\n`;
                respuesta += `🕒 *Horario:* ${db.horario}\n`;
                await sock.sendMessage(idRemitente, { text: respuesta });
            }
        }
    });
}

iniciarBot();
