#!/data/data/com.termux/files/usr/bin/bash

# ==========================================
# BLOQUE 2: VINCULACIÓN Y REGISTRO DE DUEÑO
# PROYECTO: COMIDABOT - VOZ E INSTRUCCIONES
# ==========================================

echo -e "\n\e[1;32m[+] Iniciando FASE DE VINCULACIÓN (Bloque 2)...\e[0m"

cd $HOME/comidabot

# 1. Crear base de datos inicial de configuración
cat << 'EOF' > config.json
{
  "botNumber": "",
  "ownerNumber": "",
  "ownerJID": "",
  "isConfigured": false
}
EOF

# 2. Generar el script index.js con la lógica de persistencia del proyecto anterior
cat << 'EOF' > index.js
const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const readline = require("readline");

// Interfaz de lectura global para evitar el cierre de la terminal
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on("creds.update", saveCreds);

    // PASO 1: SOLICITAR NÚMERO DEL BOT (Solo si no está registrado)
    if (!sock.authState.creds.registered) {
        console.log("\n\x1b[1;32m--- PASO 1: VINCULACIÓN DEL BOT ---\x1b[0m");
        // Pausa de seguridad para estabilizar la terminal
        await delay(5000); 
        const numeroBot = await question("👉 Introduce el número del BOT (521...): ");
        
        try {
            const codigo = await sock.requestPairingCode(numeroBot.trim());
            console.log(`\n\x1b[1;33m🔑 CÓDIGO DE VINCULACIÓN:\x1b[0m \x1b[1;32m${codigo}\x1b[0m\n`);
            console.log("\x1b[1;36m[i] Ingrésalo en tu WhatsApp ahora.\x1b[0m\n");
        } catch (e) {
            console.log("\x1b[1;31m[!] Error al generar código. Reinicia el proceso.\x1b[0m");
            process.exit(1);
        }
    }

    sock.ev.on("connection.update", async (update) => {
        const { connection } = update;
        
        if (connection === "open") {
            console.log("\n\x1b[1;32m✅ BOT CONECTADO EXITOSAMENTE\x1b[0m");
            
            // PASO 2: SOLICITAR NÚMERO DEL DUEÑO
            let config = JSON.parse(fs.readFileSync("./config.json"));
            if (!config.ownerNumber) {
                console.log("\n\x1b[1;32m--- PASO 2: REGISTRO DEL DUEÑO ---\x1b[0m");
                const numDueño = await question("👉 Introduce el número del DUEÑO (521...): ");
                config.ownerNumber = numDueño.trim();
                fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
                
                console.log("\n\x1b[1;33m👉 PASO 3: Envía 'CONFIGURAR' desde tu número personal al BOT...\x1b[0m");
            }
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jidRemoto = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toUpperCase();

        // FILTRO DE GRUPOS: El bot solo escucha mensajes directos
        if (jidRemoto.endsWith("@g.us")) return;

        let config = JSON.parse(fs.readFileSync("./config.json"));

        // PASO 4: EXTRACCIÓN DEL JID REAL DEL DUEÑO
        if (texto === "CONFIGURAR" && !config.isConfigured) {
            // Verificar que el mensaje provenga del número registrado en el Paso 2
            if (jidRemoto.includes(config.ownerNumber)) {
                config.ownerJID = jidRemoto;
                config.isConfigured = true;
                fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
                
                await sock.sendMessage(jidRemoto, { text: "✅ ID DUEÑO REGISTRADO.\n\nDesde ahora reconozco tus instrucciones." });
                console.log(`\n\x1b[1;32m[✔] DUEÑO VINCULADO: ${jidRemoto}\x1b[0m`);
            }
        }
    });
}

iniciarBot();
EOF

# 3. Lanzamiento con acceso a terminal
echo -e "\e[1;32m[+] Ejecutando Motor de Conexión...\e[0m"
node index.js
