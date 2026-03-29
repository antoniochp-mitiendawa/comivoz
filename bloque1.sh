#!/data/data/com.termux/files/usr/bin/bash

# ==========================================
# BLOQUE 1: INSTALACIÓN DE MOTOR Y LIBRERÍAS
# PROYECTO: COMIDABOT - INSTALACIÓN DESDE CERO
# ==========================================

echo -e "\n\e[1;32m[+] Iniciando CONFIGURACIÓN DEL MOTOR (Bloque 1)...\e[0m"

# Asegurar que estamos en el directorio HOME de Termux
cd $HOME

# Instalación de Node.js (Motor principal)
echo -e "\e[1;34m[+] Instalando Node.js LTS...\e[0m"
pkg install nodejs-lts -y -o Dpkg::Options::="--force-confold"

# Creación de la carpeta del proyecto
echo -e "\e[1;34m[+] Creando directorio oficial 'comidabot'...\e[0m"
mkdir -p comidabot
cd comidabot

# Inicialización del proyecto Node
echo -e "\e[1;34m[+] Configurando archivos de dependencias...\e[0m"
npm init -y

# Instalación de Baileys y herramientas de conexión
echo -e "\e[1;34m[+] Descargando librerías de WhatsApp (Baileys)...\e[0m"
npm install @whiskeysockets/baileys pino qrcode-terminal --no-audit --no-fund

echo -e "\n\e[1;32m------------------------------------------\e[0m"
echo -e "\e[1;32m BLOQUE 1: MOTOR Y LIBRERÍAS INSTALADOS\e[0m"
echo -e "\e[1;32m El entorno de ejecución está LISTO.\e[0m"
echo -e "\e[1;32m------------------------------------------\e[0m"
echo -e "\e[1;33mSiguiente fase: Bloque 2 (Pairing Code).\e[0m\n"
