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
NC='\033[0m' # Sin color

# Función para mostrar mensajes
mensaje() {
    echo -e "${AZUL}[COMIDABOT]${NC} $1"
}

mensaje_ok() {
    echo -e "${VERDE}[✓]${NC} $1"
}

mensaje_error() {
    echo -e "${ROJO}[✗]${NC} $1"
}

mensaje_advertencia() {
    echo -e "${AMARILLO}[!]${NC} $1"
}

mensaje_titulo() {
    echo -e "${MAGENTA}=========================================${NC}"
    echo -e "${CIAN}$1${NC}"
    echo -e "${MAGENTA}=========================================${NC}"
}

# Función para verificar si el paso anterior fue exitoso
verificar_paso() {
    if [ $? -eq 0 ]; then
        mensaje_ok "$1"
    else
        mensaje_error "$2"
        echo -e "${ROJO}La instalación se detuvo en el paso: $3${NC}"
        exit 1
    fi
}

# Función para esperar confirmación del usuario
esperar_usuario() {
    echo ""
    echo -e "${AMARILLO}Presiona ENTER para continuar...${NC}"
    read
}

# =============================================
# INICIO DE LA INSTALACIÓN
# =============================================
clear
mensaje_titulo "COMIDABOT - INSTALACIÓN EN TERMUX"
echo ""
echo -e "${BLANCO}Este instalador configurará todo lo necesario para:${NC}"
echo -e "  ${VERDE}•${NC} WhatsApp Bot con Baileys"
echo -e "  ${VERDE}•${NC} Whisper.cpp para reconocimiento de voz"
echo -e "  ${VERDE}•${NC} Base de datos SQLite"
echo -e "  ${VERDE}•${NC} Sistema de menús diarios"
echo -e "  ${VERDE}•${NC} Respuestas automáticas con spintax"
echo ""
echo -e "${AMARILLO}⚠️  IMPORTANTE:${NC}"
echo -e "  • Asegúrate de tener buena conexión a internet"
echo -e "  • No cierres Termux durante la instalación"
echo -e "  • El proceso puede tomar 10-20 minutos"
echo ""
esperar_usuario

# =============================================
# PASO 1: Actualizar Termux
# =============================================
clear
mensaje_titulo "PASO 1/12 - ACTUALIZANDO TERMUX"
# Verificación independiente: Si ya se actualizó recientemente, podemos saltar o agilizar
mensaje "Actualizando repositorios y paquetes básicos..."
pkg update -y && pkg upgrade -y
verificar_paso "Termux actualizado correctamente" "Error al actualizar Termux" "Paso 1 - Actualización"

# =============================================
# PASO 2: Instalar dependencias base
# =============================================
clear
mensaje_titulo "PASO 2/12 - INSTALANDO DEPENDENCIAS BASE"
mensaje "Instalando paquetes esenciales..."

# Verificación independiente: Solo instala si no están presentes
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

verificar_paso "Dependencias base instaladas" "Error al instalar dependencias base" "Paso 2 - Dependencias base"

# Verificar versiones instaladas
mensaje "Node.js: $(node --version)"
mensaje "npm: $(npm --version)"
mensaje "Python: $(python --version 2>&1)"

# =============================================
# PASO 3: Crear directorio del proyecto
# =============================================
clear
mensaje_titulo "PASO 3/12 - CREANDO DIRECTORIO DEL PROYECTO"

cd ~
if [ -d "comidabot" ];
then
    mensaje_ok "El directorio comidabot ya existe, omitiendo creación."
else
    mkdir -p ~/comidabot
    mensaje_ok "Directorio creado en ~/comidabot"
fi
cd ~/comidabot
verificar_paso "Acceso al directorio del proyecto" "Error al acceder al directorio" "Paso 3 - Directorio"

# =============================================
# PASO 4: Instalar Whisper.cpp
# =============================================
clear
mensaje_titulo "PASO 4/12 - INSTALANDO WHISPER.CPP (RECONOCIMIENTO DE VOZ)"

if [ -f "whisper.cpp/main" ]; then
    mensaje_ok "Whisper.cpp ya está compilado, omitiendo paso."
else
    mensaje "Clonando repositorio de Whisper.cpp..."
    git clone https://github.com/ggerganov/whisper.cpp.git
    verificar_paso "Repositorio clonado" "Error al clonar Whisper.cpp" "Paso 4 - Git clone"

    cd whisper.cpp
    mensaje "Compilando Whisper.cpp (esto puede tomar varios minutos)..."
    make -j4
    verificar_paso "Compilación completada" "Error al compilar Whisper.cpp" "Paso 4 - Compilación"

    mensaje "Descargando modelo TINY (75MB - el más liviano)..."
    bash ./models/download-ggml-model.sh tiny
    verificar_paso "Modelo TINY descargado" "Error al descargar modelo TINY" "Paso 4 - Descarga modelo"
    cd ~/comidabot
