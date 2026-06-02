const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Cargar variables de entorno desde un archivo .env en entorno local (desarrollo)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// URL de conexión a MongoDB.
// Toma el valor del archivo .env (local) o de las variables de entorno de Render (producción).
// Si no hay ninguno, intenta conectarse de forma local por defecto.
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gestor_finanzas';
const DB_NAME = 'gestor_finanzas';
const COLLECTION_NAME = 'datos_usuario';

let db;

// Inicializar la conexión a MongoDB
MongoClient.connect(MONGODB_URI)
  .then(client => {
    console.log('Conectado exitosamente a MongoDB');
    db = client.db(DB_NAME);
  })
  .catch(err => {
    console.error('Error al conectar a MongoDB:', err);
  });

// MIME types para los archivos estáticos
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // API Endpoints
  if (req.url.startsWith('/api/finances')) {
    if (req.method === 'GET') {
      handleGetFinances(req, res);
    } else if (req.method === 'POST') {
      handlePostFinances(req, res);
    } else {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    }
    return;
  }

  // Servir archivos estáticos
  serveStaticFile(req, res);
});

async function handleGetFinances(req, res) {
  if (!db) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Base de datos no disponible' }));
  }

  try {
    const collection = db.collection(COLLECTION_NAME);
    // Buscamos el único registro de finanzas (usamos un identificador fijo para el usuario actual)
    const data = await collection.findOne({ userId: 'default_user' });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data || {}));
  } catch (err) {
    console.error('Error obteniendo datos:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Error leyendo datos de la base de datos' }));
  }
}

async function handlePostFinances(req, res) {
  if (!db) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Base de datos no disponible' }));
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const parsedData = JSON.parse(body);
      
      // Validación básica
      if (!parsedData.income || !parsedData.period || !parsedData.categories) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Faltan campos requeridos' }));
      }

      const collection = db.collection(COLLECTION_NAME);
      
      // Upsert: Si existe el documento para 'default_user', lo actualiza. Si no, lo crea.
      await collection.updateOne(
        { userId: 'default_user' },
        { $set: { 
            income: parsedData.income, 
            period: parsedData.period, 
            categories: parsedData.categories 
          } 
        },
        { upsert: true }
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Datos guardados exitosamente en MongoDB' }));
    } catch (e) {
      console.error('Error guardando datos:', e);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'JSON inválido o error de base de datos' }));
    }
  });
}

function serveStaticFile(req, res) {
  // Normalizar la URL para quitar parámetros de búsqueda si los hay
  const urlPath = req.url.split('?')[0];
  
  // Construir la ruta al archivo
  let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
  let extname = String(path.extname(filePath)).toLowerCase();
  
  // Si no hay extensión y no es la raíz, intentamos añadir .html (soporte para URLs limpias)
  if (!extname && urlPath !== '/') {
    filePath += '.html';
    extname = '.html';
  }
  
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Sorry, check with the site admin for error: ${err.code} ..\n`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}/`);
});