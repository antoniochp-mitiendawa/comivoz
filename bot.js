// ====================================
// COMIVOZ - BOT PRINCIPAL
// Todo en un solo archivo
// ====================================

const { makeWASocket, useMultiFileAuthState, proto } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Readable } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const vosk = require('vosk');

// ====================================
// CONFIGURACIÓN
// ====================================
const config = JSON.parse(fs.readFileSync('config.json'));
const db = new sqlite3.Database('database/comivoz.db');

// Modelo Vosk
vosk.setLogLevel(-1);
const modelPath = 'models/vosk-model';
const model = new vosk.Model(modelPath);
const rec = new vosk.Recognizer({ model: model, sampleRate: 16000 });

// ====================================
// SINÓNIMOS Y EMOJIS
// ====================================
const sinonimos = {
  desayuno: ['desayuno', 'desayunos', 'para desayunar', 'mañana', 'lo de hoy en la mañana'],
  primer_tiempo: ['primer tiempo', 'sopa', 'sopas', 'consomé', 'crema', 'cremas', 'entrada', 'de entrada', 'para empezar', 'caldo'],
  segundo_tiempo: ['segundo tiempo', 'arroz', 'espagueti', 'pasta', 'guarnición', 'arrozcito', 'sopa seca'],
  tercer_tiempo: ['tercer tiempo', 'guisado', 'guisados', 'platillo fuerte', 'carne', 'pollo', 'de fondo', 'plato fuerte'],
  bebida: ['bebida', 'bebidas', 'agua', 'refresco', 'jugo', 'de tomar', 'para tomar', 'agüita', 'refresquito'],
  postre: ['postre', 'postres', 'dulce', 'para endulzar', 'algo dulce', 'de postre'],
  horario: ['horario', 'hora', 'abren', 'cierran', 'atienden', 'hasta qué hora', 'desde qué hora'],
  direccion: ['dirección', 'ubicación', 'dónde están', 'cómo llegar', 'domicilio del local', 'calle'],
  precio: ['precio', 'cuánto cuesta', 'en cuánto', 'costo', 'valor', 'cuánto es'],
  domicilio: ['domicilio', 'envío', 'mandan', 'llevan', 'reparten', 'servicio a domicilio', 'para llevar']
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
  // Quitar 521 si existe y devolver solo 10 dígitos
  let limpio = numero.replace(/\D/g, '');
  if (limpio.startsWith('521')) {
    limpio = limpio.substring(3);
  }
  if (limpio.startsWith('52')) {
    limpio = limpio.substring(2);
  }
  return limpio.substring(0, 10);
}

