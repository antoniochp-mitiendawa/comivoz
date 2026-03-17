// ====================================
// COMIVOZ - BOT PRINCIPAL
// Versión corregida
// ====================================

const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const ffmpeg = require('fluent-ffmpeg');
const vosk = require('vosk');

// ====================================
// CONFIGURACIÓN
// ====================================
let config;
try {
  config = JSON.parse(fs.readFileSync('config.json'));
} catch (err) {
  console.error('Error leyendo config.json');
  process.exit(1);
}

const db = new sqlite3.Database('database/comivoz.db');

// Modelo Vosk
vosk.setLogLevel(-1);
const modelPath = 'models/vosk-model';
let model, rec;
try {
  model = new vosk.Model(modelPath);
  rec = new vosk.Recognizer({ model: model, sampleRate: 16000 });
} catch (err) {
  console.error('Error cargando modelo Vosk:', err);
  process.exit(1);
}

// ====================================
// SINÓNIMOS Y EMOJIS
// ====================================
const sinonimos = {
  desayuno: ['desayuno', 'desayunos', 'para desayunar', 'mañana'],
  primer_tiempo: ['primer tiempo', 'sopa', 'sopas', 'consomé', 'crema', 'entrada'],
  segundo_tiempo: ['segundo tiempo', 'arroz', 'espagueti', 'pasta'],
  tercer_tiempo: ['tercer tiempo', 'guisado', 'guisados', 'platillo fuerte'],
  bebida: ['bebida', 'bebidas', 'agua', 'refresco', 'jugo'],
  postre: ['postre', 'postres', 'dulce'],
  horario: ['horario', 'hora', 'abren', 'cierran', 'atienden'],
  direccion: ['dirección', 'ubicación', 'dónde están'],
  precio: ['precio', 'cuánto cuesta', 'costo'],
  domicilio: ['domicilio', 'envío', 'mandan', 'reparten']
};

const emojis = {
  desayuno: '🍳',
  primer_tiempo: '🥣',
  segundo_tiempo: '🍚',
  tercer_tiempo: '🍖',
  bebida: '🥤',
  postre: '🍨',
  horario: '🕒',
  direccion: '📍',
  precio: '💰',
  domicilio: '🚚',
  saludo_mañana: '☀️',
  saludo_tarde: '🌤️',
  saludo_noche: '🌙',
  confirmacion: '✅',
  negacion: '✖️'
};

// ====================================
// FUNCIONES AUXILIARES
// ====================================

function getSaludo() {
  const hora = new Date().getHours();
  if (hora < 12) return { emoji: emojis.saludo_mañana, texto: 'BUENOS DÍAS' };
  if (hora < 19) return { emoji: emojis.saludo_tarde, texto: 'BUENAS TARDES' };
  return { emoji: emojis.saludo_noche, texto: 'BUENAS NOCHES' };
}

function detectarIntencion(texto) {
  texto = texto.toLowerCase();
  for (const [categoria, palabras] of Object.entries(sinonimos)) {
    for (const palabra of palabras) {
      if (texto.includes(palabra)) {
        return categoria;
      }
    }
  }
  return null;
}

function formatearNumeroMostrar(numero) {
  let limpio = numero.replace(/\D/g, '');
  if (limpio.startsWith('521')) limpio = limpio.substring(3);
  if (limpio.startsWith('52')) limpio = limpio.substring(2);
  return limpio.substring(0, 10);
}

function formatearNumeroReenvio(numero) {
  let limpio = numero.replace(/\D/g, '');
  if (limpio.startsWith('52')) limpio = limpio.substring(2);
  if (!limpio.startsWith('521')) return '521' + limpio.substring(0, 10);
  return limpio;
}

// ====================================
// PROCESADOR DE AUDIO
// ====================================

