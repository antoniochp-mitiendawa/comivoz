#!/data/data/com.termux/files/usr/bin/bash

# Inicio de instalación profesional
echo -e "\e[1;34m[*] INSTALACIÓN MAESTRA - PROYECTO COMIDABOT V2026\e[0m"

# 1. Persistencia y Actualización (Wake Lock incluido)
pkg update -y && pkg upgrade -y
pkg install -y termux-api
termux-wake-lock

# 2. Dependencias de Sistema (FFmpeg para audios y herramientas de compilación)
echo -e "\e[1;32m[+] Instalando Node.js y Herramientas de Procesamiento...\e[0m"
pkg install -y nodejs-lts git ffmpeg build-essential

# 3. Limpieza de Seguridad
rm -rf node_modules package-lock.json sesion_auth base_datos.json
npm init -y

# 4. Librerías de Baileys con Cifrado de Señal (Evita errores de sesión)
npm install @whiskeysockets/baileys pino qrcode-terminal libsignal-node fluent-ffmpeg

# 5. Inicialización de la Base de Datos
echo '{"bot_num": null, "propietario_num": null, "nombre_negocio": "Mi Negocio", "menu": "No configurado", "horario": "No configurado"}' > base_datos.json

echo -e "\e[1;32m[!] Instalación completa. Iniciando interceptor...\e[0m"

# 6. Arranque Automático
node index.js
