#!/data/data/com.termux/files/usr/bin/bash

# =========================================================
# SCRIPT DE ARRANQUE DIARIO - PROYECTO: COMIDABOT
# =========================================================

echo "Iniciando ComidaBot..."

# 1. Verificar si Ollama (la IA) está corriendo en el contenedor
echo "Verificando motor de IA Local..."
proot-distro login ubuntu -- bash -c "pgrep ollama > /dev/null || (ollama serve > /dev/null 2>&1 &)"

# Darle 3 segundos a la IA para calentar
sleep 3

# 2. Iniciar el puente de WhatsApp
echo "Conectando con WhatsApp..."
if [ -f "index.js" ]; then
    # Ejecuta el bot usando la configuración de config.yml
    node index.js
else
    echo "Error: No se encuentra el archivo index.js. ¿Ejecutaste install.sh primero?"
    exit 1
fi

# Mantener la terminal abierta si hay un error
read -p "Presiona Enter para salir..."
