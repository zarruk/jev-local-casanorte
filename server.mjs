import http from 'node:http';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {analyze} from './analysis.mjs';
import {validateRequest} from './core.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const assets = new Map([
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['public/index.html', 'text/html; charset=utf-8']],
  ...['app.mjs', 'xlsx.full.min.js'].map(name => ['/'+name, ['public/'+name, 'text/javascript; charset=utf-8']]),
  ...['core.mjs', 'config.mjs'].map(name => ['/'+name, [name, 'text/javascript; charset=utf-8']]),
  ...['01_Tickets_soporte.xlsx', '02_Resenas_clientes.xlsx', '03_Revision_respuestas.xlsx'].map(name => ['/ejemplos/'+name, ['public/ejemplos/'+name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']])
]);
const security = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  'Cache-Control': 'no-store'
};
function json(res, status, value) {
  res.writeHead(status, {...security, 'Content-Type': 'application/json; charset=utf-8'});
  res.end(JSON.stringify(value));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const large = () => reject(Object.assign(new Error('Entrada demasiado grande.'), {status:413}));
    if (Number(req.headers['content-length']) > limit) { req.resume(); large(); return; }
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) { large(); chunks.length = 0; return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
    req.on('aborted', () => reject(new Error('Solicitud interrumpida.')));
  });
}

// Inyectar fetchImpl permite probar HTTP real con respuestas de Jev simuladas.
export function createAppServer({key = '', fetchImpl = globalThis.fetch} = {}) {
  let apiKey = key.trim(), running = false;
  return http.createServer(async (req, res) => {
    try {
      const port = req.socket.localPort;
      const allowedHosts = ['localhost:'+port, '127.0.0.1:'+port];
      if (!allowedHosts.includes(req.headers.host)) return json(res, 403, {error:'Usa la dirección localhost del servidor.'});
      const url = new URL(req.url, 'http://'+req.headers.host);
      if (url.pathname.startsWith('/api/')) {
        if (req.headers.origin && req.headers.origin !== url.origin) return json(res, 403, {error:'Origen no permitido.'});
        if (req.method === 'POST' && !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return json(res, 415, {error:'Se requiere JSON.'});
        if (url.pathname === '/api/config' && req.method === 'GET') return json(res, 200, {configured:!!apiKey, runtime:'local'});
        if (url.pathname === '/api/config' && req.method === 'POST') {
          if (running) return json(res, 409, {error:'Espera a que termine el análisis.'});
          const body = JSON.parse(await readBody(req, 2000));
          if (typeof body.key !== 'string' || body.key.trim().length < 8 || body.key.length > 500) throw new Error('Introduce una API key válida de TypeSafe.');
          apiKey = body.key.trim();
          return json(res, 200, {configured:true, runtime:'local'});
        }
        if (url.pathname === '/api/analyze' && req.method === 'POST') {
          if (!apiKey) return json(res, 409, {error:'Configura la API key de TypeSafe.'});
          const {records, definition} = validateRequest(JSON.parse(await readBody(req, 2000000)));
          if (running) return json(res, 409, {error:'Ya hay un análisis en curso.'});
          running = true;
          const abort = new AbortController();
          res.on('close', () => { if (!res.writableEnded) abort.abort(); });
          res.writeHead(200, {...security, 'Content-Type':'application/x-ndjson; charset=utf-8', 'Cache-Control':'no-store, no-transform'});
          res.flushHeaders();
          const emit = event => { if (!abort.signal.aborted && !res.destroyed) res.write(JSON.stringify(event)+'\n'); };
          try {
            await analyze(records, definition, {key:apiKey, emit, fetchImpl, signal:abort.signal});
          } catch {
            emit({event:'fatal', error:'La ejecución se interrumpió. Puedes descargar los resultados recibidos.'});
          } finally { running = false; res.end(); }
          return;
        }
        return json(res, 404, {error:'Ruta no encontrada.'});
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, {error:'Método no permitido.'});
      const asset = assets.get(url.pathname);
      if (!asset) return json(res, 404, {error:'No encontrado.'});
      const content = await fs.readFile(path.join(root, asset[0]));
      res.writeHead(200, {...security, 'Content-Type':asset[1], 'Content-Length':content.length});
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 400, {error:error instanceof SyntaxError ? 'JSON inválido.' : error.message || 'Solicitud inválida.'});
      else res.end();
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (Number(process.versions.node.split('.')[0]) < 22) {
    console.error('Instala Node.js 22 o posterior y vuelve a iniciar.');
    process.exit(1);
  }
  const envFile = path.join(root, '.env');
  try { process.loadEnvFile(envFile); } catch (error) { if (error.code !== 'ENOENT') { console.error('No se pudo leer .env.'); process.exit(1); } }
  const port = Number(process.env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('PORT debe ser un puerto válido.'); process.exit(1); }
  const server = createAppServer({key:process.env.TYPESAFE_API_KEY || ''});
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? 'El puerto '+port+' está ocupado. Cierra la otra instancia o cambia PORT en .env.' : 'No se pudo iniciar el servidor: '+error.code);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    console.log('\nJev local listo. Abre http://localhost:'+port+' en tu navegador.');
    console.log('Configura tu clave de TypeSafe, carga el Excel y pulsa Analizar.');
    console.log('Para cerrar: Ctrl+C.\n');
  });
}
