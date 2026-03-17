#!/data/data/com.termux/files/usr/bin/bash

# =============================================
# INSTALADOR DE COMIDABOT PARA TERMUX
# Versión: 1.0
# =============================================

# Colores para mensajes
ROJO='\033[0;31m'
VERDE='\033[0;32m'
AMARILLO='\033[1;33m'
AZUL='\033[0;34m'
MAGENTA='\033[0;35m'
CIAN='\033[0;36m'
BLANCO='\033[1;37m'
NC='\033[0m'

# Archivo de estado
ARCHIVO_ESTADO="$HOME/comidabot/instalacion_estado.txt"
PASO_ACTUAL=0

if [ -f "$ARCHIVO_ESTADO" ]; then
    PASO_ACTUAL=$(cat "$ARCHIVO_ESTADO")
fi

# Funciones base
mensaje() { echo -e "${AZUL}[COMIDABOT]${NC} $1"; }
mensaje_ok() { echo -e "${VERDE}[✓]${NC} $1"; }
mensaje_error() { echo -e "${ROJO}[✗]${NC} $1"; }
mensaje_advertencia() { echo -e "${AMARILLO}[!]${NC} $1"; }

mensaje_titulo() {
    echo -e "${MAGENTA}=========================================${NC}"
    echo -e "${CIAN}$1${NC}"
    echo -e "${MAGENTA}=========================================${NC}"
}

verificar_paso() {
    if [ $? -eq 0 ]; then
        mensaje_ok "$1"
    else
        mensaje_error "$2"
        echo -e "${ROJO}La instalación se detuvo en el paso: $3${NC}"
        exit 1
    fi
}

esperar_usuario() {
    echo ""
    echo -e "${AMARILLO}Presiona ENTER para continuar...${NC}"
    read
}

actualizar_estado() {
    echo "$1" > "$ARCHIVO_ESTADO"
    PASO_ACTUAL=$1
}

# =============================================
# INICIO
# =============================================
if [ "$PASO_ACTUAL" -lt 1 ]; then
    clear
    mensaje_titulo "COMIDABOT - INSTALACIÓN EN TERMUX"
    echo ""
    echo -e "${BLANCO}Este instalador configurará:${NC}"
    echo -e "  ${VERDE}•${NC} WhatsApp Bot con Baileys"
    echo -e "  ${VERDE}•${NC} Whisper.cpp para reconocimiento de voz"
    echo -e "  ${VERDE}•${NC} Base de datos SQLite"
    echo -e "  ${VERDE}•${NC} Sistema de menús diarios"
    echo -e "  ${VERDE}•${NC} Respuestas automáticas con spintax"
    echo ""
    echo -e "${AMARILLO}⚠️  IMPORTANTE:${NC}"
    echo -e "  • Buena conexión a internet"
    echo -e "  • No cierres Termux"
    echo -e "  • Tiempo estimado: 10-20 minutos"
    echo ""
    esperar_usuario
fi

# =============================================
# PASO 1
# =============================================
if [ "$PASO_ACTUAL" -lt 1 ]; then
    clear
    mensaje_titulo "PASO 1/12 - ACTUALIZANDO TERMUX"
    mensaje "Actualizando repositorios y paquetes básicos..."
    pkg update -y && pkg upgrade -y
    verificar_paso "Termux actualizado" "Error al actualizar Termux" "Paso 1"
    actualizar_estado 1
else
    mensaje_ok "Paso 1 ya completado"
fi

# =============================================
# PASO 2
# =============================================
if [ "$PASO_ACTUAL" -lt 2 ]; then
    clear
    mensaje_titulo "PASO 2/12 - INSTALANDO DEPENDENCIAS BASE"
    mensaje "Instalando paquetes esenciales..."

    pkg install -y \
        nodejs \
        python \
        git \
        wget \
        curl \
        build-essential \
        cmake \
        ffmpeg \
        imagemagick \
        openssl \
        sqlite \
        nano

    verificar_paso "Dependencias base instaladas" "Error al instalar dependencias base" "Paso 2"

    mensaje "Node.js: $(node --version)"
    mensaje "npm: $(npm --version)"
    mensaje "Python: $(python --version 2>&1)"
    actualizar_estado 2