function formatearNumeroReenvio(numero) {
  // Para reenviar internamente, debe tener 521
  let limpio = numero.replace(/\D/g, '');
  if (limpio.startsWith('52')) {
    limpio = limpio.substring(2);
  }
  if (!limpio.startsWith('521')) {
    return '521' + limpio.substring(0, 10);
  }
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
// INTERPRETAR INSTRUCCIONES DE LA DUEÑA
// ====================================

async function interpretarInstruccion(texto, remitente) {
  // Solo procesar si es la dueña
  if (formatearNumeroMostrar(remitente) !== formatearNumeroMostrar(config.numero_duena)) {
    return null;
  }

  texto = texto.toLowerCase();

  // DETECTAR ACCIÓN
  if (texto.includes('agrega') || texto.includes('tenemos') || texto.includes('hay')) {
    // AGREGAR PLATILLO
    return await agregarPlatillo(texto);
  }
  
  if (texto.includes('elimina') || texto.includes('quita') || texto.includes('se acabó')) {
    // ELIMINAR PLATILLO
    return await eliminarPlatillo(texto);
  }
  
  if (texto.includes('activa domicilio') || texto.includes('activar domicilio')) {
    // ACTIVAR DOMICILIO
    return await activarDomicilio(texto);
  }
  
  if (texto.includes('desactiva domicilio') || texto.includes('desactivar domicilio')) {
    // DESACTIVAR DOMICILIO
    return await desactivarDomicilio();
  }
  
  if (texto.includes('precio comida') || texto.includes('comida en')) {
    // CAMBIAR PRECIO COMIDA
    return await cambiarPrecioComida(texto);
  }

  return '✅ Instrucción recibida';
}

async function agregarPlatillo(texto) {
  // Detectar categoría
  let categoria = null;
  if (texto.includes('desayuno')) categoria = 'desayuno';
  else if (texto.includes('primer tiempo') || texto.includes('sopa')) categoria = 'primer_tiempo';
  else if (texto.includes('segundo tiempo') || texto.includes('arroz')) categoria = 'segundo_tiempo';
  else if (texto.includes('tercer tiempo') || texto.includes('guisado')) categoria = 'tercer_tiempo';
  else if (texto.includes('bebida') || texto.includes('agua')) categoria = 'bebida';
  else if (texto.includes('postre')) categoria = 'postre';

  if (!categoria) return '❌ No se pudo identificar la categoría';

  // Extraer platillos (formato: "nombre precio" o solo nombre)
  const partes = texto.split(',');
  for (const parte of partes) {
    const matchPrecio = parte.match(/(.+?)\s+(\d+)\s*(pesos?|$)/i);
    if (matchPrecio) {
      const nombre = matchPrecio[1].trim();
      const precio = parseInt(matchPrecio[2]);
      
      if (categoria === 'desayuno') {
        db.run('INSERT INTO desayunos (nombre, precio) VALUES (?, ?)', [nombre, precio]);
      } else {
        db.run(`INSERT INTO ${categoria} (nombre) VALUES (?)`, [nombre]);
      }
    } else {
      // Sin precio (para sopas, arroces, etc.)
      const nombre = parte.trim();
      if (nombre && !nombre.includes('precio')) {
        db.run(`INSERT INTO ${categoria} (nombre) VALUES (?)`, [nombre]);
      }
    }
  }

  return `✅ Agregado a ${categoria.replace('_', ' ')}`;
}

async function eliminarPlatillo(texto) {
  // Buscar nombre del platillo
  const palabras = texto.split(' ');
  let nombrePlatillo = '';
  
  // Ignorar palabras clave
  const ignorar = ['elimina', 'quita', 'se', 'acabó', 'ya', 'no'];
  for (const palabra of palabras) {
    if (!ignorar.includes(palabra) && palabra.length > 3) {
      nombrePlatillo += palabra + ' ';
    }
  }
  nombrePlatillo = nombrePlatillo.trim();

  // Buscar en todas las tablas
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
// GENERAR RESPUESTAS PARA CLIENTES
// ====================================

async function generarRespuesta(intencion, textoOriginal) {
  const saludo = getSaludo();
  
  // Si pregunta por TODO el menú
  if (!intencion || intencion === 'desayuno' || intencion === 'primer_tiempo') {
    const hora = new Date().getHours();
    
    // ANTES DE 12: SOLO DESAYUNOS
    if (hora < 12) {
      return await generarRespuestaDesayunos(saludo);
    }
    // DESPUÉS DE 12: COMIDA COMPLETA
    else {
      return await generarRespuestaComidaCompleta(saludo);
    }
  }

  // Pregunta específica por categoría
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
      return await generarRespuestaDomicilio(textoOriginal);
    default:
      // Buscar platillo específico
      return await buscarPlatilloEspecifico(textoOriginal);
  }
}

async function generarRespuestaDesayunos(saludo) {
  return new Promise((resolve) => {
    db.all('SELECT nombre, precio FROM desayunos WHERE disponible = 1', [], (err, rows) => {
      if (err || rows.length === 0) {
        resolve(`${saludo.emoji} *${saludo.texto}* ${saludo.emoji}\n\nHoy no hay desayunos registrados.`);
        return;
      }

      let respuesta = `${saludo.emoji} *${saludo.texto}* ${saludo.emoji}\n\n`;
      respuesta += `${emojis.desayuno} *DESAYUNOS* (hasta las 12:00 pm)\n`;
      respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
      
      rows.forEach(row => {
        const puntos = '.'.repeat(25 - row.nombre.length);
        respuesta += `• ${row.nombre} ${puntos} $${row.precio}\n`;
      });
      
      respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
      respuesta += `🕒 ${config.horario}\n`;
      respuesta += `📍 ${config.direccion}\n`;
      respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
      respuesta += `¡Estamos a tus órdenes! 🤗`;
      
      resolve(respuesta);
    });
  });
}

async function generarRespuestaComidaCompleta(saludo) {
  return new Promise((resolve) => {
    db.get('SELECT precio FROM precio_comida ORDER BY fecha_actualizacion DESC LIMIT 1', [], (err, precioRow) => {
      const precio = precioRow ? precioRow.precio : 'consultar';
      
      let respuesta = `${saludo.emoji} *${saludo.texto}* ${saludo.emoji}\n\n`;
      
      if (precio !== 'consultar') {
        respuesta += `Comida corrida hoy *$${precio}* (incluye todo)\n\n`;
      }
      
      // Primer tiempo
      db.all('SELECT nombre FROM primer_tiempo WHERE disponible = 1', [], (err1, primerRows) => {
        if (primerRows && primerRows.length > 0) {
          respuesta += `${emojis.primer_tiempo} *PRIMER TIEMPO*\n`;
          respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
          primerRows.forEach(row => {
            respuesta += `• ${row.nombre}\n`;
          });
          respuesta += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        }
        
        // Segundo tiempo
        db.all('SELECT nombre FROM segundo_tiempo WHERE disponible = 1', [], (err2, segundoRows) => {
          if (segundoRows && segundoRows.length > 0) {
            respuesta += `${emojis.segundo_tiempo} *SEGUNDO TIEMPO*\n`;
            respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
            segundoRows.forEach(row => {
              respuesta += `• ${row.nombre}\n`;
            });
            respuesta += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
          }
          
          // Tercer tiempo
          db.all('SELECT nombre FROM tercer_tiempo WHERE disponible = 1', [], (err3, tercerRows) => {
            if (tercerRows && tercerRows.length > 0) {
              respuesta += `${emojis.tercer_tiempo} *TERCER TIEMPO*\n`;
              respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
              tercerRows.forEach(row => {
                respuesta += `• ${row.nombre}\n`;
              });
              respuesta += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
            }
            
            // Bebida y postre
            db.all('SELECT nombre FROM bebida WHERE disponible = 1', [], (err4, bebidaRows) => {
              db.all('SELECT nombre FROM postre WHERE disponible = 1', [], (err5, postreRows) => {
                
                if (bebidaRows && bebidaRows.length > 0) {
                  respuesta += `${emojis.bebida} *BEBIDA*\n`;
                  respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
                  bebidaRows.forEach(row => {
                    respuesta += `• ${row.nombre}\n`;
                  });
                  respuesta += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
                }
                
                if (postreRows && postreRows.length > 0) {
                  respuesta += `${emojis.postre} *POSTRE*\n`;
                  respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
                  postreRows.forEach(row => {
                    respuesta += `• ${row.nombre}\n`;
                  });
                  respuesta += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
                }
                
                // Cierre
                respuesta += `🕒 ${config.horario}\n`;
                respuesta += `📍 ${config.direccion}\n`;
                
                // Verificar domicilio
                db.get('SELECT activo, telefono_reenvio FROM domicilio_config WHERE id = 1', [], (err6, domRow) => {
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
      if (err || rows.length === 0) {
        resolve(`${emojis.primer_tiempo} *PRIMER TIEMPO*\n━━━━━━━━━━━━━━━━━━━━━\nHoy no hay sopas registradas.\n━━━━━━━━━━━━━━━━━━━━━`);
        return;
      }
      
      let respuesta = `${emojis.primer_tiempo} *PRIMER TIEMPO*\n`;
      respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
      rows.forEach(row => {
        respuesta += `• ${row.nombre}\n`;
      });
      respuesta += `━━━━━━━━━━━━━━━━━━━━━`;
      
      resolve(respuesta);
    });
  });
}

async function generarRespuestaSegundoTiempo() {
  return new Promise((resolve) => {
    db.all('SELECT nombre FROM segundo_tiempo WHERE disponible = 1', [], (err, rows) => {
      if (err || rows.length === 0) {
        resolve(`${emojis.segundo_tiempo} *SEGUNDO TIEMPO*\n━━━━━━━━━━━━━━━━━━━━━\nHoy no hay arroz/espagueti registrados.\n━━━━━━━━━━━━━━━━━━━━━`);
        return;
      }
      
      let respuesta = `${emojis.segundo_tiempo} *SEGUNDO TIEMPO*\n`;
      respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
      rows.forEach(row => {
        respuesta += `• ${row.nombre}\n`;
      });
      respuesta += `━━━━━━━━━━━━━━━━━━━━━`;
      
      resolve(respuesta);
    });
  });
}

async function generarRespuestaTercerTiempo() {
  return new Promise((resolve) => {
    db.all('SELECT nombre FROM tercer_tiempo WHERE disponible = 1', [], (err, rows) => {
      if (err || rows.length === 0) {
        resolve(`${emojis.tercer_tiempo} *TERCER TIEMPO*\n━━━━━━━━━━━━━━━━━━━━━\nHoy no hay guisados registrados.\n━━━━━━━━━━━━━━━━━━━━━`);
        return;
      }
      
      let respuesta = `${emojis.tercer_tiempo} *TERCER TIEMPO*\n`;
      respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
      rows.forEach(row => {
        respuesta += `• ${row.nombre}\n`;
      });
      respuesta += `━━━━━━━━━━━━━━━━━━━━━`;
      
      resolve(respuesta);
    });
  });
}

async function generarRespuestaBebida() {
  return new Promise((resolve) => {
    db.all('SELECT nombre FROM bebida WHERE disponible = 1', [], (err, rows) => {
      if (err || rows.length === 0) {
        resolve(`${emojis.bebida} *BEBIDA*\n━━━━━━━━━━━━━━━━━━━━━\nHoy no hay bebidas registradas.\n━━━━━━━━━━━━━━━━━━━━━`);
        return;
      }
      
      let respuesta = `${emojis.bebida} *BEBIDA*\n`;
      respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
      rows.forEach(row => {
        respuesta += `• ${row.nombre}\n`;
      });
      respuesta += `━━━━━━━━━━━━━━━━━━━━━`;
      
      resolve(respuesta);
    });
  });
}

async function generarRespuestaPostre() {
  return new Promise((resolve) => {
    db.all('SELECT nombre FROM postre WHERE disponible = 1', [], (err, rows) => {
      if (err || rows.length === 0) {
        resolve(`${emojis.postre} *POSTRE*\n━━━━━━━━━━━━━━━━━━━━━\nHoy no hay postres registrados.\n━━━━━━━━━━━━━━━━━━━━━`);
        return;
      }
      
      let respuesta = `${emojis.postre} *POSTRE*\n`;
      respuesta += `━━━━━━━━━━━━━━━━━━━━━\n`;
      rows.forEach(row => {
        respuesta += `• ${row.nombre}\n`;
      });
      respuesta += `━━━━━━━━━━━━━━━━━━━━━`;
      
      resolve(respuesta);
    });
  });
}

async function generarRespuestaPrecio() {
  return new Promise((resolve) => {
    db.get('SELECT precio FROM precio_comida ORDER BY fecha_actualizacion DESC LIMIT 1', [], (err, row) => {
      if (err || !row) {
        resolve(`${emojis.precio} *PRECIO*\n━━━━━━━━━━━━━━━━━━━━━\nConsulta el precio directamente con nosotros.\n━━━━━━━━━━━━━━━━━━━━━`);
        return;
      }
      
      resolve(`${emojis.precio} *PRECIO*\n━━━━━━━━━━━━━━━━━━━━━\nLa comida corrida hoy está en *$${row.precio}*\n\nIncluye: primer tiempo, segundo tiempo, guisado, bebida y postre.\n━━━━━━━━━━━━━━━━━━━━━`);
    });
  });
}

async function generarRespuestaDomicilio(textoOriginal) {
  return new Promise((resolve) => {
    db.get('SELECT activo, telefono_reenvio FROM domicilio_config WHERE id = 1', [], (err, row) => {
      if (!row || row.activo !== 1) {
        resolve(`${emojis.domicilio} *SERVICIO A DOMICILIO*\n━━━━━━━━━━━━━━━━━━━━━\nPor el momento no tenemos servicio a domicilio.\n\nPuedes visitarnos en:\n📍 ${config.direccion}\n🕒 ${config.horario}\n━━━━━━━━━━━━━━━━━━━━━\n¡Te esperamos!`);
        return;
      }
      
      // Si el texto ya contiene "sí" de una respuesta anterior
      if (textoOriginal.toLowerCase().includes('sí') || textoOriginal.toLowerCase().includes('si')) {
        // Esto se maneja en el evento de mensaje
        resolve(null);
      } else {
        resolve(`${emojis.domicilio} *SERVICIO A DOMICILIO*\n━━━━━━━━━━━━━━━━━━━━━\nSí tenemos servicio a domicilio.\n\n¿Te interesa? Responde *SÍ* para que te llamemos y tomemos tu pedido.\n━━━━━━━━━━━━━━━━━━━━━`);
      }
    });
  });
}

async function buscarPlatilloEspecifico(texto) {
  return new Promise((resolve) => {
    const palabras = texto.toLowerCase().split(' ');
    let nombreBuscar = '';
    
    // Tomar palabras relevantes (mayores a 3 letras)
    for (const palabra of palabras) {
      if (palabra.length > 3 && !['buenos', 'buenas', 'dias', 'tardes', 'noches', 'hola', 'como', 'cual', 'que'].includes(palabra)) {
        nombreBuscar += palabra + ' ';
      }
    }
    
    if (!nombreBuscar) {
      resolve(null);
      return;
    }
    
    nombreBuscar = nombreBuscar.trim();
    
    // Buscar en todas las tablas
    const tablas = [
      { nombre: 'desayunos', emoji: emojis.desayuno },
      { nombre: 'primer_tiempo', emoji: emojis.primer_tiempo },
      { nombre: 'segundo_tiempo', emoji: emojis.segundo_tiempo },
      { nombre: 'tercer_tiempo', emoji: emojis.tercer_tiempo },
      { nombre: 'bebida', emoji: emojis.bebida },
      { nombre: 'postre', emoji: emojis.postre }
    ];
    
    let resultados = [];
    let tablasPendientes = tablas.length;
    
    tablas.forEach(tabla => {
      db.all(`SELECT nombre, precio FROM ${tabla.nombre} WHERE nombre LIKE ? AND disponible = 1`, [`%${nombreBuscar}%`], (err, rows) => {
        if (rows && rows.length > 0) {
          rows.forEach(row => {
            resultados.push({
              ...row,
              emoji: tabla.emoji,
              tabla: tabla.nombre
            });
          });
        }
        
        tablasPendientes--;
        if (tablasPendientes === 0) {
          if (resultados.length > 0) {
            let respuesta = `${emojis.confirmacion} *SÍ, tenemos*\n━━━━━━━━━━━━━━━━━━━━━\n`;
            resultados.forEach(r => {
              if (r.precio) {
                respuesta += `${r.emoji} ${r.nombre} $${r.precio}\n`;
              } else {
                respuesta += `${r.emoji} ${r.nombre}\n`;
              }
            });
            respuesta += `━━━━━━━━━━━━━━━━━━━━━\n🕒 ${config.horario}\n📍 ${config.direccion}`;
            resolve(respuesta);
          } else {
            // Buscar en negado (si preguntó por algo que no hay)
            tablas.forEach(tabla => {
              db.all(`SELECT nombre FROM ${tabla.nombre} WHERE nombre LIKE ?`, [`%${nombreBuscar}%`], (err, rows) => {
                if (rows && rows.length > 0) {
                  resultados.push({
                    nombre: rows[0].nombre,
                    emoji: tabla.emoji
                  });
                }
              });
            });
            
            setTimeout(() => {
              if (resultados.length > 0) {
                resolve(`${emojis.negacion} *LO SENTIMOS*\n━━━━━━━━━━━━━━━━━━━━━\n${resultados[0].emoji} *${resultados[0].nombre}* ya se terminó.\n━━━━━━━━━━━━━━━━━━━━━`);
              } else {
                resolve(null);
              }
            }, 500);
          }
        }
      });
    });
  });
}

// ====================================
// MANEJADOR DE DOMICILIO (REENVÍO)
// ====================================

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
      
      const mensajeReenvio = `
🚚 *SOLICITUD DE DOMICILIO*
━━━━━━━━━━━━━━━━━━━━━

👤 Cliente: *${numeroMostrar}*
🕒 Hora: ${hora}

━━━━━━━━━━━━━━━━━━━━━
✅ Solicitó ser contactado

📞 *Llama ahora:*
${numeroMostrar}
━━━━━━━━━━━━━━━━━━━━━

Toma su pedido por teléfono.`;

      // Guardar en base de datos
      db.run('INSERT INTO solicitudes_domicilio (numero_cliente) VALUES (?)', [numeroMostrar]);
      
      // Enviar mensaje (el número ya tiene 521 para el reenvío)
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
    printQRInTerminal: false,
    browser: ['ComiVoz', 'Safari', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('QR recibido (no se usará, solo código de emparejamiento)');
    }
    
    if (connection === 'open') {
      console.log('✅ WhatsApp CONECTADO');
      console.log(`🤖 Bot listo para recibir mensajes`);
      console.log(`📱 Dueña: ${config.numero_duena}`);
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
    const esGrupo = remitente.endsWith('@g.us');
    if (esGrupo) return; // Ignorar grupos
    
    const numeroLimpio = formatearNumeroMostrar(remitente);
    const esDuena = (numeroLimpio === formatearNumeroMostrar(config.numero_duena));
    
    // PROCESAR AUDIOS (solo de la dueña)
    if (m.message.audioMessage && esDuena) {
      console.log(`🎤 Audio recibido de dueña: ${numeroLimpio}`);
      
      // Descargar audio
      const buffer = await m.message.audioMessage.download();
      const audioPath = `/tmp/audio_${Date.now()}.ogg`;
      fs.writeFileSync(audioPath, buffer);
      
      // Procesar con Vosk
      const texto = await procesarAudio(audioPath);
      console.log(`📝 Transcripción: ${texto}`);
      
      // Interpretar instrucción
      const respuesta = await interpretarInstruccion(texto, remitente);
      
      if (respuesta) {
        await sock.sendMessage(remitente, { text: respuesta });
      }
      
      // Limpiar
      fs.unlinkSync(audioPath);
      return;
    }
    
    // PROCESAR TEXTOS (clientes)
    if (m.message.conversation) {
      const texto = m.message.conversation;
      console.log(`💬 Mensaje de ${numeroLimpio}: ${texto}`);
      
      // Detectar intención
      const intencion = detectarIntencion(texto);
      
      // Verificar si es respuesta a domicilio (SÍ/NO)
      if (texto.toLowerCase() === 'sí' || texto.toLowerCase() === 'si') {
        // Verificar si hay una solicitud de domicilio pendiente
        db.get('SELECT activo FROM domicilio_config WHERE id = 1 AND activo = 1', [], async (err, row) => {
          if (row && row.activo === 1) {
            // Enviar confirmación al cliente
            await sock.sendMessage(remitente, { text: '👍 Gracias. En unos minutos te llamaremos para tomar tu pedido.' });
            
            // Reenviar a la dueña
            await manejarSolicitudDomicilio(remitente, sock);
          }
        });
        return;
      }
      
      // Generar respuesta según intención
      const respuesta = await generarRespuesta(intencion, texto);
      
      if (respuesta) {
        // Si la respuesta es muy larga, dividir en múltiples mensajes
        if (respuesta.length > 1500) {
          const partes = respuesta.split('\n\n');
          let mensajeActual = '';
          
          for (const parte of partes) {
            if ((mensajeActual + parte).length > 1500) {
              await sock.sendMessage(remitente, { text: mensajeActual });
              mensajeActual = parte;
            } else {
              mensajeActual += (mensajeActual ? '\n\n' : '') + parte;
            }
          }
          
          if (mensajeActual) {
            await sock.sendMessage(remitente, { text: mensajeActual });
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
// INICIAR BOT
// ====================================

console.log('====================================');
console.log('  COMIVOZ - INICIANDO');
console.log('====================================');

conectarWhatsApp().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
