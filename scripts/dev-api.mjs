#!/usr/bin/env node
// Local stand-in for the Vercel functions, so the phone can hit a real backend
// during the build without a deploy on every change.
//
//   node scripts/dev-api.mjs            # listens on 0.0.0.0:8788
//
// It imports the SAME handler files Vercel runs (Node 22 strips the TS types),
// so there is no second implementation to drift out of sync. Keys come from
// .env.local, which is gitignored and never reaches the app bundle.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

const PORT = Number(process.env.PORT ?? 8788);

// --- env ---------------------------------------------------------------
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

// --- routes ------------------------------------------------------------
// Guarded: handlers land at different times during the build (Agent B owns
// document/edit/versions). A route whose file does not exist yet is skipped with
// a warning rather than taking the whole dev server down with it.
const ROUTE_FILES = {
  '/api/transcribe': '../api/transcribe.ts',
  '/api/document': '../api/document.ts',
  '/api/versions': '../api/versions.ts',
  '/api/edit': '../api/edit.ts',
};

const routes = {};
const missing = [];
for (const [path, file] of Object.entries(ROUTE_FILES)) {
  try {
    routes[path] = (await import(file)).default;
  } catch (e) {
    missing.push(`${path} (${e.code === 'ERR_MODULE_NOT_FOUND' ? 'not written yet' : e.message})`);
  }
}

function lanAddress() {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return 'localhost';
}

createServer(async (req, res) => {
  const path = (req.url ?? '').split('?')[0];
  const handler = routes[path];
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks).toString('utf8');
  const started = Date.now();

  // Minimal Vercel-shaped res so the handler needs no changes.
  const shim = {
    status(code) {
      this._code = code;
      return this;
    },
    setHeader(k, v) {
      res.setHeader(k, v);
    },
    json(data) {
      const payload = data === null ? '' : JSON.stringify(data);
      res.writeHead(this._code ?? 200, { 'Content-Type': 'application/json' });
      res.end(payload);
      console.log(`${req.method} ${path} → ${this._code ?? 200} (${Date.now() - started}ms)`);
    },
  };

  try {
    await handler({ method: req.method, body }, shim);
  } catch (e) {
    console.error(`${req.method} ${path} threw:`, e);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'handler threw' }));
    }
  }
}).listen(PORT, '0.0.0.0', () => {
  const host = lanAddress();
  console.log(`dev-api listening on http://${host}:${PORT}`);
  console.log(`  routes:  ${Object.keys(routes).join(', ') || '(none)'}`);
  if (missing.length) console.log(`  pending: ${missing.join(', ')}`);
  console.log(`  point the app at: EXPO_PUBLIC_API_BASE=http://${host}:${PORT}`);
  console.log(`  OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? 'present' : 'MISSING'}`);
});
