import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requireFile = (file) => assert.ok(fs.statSync(path.join(root, file)).isFile(), `Missing file: ${file}`);
const context = { window: {} };
vm.runInNewContext(read('data/catalog.js'), context);
const catalog = context.window.PRESSPAD_CATALOG;
assert.equal(catalog.length, 12);
assert.equal(new Set(catalog.map((track) => track.id)).size, 12);
assert.equal(context.window.PRESSPAD_ARTISTS.length, 6);
const manifest = JSON.parse(read('docs/lite-manifest.json'));
assert.equal(manifest.tracks.length, 12);
assert.equal(new Set(manifest.tracks.map((track) => track.file)).size, 12);
for (const track of catalog) {
  assert.ok(track.audio.endsWith('.m4a'));
  requireFile(track.audio);
  assert.ok(manifest.tracks.some((entry) => entry.file === track.audio.replace(/^\.\//, '')));
  assert.ok(track.editions.common && track.editions.rare);
}
for (const track of manifest.tracks) {
  const bytes = fs.readFileSync(path.join(root, track.file));
  assert.equal(bytes.length, track.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), track.sha256);
  assert.ok(Math.abs(track.originalDuration - track.duration) <= 0.15);
}
for (const name of ['bg-home-v012', 'bg-login-v012', 'bg-radio-v012', 'shelf-room-v012', 'player-device-v012', 'sora-rei-reference-fallback']) {
  requireFile(`assets/images/${name}.webp`);
}
for (const file of ['index.html', 'css/styles.css', 'js/app.js', 'data/catalog.js']) {
  assert.ok(!read(file).includes('.mp3'), `Stale MP3 reference in ${file}`);
}
for (const match of read('index.html').matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
  if (!/^(?:https?:|data:|#)/.test(match[1])) requireFile(match[1]);
}
for (const match of read('css/styles.css').matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
  if (!/^(?:https?:|data:|#)/.test(match[1])) requireFile(path.join('css', match[1]));
}
let total = 0;
let largest = 0;
let count = 0;
function measure(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.DS_Store'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) measure(file);
    else { const bytes = fs.statSync(file).size; total += bytes; largest = Math.max(largest, bytes); count++; }
  }
}
measure(root);
assert.ok(total < 25_000_000, `Package exceeds 25 MB: ${total} bytes`);
console.log(`Lite validation passed: 12 full-length AAC tracks, matching hashes, resolved static assets. ${count} files; ${(total / 1e6).toFixed(2)} MB total; ${(largest / 1e6).toFixed(2)} MB largest file.`);
