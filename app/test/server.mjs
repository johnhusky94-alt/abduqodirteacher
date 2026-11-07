// Local stand-in for Supabase: serves the built site and answers /rest/v1/rpc/<fn> from the local Postgres.
import http from 'node:http'; import { readFileSync } from 'node:fs'; import { spawnSync } from 'node:child_process';
const PORT = +process.env.PORT || 8787, ROOT = new URL('../../', import.meta.url).pathname;
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/rest/v1/rpc/')) {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      const fn = req.url.split('/').pop();
      const r = spawnSync('psql', ['-h', '/tmp/pgtest', '-p', '5433', '-U', 'postgres', '-qtA', '-v', 'ON_ERROR_STOP=1', '-v', 'fn=' + fn, '-v', 'j=' + (body || '{}')],
        { input: "select rpc_call(:'fn', :'j'::jsonb);", encoding: 'utf8', maxBuffer: 1 << 28 });
      if (r.status !== 0) { const m = (r.stderr.match(/ERROR:\s+(.*)/) || [])[1] || r.stderr; res.writeHead(400, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ message: m.trim() })); }
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(r.stdout.trim() || 'null');
    }); return;
  }
  const html = readFileSync(ROOT + 'index.html', 'utf8').replace("'https://meiokexdxhyjcyfpvjvx.supabase.co'", `'http://localhost:${PORT}'`);
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html);
}).listen(PORT, () => console.log('local site on', PORT));
