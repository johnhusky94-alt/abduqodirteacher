// Tiny headless-Chrome driver (no packages): launch, open a page, run JS in it, take screenshots.
import { spawn } from 'node:child_process'; import { writeFileSync, mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os';
export async function launch() {
  const dir = mkdtempSync(tmpdir() + '/chr-');
  const p = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', '--user-data-dir=' + dir, '--window-size=420,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((ok, no) => { let b = ''; p.stderr.on('data', d => { b += d; const m = b.match(/DevTools listening on (ws:\S+)/); if (m) ok(m[1]); }); setTimeout(() => no(new Error('chrome did not start')), 15000); });
  const port = new URL(wsUrl).port;
  const page = async () => {
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const wait = {}, logs = [];
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait[d.id]) { wait[d.id](d); delete wait[d.id]; }
      if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description).join(' '));
      if (d.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text)); };
    const send = (method, params = {}) => new Promise(r => { const i = ++id; wait[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Runtime.enable'); await send('Page.enable');
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval error'); return r.result.result.value; };
    return {
      logs, send, ev,
      go: async url => { await send('Page.navigate', { url }); await new Promise(r => setTimeout(r, 1500)); },
      sleep: ms => new Promise(r => setTimeout(r, ms)),
      until: async (expr, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await ev(expr)) return true; } catch (e) {} await new Promise(r => setTimeout(r, 150)); } throw new Error('timeout: ' + expr); },
      shot: async file => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(file, Buffer.from(r.result.data, 'base64')); },
      close: () => ws.close(),
    };
  };
  return { page, kill: () => p.kill() };
}