else
    mensaje_ok "Paso 2 ya completado"
fi

# =============================================
# PASO 3 - CORREGIDO (sin preguntas)
# =============================================
if [ "$PASO_ACTUAL" -lt 3 ]; then
    clear
    mensaje_titulo "PASO 3/12 - CREANDO DIRECTORIO DEL PROYECTO"

    cd ~
    if [ ! -d "comidabot" ]; then
        mkdir -p ~/comidabot
        mensaje_ok "Directorio creado en ~/comidabot"
    else
        mensaje_advertencia "El directorio comidabot ya existe. Continuando..."
    fi
    cd ~/comidabot
    actualizar_estado 3
else
    cd ~/comidabot 2>/dev/null || mkdir -p ~/comidabot && cd ~/comidabot
fi

# =============================================
# PASO 4
# =============================================
if [ "$PASO_ACTUAL" -lt 4 ]; then
    clear
    mensaje_titulo "PASO 4/12 - INSTALANDO WHISPER.CPP"

    if [ -f "whisper.cpp/main" ] && [ -f "whisper.cpp/models/ggml-tiny.bin" ]; then
        mensaje_ok "Whisper.cpp ya está instalado"
    else
        if [ ! -d "whisper.cpp" ]; then
            git clone https://github.com/ggerganov/whisper.cpp.git
            verificar_paso "Repositorio clonado" "Error al clonar" "Paso 4 - Git"
        fi

        cd whisper.cpp

        if [ ! -f "main" ]; then
            make -j4
            verificar_paso "Compilación completada" "Error al compilar" "Paso 4 - Compilación"
        fi

        if [ ! -f "models/ggml-tiny.bin" ]; then
            bash ./models/download-ggml-model.sh tiny
            verificar_paso "Modelo TINY descargado" "Error al descargar" "Paso 4 - Modelo"
        fi

        cd ~/comidabot
    fi
    actualizar_estado 4
else
    mensaje_ok "Paso 4 ya completado"
fi

# =============================================
# PASO 5
# =============================================
if [ "$PASO_ACTUAL" -lt 5 ]; then
    clear
    mensaje_titulo "PASO 5/12 - INICIALIZANDO PROYECTO NODE.JS"

    cd ~/comidabot

    if [ ! -f "package.json" ]; then
        npm init -y
        verificar_paso "package.json creado" "Error al crear package.json" "Paso 5"
    fi

    cat > package.json << 'EOF'
{
  "name": "comidabot",
  "version": "1.0.0",
  "description": "Bot de WhatsApp para comidas corridas",
  "main": "bot.js",
  "type": "module",
  "scripts": {
    "start": "node bot.js"
  }
}
EOF

    mensaje_ok "package.json configurado"
    actualizar_estado 5
else
    mensaje_ok "Paso 5 ya completado"
fi

# =============================================
# PASO 6
# =============================================
if [ "$PASO_ACTUAL" -lt 6 ]; then
    clear
    mensaje_titulo "PASO 6/12 - INSTALANDO DEPENDENCIAS NODE.JS"

    cd ~/comidabot

    npm install @whiskeysockets/baileys
    npm install pino
    npm install sqlite3
    npm install node-fetch
    npm install fluent-ffmpeg
    npm install qrcode-terminal
    npm install audio-decode

    verificar_paso "Dependencias instaladas" "Error en npm" "Paso 6"
    actualizar_estado 6
else
    mensaje_ok "Paso 6 ya completado"
fi

# =============================================
# PASO 7
# =============================================
if [ "$PASO_ACTUAL" -lt 7 ]; then
    clear
    mensaje_titulo "PASO 7/12 - CREANDO ESTRUCTURA DE DIRECTORIOS"

    cd ~/comidabot
    mkdir -p src
    mkdir -p src/baileys
    mkdir -p src/whisper
    mkdir -p src/database
    mkdir -p src/spintax
    mkdir -p src/utils
    mkdir -p auth_info
    mkdir -p logs
    mkdir -p audios

    mensaje_ok "Directorios creados"
    actualizar_estado 7
