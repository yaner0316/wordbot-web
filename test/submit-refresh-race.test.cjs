const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/app.js'), 'utf8');
function fn(name) {
  const asyncStart = source.indexOf('async function ' + name + '(');
  const start = asyncStart >= 0 ? asyncStart : source.indexOf('function ' + name + '(');
  const rest = source.slice(start);
  const end = /\n(?:async )?function \w+\(/.exec(rest);
  return end ? rest.slice(0, end.index) : rest;
}
for (const timing of ['before submit', 'during submit', 'after submit']) {
  test('focus refresh cannot erase a submitted quiz: ' + timing, async () => {
    let resolveRemote, resolveSubmit;
    const messages = [], pages = [];
    const quiz = { testId: 'real-race', questions: [{}] };
    const c = { state: { user: 'child', mode: 'real', quiz, answers: [0], currentQuestion: 0, currentPage: 'quiz', session: { kind: 'quiz' } },
      DEMO_MODE: false, deviceRefreshPromise: null, document: { visibilityState: 'visible' },
      quizProgressSavePromise: Promise.resolve(), syncLearningSettingsFromServer: async () => {}, syncGameStateFromServer: async () => {},
      $: () => ({}), loadRemoteQuizSession: () => new Promise(r => resolveRemote = r),
      canLeaveCurrentQuestion: () => true, isSenseChoiceReviewQuestion: () => false, isMeaningReviewQuestion: () => false,
      submitQuizToBackend: () => new Promise(r => resolveSubmit = r), showLoading() {}, hideLoading() {}, clearQuizDraft() {},
      preserveUnsyncedQuiz() {}, showToast: x => messages.push(x), navigateTo: x => pages.push(x), renderResults() {}, normalizeApiError: x => x };
    vm.createContext(c); vm.runInContext(fn('refreshDeviceState') + '\n' + fn('submitQuiz'), c);
    let refresh;
    if (timing !== 'during submit') { refresh = c.refreshDeviceState(); while (!resolveRemote) await Promise.resolve(); }
    const submission = c.submitQuiz();
    if (timing === 'during submit') { await c.refreshDeviceState(); assert.equal(resolveRemote, undefined); }
    if (timing === 'before submit') { resolveRemote(null); await refresh; }
    resolveSubmit({ results: [], testId: quiz.testId }); await submission;
    if (timing === 'after submit') { resolveRemote(null); await refresh; }
    assert.equal(c.state.quiz, quiz); assert.ok(quiz.result); assert.deepEqual(messages, []); assert.deepEqual(pages, ['results']);
  });
}
test('sense selection renders only Chinese labels and rejects English-only results', async () => {
  const host = {}, messages = [];
  const c = { $: () => ({ value: 'bank' }), parseParentWordEntries: () => [{ word: 'bank' }], showLoading() {}, hideLoading() {},
    api: async () => ({ senses: [{ cnMeaning: '银行', definition: 'a financial institution', partOfSpeech: 'noun' }, { definition: 'English only' }] }),
    getWordEntryDuplicatePanel: () => host, escapeHtml: x => x, showToast: x => messages.push(x) };
  vm.createContext(c); vm.runInContext(fn('renderDictionarySenseOption') + '\n' + fn('lookupSelectedSenses'), c); await c.lookupSelectedSenses();
  assert.match(host.innerHTML, /银行/); assert.doesNotMatch(host.innerHTML, /financial|noun|English only/); assert.equal(host._dictionarySenses.length, 1);
});
