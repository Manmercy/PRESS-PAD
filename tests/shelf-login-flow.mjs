import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const catalogContext = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../data/catalog.js', import.meta.url), 'utf8'), catalogContext);
const catalog = catalogContext.window.PRESSPAD_CATALOG;
assert.equal(new Set(catalog.map(track => track.spineColor)).size, catalog.length);
for (const track of catalog) {
  assert.match(track.spineColor, /^#[0-9a-f]{6}$/i);
  const rgb = track.spineColor.slice(1).match(/../g).map(hex => {
    const value = parseInt(hex, 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  assert.ok(1.05 / (luminance + .05) >= 4.5, `${track.id}: white text contrast`);
}

const elements = { '#shelfCount': {}, '#tapeShelf': {}, '#miniCalendar': {} };
const shelf = {
  catalog, shelfIds: catalog.map(track => track.id), receivedDaily: true, shelfCalendar: { render() {} },
  updateShelfPlayButton() {},
  $: selector => elements[selector], $$: () => [],
};
vm.createContext(shelf);
vm.runInContext(app.slice(app.indexOf('  function escapeHtml('), app.indexOf('  function formatTime(')), shelf);
vm.runInContext(app.slice(app.indexOf('  function renderShelf('), app.indexOf('  function openArtist(')), shelf);
vm.runInContext('renderShelf()', shelf);
const rendered = elements['#tapeShelf'].innerHTML;
for (const track of catalog) {
  assert.ok(rendered.includes(`--spine-color:${track.spineColor}`));
  assert.ok(rendered.includes(`data-play-track="${track.id}"`));
  assert.ok(rendered.includes(`<strong>${track.title}</strong>`));
  assert.ok(rendered.includes(`<span>${track.artist}</span>`));
}
shelf.shelfIds = [catalog[11].id];
vm.runInContext('renderShelf()', shelf);
assert.match(elements['#tapeShelf'].innerHTML, /12 <span>COM/); // Stable catalog number, not shelf order.
assert.ok(elements['#tapeShelf'].innerHTML.includes(catalog[11].spineColor));
shelf.shelfIds = [];
vm.runInContext('renderShelf()', shelf);
assert.match(elements['#tapeShelf'].innerHTML, /Your shelf is empty/);

// Unit media doubles: verify behavior without playing audio or touching user storage.
let playCalls = 0;
let mode = 'blocked';
let finishPending;
const toggleHandlers = {};
const documentHandlers = {};
const music = {
  paused: true, error: null, loads: 0,
  play() {
    playCalls++;
    if (mode === 'blocked') return Promise.reject({ name: 'NotAllowedError' });
    if (mode === 'error') return Promise.reject({ name: 'NotSupportedError' });
    if (mode === 'pending') return new Promise(resolve => { finishPending = () => { this.paused = false; resolve(); }; });
    this.paused = false;
    return Promise.resolve();
  },
  pause() { this.paused = true; },
  load() { this.loads++; this.error = null; },
};
const bgm = {
  entryMusic: music, entryMusicEnabled: true, entryMusicState: 'ready', entryScreen: { hidden: false },
  entryMusicToggle: {
    attributes: {}, setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, fn) { toggleHandlers[type] = fn; },
  },
  document: { addEventListener(type, fn) { documentHandlers[type] = fn; } },
};
vm.createContext(bgm);
vm.runInContext(app.slice(app.indexOf('  function updateEntryMusicButton('), app.indexOf('  function activateApp(')), bgm);
vm.runInContext(app.slice(app.indexOf("  entryMusicToggle.addEventListener('click'"), app.indexOf("  $('#logoutButton').addEventListener('click'")), bgm);
await vm.runInContext('startEntryMusic()', bgm);
assert.equal(playCalls, 1);
assert.equal(bgm.entryMusicToggle.textContent, 'BGM / AUTO');
assert.equal(bgm.entryMusicToggle.attributes['aria-pressed'], 'false');
const gesture = type => ({ type, isTrusted: true, target: { closest: () => null }, key: 'a' });
const flushMedia = () => new Promise(resolve => setImmediate(resolve));
documentHandlers.click(gesture('click'));
await flushMedia();
assert.equal(playCalls, 2); // A blocked first gesture must not exhaust future retries.
mode = 'ok';
documentHandlers.click(gesture('click'));
await flushMedia();
assert.equal(bgm.entryMusicToggle.textContent, 'BGM / ON');
toggleHandlers.click();
assert.ok(music.paused);
assert.equal(bgm.entryMusicToggle.textContent, 'BGM / OFF');
const stoppedCalls = playCalls;
documentHandlers.click(gesture('click'));
documentHandlers.keydown(gesture('keydown'));
await vm.runInContext('startEntryMusic()', bgm);
assert.equal(playCalls, stoppedCalls); // OFF respected across gestures and lifecycle calls.
bgm.entryMusicEnabled = true;
documentHandlers.keydown(gesture('keydown'));
await flushMedia();
assert.equal(bgm.entryMusicToggle.textContent, 'BGM / ON');
music.pause();
bgm.entryScreen.hidden = true;
await vm.runInContext('startEntryMusic()', bgm);
assert.equal(playCalls, stoppedCalls + 1);
bgm.entryScreen.hidden = false;
mode = 'pending';
const pending = vm.runInContext('startEntryMusic()', bgm);
bgm.entryScreen.hidden = true;
finishPending();
await pending;
assert.ok(music.paused); // Late resolution cannot play on Home.
music.paused = false;
vm.runInContext('handleEntryMusicPlay()', bgm);
assert.ok(music.paused); // Includes the native autoplay attribute's play event.
bgm.entryScreen.hidden = false;
mode = 'error';
await vm.runInContext('startEntryMusic()', bgm);
assert.equal(bgm.entryMusicToggle.textContent, 'BGM / RETRY');
music.error = { code: 4 };
mode = 'ok';
toggleHandlers.click();
await flushMedia();
assert.equal(music.loads, 1);
assert.equal(bgm.entryMusicToggle.textContent, 'BGM / ON');
const audioTag = html.match(/<audio id="entryMusic"[^>]+>/)[0];
assert.match(audioTag, /autoplay/);
assert.match(audioTag, /loop/);
assert.match(app, /window\.addEventListener\('pageshow', startEntryMusic\)/);
assert.match(app, /entryMusic\.volume = \.18/);
assert.ok(fs.existsSync(new URL('../' + audioTag.match(/src="([^"]+)"/)[1], import.meta.url)));
console.log('PASS: 12 distinct high-contrast shelf spines, stable labels, autoplay/retry/OFF/keyboard/late-play/error behavior.');
