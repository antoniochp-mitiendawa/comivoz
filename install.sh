#!/bin/bash
# COMIVOZ - INSTALADOR NATIVO TERMUX

# 1. Limpieza radical de caracteres Windows y configuración de entorno
sed -i 's/\r$//' "$0" 2>/dev/null
clear
echo "===================================="
echo "  COMIVOZ - INSTALACIÓN MAESTRA"
echo "===================================="

# 2. Forzar actualización de repositorios y herramientas de compilación
echo "[1/7] Actualizando sistema (Modo Agresivo)..."
pkg update -y -o Dpkg::Options::="--force-confold"
pkg upgrade -y -o Dpkg::Options::="--force-confold"
pkg install -y nodejs-lts python build-essential ffmpeg wget sqlite3 unzip

# 3. Estructura de archivos respetando tu diseño original
echo "[2/7] Creando directorios..."
cd $HOME
rm -rf comivoz # Limpiar instalación previa fallida
mkdir -p comivoz/auth_info
mkdir -p comivoz/database
cd comivoz

# 4. Descarga del modelo de voz (Vosk) - Integridad Total
echo "[3/7] Descargando modelo de voz..."
if [ ! -d "modelo-voz" ]; then
    wget -q --show-progress -O vosk.zip https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip
    unzip -q vosk.zip
    mv vosk-model-small-es-0.42 modelo-voz
    rm vosk.zip
fi

# 5. Instalación de dependencias de Node.js
echo "[4/7] Instalando Baileys, SQLite3 y Vosk..."
npm init -y
npm install @whiskeysockets/baileys sqlite3 vosk fluent-ffmpeg readline

# 6. Configuración inicial (Solo teléfono del bot)
echo ""
echo "--- VINCULACIÓN ---"
read -p "Introduce el número que usará el BOT (ej. 521XXXXXXXXXX): " NUM_BOT

# Crear config inicial con el número
echo "{\"bot\":\"$NUM_BOT\",\"dueña\":\"\",\"nombre\":\"\",\"direccion\":\"\",\"horario\":\"\",\"domicilio\":false}" > config.json

# 7. Base de datos (Todas tus tablas restauradas)
echo "[5/7] Inicializando Base de Datos..."
sqlite3 comida.db << SQL
CREATE TABLE IF NOT EXISTS desayunos (id INTEGER PRIMARY KEY, nombre TEXT, precio INTEGER, disponible INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS primer_tiempo (id INTEGER PRIMARY KEY, nombre TEXT, disponible INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS segundo_tiempo (id INTEGER PRIMARY KEY, nombre TEXT, disponible INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS tercer_tiempo (id INTEGER PRIMARY KEY, nombre TEXT, disponible INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS bebida (id INTEGER PRIMARY KEY, nombre TEXT, disponible INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS postre (id INTEGER PRIMARY KEY, nombre TEXT, disponible INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS precio_comida (id INTEGER PRIMARY KEY, precio INTEGER);
CREATE TABLE IF NOT EXISTS domicilio (id INTEGER PRIMARY KEY, activo INTEGER DEFAULT 0, telefono TEXT);
SQL

echo "===================================="
echo "✅ INSTALACIÓN BASE COMPLETA"
echo "Ejecuta: node bot.js"
echo "===================================="
