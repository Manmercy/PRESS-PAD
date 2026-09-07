import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const app = read('js/app.js');
const html = read('index.html');
const css = read('css/styles.css');

const deck = html.split('<div class="hardware-controls"')[1].split('</div>')[0];
const hotspotMarkup = [...deck.matchAll(/data-hardware-control="([^"]+)" style="--hotspot-x:([\d.]+)%;--hotspot-w:([\d.]+)%"/g)];
assert.deepEqual(hotspotMarkup.map(match => match[1]), ['previous', 'rewind', 'play', 'next', 'stop', 'pause']);
let right = 0;
for (const [, action, xText, widthText] of hotspotMarkup) {
  const x = Number(xText), width = Number(widthText);
  assert.ok(x >= 0 && width > 0 && x + width <= 100, `${action} has normalized bounds`);
  assert.ok(x >= right - .1, `${action} does not overlap the prior control`);
  right = x + width;
}
assert.equal((html.match(/id="audioEngine"/g) || []).length, 1, 'No second player/audio state');
assert.match(css, /\.hardware-controls button \{[^}]*top: 74\.75%;[^}]*height: 11\.45%/);
assert.match(css, /translateY\(3px\)/);
assert.match(css, /\.hardware-controls button:focus-visible/);
assert.match(css, /@media \(max-width: 760px\) \{\s*\.hardware-controls, \.hardware-lcd \{ display: none; \}/);
assert.ok(html.includes('id="globalPlay"') && html.includes('id="seekInput"') && html.includes('id="globalEject"'), 'Lower controls preserved');

function classList(initial = []) {
  const set = new Set(initial);
  return { add: value => set.add(value), remove: value => set.delete(value), contains: value => set.has(value), toggle(value, on) { if (on) set.add(value); else set.delete(value); } };
}
function element(action) {
  return {
    dataset: action ? { hardwareControl: action } : {}, disabled: false, textContent: '', title: '', value: '', attributes: {}, classList: classList(),
    setAttribute(name, value) { this.attributes[name] = value; },
  };
}
const controls = Object.fromEntries(['previous', 'rewind', 'play', 'next', 'stop', 'pause'].map(action => [action, element(action)]));
const elements = new Map();
const $ = selector => {
  if (!elements.has(selector)) elements.set(selector, element());
  return elements.get(selector);
};
const tracks = ['a', 'b', 'c'].map(id => ({ id, title: id.toUpperCase(), audio: `${id}.m4a`, cover: `${id}.webp` }));
const audio = { paused: false, ended: false, currentTime: 35, duration: 100, dataset: { trackId: 'b' }, pause() { this.paused = true; } };
const context = {
  controls,
  $, $$: selector => selector === '[data-hardware-control]' ? Object.values(controls) : [],
  caseScene: { classList: classList(['state-playing']) }, currentTrack: tracks[1], ritualTrack: tracks[1], shelfIds: ['a', 'b', 'c'], catalog: tracks,
  audio, reduceMotion: true, transportState: 'playing', hardwareHoldTimer: null, hardwareSeekTimer: null, suppressHardwareNext: false,
  ritualDialog: { classList: classList() },
  formatTime(seconds) { const value = Math.floor(seconds); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; },
  updateShelfPlayButton() {}, refreshAccount() {}, stopShelfQueue() { context.queueStopped = true; }, clearRitualTimers() {},
  playSfx() { context.mechanicalClicks = (context.mechanicalClicks || 0) + 1; }, showToast() {},
  openRitual(track, daily, state) { context.ritualTrack = track; context.currentTrack = track; audio.dataset.trackId = track.id; context.lastOpen = [track.id, daily, state]; },
  startTrack(track) { context.currentTrack = track; context.ritualTrack = track; audio.dataset.trackId = track.id; audio.paused = false; context.started = track.id; },
  requestAnimationFrame(fn) { fn(); }, setTimeout, clearTimeout, setInterval, clearInterval,
};
vm.createContext(context);
const playerUpdate = app.slice(app.indexOf('  function updatePlayer('), app.indexOf('  function hardwareReady('));
const hardware = app.slice(app.indexOf('  function hardwareReady('), app.indexOf('  function updateShelfPlayButton('));
vm.runInContext(playerUpdate + hardware, context);
const run = code => vm.runInContext(code, context);

run('updatePlayer(true)');
assert.equal($('#globalPlay span').textContent, 'Ⅱ');
assert.equal($('#ritualPlay span:first-child').textContent, 'PAUSE');
assert.equal($('#hardwareLcdState').textContent, 'PLAY');
assert.equal(controls.play.disabled, true);
assert.equal(controls.pause.disabled, false);
run("runHardwareControl('pause'); updatePlayer(false)");
assert.equal($('#globalPlay span').textContent, '▶', 'Lower control mirrors hardware pause');
assert.equal($('#ritualPlay span:first-child').textContent, 'PLAY');
assert.ok(audio.paused);
run("runHardwareControl('play'); updatePlayer(true)");
assert.equal(context.started, 'b');
assert.equal($('#globalPlay span').textContent, 'Ⅱ', 'Lower control mirrors hardware play');
audio.currentTime = 35;
run("runHardwareControl('rewind')");
assert.equal(audio.currentTime, 25);
assert.equal($('#seekInput').value, '25');
assert.equal($('#hardwareLcdState').textContent, 'REW');
run("runHardwareControl('stop')");
assert.ok(audio.paused);
assert.equal(audio.currentTime, 0);
assert.equal($('#seekInput').value, '0');
assert.equal($('#globalPlay span').textContent, '▶');
assert.equal($('#hardwareLcdState').textContent, 'STOP');

audio.paused = false; audio.currentTime = 20; context.currentTrack = tracks[1]; context.ritualTrack = tracks[1]; audio.dataset.trackId = 'b';
run("runHardwareControl('previous')");
assert.equal(context.started, 'a');
assert.deepEqual(context.lastOpen, ['a', false, 'playing']);
context.currentTrack = tracks[1]; context.ritualTrack = tracks[1]; audio.dataset.trackId = 'b'; audio.paused = false;
run("runHardwareControl('next')");
assert.equal(context.started, 'c');
assert.ok(context.queueStopped, 'Manual physical track selection exits an existing queue through the shared state path');
context.currentTrack = tracks[2]; context.ritualTrack = tracks[2]; audio.dataset.trackId = 'c'; audio.currentTime = 70; audio.paused = false;
run("runHardwareControl('next')");
assert.equal(audio.currentTime, 80, 'Last-track next button remains a useful fast-forward control');

context.currentTrack = tracks[1]; context.ritualTrack = tracks[1]; audio.dataset.trackId = 'b'; audio.currentTime = 30; audio.paused = false;
run("startHardwareFastForward(controls.next)");
await new Promise(resolve => setTimeout(resolve, 480));
run("endHardwareFastForward(controls.next)");
assert.ok(audio.currentTime >= 35, 'Hold performs fast-forward');
assert.equal(context.suppressHardwareNext, true, 'Release suppresses accidental next after a hold');
context.caseScene.classList.remove('state-playing');
run('updateHardwareControls()');
assert.ok(Object.values(controls).every(button => button.disabled), 'All immersive hotspots disable without inserted media');
assert.ok(context.mechanicalClicks >= 6);
for (const event of ['click', 'pointerdown', 'pointerup', 'pointercancel', 'keydown', 'keyup']) {
  assert.ok(app.includes(`$('#hardwareControls').addEventListener('${event}'`), `${event} handler wired`);
}
assert.match(app, /audio\.addEventListener\('pause',[\s\S]*updatePlayer\(false\)/);
assert.match(app, /audio\.addEventListener\('timeupdate',[\s\S]*hardwareLcdDetail/);
console.log('PASS: normalized hotspots, one audio state, play/pause/stop/previous/next/rewind/hold-fast-forward, LCD/reel sync wiring, keyboard/pointer support, focus and mobile safety.');
