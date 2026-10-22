import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve('qrcode/package.json'));
const output = 'public/jahiz/vendor';
await mkdir(output, { recursive: true });
await build({
  entryPoints: [path.join(root, 'lib/browser.js')],
  outfile: `${output}/qrcode.js`,
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'QRCode',
  minify: true,
  legalComments: 'eof',
  target: ['es2020'],
});
const license = await readFile(path.join(root, 'license'), 'utf8');
await writeFile(`${output}/qrcode-LICENSE.txt`, `${license.trimEnd()}\n`);
