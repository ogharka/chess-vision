// Full-strength Stockfish 18 (complete NNUE network), single-threaded.
// The 113 MB engine is hosted in 9 chunks; this worker downloads them (or reads them from the
// browser cache), checks the SHA-256 of the result, and only then starts the engine.
const PARTS = 9;
const SIZE = 112992459;
const SHA256 = 'f611ac05ddb248fe975a4f180ac9fec7f7fb650f8f17f5fe4230fcc0fe6419c7';
const CACHE = 'chess-vision-sf18-full-v1';
const realFetch = self.fetch.bind(self);
let wasmPromise = null;

async function getPart(i, cache) {
  const url = new URL(`full/sf-full-${String(i).padStart(2, "0")}.wasm`, self.location.href).href;
  if (cache) {
    try { const hit = await cache.match(url); if (hit) return { buf: new Uint8Array(await hit.arrayBuffer()), cached: true }; } catch (e) { /* no cache */ }
  }
  const r = await realFetch(url, { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`engine part ${i} failed to download (${r.status})`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (cache) { try { await cache.put(url, new Response(buf.slice(0))); } catch (e) { /* storage full or blocked */ } }
  return { buf, cached: false };
}

function loadWasm() {
  if (wasmPromise) return wasmPromise;
  wasmPromise = (async () => {
    let cache = null;
    try { cache = await caches.open(CACHE); } catch (e) { cache = null; }
    const out = new Uint8Array(SIZE);
    let got = 0;
    const offsets = [];
    for (let i = 0, o = 0; i < PARTS; i++, o += 14000000) offsets.push(o);
    await Promise.all(offsets.map(async (off, i) => {
      const { buf } = await getPart(i, cache);
      out.set(buf, off);
      got += buf.length;
      postMessage('info string download ' + Math.floor((got / SIZE) * 100));
    }));
    if (got !== SIZE) throw new Error('engine download incomplete');
    const digest = await crypto.subtle.digest('SHA-256', out);
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    if (hex !== SHA256) {
      try { await caches.delete(CACHE); } catch (e) { /* ignore */ }
      postMessage('info string engine checksum failed');
      throw new Error('engine checksum mismatch');
    }
    postMessage('info string download verified');
    return out;
  })();
  return wasmPromise;
}

self.fetch = (url, opts) => (String(url).includes('.wasm')
  ? loadWasm().then((b) => new Response(b, { headers: { 'Content-Type': 'application/wasm' } }))
  : realFetch(url, opts));

importScripts('full/sf-full-core.js');