async function procesarAudio(rutaAudio) {
  return new Promise((resolve, reject) => {
    const outputFile = path.join('/tmp', 'audio_processed.wav');
    
    ffmpeg(rutaAudio)
      .audioFrequency(16000)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      .format('wav')
      .on('end', () => {
        const fileStream = fs.createReadStream(outputFile);
        const buffer = [];
        fileStream.on('data', chunk => buffer.push(chunk));
        fileStream.on('end', () => {
          const audioBuffer = Buffer.concat(buffer);
          if (rec.acceptWaveform(audioBuffer)) {
            const result = JSON.parse(rec.result());
            resolve(result.text);
          } else {
            const result = JSON.parse(rec.partialResult());
            resolve(result.partial);
          }
          fs.unlinkSync(outputFile);
        });
      })
      .on('error', reject)
      .save(outputFile);
  });
}

// ====================================
// INTERPRETAR INSTRUCCIONES
// ====================================

async function interpretarInstruccion(texto, remitente) {
  if (formatearNumeroMostrar(remitente) !== formatearNumeroMostrar(config.numero_duena)) {
    return null;
  }

  texto = texto.toLowerCase();

  if (texto.includes('agrega') || texto.includes('tenemos') || texto.includes('hay')) {
    return await agregarPlatillo(texto);
  }
  
  if (texto.includes('elimina') || texto.includes('quita') || texto.includes('se acabó')) {
    return await eliminarPlatillo(texto);
  }
  
  if (texto.includes('activa domicilio')) {
    return await activarDomicilio(texto);
  }
  
  if (texto.includes('desactiva domicilio')) {
    return await desactivarDomicilio();
  }
  
  if (texto.includes('precio comida')) {
    return await cambiarPrecioComida(texto);
  }

  return '✅ Instrucción recibida';
}

async function agregarPlatillo(texto) {
  let categoria = null;
  if (texto.includes('desayuno')) categoria = 'desayunos';
  else if (texto.includes('primer tiempo') || texto.includes('sopa')) categoria = 'primer_tiempo';
  else if (texto.includes('segundo tiempo') || texto.includes('arroz')) categoria = 'segundo_tiempo';
  else if (texto.includes('tercer tiempo') || texto.includes('guisado')) categoria = 'tercer_tiempo';
  else if (texto.includes('bebida')) categoria = 'bebida';
  else if (texto.includes('postre')) categoria = 'postre';

  if (!categoria) return '❌ No se pudo identificar la categoría';

  const partes = texto.split(',');
  for (const parte of partes) {
    const matchPrecio = parte.match(/(.+?)\s+(\d+)\s*(pesos?|$)/i);
    if (matchPrecio && categoria === 'desayunos') {
      const nombre = matchPrecio[1].trim();
      const precio = parseInt(matchPrecio[2]);
      db.run('INSERT INTO desayunos (nombre, precio) VALUES (?, ?)', [nombre, precio]);
    } else {
      const nombre = parte.trim();
      if (nombre && !nombre.includes('precio') && !nombre.includes('pesos')) {
        if (categoria === 'desayunos') {
          db.run('INSERT INTO desayunos (nombre, precio) VALUES (?, 0)', [nombre]);
        } else {
          db.run(`INSERT INTO ${categoria} (nombre) VALUES (?)`, [nombre]);
        }
      }
    }
  }

  return `✅ Agregado a ${categoria.replace('_', ' ')}`;
}

async function eliminarPlatillo(texto) {
  const palabras = texto.split(' ');
  let nombrePlatillo = '';
  const ignorar = ['elimina', 'quita', 'se', 'acabó', 'ya', 'no'];
  
  for (const palabra of palabras) {
    if (!ignorar.includes(palabra) && palabra.length > 3) {
      nombrePlatillo += palabra + ' ';
    }
  }
  nombrePlatillo = nombrePlatillo.trim();

  const tablas = ['desayunos', 'primer_tiempo', 'segundo_tiempo', 'tercer_tiempo', 'bebida', 'postre'];
  
  for (const tabla of tablas) {
    db.run(`UPDATE ${tabla} SET disponible = 0 WHERE nombre LIKE ?`, [`%${nombrePlatillo}%`]);
  }

  return `✅ Eliminado: ${nombrePlatillo}`;
}

