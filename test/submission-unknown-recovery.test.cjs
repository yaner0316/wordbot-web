const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/app.js'), 'utf8');
function fn(name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(source);
  assert.ok(match, name);
  const rest = source.slice(match.index), next = /\n(?:async )?function \w+\(/.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}
const draftKey = 'wordbot:active-quiz:kid';
const backupKey = 'wordbot_unsynced_quiz_kid_real-unknown';
function fixture() {
  const storage = new Map(), calls = [], messages = [];
  const quiz = { testId: 'real-unknown', mode: 'real', questions: [{ word: 'bank' }, { word: 'light' }], progressRevision: 3 };
  const c = {
    state: { user: 'kid', mode: 'real', currentPage: 'quiz', quiz, answers: [0, 2], currentQuestion: 1, session: { kind: 'quiz' } },
    DEMO_MODE: false, deviceRefreshPromise: null, remoteQuizSession: null, quizProgressSavePromise: Promise.resolve(),
    document: { visibilityState: 'visible' }, remoteResponse: { active: false }, postResult: null,
    localStorage: { get length() { return storage.size; }, key: i => [...storage.keys()][i],
      getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    api: async (path, options) => {
      calls.push({ path, ...options });
      if (options?.method === 'POST') {
        if (c.postResult) return c.postResult;
        throw Object.assign(new Error('REQUEST_TIMEOUT'), { name: 'AbortError' });
      }
      return c.remoteResponse;
    },
    $: id => id === 'submitBtn' ? {} : null,
    syncLearningSettingsFromServer: async () => {}, syncGameStateFromServer: async () => {}, loadQuizCacheReadiness: async () => {},
    renderStudentTools() {}, renderQuestion() {}, renderResults() {}, showLoading() {}, hideLoading() {}, applyServerGameState() {},
    canLeaveCurrentQuestion: () => true, isSenseChoiceReviewQuestion: () => false, isMeaningReviewQuestion: () => false,
    getFormalChallengeQuestionCountIssue: () => null, inspectFormalQuizResponse: () => ({ blocked: false }),
    inspectQuizContentForBlockingIssue: () => ({ blocked: false }), normalizeApiError: error => error,
    navigateTo: page => { c.state.currentPage = page; }, showToast: message => messages.push(message),
    escapeHtml: value => String(value), formatDate: value => String(value),
  };
  vm.createContext(c);
  vm.runInContext(['activeQuizKey', 'saveQuizDraft', 'clearQuizDraft', 'saveQuizProgressToServer', 'preserveUnsyncedQuiz', 'loadRemoteQuizSession',
    'enterFormalQuiz', 'restoreRemoteQuizSession', 'recoverPendingQuizDraft', 'handleContinueQuizEntry', 'refreshDeviceState',
    'readUnsyncedQuizBackups', 'renderUnsyncedQuizBackups', 'submitWithTimeoutConfirmation', 'submitQuizToBackend', 'submitQuiz'].map(fn).join('\n'), c);
  return { c, storage, calls, messages };
}
function assertOriginalVisible(c) {
  const backups = c.readUnsyncedQuizBackups();
  const saved = backups.find(item => item.quiz.testId === 'real-unknown');
  assert.ok(saved, 'original unknown answer sheet must remain reachable through the backup view');
  assert.deepEqual(Array.from(saved.answers), [0, 2]);
  const html = c.renderUnsyncedQuizBackups();
  assert.match(html, /bank：本机 A/);
  assert.match(html, /light：本机 C/);
  assert.match(html, /结果.*未确认|尚未确认/);
}
test('after two timeouts, focus on inactive cloud retains original answers in the visible read-only backup', async () => {
  const { c, storage, calls, messages } = fixture();
  await c.submitQuiz();
  await c.refreshDeviceState();
  assert.ok(storage.has(backupKey));
  assertOriginalVisible(c);
  assert.equal(calls.filter(call => call.method === 'POST').length, 2);
  assert.match(messages.at(-1), /结果.*未确认|尚未确认/);
  assert.doesNotMatch(messages.at(-1), /已在另一设备结束|暂无未完成/);
});
test('reload then continue on inactive cloud archives an unknown sheet without attempting a new submission', async () => {
  const { c, storage, calls, messages } = fixture();
  await c.submitQuiz();
  c.state.quiz = null; c.state.answers = []; c.state.currentPage = 'home'; c.state.session = { kind: null };
  assert.equal(await c.handleContinueQuizEntry(), false);
  assert.ok(storage.has(backupKey));
  assertOriginalVisible(c);
  assert.equal(calls.filter(call => call.method === 'POST').length, 2);
  assert.match(messages.at(-1), /结果.*未确认|尚未确认/);
  assert.doesNotMatch(messages.at(-1), /暂无未完成/);
});
for (const action of ['focus', 'reload-continue']) {
  test(action + ' keeps the unknown sheet separate from a new active cloud quiz', async () => {
    const { c, storage, calls } = fixture();
    await c.submitQuiz();
    c.remoteResponse = { active: true, testId: 'real-new', mode: 'real', questions: [{ word: 'new' }, { word: 'current' }], progress: { revision: 7, answers: [1, 3], currentQuestion: 1 } };
    if (action === 'focus') await c.refreshDeviceState();
    else {
      c.state.quiz = null; c.state.answers = []; c.state.currentPage = 'home'; c.state.session = { kind: null };
      assert.equal(await c.handleContinueQuizEntry(), true);
    }
    assert.equal(c.state.quiz?.testId, 'real-new');
    assert.deepEqual(Array.from(c.state.answers), [1, 3]);
    assert.equal(JSON.parse(storage.get(draftKey)).quiz.testId, 'real-new');
    assertOriginalVisible(c);
    assert.equal(calls.filter(call => call.method === 'POST').length, 2);
  });
}
test('unknown submission cannot re-upload changed answers when its old cloud revision is still active', async () => {
  const { c, calls } = fixture();
  await c.submitQuiz();
  c.state.quiz.syncFailed = true;
  c.state.answers[0] = 3;
  c.saveQuizDraft();
  assert.equal(await c.saveQuizProgressToServer(), false);
  c.remoteResponse = { active: true, testId: 'real-unknown', mode: 'real', progress: { revision: 3 } };
  await c.refreshDeviceState();
  assertOriginalVisible(c);
  assert.equal(calls.filter(call => call.method === 'POST').length, 2);
});
test('manual confirmation reuses the submitted snapshot and clears only the corresponding unknown backup on success', async () => {
  const { c, storage, calls } = fixture();
  await c.submitQuiz();
  c.preserveUnsyncedQuiz('kid', c.state.quiz);
  const otherKey = 'wordbot_unsynced_quiz_kid_real-conflict';
  const conflict = JSON.stringify({ quiz: { testId: 'real-conflict', questions: [{}], syncFailed: true }, answers: [1] });
  storage.set(otherKey, conflict);
  c.state.answers[0] = 3;
  c.postResult = { results: [], gameState: {} };
  await c.submitQuiz();
  assert.equal(calls.at(-1).body, calls[0].body);
  assert.deepEqual(Array.from(c.state.answers), [0, 2], 'the result page uses the answers actually submitted');
  assert.equal(c.state.currentPage, 'results');
  assert.equal(c.state.quiz.submissionUnknown, false);
  assert.equal(storage.has(draftKey), false);
  assert.equal(storage.has(backupKey), false);
  assert.equal(storage.get(otherKey), conflict);
});
