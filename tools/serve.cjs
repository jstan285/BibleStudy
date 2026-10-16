const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../docs');
const mount = '/bible-study-tool/';
const port = Number(process.env.BIBLE_STUDY_PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server = http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400); return response.end('Invalid address'); }
  if (pathname === '/') { response.writeHead(302, {Location:mount}); return response.end(); }
  if (!pathname.startsWith(mount)) { response.writeHead(404); return response.end('Not found'); }
  const file = path.resolve(root, pathname.slice(mount.length) || 'index.html');
  if (!file.startsWith(root + path.sep)) { response.writeHead(403); return response.end('Not allowed'); }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404); return response.end('Not found'); }
    response.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    response.end(request.method === 'HEAD' ? undefined : data);
  });
});
server.listen(port, '127.0.0.1', () => console.log(`Local URL: http://127.0.0.1:${port}${mount}`));
server.on('error', error => { console.error(error.message); process.exit(1); });