async function activarDomicilio(texto) {
  const matchTelefono = texto.match(/(\d{10})/);
  if (matchTelefono) {
    const telefono = matchTelefono[1];
    db.run('INSERT OR REPLACE INTO domicilio_config (id, activo, telefono_reenvio) VALUES (1, 1, ?)', [telefono]);
    return `✅ Servicio a domicilio ACTIVADO. Reenvíos a: ${telefono}`;
  }
  return '❌ No se encontró número de teléfono';
}

async function desactivarDomicilio() {
  db.run('UPDATE domicilio_config SET activo = 0 WHERE id = 1');
  return '✅ Servicio a domicilio DESACTIVADO';
}

async function cambiarPrecioComida(texto) {
  const matchPrecio = texto.match(/(\d+)/);
  if (matchPrecio) {
    const precio = parseInt(matchPrecio[1]);
    db.run('INSERT INTO precio_comida (precio) VALUES (?)', [precio]);
    return `✅ Precio de comida actualizado: $${precio}`;
  }
  return '❌ No se encontró el precio';
}

// ====================================
// GENERAR RESPUESTAS
// ====================================

async function generarRespuesta(intencion, textoOriginal) {
  const saludo = getSaludo();
  const hora = new Date().getHours();
  
  // Menú completo
  if (!intencion || intencion === 'desayuno' || intencion === 'primer_tiempo') {
    if (hora < 12) {
      return await generarRespuestaDesayunos(saludo);
    } else {
      return await generarRespuestaComidaCompleta(saludo);
    }
  }

  switch(intencion) {
    case 'desayuno':
      return await generarRespuestaDesayunos(saludo);
    case 'primer_tiempo':
      return await generarRespuestaPrimerTiempo();
    case 'segundo_tiempo':
      return await generarRespuestaSegundoTiempo();
    case 'tercer_tiempo':
      return await generarRespuestaTercerTiempo();
    case 'bebida':
      return await generarRespuestaBebida();
    case 'postre':
      return await generarRespuestaPostre();
    case 'horario':
      return `${emojis.horario} *HORARIO*\n━━━━━━━━━━━━━━━━━━━━━\n🕒 ${config.horario}\n━━━━━━━━━━━━━━━━━━━━━\n${emojis.direccion} ${config.direccion}`;
    case 'direccion':
      return `${emojis.direccion} *DIRECCIÓN*\n━━━━━━━━━━━━━━━━━━━━━\n📍 ${config.direccion}\n━━━━━━━━━━━━━━━━━━━━━\n🕒 ${config.horario}`;
    case 'precio':
      return await generarRespuestaPrecio();
    case 'domicilio':
      return await generarRespuestaDomicilio();
    default:
      return null;
  }
}

async function generarRespuestaDesayunos(saludo) {
  return new Promise((resolve) => {
    db.all('SELECT nombre, precio FROM desayunos WHERE disponible = 1', [], (err, rows) => {
      if (err || !rows || rows.length === 0) {
        resolve(`${saludo.emoji} *${saludo.texto}* ${saludo.emoji}\n\nHoy no hay desayunos registrados.`);
        return;
      }

      let respuesta = `${saludo.emoji} *${saludo.texto}* ${saludo.emoji}\n\n`;
      respuesta += `${emojis.desayuno} *DESAYUNOS*\n`;
      respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
      
      rows.forEach(row => {
        const puntos = '.'.repeat(25 - row.nombre.length);
        respuesta += `• ${row.nombre} ${puntos} $${row.precio}\n`;
      });
      
      respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
      respuesta += `🕒 ${config.horario}\n`;
      respuesta += `📍 ${config.direccion}\n`;
      respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
      respuesta += `¡Te esperamos! 🤗`;
      
      resolve(respuesta);
    });
  });
}