else
    mensaje_ok "Paso 7 ya completado"
fi

# =============================================
# PASO 8
# =============================================
if [ "$PASO_ACTUAL" -lt 8 ]; then
    clear
    mensaje_titulo "PASO 8/12 - CREANDO BASE DE DATOS"

    cd ~/comidabot

    if [ ! -f "comidabot.db" ]; then
        cat > crear_bd.sql << 'EOF'
CREATE TABLE IF NOT EXISTS negocio (id INTEGER PRIMARY KEY DEFAULT 1, nombre TEXT DEFAULT 'Mi Restaurante', telefono TEXT, slogan TEXT, direccion TEXT);
CREATE TABLE IF NOT EXISTS horarios (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT, dia_inicio TEXT, dia_fin TEXT, hora_apertura TEXT, hora_cierre TEXT, activo BOOLEAN DEFAULT 1);
CREATE TABLE IF NOT EXISTS domicilio (id INTEGER PRIMARY KEY AUTOINCREMENT, activo BOOLEAN DEFAULT 0, telefono_contacto TEXT, horario TEXT);
CREATE TABLE IF NOT EXISTS avisos_pedidos (id INTEGER PRIMARY KEY AUTOINCREMENT, numero TEXT UNIQUE, nombre TEXT, activo BOOLEAN DEFAULT 1, ultimo_aviso DATETIME, orden INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS menu_desayunos (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha DATE, platillo TEXT, precio INTEGER, incluye TEXT DEFAULT 'Café o té + fruta', disponible BOOLEAN DEFAULT 1);
CREATE TABLE IF NOT EXISTS menu_comida_tiempos (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha DATE, tiempo INTEGER, nombre_tiempo TEXT, opciones TEXT, incluye TEXT, precio_total INTEGER, disponible BOOLEAN DEFAULT 1);
CREATE TABLE IF NOT EXISTS autorizados (id INTEGER PRIMARY KEY AUTOINCREMENT, numero TEXT UNIQUE, rol TEXT DEFAULT 'dueño', activo BOOLEAN DEFAULT 1);
CREATE TABLE IF NOT EXISTS spintax (id INTEGER PRIMARY KEY AUTOINCREMENT, categoria TEXT, variante TEXT);
CREATE TABLE IF NOT EXISTS conversaciones (id INTEGER PRIMARY KEY AUTOINCREMENT, numero_cliente TEXT, fecha DATE, ultimo_mensaje DATETIME, variaciones_usadas TEXT);
CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, tipo TEXT, mensaje TEXT);
INSERT INTO spintax (categoria, variante) VALUES 
('saludo', '{☀️|🌅|🙌|🌞|🌤️} {BUENOS DÍAS|BUEN DÍA|Muy buenos días|QUÉ TAL}'),
('saludo_tarde', '{🌤️|☀️|🌞} {BUENAS TARDES|BUENA TARDE|QUÉ TAL}'),
('saludo_noche', '{🌙|✨|🌆} {BUENAS NOCHES|BUENA NOCHE}'),
('icono_platillo', '{🥚|🍳|🌮|🍽️|🥘}'),
('icono_dinero', '{💰|💵|💲|🪙|💸}'),
('bebida', '{☕ Café|🧋 Café|🫖 Té|🍵 Té}'),
('fruta', '{🍉 fruta|🍍 fruta|🍈 fruta|🍊 fruta|🍓 fruta}'),
('incluye', '{Incluye:|Todo incluye:|Acompañado de:}'),
('espera', '{un momentito|espera|solo un segundo|ahora sigo|continuamos}'),
('confirmacion_si', '{Sí|Está bien|Ok|Perfecto|Dale|Sale}'),
('confirmacion_no', '{No|Nel|No gracias|Mejor no}');
EOF
        sqlite3 comidabot.db < crear_bd.sql
        verificar_paso "Base de datos creada" "Error al crear BD" "Paso 8"
    else
        mensaje_ok "Base de datos ya existe"
    fi
    actualizar_estado 8
