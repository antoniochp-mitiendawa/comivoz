#!/data/data/com.termux/files/usr/bin/bash
# BLOQUE 1: INSTALACIÓN DE MOTOR (NODE Y BAILEYS)

echo -e "\e[1;34m[+] Instalando Node.js LTS...\e[0m"
pkg install nodejs-lts -y

echo -e "\e[1;34m[+] Creando carpeta del proyecto...\e[0m"
mkdir -p $HOME/comidabot && cd $HOME/comidabot

echo -e "\e[1;34m[+] Instalando librerías de WhatsApp (Baileys)...\e[0m"
npm init -y
npm install @whiskeysockets/baileys pino qrcode-terminal

echo -e "\e[1;32m------------------------------------------\e[0m"
echo -e "\e[1;32m BLOQUE 1 COMPLETADO CON ÉXITO\e[0m"
echo -e "\e[1;32m------------------------------------------\e[0m"