async function generarRespuestaComidaCompleta(saludo) {
  return new Promise((resolve) => {
    db.get('SELECT precio FROM precio_comida ORDER BY fecha_actualizacion DESC LIMIT 1', [], (err, precioRow) => {
      let respuesta = `${saludo.emoji} *${saludo.texto}* ${saludo.emoji}\n\n`;
      
      if (precioRow) {
        respuesta += `Comida corrida hoy *$${precioRow.precio}*\n\n`;
      }
      
      db.all('SELECT nombre FROM primer_tiempo WHERE disponible = 1', [], (err1, primerRows) => {
        if (primerRows && primerRows.length > 0) {
          respuesta += `${emojis.primer_tiempo} *PRIMER TIEMPO*\n`;
          respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
          primerRows.forEach(row => { respuesta += `• ${row.nombre}\n`; });
          respuesta += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        }
        
        db.all('SELECT nombre FROM segundo_tiempo WHERE disponible = 1', [], (err2, segundoRows) => {
          if (segundoRows && segundoRows.length > 0) {
            respuesta += `${emojis.segundo_tiempo} *SEGUNDO TIEMPO*\n`;
            respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
            segundoRows.forEach(row => { respuesta += `• ${row.nombre}\n`; });
            respuesta += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
          }
          
          db.all('SELECT nombre FROM tercer_tiempo WHERE disponible = 1', [], (err3, tercerRows) => {
            if (tercerRows && tercerRows.length > 0) {
              respuesta += `${emojis.tercer_tiempo} *TERCER TIEMPO*\n`;
              respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
              tercerRows.forEach(row => { respuesta += `• ${row.nombre}\n`; });
              respuesta += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
            }
            
            db.all('SELECT nombre FROM bebida WHERE disponible = 1', [], (err4, bebidaRows) => {
              db.all('SELECT nombre FROM postre WHERE disponible = 1', [], (err5, postreRows) => {
                
                if (bebidaRows && bebidaRows.length > 0) {
                  respuesta += `${emojis.bebida} *BEBIDA*\n`;
                  respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
                  bebidaRows.forEach(row => { respuesta += `• ${row.nombre}\n`; });
                  respuesta += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
                }
                
                if (postreRows && postreRows.length > 0) {
                  respuesta += `${emojis.postre} *POSTRE*\n`;
                  respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
                  postreRows.forEach(row => { respuesta += `• ${row.nombre}\n`; });
                  respuesta += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
                }
                
                respuesta += `🕒 ${config.horario}\n`;
                respuesta += `📍 ${config.direccion}\n`;
                
                db.get('SELECT activo FROM domicilio_config WHERE id = 1', [], (err6, domRow) => {
                  if (domRow && domRow.activo === 1) {
                    respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
                    respuesta += `${emojis.domicilio} *DOMICILIO*\n`;
                    respuesta += `¿Necesitas servicio a domicilio?\n`;
                    respuesta += `Responde *SÍ* para que te llamemos.\n`;
                  }
                  
                  respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
                  respuesta += `¡Te esperamos! 🤗`;
                  resolve(respuesta);
                });
              });
            });
          });
        });
      });
    });
  });
}

async function generarRespuestaPrimerTiempo() {
  return new Promise((resolve) => {
    db.all('SELECT nombre FROM primer_tiempo WHERE disponible = 1', [], (err, rows) => {
      if (!rows || rows.length === 0) {
        resolve(`${emojis.primer_tiempo} *PRIMER TIEMPO*\n━━━━━━━━━━━━━━━━━━━━━\nHoy no hay sopas registradas.`);
        return;
      }
      let respuesta = `${emojis.primer_tiempo} *PRIMER TIEMPO*\n━━━━━━━━━━━━━━━━━━━━━\n`;
      rows.forEach(row => { respuesta += `• ${row.nombre}\n`; });
      respuesta += `━━━━━━━━━━━━━━━━━━━━━`;
      resolve(respuesta);
    });
  });
}

async function generarRespuestaSegundoTiempo() {
  return new Promise((resolve) => {
    db.all('SELECT nombre FROM segundo_tiempo WHERE disponible = 1', [], (err, rows) => {
      if (!rows || rows.length === 0) {
        resolve(`${emojis.segundo_tiempo} *SEGUNDO TIEMPO*\n━━━━━━━━━━━━━━━━━━━━━\nHoy no hay arroz/espagueti registrados.`);
        return;
      }
      let respuesta = `${emojis.segundo_tiempo} *SEGUNDO TIEMPO*\n━━━━━━━━━━━━━━━━━━━━━\n`;
      rows.forEach(row => { respuesta += `• ${row.nombre}\n`; });
      respuesta += `━━━━━━━━━━━━━━━━━━━━━`;
      resolve(respuesta);
    });
  });
}

