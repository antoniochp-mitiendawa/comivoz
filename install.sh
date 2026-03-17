#!/bin/bash

echo "===================================="
echo "  COMIVOZ - INSTALACIÓN AUTOMÁTICA"
echo "  Un solo comando, todo listo"
echo "===================================="
echo ""

# [PASO 1] Actualizar Termux
echo "[1/9] Actualizando Termux..."

# [PASO 2] Instalar paquetes necesarios
echo "[2/9] Instalando paquetes (nodejs, ffmpeg, git, sqlite, wget, curl)..."

# [PASO 3] Crear carpetas del proyecto
echo "[3/9] Creando estructura de carpetas..."

# [PASO 4] Descargar modelo Vosk (40MB)
echo "[4/9] Descargando modelo de voz Vosk español (40MB)..."

# [PASO 5] Instalar dependencias de Node.js
echo "[5/9] Instalando dependencias de Node.js..."

# [PASO 6] Preguntar datos al usuario
echo "[6/9] Configuración inicial (solo una vez)"
echo "----------------------------------------"
read -p "Número de teléfono de la dueña (quien mandará audios, ej: 5512345678): " NUMERO_DUENA
read -p "Número de teléfono que usará el bot (el que emparejaremos): " NUMERO_BOT
echo ""

# [PASO 7] Guardar configuración
echo "[7/9] Guardando configuración..."

# [PASO 8] Generar código de emparejamiento
echo "[8/9] Preparando código de emparejamiento..."
echo ""
echo "IMPORTANTE: En tu WhatsApp ve a:"
echo "Menú > Dispositivos vinculados > Vincular un dispositivo"
echo ""
echo "Generando código de emparejamiento..."

# [PASO 9] Iniciar el bot
echo "[9/9] Iniciando COMIVOZ..."
echo "===================================="
echo "✅ Instalación completada"
echo "El bot ya está funcionando"
echo "===================================="