fi
mensaje_ok "Whisper.cpp configurado correctamente"

# =============================================
# PASO 5: Inicializar proyecto Node.js
# =============================================
clear
mensaje_titulo "PASO 5/12 - INICIALIZANDO PROYECTO NODE.JS"

cd ~/comidabot
if [ -f "package.json" ]; then
    mensaje_ok "package.json ya existe."
else
    npm init -y
    verificar_paso "package.json creado" "Error al crear package.json" "Paso 5 - npm init"

    # Modificar package.json para tipo módulo
    cat > package.json << 'EOF'
{
  "name": "comidabot",
  "version": "1.0.0",
  "description": "Bot de WhatsApp para comidas corridas",
  "main": "bot.js",
  "type": "module",
  "scripts": {
    "start": "node bot.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["whatsapp", "bot", "comidas"],
  "author": "",
  "license": "ISC"
}
EOF
fi
mensaje_ok "package.json configurado"

# =============================================
# PASO 6: Instalar dependencias de Node.js
# =============================================
clear
mensaje_titulo "PASO 6/12 - INSTALANDO DEPENDENCIAS NODE.JS"

if [ -d "node_modules" ]; then
    mensaje_ok "Las dependencias de Node.js ya están instaladas."
else
    mensaje "Instalando paquetes npm (esto puede tomar varios minutos)..."
    npm install @whiskeysockets/baileys pino sqlite3 node-fetch fluent-ffmpeg qrcode-terminal audio-decode
    verificar_paso "Dependencias npm instaladas" "Error al instalar dependencias npm" "Paso 6 - npm install"
fi

# =============================================
# PASO 7: Crear estructura de directorios
# =============================================
clear
mensaje_titulo "PASO 7/12 - CREANDO ESTRUCTURA DE DIRECTORIOS"

cd ~/comidabot
mkdir -p src src/baileys src/whisper src/database src/spintax src/utils auth_info logs audios
verificar_paso "Estructura de directorios lista" "Error al crear directorios" "Paso 7 - Directorios"

# =============================================
# PASO 8: Crear base de datos SQLite
# =============================================
clear
mensaje_titulo "PASO 8/12 - CREANDO BASE DE DATOS"

if [ -f "comidabot.db" ]; then
    mensaje_ok "La base de datos ya existe."
else
    cd ~/comidabot
    cat > crear_bd.sql << 'EOF'
-- Negocio
CREATE TABLE IF NOT EXISTS negocio (
    id INTEGER PRIMARY KEY DEFAULT 1,
    nombre TEXT DEFAULT 'Mi Restaurante',
    telefono TEXT,
    slogan TEXT,
    direccion TEXT
);
-- Horarios
CREATE TABLE IF NOT EXISTS horarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT,
    dia_inicio TEXT,
    dia_fin TEXT,
    hora_apertura TEXT,
    hora_cierre TEXT,
    activo BOOLEAN DEFAULT 1
);
-- Domicilio
CREATE TABLE IF NOT EXISTS domicilio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activo BOOLEAN DEFAULT 0,
    telefono_contacto TEXT,
    horario TEXT
);
-- Números para avisos
CREATE TABLE IF NOT EXISTS avisos_pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE,
    nombre TEXT,
    activo BOOLEAN DEFAULT 1,
    ultimo_aviso DATETIME,
    orden INTEGER DEFAULT 0
);
-- Desayunos diarios
CREATE TABLE IF NOT EXISTS menu_desayunos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATE,
    platillo TEXT,
    precio INTEGER,
    incluye TEXT DEFAULT 'Café o té + fruta',
    disponible BOOLEAN DEFAULT 1
);
-- Comida corrida por tiempos
CREATE TABLE IF NOT EXISTS menu_comida_tiempos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATE,
    tiempo INTEGER,
    nombre_tiempo TEXT,
    opciones TEXT,
    incluye TEXT,
    precio_total INTEGER,
    disponible BOOLEAN DEFAULT 1
);
-- Números autorizados
CREATE TABLE IF NOT EXISTS autorizados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE,
    rol TEXT DEFAULT 'dueño',
    activo BOOLEAN DEFAULT 1
);
-- Spintax (variaciones)
CREATE TABLE IF NOT EXISTS spintax (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria TEXT,
    variante TEXT
);
-- Conversaciones
CREATE TABLE IF NOT EXISTS conversaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_cliente TEXT,
    fecha DATE,
    ultimo_mensaje DATETIME,
    variaciones_usadas TEXT
);
-- Logs
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    tipo TEXT,
    mensaje TEXT
);
-- Insertar spintax inicial
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
    verificar_paso "Base de datos creada" "Error en base de datos" "Paso 8"
