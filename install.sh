#!/bin/bash

# ====================================
# COMIVOZ - INSTALACIÓN COMPLETA (RESTAURADA)
# ====================================

# Limpieza inicial de pantalla
clear
echo "===================================="
echo "  COMIVOZ - INSTALACIÓN COMPLETA"
echo "  Todo incluido: Voz + WhatsApp + DB"
echo "===================================="

# [1/7] Actualización y Repositorios
echo "[1/7] Configurando Termux..."
pkg update -y
pkg upgrade -y

# [2/7] Instalación de todas las dependencias necesarias 
echo "[2/7] Instalando herramientas base..."
pkg install -y nodejs ffmpeg wget sqlite3 unzip

# [3/7] Estructura de archivos 
echo "[3/7] Creando carpetas de sistema..."
mkdir -p comivoz/auth_info
mkdir -p comivoz/database
cd comivoz

# [4/7] Descarga y configuración del modelo de voz 
echo "[4/7] Configurando reconocimiento de voz (Vosk)..."
# Usamos un método de descarga más robusto para que no se corte
if [ ! -d "modelo-voz" ]; then
    wget -O vosk.zip https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip
    unzip vosk.zip
    mv vosk-model-small-es-0.42 modelo-voz
    rm vosk.zip
fi

# [5/7] Instalación de librerías Node.js 
echo "[5/7] Instalando dependencias de IA y WhatsApp..."
npm init -y
npm install @whiskeysockets/baileys sqlite3 vosk fluent-ffmpeg

# [6/7] Configuración de negocio (Recuperada) [cite: 31, 32]
echo ""
echo "--- CONFIGURACIÓN DEL SISTEMA ---"
read -p "Número de la dueña (10 dígitos): " DUEÑA
read -p "Número del bot (10 dígitos): " BOT
read -p "Nombre del negocio: " NOMBRE
read -p "Dirección: " DIR
read -p "Horario: " HORARIO

# Generación del JSON con todos los campos necesarios 
cat > config.json << EOF
{
  "dueña": "$DUEÑA",
  "bot": "$BOT",
  "nombre": "$NOMBRE",
  "direccion": "$DIR",
  "horario": "$HORARIO",
  "domicilio": false
}
EOF

# [7/7] Base de datos completa (Todas las tablas restauradas) [cite: 32, 33, 34, 35, 36, 37, 38]
echo "[7/7] Inicializando base de datos completa..."
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

echo ""
echo "===================================="
echo "✅ INSTALACIÓN FINALIZADA"
echo "===================================="
echo "Para iniciar el sistema de voz y WhatsApp:"
echo "node bot.js"
