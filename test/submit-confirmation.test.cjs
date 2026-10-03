const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/app.js'), 'utf8');
function fn(name) {
  const start = source.indexOf('async function ' + name + '(');
  assert.ok(start >= 0);
  const rest = source.slice(start), next = /\n(?:async )?function \w+\(/.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}
const timeout = () => Object.assign(new Error('REQUEST_TIMEOUT'), { name: 'AbortError' });
test('server success followed by a client timeout replays the exact idempotent payload once and applies one result', async () => {
  const requests = [], pages = [];
  let rewards = 0, applied = 0;
  const quiz = { testId: 'real-confirm', questions: [{ word: 'bank' }] };
  const result = { results: [{ correct: true }], gameState: { timeBankMinutes: 1 } };
  const c = { state: { user: 'kid', quiz, answers: [0], currentQuestion: 0, mode: 'real', session: { kind: 'quiz' } }, DEMO_MODE: false,
    api: async (path, opts) => { requests.push([path, opts.body]); if (requests.length === 1) { rewards++; throw timeout(); } return result; },
    showLoading() {}, hideLoading() {}, canLeaveCurrentQuestion: () => true, isSenseChoiceReviewQuestion: () => false, isMeaningReviewQuestion: () => false,
    $: () => ({}), clearQuizDraft() {}, applyServerGameState: () => applied++, navigateTo: x => pages.push(x), renderResults() {}, showToast() {}, normalizeApiError: x => x };
  vm.createContext(c); vm.runInContext(fn('submitWithTimeoutConfirmation') + '\n' + fn('submitQuizToBackend') + '\n' + fn('submitQuiz'), c);
  await c.submitQuiz();
  assert.equal(requests.length, 2); assert.deepEqual(requests[0], requests[1]); assert.equal(JSON.parse(requests[1][1]).testId, 'real-confirm');
  assert.equal(rewards, 1); assert.equal(applied, 1); assert.equal(quiz.result, result); assert.deepEqual(pages, ['results']);
});
test('two submission timeouts stop after two requests and retain answers and draft with an unknown-result message', async () => {
  let requests = 0, saves = 0, clears = 0;
  const messages = [], pages = [];
  const quiz = { testId: 'real-confirm', questions: [{}] };
  const c = { state: { user: 'kid', quiz, answers: [2], currentQuestion: 0, mode: 'real', session: { kind: 'quiz' } }, DEMO_MODE: false,
    api: async () => { requests++; throw timeout(); }, showLoading() {}, hideLoading() {}, canLeaveCurrentQuestion: () => true,
    isSenseChoiceReviewQuestion: () => false, isMeaningReviewQuestion: () => false, $: () => ({}), clearQuizDraft: () => clears++,
    saveCurrentSessionProgress: () => saves++, saveQuizDraft: () => saves++, showToast: x => messages.push(x), navigateTo: x => pages.push(x), normalizeApiError: x => x };
  vm.createContext(c); vm.runInContext(fn('submitWithTimeoutConfirmation') + '\n' + fn('submitQuizToBackend') + '\n' + fn('submitQuiz'), c);
  await c.submitQuiz();
  assert.equal(requests, 2); assert.equal(clears, 0); assert.ok(saves > 0); assert.deepEqual(c.state.answers, [2]); assert.equal(quiz.result, undefined);
  assert.deepEqual(pages, []); assert.match(messages[0], /结果.*未确认|尚未确认/); assert.doesNotMatch(messages[0], /提交失败/);
  assert.equal(c.state.submitting, false);
});

test('a service error after the first timeout cannot prove that the first submission was unsaved', async () => {
  let requests = 0;
  const c = { api: async () => {
    requests++;
    if (requests === 1) throw timeout();
    throw Object.assign(new Error('temporarily unavailable'), { code: 'SERVICE_UNAVAILABLE' });
  }, showLoading() {} };
  vm.createContext(c); vm.runInContext(fn('submitWithTimeoutConfirmation'), c);
  await assert.rejects(c.submitWithTimeoutConfirmation('/api/submit', { testId: 'real-confirm', answers: [0] }), error => error.code === 'SUBMISSION_RESULT_UNKNOWN');
  assert.equal(requests, 2);
});