fi

# =============================================
# PASO 9: Crear script de configuración inicial
# =============================================
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
fi
mensaje_ok "Archivo config.json listo"

# =============================================
# PASO 10: Solicitar números y emparejamiento
# =============================================
clear
mensaje_titulo "PASO 10/12 - CONFIGURACIÓN DE NÚMEROS"

# Limpieza de búfer y bucle de espera física
NUMERO_BOT=""
while [ -z "$NUMERO_BOT" ]; do
    echo ""
    echo -e "${BLANCO}Ingresa el número del BOT (el que atenderá clientes)${NC}"
    echo -e "Formato: 5215512345678 (código de país + número sin espacios)"
    echo -e "${AMARILLO}Ejemplo: 5215551234567${NC}"
    echo -n "> "
    read NUMERO_BOT < /dev/tty
    if [ -z "$NUMERO_BOT" ]; then
        mensaje_error "El número del bot es obligatorio para continuar"
    fi
done

NUMERO_DUENO=""
while [ -z "$NUMERO_DUENO" ]; do
    echo ""
    echo -e "${BLANCO}Ingresa el número del DUEÑO (el que dará instrucciones)${NC}"
    echo -e "Formato: 5215512345678"
    echo -n "> "
    read NUMERO_DUENO < /dev/tty
    if [ -z "$NUMERO_DUENO" ]; then
        mensaje_error "El número del dueño es obligatorio para continuar"
    fi
done

# Guardar números en config.json respetando tu sed original
sed -i "s/\"numero_bot\": \"\"/\"numero_bot\": \"$NUMERO_BOT\"/" config.json
sed -i "s/\"numero_dueño\": \"\"/\"numero_dueño\": \"$NUMERO_DUENO\"/" config.json

# Insertar número de dueño en base de datos
sqlite3 comidabot.db "INSERT OR IGNORE INTO autorizados (numero, rol) VALUES ('$NUMERO_DUENO', 'dueño');"
mensaje_ok "Números guardados correctamente"

# =============================================
# PASO 11: Crear script de emparejamiento
# =============================================
clear
mensaje_titulo "PASO 11/12 - PREPARANDO EMPAREJAMIENTO WHATSAPP"

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
        console.log('2. Ve a: Menú > Dispositivos vinculados > Vincular dispositivo');
        console.log('3. Selecciona "Vincular con número de teléfono"');
        console.log('4. Ingresa este código exactamente como aparece\n');
    }, 1000);

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('\x1b[32m%s\x1b[0m', '✅ ¡EMPAREJAMIENTO EXITOSO!');
            process.exit(0);
        } else if (connection === 'close') {
            console.log('\x1b[31m%s\x1b[0m', '❌ La conexión se cerró');
            process.exit(1);
        }
    });
}
emparejar().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
EOF
mensaje_ok "Script de emparejamiento listo"

# =============================================
# PASO 12: Crear script principal del bot
# =============================================
clear
mensaje_titulo "PASO 12/12 - CREANDO SCRIPT PRINCIPAL"

cd ~/comidabot
cat > bot.js << 'EOF'
import makeWASocket from '@whiskeysockets/baileys';
import { useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const db = new sqlite3.Database(config.db_path);
const delay = (min, max) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));
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
        const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
        const isAudio = m.message.audioMessage ? true : false;
        db.get('SELECT * FROM autorizados WHERE numero = ?', [from.split('@')[0]], async (err, autorizado) => {
            if (isAudio && autorizado) {
                await sendTyping(sock, from, 5000);
                await sock.sendMessage(from, { text: '🎤 Procesando tu audio...' });
                await delay(3000, 5000);
                await sock.sendMessage(from, { text: 'Audio procesado (placeholder)' });
            } else if (!isAudio) {
                await sendTyping(sock, from, config.typing_min * 1000);
                await delay(config.delay_min * 1000, config.delay_max * 1000);
                await sock.sendMessage(from, { text: '🤖 Bot funcionando correctamente' });
            }
        });
    });
}
startBot().catch(err => console.error('Error:', err));
EOF
verificar_paso "Script principal creado" "Error al crear bot.js" "Paso 12"

# =============================================
# CREAR ARCHIVO README
# =============================================
cat > README.md << 'EOF'
# COMIDABOT - Bot de WhatsApp para Comidas Corridas

## Instalación (un solo comando)
```bash
curl -sSL [https://raw.githubusercontent.com/TU_USUARIO/comidabot/main/install.sh](https://raw.githubusercontent.com/TU_USUARIO/comidabot/main/install.sh) | bash