async function generarRespuestaTercerTiempo() {
  return new Promise((resolve) => {
    db.all('SELECT nombre FROM tercer_tiempo WHERE disponible = 1', [], (err, rows) => {
      if (!rows || rows.length === 0) {
        resolve(`${emojis.tercer_tiempo} *TERCER TIEMPO*\n━━━━━━━━━━━━━━━━━━━━━\nHoy no hay guisados registrados.`);
        return;
      }
      let respuesta = `${emojis.tercer_tiempo} *TERCER TIEMPO*\n━━━━━━━━━━━━━━━━━━━━━\n`;
      rows.forEach(row => { respuesta += `• ${row.nombre}\n`; });
      respuesta += `━━━━━━━━━━━━━━━━━━━━━`;
      resolve(respuesta);
    });
  });
}

async function generarRespuestaBebida() {
  return new Promise((resolve) => {
    db.all('SELECT nombre FROM bebida WHERE disponible = 1', [], (err, rows) => {
      if (!rows || rows.length === 0) {
        resolve(`${emojis.bebida} *BEBIDA*\n━━━━━━━━━━━━━━━━━━━━━\nHoy no hay bebidas registradas.`);
        return;
      }
      let respuesta = `${emojis.bebida} *BEBIDA*\n━━━━━━━━━━━━━━━━━━━━━\n`;
      rows.forEach(row => { respuesta += `• ${row.nombre}\n`; });
      respuesta += `━━━━━━━━━━━━━━━━━━━━━`;
      resolve(respuesta);
    });
  });
}

async function generarRespuestaPostre() {
  return new Promise((resolve) => {
    db.all('SELECT nombre FROM postre WHERE disponible = 1', [], (err, rows) => {
      if (!rows || rows.length === 0) {
        resolve(`${emojis.postre} *POSTRE*\n━━━━━━━━━━━━━━━━━━━━━\nHoy no hay postres registrados.`);
        return;
      }
      let respuesta = `${emojis.postre} *POSTRE*\n━━━━━━━━━━━━━━━━━━━━━\n`;
      rows.forEach(row => { respuesta += `• ${row.nombre}\n`; });
      respuesta += `━━━━━━━━━━━━━━━━━━━━━`;
      resolve(respuesta);
    });
  });
}

async function generarRespuestaPrecio() {
  return new Promise((resolve) => {
    db.get('SELECT precio FROM precio_comida ORDER BY fecha_actualizacion DESC LIMIT 1', [], (err, row) => {
      if (!row) {
        resolve(`${emojis.precio} *PRECIO*\n━━━━━━━━━━━━━━━━━━━━━\nConsulta el precio directamente con nosotros.`);
        return;
      }
      resolve(`${emojis.precio} *PRECIO*\n━━━━━━━━━━━━━━━━━━━━━\nLa comida corrida hoy está en *$${row.precio}*\n━━━━━━━━━━━━━━━━━━━━━`);
    });
  });
}

async function generarRespuestaDomicilio() {
  return new Promise((resolve) => {
    db.get('SELECT activo FROM domicilio_config WHERE id = 1', [], (err, row) => {
      if (!row || row.activo !== 1) {
        resolve(`${emojis.domicilio} *SERVICIO A DOMICILIO*\n━━━━━━━━━━━━━━━━━━━━━\nPor el momento no tenemos servicio a domicilio.\n\nPuedes visitarnos en:\n📍 ${config.direccion}\n🕒 ${config.horario}`);
        return;
      }
      resolve(`${emojis.domicilio} *SERVICIO A DOMICILIO*\n━━━━━━━━━━━━━━━━━━━━━\nSí tenemos servicio a domicilio.\n\n¿Te interesa? Responde *SÍ* para que te llamemos.`);
    });
  });
}