else
    mensaje_ok "Paso 8 ya completado"
fi

# =============================================
# PASO 9
# =============================================
if [ "$PASO_ACTUAL" -lt 9 ]; then
    clear
    mensaje_titulo "PASO 9/12 - CONFIGURACIÓN INICIAL"

    cd ~/comidabot

    if [ ! -f "config.json" ]; then
        cat > config.json << 'EOF'
{
    "numero_bot": "",
    "numero_dueño": "",
    "whisper_path": "./whisper.cpp/main",
    "whisper_model": "./whisper.cpp/models/ggml-tiny.bin",
    "delay_min": 5,
    "delay_max": 10,
    "typing_min": 3,
    "typing_max": 7,
    "db_path": "./comidabot.db"
}
EOF
        mensaje_ok "Archivo config.json creado"
    else
        mensaje_ok "config.json ya existe"
    fi
    actualizar_estado 9
else
    mensaje_ok "Paso 9 ya completado"
fi

# =============================================
# PASO 10 - CORREGIDO (AHORA ESPERA)
# =============================================
if [ "$PASO_ACTUAL" -lt 10 ]; then
    clear
    mensaje_titulo "PASO 10/12 - CONFIGURACIÓN DE NÚMEROS"

    cd ~/comidabot

    echo ""
    echo "========================================="
    echo "CONFIGURACIÓN DE NÚMEROS DE TELÉFONO"
    echo "========================================="
    echo ""
    echo "📱 Ingresa los números en formato: 5215512345678"
    echo "   (código de país + número sin espacios)"
    echo "   Ejemplo: 5215551234567"
    echo ""

    # Número del BOT
    while true; do
        echo -e "${BLANCO}Número del BOT (atenderá clientes):${NC}"
        echo -n "> "
        read NUMERO_BOT
        if [ -n "$NUMERO_BOT" ] && [[ "$NUMERO_BOT" =~ ^[0-9]+$ ]]; then
            break
        else
            echo -e "${AMARILLO}❌ Número inválido. Solo dígitos, no vacío.${NC}"
        fi
    done

    echo ""

    # Número del DUEÑO
    while true; do
        echo -e "${BLANCO}Número del DUEÑO (dará instrucciones):${NC}"
        echo -n "> "
        read NUMERO_DUENO
        if [ -n "$NUMERO_DUENO" ] && [[ "$NUMERO_DUENO" =~ ^[0-9]+$ ]]; then
            break
        else
            echo -e "${AMARILLO}❌ Número inválido. Solo dígitos, no vacío.${NC}"
        fi
    done

    # Guardar
    sed -i "s/\"numero_bot\": \"\"/\"numero_bot\": \"$NUMERO_BOT\"/" config.json
    sed -i "s/\"numero_dueño\": \"\"/\"numero_dueño\": \"$NUMERO_DUENO\"/" config.json
    sqlite3 comidabot.db "INSERT OR IGNORE INTO autorizados (numero, rol) VALUES ('$NUMERO_DUENO', 'dueño');"

    echo ""
    mensaje_ok "Números guardados: Bot: $NUMERO_BOT | Dueño: $NUMERO_DUENO"
    actualizar_estado 10
else
    mensaje_ok "Paso 10 ya completado"
fi

# =============================================
# PASO 11
# =============================================
if [ "$PASO_ACTUAL" -lt 11 ]; then
    clear
    mensaje_titulo "PASO 11/12 - EMPAREJAMIENTO WHATSAPP"

    cd ~/comidabot

    cat > emparejar.js << 'EOF'
