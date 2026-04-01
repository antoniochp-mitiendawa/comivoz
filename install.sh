#!/data/data/com.termux/files/usr/bin/bash

echo "---------------------------------------------------------"
echo "INSTALADOR INTEGRAL COMIDABOT - MODO SECUENCIAL"
echo "---------------------------------------------------------"

# FASE 1: Entorno de Sistema (Blindado)
pkg update -y && pkg upgrade -y
pkg install -y nodejs git python python-pip wget proot-distro build-essential sqlite

# Reparación de compatibilidad Python 3.13
pip install setuptools --break-system-packages

# FASE 2: IA LOCAL (Ollama en Ubuntu)
if [ ! -d "$HOME/.proot-distro/installed-rootfs/ubuntu" ]; then
    proot-distro install ubuntu
fi
proot-distro login ubuntu -- bash -c "curl -fsSL https://ollama.com/install.sh | sh"
proot-distro login ubuntu -- bash -c "ollama serve > /dev/null 2>&1 & sleep 10 && ollama pull llama3.2:1b"

# FASE 3: Instalación de Node Modules
cd $HOME/comidabot
rm -rf node_modules package-lock.json
npm install --no-bin-links --ignore-scripts
npm install baileys pino dotenv @hapi/boom ollama

# FASE 4: Captura de Datos Inicial
echo "---------------------------------------------------------"
read -p "Introduce el número del BOT (ej. 521XXXXXXXXXX): " BOT_PHONE
read -p "Introduce el número del DUEÑO (ej. 521XXXXXXXXXX): " OWNER_PHONE

echo "OWNER_RAW_NUMBER=$OWNER_PHONE" > .env
echo "BOT_NUMBER=$BOT_PHONE" >> .env

echo "---------------------------------------------------------"
echo "INSTALACIÓN COMPLETADA. INICIANDO VINCULACIÓN..."
node index.js
