const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const quizLogicSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'quiz-logic.js'), 'utf8');

test('ordinary results use a context translation helper only', () => {
  const start = appSource.indexOf('function renderResults(data)');
  const end = appSource.indexOf('function toggleAnalysis()', start);
  assert.ok(start >= 0 && end > start);
  const renderResults = appSource.slice(start, end);

  assert.match(renderResults, /buildContextTranslationHtml\(q,\s*escapeHtml\)/);
  assert.match(renderResults, /const translationHtml = !isMeaningReview && r\.correct\s*\?\s*buildContextTranslationHtml\(q,\s*escapeHtml\)\s*:\s*'';/);
  assert.match(renderResults, /\$\{tag\}<\/div>/);
  assert.match(renderResults, /\$\{optionsHtml\}\s*\$\{translationHtml\}/);
  assert.doesNotMatch(renderResults, /buildOptionMeaningsExplanation\(q,\s*escapeHtml\)/);
  assert.doesNotMatch(renderResults, /buildQuestionExplanation\(q,\s*r,\s*escapeHtml\)/);
  assert.match(renderResults, /\$\{isMeaningReview \? `<div class="explain-box">/);
});

test('context translation helper ignores meaning fallbacks', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(quizLogicSource, context);
  const html = context.WordBotQuizLogic.buildContextTranslationHtml(
    {
      contextCN: '\u6211\u59d0\u59d0\u6536\u5230\u4e00\u8f86\u5d2d\u65b0\u7684\u81ea\u884c\u8f66\u4f5c\u4e3a\u751f\u65e5\u793c\u7269\u3002',
      correctMeaning: '\u5d2d\u65b0\u7684',
      optionMeanings: ['\u65e7\u7684', '\u5d2d\u65b0\u7684'],
    },
    value => String(value)
  );

  assert.equal(html, '<div class="opt-translation">\u6211\u59d0\u59d0\u6536\u5230\u4e00\u8f86\u5d2d\u65b0\u7684\u81ea\u884c\u8f66\u4f5c\u4e3a\u751f\u65e5\u793c\u7269\u3002</div>');
});

test('missing context translation renders no ordinary explanation', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(quizLogicSource, context);
  assert.equal(context.WordBotQuizLogic.buildContextTranslationHtml({ correctMeaning: '\u6709\u97e7\u6027\u7684' }, String), '');
});

test('type4 keeps meaning review feedback', () => {
  assert.match(appSource, /buildMeaningReviewExplanation\(q,\s*r,\s*escapeHtml\)/);
});


test('result translations stay bound to their own question when result order changes', () => {
  const start = appSource.indexOf('function renderResults(data)');
  const end = appSource.indexOf('function toggleAnalysis()', start);
  assert.ok(start >= 0 && end > start);

  let resultContent = { innerHTML: '' };
  const context = {
    state: {
      session: { kind: 'quiz', analysisViewed: false, remainingRecordIds: [] },
      quiz: {
        questions: [
          {
            type: 1,
            meaningId: 'q-one',
            word: 'bright',
            context: 'I used bright _____.',
            contextCN: '\\u6211\\u7528\\u4e86\\u660e\\u4eae\\u7684\\u8721\\u7b14\\u3002',
            options: ['A. bright', 'B. dark'],
            answer: 'A',
          },
          {
            type: 1,
            meaningId: 'q-two',
            word: 'calm',
            context: 'The lake stayed _____.',
            contextCN: '\\u6e56\\u9762\\u4fdd\\u6301\\u5e73\\u9759\\u3002',
            options: ['A. calm', 'B. noisy'],
            answer: 'A',
          },
        ],
      },
    },
    escapeHtml: value => String(value),
    buildContextTranslationHtml: (question, escape) => {
      const value = String(question?.contextCN || '').trim();
      return value ? '<div class="opt-translation">' + escape(value) + '</div>' : '';
    },
    buildMeaningReviewExplanation: () => '',
    buildAnimalGardenRewardHtml: () => '',
    getEncourage: () => '',
    isMeaningReviewQuestion: () => false,
    formatOptionDisplayText: value => value,
    updateResultActions: () => {},
    launchConfetti: () => {},
    $: id => id === 'resultContent' ? resultContent : null,
  };
  vm.createContext(context);
  context.renderResults = vm.runInContext('(' + appSource.slice(start, end) + ')', context);

  context.renderResults({
    correct: 2,
    total: 2,
    accuracy: '100.0%',
    masteredWords: [],
    results: [
      { meaningId: 'q-two', word: 'calm', your: 'A', correct: true },
      { meaningId: 'q-one', word: 'bright', your: 'A', correct: true },
    ],
  });

  const html = resultContent.innerHTML;
  const lakePosition = html.indexOf('\\u6e56\\u9762\\u4fdd\\u6301\\u5e73\\u9759\\u3002');
  const crayonPosition = html.indexOf('\\u6211\\u7528\\u4e86\\u660e\\u4eae\\u7684\\u8721\\u7b14\\u3002');
  assert.ok(lakePosition >= 0 && crayonPosition >= 0);
  assert.ok(lakePosition < crayonPosition);
  assert.doesNotMatch(html, /\\u6709\\u610f\\u4e49|\\u9009\\u9879\\u91ca\\u4e49|correctMeaning|optionMeanings/);
});
function renderResultTranslations(questions, results) {
  const start = appSource.indexOf('function renderResults(data)');
  const end = appSource.indexOf('function toggleAnalysis()', start);
  let resultContent = { innerHTML: '' };
  const context = {
    state: {
      session: { kind: 'quiz', analysisViewed: false, remainingRecordIds: [] },
      quiz: { questions },
    },
    escapeHtml: String,
    buildContextTranslationHtml: question => question?.contextCN ? '<div class="opt-translation">' + question.contextCN + '</div>' : '',
    buildMeaningReviewExplanation: () => '',
    buildAnimalGardenRewardHtml: () => '',
    getEncourage: () => '',
    isMeaningReviewQuestion: () => false,
    formatOptionDisplayText: value => value,
    updateResultActions: () => {},
    launchConfetti: () => {},
    $: id => id === 'resultContent' ? resultContent : null,
  };
  vm.createContext(context);
  context.renderResults = vm.runInContext('(' + appSource.slice(start, end) + ')', context);
  context.renderResults({
    correct: results.length,
    total: results.length,
    accuracy: '100.0%',
    masteredWords: [],
    results,
  });
  return resultContent.innerHTML;
}

test('raw snake_case record_id does not bypass canonical meaningId result binding', () => {
  const html = renderResultTranslations([
    { type: 1, record_id: 'bank-finance', word: 'bank', contextCN: 'finance bank sentence', options: ['A. bank'], answer: 'A' },
    { type: 1, record_id: 'bank-river', word: 'bank', contextCN: 'river bank sentence', options: ['A. bank'], answer: 'A' },
  ], [
    { record_id: 'bank-river', word: 'bank', your: 'A', correct: true },
    { record_id: 'bank-finance', word: 'bank', your: 'A', correct: true },
  ]);

  assert.doesNotMatch(html, /river bank sentence|finance bank sentence/);

});

test('raw wordRecordId does not bypass canonical meaningId result binding', () => {
  const html = renderResultTranslations([
    { type: 1, wordRecordId: 'seal-animal', word: 'seal', contextCN: 'animal seal sentence', options: ['A. seal'], answer: 'A' },
    { type: 1, wordRecordId: 'seal-stamp', word: 'seal', contextCN: 'stamp seal sentence', options: ['A. seal'], answer: 'A' },
  ], [
    { wordRecordId: 'seal-stamp', word: 'seal', your: 'A', correct: true },
    { wordRecordId: 'seal-animal', word: 'seal', your: 'A', correct: true },
  ]);

  assert.doesNotMatch(html, /stamp seal sentence|animal seal sentence/);

});

test('ambiguous spelling without a source record identity shows no translation', () => {
  const html = renderResultTranslations([
    { type: 1, recordId: 'bank-finance', word: 'bank', contextCN: 'finance bank sentence', options: ['A. bank'], answer: 'A' },
    { type: 1, recordId: 'bank-river', word: 'bank', contextCN: 'river bank sentence', options: ['A. bank'], answer: 'A' },
  ], [
    { word: 'bank', your: 'A', correct: true },
  ]);

  assert.doesNotMatch(html, /finance bank sentence|river bank sentence/);
});

test('question number does not bind same-spelling results without meaningId', () => {
  const html = renderResultTranslations([
    { type: 1, wordRecordId: 'bank-finance', word: 'bank', contextCN: 'finance bank sentence', options: ['A. bank'], answer: 'A' },
    { type: 1, wordRecordId: 'bank-river', word: 'bank', contextCN: 'river bank sentence', options: ['A. bank'], answer: 'A' },
  ], [
    { q: 2, word: 'bank', your: 'A', correct: true },
    { q: 1, word: 'bank', your: 'A', correct: true },
  ]);

  assert.doesNotMatch(html, /river bank sentence|finance bank sentence/);
});

test('unique word does not bind results without meaningId', () => {
  const html = renderResultTranslations([
    { type: 1, word: 'unique', contextCN: 'unique fallback sentence', options: ['A. unique'], answer: 'A' },
    { type: 1, word: 'other', contextCN: 'other sentence', options: ['A. other'], answer: 'A' },
  ], [
    { word: 'unique', your: 'A', correct: true },
  ]);

  assert.doesNotMatch(html, /unique fallback sentence/);
});

test('meaningId binds reversed same-spelling results to the right translation', () => {
  const html = renderResultTranslations([
    { type: 1, meaningId: 'lead-metal', word: 'lead', contextCN: 'metal lead sentence', options: ['A. lead'], answer: 'A' },
    { type: 1, meaningId: 'lead-guide', word: 'lead', contextCN: 'guide lead sentence', options: ['A. lead'], answer: 'A' },
  ], [
    { meaningId: 'lead-guide', word: 'lead', your: 'A', correct: true },
    { meaningId: 'lead-metal', word: 'lead', your: 'A', correct: true },
  ]);

  assert.match(html, /guide lead sentence/);
  assert.match(html, /metal lead sentence/);
  assert.ok(html.indexOf('guide lead sentence') < html.indexOf('metal lead sentence'));
});

test('raw wordId does not bypass canonical meaningId result binding', () => {
  const html = renderResultTranslations([
    { type: 1, wordId: 'bat-animal', word: 'bat', contextCN: 'animal bat sentence', options: ['A. bat'], answer: 'A' },
    { type: 1, wordId: 'bat-tool', word: 'bat', contextCN: 'tool bat sentence', options: ['A. bat'], answer: 'A' },
  ], [
    { wordId: 'bat-tool', word: 'bat', your: 'A', correct: true },
    { wordId: 'bat-animal', word: 'bat', your: 'A', correct: true },
  ]);

  assert.doesNotMatch(html, /tool bat sentence|animal bat sentence/);

});

test('raw sourceRecordId does not bypass canonical meaningId result binding', () => {
  const html = renderResultTranslations([
    { type: 1, sourceRecordId: 'match-sport', word: 'match', contextCN: 'sport match sentence', options: ['A. match'], answer: 'A' },
    { type: 1, sourceRecordId: 'match-fire', word: 'match', contextCN: 'fire match sentence', options: ['A. match'], answer: 'A' },
  ], [
    { sourceRecordId: 'match-fire', word: 'match', your: 'A', correct: true },
    { sourceRecordId: 'match-sport', word: 'match', your: 'A', correct: true },
  ]);

  assert.doesNotMatch(html, /fire match sentence|sport match sentence/);

});
