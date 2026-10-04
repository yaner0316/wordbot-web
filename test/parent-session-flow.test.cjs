const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/app.js'), 'utf8');
function fn(name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(source);
  assert.ok(match, name + ' must exist');
  const rest = source.slice(match.index);
  const next = /\n(?:async )?function \w+\(/.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}
function context(api) {
  const nodes = Object.fromEntries(['parentGatePanel', 'parentToolGrid', 'parentToolPanel', 'parentUsernameInput', 'parentPasswordInput', 'parentChildPasswordInput', 'parentPasswordConfirmInput'].map(id => [id, { style: {}, value: '' }]));
  const pages = [], messages = [];
  const c = { state: { user: 'kid', parentAccess: false, parentAuth: null }, DEMO_MODE: false, $: id => nodes[id], api,
    parentExitPromise: null,
    normalizeUsername: x => String(x || '').trim().toLowerCase(), ensureParentPage() {}, navigateTo: x => pages.push(x), performPageNavigation: x => pages.push(x), updateAppHistory() {},
    showLoading() {}, hideLoading() {}, showToast: x => messages.push(x), formatParentLoginError: x => x.message };
  vm.createContext(c);
  return { c, nodes, pages, messages };
}
test('explicit parent exit clears access and memory credentials only after cookie downgrade succeeds', async () => {
  let finish;
  const calls = [];
  const { c, pages } = context((path, opts) => { calls.push([path, opts]); return new Promise(resolve => finish = resolve); });
  c.state.parentAccess = true; c.state.parentAuth = { password: 'secret' };
  vm.runInContext(fn('resetParentConsole') + '\n' + fn('exitParentMode'), c);
  const task = c.exitParentMode();
  assert.equal(c.state.parentAccess, true); assert.equal(c.state.parentAuth.password, 'secret'); assert.deepEqual(pages, []);
  finish({ ok: true, user: 'kid' }); await task;
  assert.equal(calls[0][0], '/api/auth/parent/logout'); assert.equal(calls[0][1].method, 'POST');
  assert.equal(c.state.parentAccess, false); assert.equal(c.state.parentAuth, null); assert.deepEqual(pages, ['home']);
  assert.match(fn('ensureParentPage'), /exitParentMode\(\)/); assert.match(fn('ensureParentPage'), /退出家长模式/);
});
test('failed parent exit retains access and credentials and asks for a retry', async () => {
  const { c, pages, messages } = context(async () => { throw new Error('offline'); });
  c.state.parentAccess = true; c.state.parentAuth = { password: 'secret' };
  vm.runInContext(fn('resetParentConsole') + '\n' + fn('exitParentMode'), c);
  await c.exitParentMode();
  assert.equal(c.state.parentAccess, true); assert.equal(c.state.parentAuth.password, 'secret');
  assert.deepEqual(pages, []); assert.match(messages[0], /未退出.*重试/);
});
test('an explicit unauthorized response on parent exit returns to login because no valid elevated session remains', async () => {
  const { c, pages, messages } = context();
  c.state.parentAccess = true; c.state.parentAuth = { password: 'secret' };
  Object.assign(c, { API_BASE: '', AbortController, setTimeout, clearTimeout, normalizeApiPayload: x => x,
    fetch: async () => ({ ok: false, status: 401, json: async () => ({ code: 'UNAUTHORIZED' }) }),
    clearSessionUser() {}, showLoginPage: () => pages.push('login') });
  vm.runInContext(fn('handleUnauthorizedSession'), c);
  vm.runInContext(fn('api') + '\n' + fn('resetParentConsole') + '\n' + fn('exitParentMode'), c);
  await c.exitParentMode();
  assert.equal(c.state.parentAccess, false); assert.equal(c.state.parentAuth, null); assert.equal(c.state.user, null); assert.deepEqual(pages, ['login']);
});
test('opening parent mode selects initial setup or existing login from authenticated status', async () => {
  for (const configured of [false, true]) {
    const calls = [];
    const { c, nodes } = context(async path => { calls.push(path); return { hasParentCredentials: configured }; });
    vm.runInContext(fn('showParentTools') + '\n' + fn('renderParentGate') + '\n' + fn('openParentConsole'), c);
    await c.openParentConsole();
    assert.equal(calls.length, 1); assert.match(calls[0], /\/api\/auth\/parent\/status\?user=kid/);
    assert.match(nodes.parentGatePanel.innerHTML, configured ? /verifyParentPassword/ : /submitParentSetup/);
    assert.equal(c.state.parentAccess, false);
  }
});
test('initial setup validates confirmation and enters parent mode only after login; failed login retries without replacing saved credentials', async () => {
  let failLogin = true;
  const calls = [];
  const { c, nodes, messages } = context(async (path, opts) => {
    calls.push([path, JSON.parse(opts.body)]);
    if (path.endsWith('/login') && failLogin) throw new Error('offline');
    return { ok: true, user: 'kid' };
  });
  Object.assign(nodes.parentUsernameInput, { value: 'adult' });
  nodes.parentPasswordInput.value = 'parentpass'; nodes.parentChildPasswordInput.value = 'kidpass'; nodes.parentPasswordConfirmInput.value = 'different';
  vm.runInContext(fn('showParentTools') + '\n' + fn('submitParentSetup'), c);
  await c.submitParentSetup(); assert.equal(calls.length, 0); assert.match(messages[0], /一致/);
  nodes.parentPasswordConfirmInput.value = 'parentpass';
  await c.submitParentSetup();
  assert.equal(c.state.parentAccess, false); assert.equal(nodes.parentPasswordInput.value, 'parentpass'); assert.equal(nodes.parentChildPasswordInput.value, 'kidpass');
  failLogin = false; await c.submitParentSetup();
  assert.deepEqual(calls.map(x => x[0]), ['/api/auth/parent/setup', '/api/auth/parent/login', '/api/auth/parent/login']);
  assert.deepEqual(calls[0][1], { user: 'kid', childPassword: 'kidpass', parentUsername: 'adult', parentPassword: 'parentpass' });
  assert.equal(c.state.parentAccess, true); assert.equal(c.state.parentAuth.password, 'parentpass');
  assert.equal(nodes.parentPasswordInput.value, ''); assert.equal(nodes.parentChildPasswordInput.value, '');
});

test('a user switch while setup is in flight never sends a parent login for the previous child', async () => {
  let finishSetup;
  const calls = [];
  const { c, nodes } = context(path => {
    calls.push(path);
    return path.endsWith('/setup') ? new Promise(resolve => finishSetup = resolve) : Promise.resolve({ ok: true, user: 'kid' });
  });
  nodes.parentUsernameInput.value = 'adult'; nodes.parentPasswordInput.value = 'parentpass';
  nodes.parentChildPasswordInput.value = 'kidpass'; nodes.parentPasswordConfirmInput.value = 'parentpass';
  vm.runInContext(fn('showParentTools') + '\n' + fn('submitParentSetup'), c);
  const task = c.submitParentSetup();
  c.state.user = 'other';
  finishSetup({ ok: true, user: 'kid' }); await task;
  assert.deepEqual(calls, ['/api/auth/parent/setup']);
  assert.equal(c.state.parentAccess, false); assert.equal(c.state.parentSetupCreatedFor, undefined);
});

test('resetting the parent console clears setup markers and typed passwords before another child opens it', () => {
  const { c, nodes } = context();
  c.state.parentSetupCreatedFor = 'kid'; nodes.parentPasswordInput.value = 'parentpass'; nodes.parentChildPasswordInput.value = 'kidpass';
  vm.runInContext(fn('resetParentConsole'), c); c.resetParentConsole();
  assert.equal(c.state.parentSetupCreatedFor, null); assert.equal(nodes.parentPasswordInput.value, ''); assert.equal(nodes.parentChildPasswordInput.value, '');
});
