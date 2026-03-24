const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function iniciarBot() {
    // Carpeta donde se guardará la sesión para no tener que vincular cada vez
    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Forzamos el uso de Pairing Code
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        // Navegador necesario para que WhatsApp acepte la vinculación por código
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
    });

    // Proceso de Vinculación por Código (Pairing Code)
    if (!sock.authState.creds.registered) {
        console.log("\n--- CONFIGURACIÓN DE VINCULACIÓN ---");
        const numeroInput = await question('Introduce tu número de WhatsApp (ej: 5215512345678): ');
        
        // Limpiamos el número: solo dejamos los dígitos
        const numeroLimpio = numeroInput.replace(/[^0-9]/g, '');
        
        try {
            const codigo = await sock.requestPairingCode(numeroLimpio);
            console.log("\n************************************");
            console.log("TU CÓDIGO DE VINCULACIÓN ES:");
            console.log(codigo); 
            console.log("************************************\n");
            console.log("Instrucciones:");
            console.log("1. Abre WhatsApp en tu teléfono.");
            console.log("2. Ve a Dispositivos vinculados > Vincular un dispositivo.");
            console.log("3. Selecciona 'Vincular con el número de teléfono'.");
            console.log("4. Ingresa el código de 8 dígitos mostrado arriba.\n");
        } catch (error) {
            console.log("Error al solicitar el código: ", error);
        }
    }

    // Guardar credenciales cuando se actualicen
    sock.ev.on('creds.update', saveCreds);

    // Monitor de conexión
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const debeReintentar = (lastDisconnect?.error?.output?.statusCode !== 401);
            if (debeReintentar) {
                console.log("Conexión perdida. Reconectando...");
                iniciarBot();
            } else {
                console.log("Sesión cerrada. Borra la carpeta 'sesion_auth' y vuelve a empezar.");
            }
        } else if (connection === 'open') {
            console.log("\n[!] BOT CONECTADO EXITOSAMENTE");
            console.log("[!] El bot de Comida Corrida está activo.\n");
        }
    });

    // Escucha de mensajes (Prueba de funcionamiento)
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const texto = m.message.conversation || m.message.extendedTextMessage?.text || "";
        const idCliente = m.key.remoteJid;

        // Respuesta simple de prueba
        if (texto.toLowerCase() === 'hola') {
            await sock.sendMessage(idCliente, { 
                text: "¡Hola! Bienvenido al servicio de Comida Corrida. Próximamente podrás consultar nuestro menú aquí." 
            });
        }
    });
}

// Arrancar el proceso
iniciarBot();