import makeWASocket from '@whiskeysockets/baileys';
import { useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const numeroBot = config.numero_bot;

async function emparejar() {
    console.log('\x1b[36m%s\x1b[0m', '=========================================');
    console.log('\x1b[35m%s\x1b[0m', 'EMPAREJAMIENTO DE WHATSAPP BOT');
    console.log('\x1b[36m%s\x1b[0m', '=========================================');
    console.log(`Número del Bot: ${numeroBot}\n`);

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
    });

    setTimeout(async () => {
        const code = await sock.requestPairingCode(numeroBot);
        console.log('\x1b[32m%s\x1b[0m', '🔑 CÓDIGO DE EMPAREJAMIENTO:');
        console.log('\x1b[33m%s\x1b[0m', '=========================================');
        console.log('\x1b[1;37m%s\x1b[0m', code);
        console.log('\x1b[33m%s\x1b[0m', '=========================================');
        console.log('\n📲 INSTRUCCIONES:');
        console.log('1. Abre WhatsApp en el teléfono del BOT');
        console.log('2. Menú > Dispositivos vinculados > Vincular dispositivo');
        console.log('3. Selecciona "Vincular con número de teléfono"');
        console.log('4. Ingresa este código exactamente como aparece\n');
    }, 1000);

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('\x1b[32m%s\x1b[0m', '✅ ¡EMPAREJAMIENTO EXITOSO!');
            process.exit(0);
        }
    });
}

emparejar().catch(console.error);
EOF

    mensaje_ok "Script de emparejamiento creado"
    actualizar_estado 11
else
    mensaje_ok "Paso 11 ya completado"
fi

# =============================================
# PASO 12
# =============================================
if [ "$PASO_ACTUAL" -lt 12 ]; then
    clear
    mensaje_titulo "PASO 12/12 - SCRIPT PRINCIPAL"

    cd ~/comidabot

    cat > bot.js << 'EOF'
import makeWASocket from '@whiskeysockets/baileys';
import { useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import sqlite3 from 'sqlite3';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const db = new sqlite3.Database(config.db_path);

const delay = (min, max) => new Promise(resolve => 
    setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min))
);

const sendTyping = async (sock, jid, time) => {
    await sock.sendPresenceUpdate('composing', jid);
    await delay(time, time);
};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const from = m.key.remoteJid;
        const isAudio = m.message.audioMessage ? true : false;
        db.get('SELECT * FROM autorizados WHERE numero = ?', [from.split('@')[0]], async (err, autorizado) => {
            if (isAudio && autorizado) {
                await sendTyping(sock, from, 5000);
                await sock.sendMessage(from, { text: '🎤 Audio recibido' });
            } else if (!isAudio) {
                await sendTyping(sock, from, config.typing_min * 1000);
                await delay(config.delay_min * 1000, config.delay_max * 1000);
                await sock.sendMessage(from, { text: '🤖 Bot funcionando' });
            }
        });
    });
    console.log('🤖 Bot iniciado');
}

startBot().catch(console.error);
EOF

    verificar_paso "Script principal creado" "Error" "Paso 12"
    actualizar_estado 12
else
    mensaje_ok "Paso 12 ya completado"
fi

# =============================================
# FINAL
# =============================================
clear
mensaje_titulo "✅ INSTALACIÓN COMPLETADA"

echo -e "${VERDE}¡Todo listo!${NC}\n"
echo -e "${BLANCO}Resumen:${NC}"
echo -e "  • Termux actualizado"
echo -e "  • Dependencias base"
echo -e "  • Whisper.cpp (modelo TINY)"
echo -e "  • Proyecto Node.js"
echo -e "  • Base de datos SQLite"
echo ""

echo -e "${AMARILLO}📱 PRÓXIMOS PASOS:${NC}"
echo -e "1. Se mostrará el código de emparejamiento"
echo -e "2. Vincular WhatsApp"
echo -e "3. Bot listo"
echo ""
esperar_usuario

clear
mensaje_titulo "🔑 EMPAREJANDO WHATSAPP BOT"
cd ~/comidabot
node emparejar.js

clear
mensaje_titulo "🚀 INICIANDO BOT"
cd ~/comidabot
node bot.js
