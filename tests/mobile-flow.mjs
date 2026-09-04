import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const routes = ['home', 'discover', 'radio', 'shelf', 'settings'];
const nav = html.split('<nav class="mobile-nav"')[1].split('</nav>')[0];
assert.deepEqual([...nav.matchAll(/data-view="([^"]+)"/g)].map((match) => match[1]), routes);
assert.equal((html.match(/id="logoutButton"/g) || []).length, 1);
assert.ok(html.split('data-page="settings"')[1].split('</section>')[0].includes('id="logoutButton"'));

// Lightweight unit doubles exercise actual navigation/session handlers,
// not browser layout, media decoding, or rendered visual behavior.
function element(view) {
  const classes = new Set();
  return {
    dataset: { page: view, view }, hidden: false, open: true,
    attributes: {},
    classList: {
      toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    focus() { this.focused = true; },
    close() { this.open = false; },
    pause() { this.paused = true; },
  };
}
const pages = routes.map(element);
const buttons = routes.map(element);
const headings = new Map(routes.map((route) => [route, element(route)]));
let radioUpdates = 0;
let shelfRenders = 0;
const context = {
  $$: (selector) => selector === '.view' ? pages : buttons,
  $: (selector) => headings.get(selector.match(/data-page="([^"]+)"/)[1]),
  window: { scrollTo() {} }, reduceMotion: true,
  renderShelf() { shelfRenders++; }, updateRadio() { radioUpdates++; },
};
const navigation = app.slice(app.indexOf('  function setView('), app.indexOf('  function attachCoverFallback('));
vm.runInNewContext(navigation + '\nsetView("home"); setView("settings");', context);
assert.equal(pages.filter((page) => page.classList.contains('is-active')).length, 1);
assert.equal(buttons[4].attributes['aria-current'], 'page');
assert.equal(buttons[0].attributes['aria-current'], undefined);
assert.ok(headings.get('settings').focused);
vm.runInNewContext('setView("home"); setView("radio"); setView("shelf"); setView("invalid");', context);
assert.equal(radioUpdates, 1);
assert.equal(shelfRenders, 1);
assert.equal(buttons[3].attributes['aria-current'], 'page');

const logoutStart = app.indexOf("  $('#logoutButton').addEventListener('click',");
const logoutEnd = app.indexOf("  document.addEventListener('click',", logoutStart);
let logout;
let timersCleared = false;
let bgmRequested = false;
const artist = element();
const entryTitle = element();
const session = {
  $: (selector) => selector === '#logoutButton'
    ? { addEventListener(type, callback) { logout = callback; } }
    : selector === '#artistDialog' ? artist : entryTitle,
  ritualDialog: element(), audio: element(), globalPlayer: element(),
  appShell: element(), entryScreen: element(),
  clearRitualTimers() { timersCleared = true; },
  stopShelfQueue() {},
  startEntryMusic() { bgmRequested = true; },
  window: { scrollTo() {} },
};
session.appShell.classList.toggle('has-player', true);
session.entryScreen.hidden = true;
vm.runInNewContext(app.slice(logoutStart, logoutEnd), session);
logout();
assert.ok(timersCleared && bgmRequested);
assert.ok(session.audio.paused && session.globalPlayer.hidden && session.appShell.hidden);
assert.equal(session.entryScreen.hidden, false);
assert.equal(session.ritualDialog.open || artist.open, false);
assert.equal(session.appShell.classList.contains('has-player'), false);
assert.ok(entryTitle.focused);

const loginStart = app.indexOf('  function activateApp(');
const loginEnd = app.indexOf('  function setView(', loginStart);
const pending = [];
const name = {};
let destination;
const login = {
  $: () => name,
  loginForm: { elements: { user: { value: '  SIGNAL_GUEST  ' } } },
  entryMusic: element(), entryScreen: element(), bootScreen: element(), appShell: element(),
  updateEntryMusicButton() {}, playSfx() {}, reduceMotion: true,
  setTimeout(fn) { pending.push(fn); }, setView(view) { destination = view; },
};
vm.runInNewContext(app.slice(loginStart, loginEnd) + '\nactivateApp();', login);
assert.equal(name.textContent, 'SIGNAL_GUEST');
assert.ok(login.entryMusic.paused && login.entryScreen.hidden);
pending.forEach((fn) => fn());
assert.equal(destination, 'home');
assert.equal(login.appShell.hidden, false);
assert.equal(login.bootScreen.hidden, true);
console.log('PASS: five mobile destinations, Settings/Home, Logout/Login, Login/Home session handlers.');
