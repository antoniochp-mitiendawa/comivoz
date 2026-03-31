#!/data/data/com.termux/files/usr/bin/bash

# =========================================================
# SCRIPT DE INSTALACIÓN MAESTRO - PROYECTO: COMIDABOT
# =========================================================
# 1. Sistema -> 2. IA (Ollama) -> 3. Librerías -> 4. Vinculación
# =========================================================

echo "---------------------------------------------------------"
echo "INICIANDO INSTALACIÓN TOTAL DE COMIDABOT"
echo "---------------------------------------------------------"

# --- FASE 1: ACTUALIZACIÓN Y HERRAMIENTAS BASE ---
echo "[1/4] Actualizando repositorios y paquetes base..."
pkg update -y && pkg upgrade -y
pkg install -y nodejs git python wget proot-distro
termux-setup-storage

# --- FASE 2: MOTOR DE IA LOCAL (OLLAMA) ---
echo "[2/4] Configurando entorno de IA Local (Ollama)..."
# Instalamos el contenedor de Ubuntu para estabilidad de la IA
if [ ! -d "$HOME/.proot-distro/installed-rootfs/ubuntu" ]; then
    proot-distro install ubuntu
fi

# Instalación de Ollama dentro del contenedor
echo "Instalando servidor de IA..."
proot-distro login ubuntu -- bash -c "curl -fsSL https://ollama.com/install.sh | sh"

# Descarga del modelo (Llama 3.2 1B - Optimizado para móviles)
echo "Descargando modelo de lenguaje (esto puede tardar según tu internet)..."
proot-distro login ubuntu -- bash -c "ollama serve > /dev/null 2>&1 & sleep 8 && ollama pull llama3.2:1b"

# --- FASE 3: LIBRERÍAS DE WHATSAPP Y DEPENDENCIAS ---
echo "[3/4] Instalando librerías de Node.js y Baileys..."
# Entramos a la carpeta del proyecto (comidabot)
cd $HOME/comidabot
npm install -g npm@latest
npm install

# --- FASE 4: VINCULACIÓN Y CONFIGURACIÓN DE DUEÑO ---
echo "---------------------------------------------------------"
echo "INSTALACIÓN COMPLETADA CON ÉXITO"
echo "---------------------------------------------------------"
echo "Iniciando fase de emparejamiento..."
echo ""

# 1. Pedir número del BOT
read -p "Introduce el número que será el BOT (ej. 521XXXXXXXXXX): " BOT_PHONE

# 2. Pedir número del DUEÑO
read -p "Introduce el número del DUEÑO (ej. 521XXXXXXXXXX): " OWNER_PHONE

# Guardamos los números en el archivo de entorno .env para que el bot los use
echo "OWNER_RAW_NUMBER=$OWNER_PHONE" > .env
echo "BOT_NUMBER=$BOT_PHONE" >> .env
echo "DATABASE_PATH='./database/memory.sqlite'" >> .env

# 3. Generar Código de Emparejamiento
echo ""
echo "ATENCIÓN: En unos segundos aparecerá un CÓDIGO DE 8 DÍGITOS."
echo "Ve a tu WhatsApp -> Dispositivos vinculados -> Vincular con código."
echo "Introduce el código que verás a continuación."
echo "---------------------------------------------------------"

# Ejecutamos el bot en modo vinculación
node index.js --pairing

# 4. Instrucción final de activación de ID técnico
echo ""
echo "---------------------------------------------------------"
echo "¡VINCULACIÓN INICIAL REALIZADA!"
echo "---------------------------------------------------------"
echo "Para que el bot reconozca tu ID técnico de WhatsApp:"
echo "Desde el número del DUEÑO ($OWNER_PHONE), envía un mensaje"
echo "al número del BOT ($BOT_PHONE) que diga exactamente:"
echo ""
echo "   ACTIVAR CONFIGURACION"
echo ""
echo "Esto registrará tu identidad de forma permanente en la memoria."
echo "---------------------------------------------------------"

# Iniciamos el proceso final para capturar el mensaje del dueño
node index.js --setup-admin
