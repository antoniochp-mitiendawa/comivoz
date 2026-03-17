#!/bin/bash

# ====================================
# COMIVOZ - INSTALACIÓN COMPLETA
# Un solo comando - TODO INCLUIDO
# ====================================

# Limpiar caracteres Windows si existen
sed -i 's/\r$//' "$0"

clear
echo "===================================="
echo "  COMIVOZ - INSTALACIÓN COMPLETA"
echo "  Un solo comando - TODO INCLUIDO"
echo "===================================="
echo ""

echo "[1/7] Configurando Termux..."
termux-setup-storage
pkg update -y
pkg upgrade -y

echo "[2/7] Instalando lo necesario..."
pkg install -y nodejs ffmpeg wget

echo "[3/7] Creando carpetas..."
mkdir -p comivoz
cd comivoz
mkdir -p database
mkdir -p auth_info

echo "[4/7] Descargando modelo de voz..."
wget -O vosk.zip https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip
unzip vosk.zip
rm vosk.zip
mv vosk-model-small-es-0.42 modelo-voz

echo "[5/7] Instalando dependencias..."
npm init -y
npm install @whiskeysockets/baileys sqlite3 vosk fluent-ffmpeg

echo "[6/7] Configuración inicial"
echo "------------------------"
read -p "Número de la dueña (10 dígitos): " DUEÑA
read -p "Número del bot (10 dígitos): " BOT
read -p "Nombre del negocio: " NOMBRE
read -p "Dirección: " DIR
read -p "Horario: " HORARIO

cat > config.json << EOF
{
  "dueña": "$DUEÑA",
  "bot": "$BOT",
  "nombre": "$NOMBRE",
  "direccion": "$DIR",
  "horario": "$HORARIO",
  "domicilio": false,
  "domicilio_tel": ""
}
EOF

echo "[7/7] Creando base de datos..."
sqlite3 comida.db << SQL
CREATE TABLE desayunos (id INTEGER PRIMARY KEY, nombre TEXT, precio INTEGER, disponible INTEGER DEFAULT 1);
CREATE TABLE primer_tiempo (id INTEGER PRIMARY KEY, nombre TEXT, disponible INTEGER DEFAULT 1);
CREATE TABLE segundo_tiempo (id INTEGER PRIMARY KEY, nombre TEXT, disponible INTEGER DEFAULT 1);
CREATE TABLE tercer_tiempo (id INTEGER PRIMARY KEY, nombre TEXT, disponible INTEGER DEFAULT 1);
CREATE TABLE bebida (id INTEGER PRIMARY KEY, nombre TEXT, disponible INTEGER DEFAULT 1);
CREATE TABLE postre (id INTEGER PRIMARY KEY, nombre TEXT, disponible INTEGER DEFAULT 1);
CREATE TABLE precio_comida (id INTEGER PRIMARY KEY, precio INTEGER);
CREATE TABLE domicilio (id INTEGER PRIMARY KEY, activo INTEGER DEFAULT 0, telefono TEXT);
SQL

echo ""
echo "===================================="
echo "✅ TODO LISTO"
echo "===================================="
echo ""

echo "Ahora ve a WhatsApp > Dispositivos vinculados"
echo "Presiona ENTER cuando estés listo"
read

node -e "
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
async function main() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ auth: state, browser: ['ComiVoz', 'Safari', '1.0.0'] });
  sock.ev.on('creds.update', saveCreds);
  setTimeout(() => {
    console.log('\\n🔑 CÓDIGO: ' + state.creds.registrationId);
    process.exit(0);
  }, 5000);
}
main();
"
