import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('public');

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  }));
  return nested.flat();
}

test('public artifact excludes credentials and private deployment files', async () => {
  for (const file of await files(root)) {
    const relative = path.relative(root, file);
    assert.doesNotMatch(relative, /(^|[\\/])(?:\.env|\.dev\.vars|\.git|node_modules|schema\.sql|wrangler\.toml)/);
    if (/\.(html|css|js|json|txt|svg)$/.test(file)) {
      const source = await readFile(file, 'utf8');
      assert.doesNotMatch(source, /cfat_[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}/);
      assert.doesNotMatch(source, /\{\{(?:PROJECT_NAME|ADMIN_PASS|ADMIN_USER|D1_DATABASE_ID)\}\}/);
    }
  }
});

test('HTML uses local, existing assets and CSP-compatible markup', async () => {
  for (const file of (await files(root)).filter(file => file.endsWith('.html'))) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /<script\b(?![^>]*\bsrc=)[^>]*>(?!\s*<\/script>)/i, file);
    assert.doesNotMatch(source, /\son(?:click|error|load|submit|change)\s*=/i, file);
    assert.doesNotMatch(source, /\sstyle\s*=/i, file);
    for (const match of source.matchAll(/\b(?:src|href)=["']([^"'?#]+)(?:[?#][^"']*)?["']/g)) {
      const url = match[1];
      if (!url || /^(?:https?:|data:|mailto:|tel:)/.test(url)) continue;
      let target = url.startsWith('/') ? path.join(root, url) : path.resolve(path.dirname(file), url);
      if (url.endsWith('/')) target = path.join(target, 'index.html');
      assert.ok((await stat(target)).isFile(), `${file}: missing ${url}`);
    }
  }
});
