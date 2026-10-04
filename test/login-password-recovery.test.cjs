const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function fn(name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(source);
  assert.ok(match, name + ' must exist');
  const rest = source.slice(match.index), next = /\n(?:async )?function \w+\(/.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}
function fixture(api) {
  const nodes = Object.fromEntries(['authLoginForm', 'authPasswordRecoveryForm', 'authRecoveryEntry', 'recoveryChildUsername', 'recoveryParentUsername', 'recoveryParentPassword', 'recoveryNewPassword', 'recoveryNewPasswordConfirm'].map(id => [id, { value: '', style: {} }]));
  const messages = [], pages = [];
  const c = { state: { user: null, parentAccess: false }, authUsername: { value: 'kid' }, authPassword: { value: '' }, authPasswordConfirm: { value: '' },
    $: id => nodes[id], api, normalizeUsername: x => String(x || '').trim().replace(/\s+/g, ''), normalizeApiError: x => x,
    updateAuthMode: mode => c.state.authMode = mode, showLoading() {}, hideLoading() {}, showToast: x => messages.push(x), showLoginPage: () => pages.push('login'),
    loginAs() { throw Error('recovery must not log in'); }, localStorage: { setItem() { throw Error('passwords must not be persisted'); } } };
  vm.createContext(c);
  vm.runInContext(fn('openPasswordRecovery') + '\n' + fn('closePasswordRecovery') + '\n' + fn('submitPasswordRecovery'), c);
  nodes.recoveryParentUsername.value = 'adult'; nodes.recoveryParentPassword.value = 'parentpass';
  nodes.recoveryNewPassword.value = 'newpass'; nodes.recoveryNewPasswordConfirm.value = 'newpass';
  return { c, nodes, messages, pages };
}
test('login-page parent recovery is available without a child session and uses the existing credential-verified endpoint', async () => {
  const calls = [];
  const { c, nodes } = fixture(async (url, opts) => { calls.push([url, JSON.parse(opts.body)]); return { ok: true, user: 'kid' }; });
  c.openPasswordRecovery();
  assert.equal(nodes.authPasswordRecoveryForm.style.display, 'flex'); assert.equal(nodes.authLoginForm.style.display, 'none');
  assert.equal(nodes.recoveryChildUsername.value, 'kid');
  await c.submitPasswordRecovery();
  assert.deepEqual(calls, [['/api/auth/parent/reset-child-password', { user: 'kid', parentUsername: 'adult', parentPassword: 'parentpass', newPassword: 'newpass' }]]);
  assert.equal(c.state.user, null); assert.equal(c.state.parentAccess, false);
  assert.match(html, /onclick="openPasswordRecovery\(\)"[^>]*>家长重置孩子密码/);
});
test('a failed parent recovery preserves all typed inputs and keeps the recovery form available', async () => {
  const { c, nodes, messages, pages } = fixture(async () => { throw Error('parent username/password error'); });
  c.openPasswordRecovery(); await c.submitPasswordRecovery();
  assert.equal(nodes.recoveryParentPassword.value, 'parentpass'); assert.equal(nodes.recoveryNewPassword.value, 'newpass');
  assert.equal(nodes.recoveryChildUsername.value, 'kid'); assert.equal(nodes.recoveryParentUsername.value, 'adult');
  assert.equal(nodes.authPasswordRecoveryForm.style.display, 'flex'); assert.deepEqual(pages, []); assert.match(messages[0], /重置失败/);
});
test('confirmed recovery clears password inputs and returns to ordinary login without creating local identity', async () => {
  const { c, nodes, messages, pages } = fixture(async () => ({ ok: true, user: 'kid' }));
  c.openPasswordRecovery(); await c.submitPasswordRecovery();
  assert.equal(nodes.authPasswordRecoveryForm.style.display, 'none'); assert.equal(nodes.authLoginForm.style.display, 'flex');
  for (const id of ['recoveryParentPassword', 'recoveryNewPassword', 'recoveryNewPasswordConfirm']) assert.equal(nodes[id].value, '');
  assert.equal(c.authUsername.value, 'kid'); assert.equal(c.authPassword.value, ''); assert.equal(c.state.user, null);
  assert.deepEqual(pages, ['login']); assert.match(messages[0], /新密码.*登录/);
});
