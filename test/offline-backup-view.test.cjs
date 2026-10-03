const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/app.js'), 'utf8');
function fn(name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(source);
  assert.ok(match, name + ' must exist');
  const rest = source.slice(match.index), next = /\n(?:async )?function \w+\(/.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}
test('home exposes a bounded read-only backup comparison without changing cloud progress or local backups', () => {
  const map = new Map();
  for (let i = 0; i < 7; i++) map.set('wordbot_unsynced_quiz_kid_real-' + i, JSON.stringify({ quiz: { testId: 'real-' + i, questions: [{ word: '<bank>' }, { word: 'light' }], progressRevision: 1 }, answers: [0, 1], currentQuestion: 1, savedAt: i + 1 }));
  map.set('wordbot_unsynced_quiz_other_real-other', JSON.stringify({ quiz: { testId: 'real-other', questions: [{}] }, answers: [3] }));
  map.set('wordbot_unsynced_quiz_kid_bad', '{broken');
  const before = [...map];
  const remote = { testId: 'real-6', progress: { revision: 2, answers: [2, null], currentQuestion: 0 } };
  const remoteBefore = JSON.stringify(remote), host = {};
  const c = { state: { user: 'kid', mode: 'real' }, remoteQuizSession: remote,
    localStorage: { get length() { return map.size; }, key: i => [...map.keys()][i], getItem: k => map.get(k), setItem() { throw Error('must be read only'); }, removeItem() { throw Error('must keep backups'); } },
    $: () => host, getBankedGameMinutes: () => 0, hasActiveQuizDraft: () => true,
    escapeHtml: x => String(x).replaceAll('<', '&lt;').replaceAll('>', '&gt;'), formatDate: x => String(x), activeQuizKey: user => 'wordbot:active-quiz:' + user };
  vm.createContext(c); vm.runInContext(fn('readUnsyncedQuizBackups') + '\n' + fn('renderUnsyncedQuizBackups') + '\n' + fn('renderStudentTools'), c);
  c.renderStudentTools();
  assert.match(host.innerHTML, /<details/); assert.match(host.innerHTML, /本机.*备份/); assert.match(host.innerHTML, /&lt;bank&gt;/);
  assert.match(host.innerHTML, /本机.*A/); assert.match(host.innerHTML, /云端.*C/); assert.match(host.innerHTML, /本机.*2.*云端.*1/);
  assert.doesNotMatch(host.innerHTML, /real-other|real-0/); assert.ok(c.readUnsyncedQuizBackups().length <= 5);
  assert.deepEqual([...map], before); assert.equal(JSON.stringify(remote), remoteBefore);
});
test('offline backup is still viewable without claiming cloud progress was read', () => {
  const saved = { quiz: { testId: 'real-1', questions: [{ word: 'bank' }] }, answers: [1], currentQuestion: 0 };
  const c = { remoteQuizSession: null, readUnsyncedQuizBackups: () => [saved], escapeHtml: x => String(x), formatDate: () => '' };
  vm.createContext(c); vm.runInContext(fn('renderUnsyncedQuizBackups'), c);
  const html = c.renderUnsyncedQuizBackups();
  assert.match(html, /未取得.*云端/); assert.match(html, /本机.*B/);
});
