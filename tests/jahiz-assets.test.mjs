import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import jsQR from 'jsqr';
import { onRequest } from '../functions/jahiz/_middleware.js';

test('shipped browser QR bundle roundtrips venue URLs with an independent decoder', async () => {
  const context = vm.createContext({ TextEncoder, Uint8Array, Uint32Array, console });
  vm.runInContext(await readFile('public/jahiz/vendor/qrcode.js', 'utf8'), context);
  const destination = 'https://rts-royal.pages.dev/jahiz/s/?shop=jahiz-demo-cafe';
  const { modules } = context.QRCode.create(destination, { errorCorrectionLevel: 'M' });
  const scale = 5;
  const width = (modules.size + 8) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (!modules.get(y, x)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const offset = (((y + 4) * scale + dy) * width + (x + 4) * scale + dx) * 4;
          pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
        }
      }
    }
  }
  assert.equal(jsQR(pixels, width, width)?.data, destination);
  const svg = await context.QRCode.toString(destination, { type: 'svg' });
  assert.match(svg, /<svg/);
  assert.doesNotMatch(svg, /<script|https?:\/\/(?!www.w3.org)/);
});

test('Jahiz CSP replaces inherited image restrictions without relaxing scripts', async () => {
  const response = await onRequest({
    request: new Request('https://rts.example/jahiz/s/?shop=example'),
    next: async () => new Response('customer page', {
      headers: { 'Content-Security-Policy': "img-src 'self'", 'Content-Type': 'text/html' },
    }),
  });
  assert.equal(await response.text(), 'customer page');
  assert.equal(response.headers.get('Content-Type'), 'text/html');
  assert.match(response.headers.get('Content-Security-Policy'), /img-src 'self' data: https:/);
  assert.match(response.headers.get('Content-Security-Policy'), /script-src 'self';/);
  assert.doesNotMatch(response.headers.get('Content-Security-Policy'), /unsafe-inline|unsafe-eval|,/);
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
});