async function manejarSolicitudDomicilio(numeroCliente, sock) {
  return new Promise((resolve) => {
    db.get('SELECT telefono_reenvio FROM domicilio_config WHERE id = 1 AND activo = 1', [], (err, row) => {
      if (!row || !row.telefono_reenvio) {
        resolve();
        return;
      }
      
      const numeroReenvio = formatearNumeroReenvio(row.telefono_reenvio);
      const numeroMostrar = formatearNumeroMostrar(numeroCliente);
      const fecha = new Date();
      const hora = `${fecha.getHours()}:${fecha.getMinutes().toString().padStart(2, '0')}`;
      
      const mensajeReenvio = `🚚 *SOLICITUD DE DOMICILIO*\n━━━━━━━━━━━━━━━━━━━━━\n\n👤 Cliente: *${numeroMostrar}*\n🕒 Hora: ${hora}\n━━━━━━━━━━━━━━━━━━━━━\n✅ Solicitó ser contactado\n\n📞 *Llama ahora:*\n${numeroMostrar}\n━━━━━━━━━━━━━━━━━━━━━\nToma su pedido por teléfono.`;

      db.run('INSERT INTO solicitudes_domicilio (numero_cliente) VALUES (?)', [numeroMostrar]);
      sock.sendMessage(numeroReenvio, { text: mensajeReenvio });
      resolve();
    });
  });
}

// ====================================
// CONEXIÓN WHATSAPP
// ====================================

async function conectarWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  
  const sock = makeWASocket({
    auth: state,
    browser: ['ComiVoz', 'Safari', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection } = update;
    
    if (connection === 'open') {
      console.log('✅ WhatsApp CONECTADO');
    }
    
    if (connection === 'close') {
      console.log('❌ Conexión cerrada, reconectando...');
      setTimeout(conectarWhatsApp, 5000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;
    
    const remitente = m.key.remoteJid;
    if (remitente.endsWith('@g.us')) return;
    
    const numeroLimpio = formatearNumeroMostrar(remitente);
    const esDuena = (numeroLimpio === formatearNumeroMostrar(config.numero_duena));
    
    // Audios de la dueña
    if (m.message.audioMessage && esDuena) {
      console.log(`🎤 Audio recibido de dueña`);
      
      const buffer = await m.message.audioMessage.download();
      const audioPath = `/tmp/audio_${Date.now()}.ogg`;
      fs.writeFileSync(audioPath, buffer);
      
      const texto = await procesarAudio(audioPath);
      console.log(`📝 Transcripción: ${texto}`);
      
      const respuesta = await interpretarInstruccion(texto, remitente);
      if (respuesta) await sock.sendMessage(remitente, { text: respuesta });
      
      fs.unlinkSync(audioPath);
      return;
    }
    
    // Textos de clientes
    if (m.message.conversation) {
      const texto = m.message.conversation;
      console.log(`💬 Mensaje de ${numeroLimpio}: ${texto}`);
      
      if (texto.toLowerCase() === 'sí' || texto.toLowerCase() === 'si') {
        db.get('SELECT activo FROM domicilio_config WHERE id = 1 AND activo = 1', [], async (err, row) => {
          if (row && row.activo === 1) {
            await sock.sendMessage(remitente, { text: '👍 Gracias. En unos minutos te llamaremos.' });
            await manejarSolicitudDomicilio(remitente, sock);
          }
        });
        return;
      }
      
      const intencion = detectarIntencion(texto);
      const respuesta = await generarRespuesta(intencion, texto);
      
      if (respuesta) {
        if (respuesta.length > 1500) {
          const partes = respuesta.split('\n\n');
          for (const parte of partes) {
            await sock.sendMessage(remitente, { text: parte });
          }
        } else {
          await sock.sendMessage(remitente, { text: respuesta });
        }
      }
    }
  });

  return sock;
}

// ====================================
// INICIAR
// ====================================

console.log('====================================');
console.log('  COMIVOZ - INICIANDO');
console.log('====================================');

conectarWhatsApp().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
