const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/app.js'), 'utf8');
function fn(name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(source);
  assert.ok(match, name + ' must exist');
  const rest = source.slice(match.index), next = /\n(?:async )?function \w+\(/.exec(rest);
  return (next ? rest.slice(0, next.index) : rest).split('// ========== Init ==========')[0];
}
function fixture(api) {
  const events = [], nodes = Object.fromEntries(['parentGatePanel', 'parentToolGrid', 'parentToolPanel', 'parentPasswordInput', 'parentUsernameInput'].map(id => [id, { style: {}, value: 'secret' }]));
  const c = { state: { user: 'kid', currentPage: 'parent', parentAccess: true, parentAuth: { password: 'secret' } },
    parentExitPromise: null, DEMO_MODE: false, $: id => nodes[id], api, normalizeUsername: x => String(x || '').toLowerCase(),
    activatePage: page => { events.push(['page', page]); c.state.currentPage = page; return true; },
    updateAppHistory: (page, opts) => events.push(['history', page, opts]),
    loadHome: () => events.push(['load', 'home']), loadHistory: () => events.push(['load', 'history']),
    showLoading() {}, hideLoading() {}, showToast: message => events.push(['toast', message]), showLoginPage: () => events.push(['page', 'login']),
    showAppPage: () => { events.push(['page', 'home']); c.state.currentPage = 'home'; },
    saveCurrentSessionProgress() {}, ensureParentPage: () => events.push(['ensure', 'parent']),
    loadUserDifficulty: () => '中学', renderUsers() {}, updateLevelButtons() {}, applyEnvironmentControls() {} };
  c.clearSessionUser = () => events.push(['clear-user']);
  c.showLoginPage = () => { events.push(['page', 'login']); c.state.currentPage = 'login'; };
  c.formatParentLoginError = error => error.message;
  vm.createContext(c);
  const names = ['navigateTo', 'exitParentMode', 'resetParentConsole', 'closeParentConsole', 'hasInProgressSession', 'handleInAppBack', 'handleBrowserBack'];
  if (source.includes('function performPageNavigation(')) names.push('performPageNavigation');
  vm.runInContext(names.map(fn).join('\n'), c);
  vm.runInContext(fn('handleUnauthorizedSession'), c);
  return { c, events, nodes };
}
for (const target of ['home', 'history']) {
  test('leaving parent for ' + target + ' waits for downgrade before loading the destination', async () => {
    let finish;
    const calls = [];
    const { c, events } = fixture((path, opts) => { calls.push([path, opts]); return new Promise(resolve => finish = resolve); });
    const navigation = c.navigateTo(target);
    assert.equal(calls.length, 1); assert.equal(calls[0][0], '/api/auth/parent/logout');
    assert.equal(c.state.currentPage, 'parent'); assert.equal(c.state.parentAccess, true);
    assert.equal(events.filter(event => event[0] === 'load' || event[0] === 'page').length, 0);
    finish({ ok: true, user: 'kid' }); await navigation;
    assert.equal(c.state.currentPage, target); assert.equal(c.state.parentAccess, false); assert.equal(c.state.parentAuth, null);
    assert.equal(events.filter(event => event[0] === 'load').length, 1);
  });
}
test('closing and browser back share one pending downgrade and never reset credentials early', async () => {
  let finish;
  let calls = 0;
  const { c, events, nodes } = fixture(() => { calls++; return new Promise(resolve => finish = resolve); });
  const closing = c.closeParentConsole(); c.handleBrowserBack(); c.navigateTo('history');
  assert.equal(calls, 1); assert.equal(nodes.parentPasswordInput.value, 'secret'); assert.equal(c.state.currentPage, 'parent');
  finish({ ok: true, user: 'kid' }); await closing; await c.parentExitPromise;
  assert.equal(c.state.currentPage, 'home'); assert.equal(events.filter(event => event[0] === 'load').length, 1);
});
test('failed downgrade retains the parent page and inputs; another exit can retry', async () => {
  let calls = 0;
  const { c, events, nodes } = fixture(async () => { calls++; if (calls === 1) throw Error('offline'); return { ok: true, user: 'kid' }; });
  await c.navigateTo('history');
  assert.equal(c.state.currentPage, 'parent'); assert.equal(c.state.parentAccess, true); assert.equal(nodes.parentPasswordInput.value, 'secret');
  assert.equal(events.filter(event => event[0] === 'load').length, 0); assert.match(events.find(event => event[0] === 'toast')[1], /未退出.*重试/);
  assert.equal(events.find(event => event[0] === 'history')[1], 'parent');
  await c.navigateTo('history'); assert.equal(calls, 2); assert.equal(c.state.currentPage, 'history');
});
test('leaving a parent gate also downgrades a surviving parent cookie when in-memory access is false', async () => {
  let calls = 0;
  const { c } = fixture(async () => { calls++; return { ok: true, user: 'kid' }; });
  c.state.parentAccess = false; c.state.parentAuth = null;
  await c.navigateTo('home'); assert.equal(calls, 1); assert.equal(c.state.currentPage, 'home');
});
test('saved-user startup confirms child cookie before loading home and leaves a retryable parent page on failure', async () => {
  for (const succeeds of [true, false]) {
    let finish;
    const calls = [];
    const { c, events } = fixture((path, opts) => { calls.push([path, opts]); return new Promise((resolve, reject) => finish = () => succeeds ? resolve({ ok: true, user: 'kid' }) : reject(Error('offline'))); });
    c.state.currentPage = 'login'; c.state.parentAccess = false;
    Object.assign(c, { updateAuthMode() {}, initializeAppHistory() {}, GAME_PREVIEW_MODE: false, getSessionUser: () => 'kid' });
    vm.runInContext(fn('initApp'), c);
    const starting = c.initApp();
    assert.equal(calls.length, 1); assert.equal(calls[0][0], '/api/auth/parent/logout');
    assert.equal(events.filter(event => event[0] === 'load').length, 0); assert.equal(c.state.currentPage, 'parent');
    finish(); await starting;
    assert.equal(c.state.currentPage, succeeds ? 'home' : 'parent');
    assert.equal(events.filter(event => event[0] === 'load').length, succeeds ? 1 : 0);
  }
});

test('expired saved-user startup clears stale local identity and returns to login instead of trapping retries', async () => {
  const { c, events } = fixture(async () => { throw Object.assign(Error('Unauthorized'), { code: 'UNAUTHORIZED' }); });
  c.state.currentPage = 'login'; c.state.parentAccess = false;
  Object.assign(c, { updateAuthMode() {}, initializeAppHistory() {}, GAME_PREVIEW_MODE: false, getSessionUser: () => 'kid' });
  vm.runInContext(fn('initApp'), c); await c.initApp();
  assert.equal(c.state.currentPage, 'login'); assert.equal(c.state.user, null); assert.equal(c.state.parentAuth, null);
  assert.equal(events.filter(event => event[0] === 'load').length, 0); assert.equal(events.filter(event => event[0] === 'clear-user').length, 1);
});

test('leaving during parent login waits for the late parent cookie then downgrades it before navigating', async () => {
  let finishLogin;
  let cookieRole = 'user';
  const calls = [];
  const { c, events } = fixture(path => {
    calls.push(path);
    if (path.endsWith('/login')) return new Promise(resolve => finishLogin = () => { cookieRole = 'parent'; resolve({ user: 'kid' }); });
    cookieRole = 'user'; return Promise.resolve({ ok: true, user: 'kid' });
  });
  c.state.parentAccess = false; c.state.parentAuth = null;
  vm.runInContext(fn('showParentTools') + '\n' + fn('verifyParentPassword'), c);
  const login = c.verifyParentPassword();
  const leaving = c.navigateTo('home');
  assert.deepEqual(calls, ['/api/auth/parent/login']); assert.equal(events.filter(event => event[0] === 'load').length, 0);
  finishLogin(); await login; await leaving;
  assert.deepEqual(calls, ['/api/auth/parent/login', '/api/auth/parent/logout']);
  assert.equal(cookieRole, 'user'); assert.equal(c.state.parentAccess, false); assert.equal(c.state.currentPage, 'home');
});
