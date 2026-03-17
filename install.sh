#!/bin/bash
# Limpiar la pantalla y preparar el entorno
clear
echo "===================================="
echo "  COMIVOZ - INSTALACIÓN FORZADA"
echo "===================================="

# Corregir repositorios y actualizar
echo "[1/7] Actualizando repositorios..."
pkg update -y
pkg upgrade -y

# Instalación individual para evitar bloqueos
echo "[2/7] Instalando paquetes base..."
pkg install -y wget
pkg install -y nodejs
pkg install -y ffmpeg
pkg install -y sqlite3
pkg install -y unzip

# Crear estructura limpia
echo "[3/7] Preparando carpetas..."
cd $HOME
rm -rf comivoz
mkdir -p comivoz/auth_info
cd comivoz

# Descarga del modelo de voz
echo "[4/7] Descargando modelo de voz..."
wget -O vosk.zip https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip
unzip vosk.zip
mv vosk-model-small-es-0.42 modelo-voz
rm vosk.zip

# Instalación de dependencias Node.js
echo "[5/7] Instalando dependencias de IA..."
npm init -y
npm install @whiskeysockets/baileys sqlite3 vosk fluent-ffmpeg [cite: 1, 2]

# Configuración inicial
echo "[6/7] Configuración del negocio..."
read -p "Número Dueña (10 dígitos): " DUE
read -p "Nombre Negocio: " NOM
read -p "Dirección: " DIR
read -p "Horario: " HOR

echo "{\"dueña\":\"$DUE\",\"nombre\":\"$NOM\",\"direccion\":\"$DIR\",\"horario\":\"$HOR\"}" > config.json

# Inicialización de Base de Datos
echo "[7/7] Creando base de datos..."
sqlite3 comida.db "CREATE TABLE IF NOT EXISTS desayunos (id INTEGER PRIMARY KEY, nombre TEXT, precio INTEGER, disponible INTEGER DEFAULT 1); 
CREATE TABLE IF NOT EXISTS primer_tiempo (id INTEGER PRIMARY KEY, nombre TEXT, disponible INTEGER DEFAULT 1); 
CREATE TABLE IF NOT EXISTS segundo_tiempo (id INTEGER PRIMARY KEY, nombre TEXT, disponible INTEGER DEFAULT 1); 
CREATE TABLE IF NOT EXISTS tercer_tiempo (id INTEGER PRIMARY KEY, nombre TEXT, disponible INTEGER DEFAULT 1); 
CREATE TABLE IF NOT EXISTS bebida (id INTEGER PRIMARY KEY, nombre TEXT, disponible INTEGER DEFAULT 1); 
CREATE TABLE IF NOT EXISTS postre (id INTEGER PRIMARY KEY, nombre TEXT, disponible INTEGER DEFAULT 1); 
CREATE TABLE IF NOT EXISTS precio_comida (id INTEGER PRIMARY KEY, precio INTEGER); 
CREATE TABLE IF NOT EXISTS domicilio (id INTEGER PRIMARY KEY, activo INTEGER DEFAULT 0, telefono TEXT);" [cite: 32, 33, 34, 35, 36, 37, 38]

echo "===================================="
echo "✅ INSTALACIÓN EXITOSA"
echo "Escribe 'node bot.js' para empezar"
echo "===================================="
