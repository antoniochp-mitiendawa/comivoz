#!/data/data/com.termux/files/usr/bin/bash

# ==========================================
# BLOQUE 1: MOTOR DE EJECUCIÓN (NODE & BAILEYS)
# PROYECTO: COMIDABOT - INSTALACIÓN DESDE CERO
# ==========================================

echo -e "\n\e[1;34m[+] Instalando Node.js (Versión estable)... \e[0m"
pkg install nodejs-lts -y

echo -e "\e[1;34m[+] Creando directorio del proyecto 'comidabot'... \e[0m"
mkdir -p $HOME/comidabot
cd $HOME/comidabot

echo -e "\e[1;34m[+] Inicializando entorno de Node y Baileys... \e[0m"
# Instalación de las librerías base para la conexión
npm init -y
npm install @whiskeysockets/baileys pino qrcode-terminal

echo -e "\n\e[1;32m------------------------------------------\e[0m"
echo -e "\e[1;32m BLOQUE 1: MOTOR INSTALADO CON ÉXITO\e[0m"
echo -e "\e[1;32m Directorio: $HOME/comidabot\e[0m"
echo -e "\e[1;32m------------------------------------------\e[0m"
echo -e "\e[1;33mPróximo paso: Bloque 2 (Emparejamiento y JID).\e[0m\n"
