import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const dist = resolve('dist');
const admin = resolve('build/apps-script/admin/Index.html');
const type = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  const file = pathname === '/admin.html' ? admin : resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (file !== admin && !file.startsWith(dist + sep)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': type[extname(file)] ?? 'application/octet-stream' }).end(data);
  } catch { response.writeHead(404).end(); }
}).listen(48731, '127.0.0.1');
