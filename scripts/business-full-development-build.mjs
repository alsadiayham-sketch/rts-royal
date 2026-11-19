import { build } from 'esbuild';
import { readFile, mkdir, writeFile, copyFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const business = process.env.RTS_BUSINESS_SOURCE || path.resolve(root, '..', '..', 'rts-business');
const renderer = path.join(business, 'src', 'renderer');
const output = path.join(root, 'test-results', 'business-full-development');
const adapter = path.join(root, 'scripts', 'business-full-development');
const assets = ['app.js', 'styles.css', 'restaurant-model.js', 'restaurant-supplies.js', 'restaurant-workspace.js'];
const checkedAssets = [...assets, 'owner-telemetry.js', 'restaurant-service.js', 'restaurant-shared.js'];
const checkedSource = await Promise.all(checkedAssets.map((file) => readFile(path.join(renderer, file), 'utf8')));
const source = checkedSource.slice(0, assets.length);
const credentialPattern = /AIza[0-9A-Za-z_-]{20,}|-----BEGIN [^-]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}/u;
for (const [index, text] of checkedSource.entries()) {
  if (credentialPattern.test(text)) {
    throw new Error(`Possible credential in ${checkedAssets[index]}; preview not generated.`);
  }
}
const version = JSON.parse(await readFile(path.join(business, 'package.json'), 'utf8')).version;
if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)) throw new Error('Invalid version.');
let html = await readFile(path.join(renderer, 'index.html'), 'utf8');
if (credentialPattern.test(html)) throw new Error('Possible credential in index.html; preview not generated.');
const footer = '<script src="firebase-config.js"></script>';
if (!html.includes(footer)) throw new Error('Renderer scripts changed; review browser adapter before building.');
function replaceEvents(text) {
  return text.replace(/(\s)on([a-z]+)=/gi, (whole, space, type) => {
    const name = type.toLowerCase();
    if (!['click', 'error'].includes(name)) throw new Error(`Unknown inline event ${name}; review dispatch allowlist.`);
    return `${space}data-rts-${name}=`;
  });
}
html = replaceEvents(html).replace(/(\s)style="/g, '$1data-rts-style="');
for (let index = 0; index < assets.length; index++) {
  if (assets[index].endsWith('.js')) source[index] = replaceEvents(source[index]).replace(/(\s)style="/g, '$1data-rts-style="');
}
const dispatchSource = await readFile(path.join(adapter, 'dispatch.js'), 'utf8');
const allowedActions = new Set([...dispatchSource.matchAll(/^    ([A-Za-z][A-Za-z0-9]*): \[/gm)].map(match => match[1]));
for (const text of [html, ...source.filter((_, index) => assets[index].endsWith('.js'))]) {
  const calls = [...text.matchAll(/data-rts-click="(?:event\.stopPropagation\(\);)?([A-Za-z][A-Za-z0-9]*)\(/g)];
  if ([...text.matchAll(/data-rts-click="/g)].length !== calls.length) {
    throw new Error('Unrecognized inline click expression; review before building.');
  }
  for (const match of calls) {
    if (!allowedActions.has(match[1])) throw new Error(`Unknown inline action ${match[1]}; review dispatch allowlist.`);
  }
}
html = html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'">\n    <link rel="stylesheet" href="preview.css">`)
  .replace('<body>', '<body>\n    <script src="dispatch.js"></script>\n    <div id="full-preview-warning" role="status">معاينة تطوير محلية ببيانات وهمية فقط — العمليات المالية والبيانات الحقيقية معطلة</div>\n    <pre id="full-preview-print"></pre>')
  .replaceAll('../assets/icon.png', 'icon.png')
  .replace(footer, '<script src="modules.js"></script>\n    <script src="adapter.js"></script>');
await mkdir(output, { recursive: true });
const allowedOutput = new Set([...assets, 'index.html', 'icon.png', 'adapter.js', 'preview.css', 'static-styles.css', 'dispatch.js', 'modules.js']);
for (const existing of await readdir(output)) {
  if (!allowedOutput.has(existing)) throw new Error(`Unexpected preview output ${existing}; review before rebuilding.`);
}
await rm(path.join(output, 'static-styles.css'), { force: true });
await Promise.all(assets.map((file, i) => writeFile(path.join(output, file), source[i])));
await Promise.all([
  writeFile(path.join(output, 'index.html'), html),
  copyFile(path.join(renderer, '..', 'assets', 'icon.png'), path.join(output, 'icon.png')),
  copyFile(path.join(adapter, 'adapter.js'), path.join(output, 'adapter.js')),
  copyFile(path.join(adapter, 'dispatch.js'), path.join(output, 'dispatch.js')),
  copyFile(path.join(adapter, 'preview.css'), path.join(output, 'preview.css')),
]);
await build({
  stdin: {
    contents: `window.__businessModules = { telemetry: require('./owner-telemetry'), service: require('./restaurant-service'), shared: require('./restaurant-shared'), crypto: require('node:crypto'), image: require('image-size'), version: ${JSON.stringify(version)} };`,
    resolveDir: renderer, sourcefile: 'preview-entry.js',
  },
  bundle: true, platform: 'browser', format: 'iife', outfile: path.join(output, 'modules.js'),
  plugins: [{
    name: 'preview-crypto',
    setup(plugin) {
      plugin.onResolve({ filter: /^node:crypto$/ }, () => ({ path: path.join(adapter, 'crypto.cjs') }));
    },
  }],
});
console.log(`Development-only fixture generated: ${output}`);
