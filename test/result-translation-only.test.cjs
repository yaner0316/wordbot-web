const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const quizLogicSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'quiz-logic.js'), 'utf8');

test('ordinary results show each option meaning and put the sentence translation after all options', () => {
  const start = appSource.indexOf('function renderResults(data)');
  const end = appSource.indexOf('function toggleAnalysis()', start);
  assert.ok(start >= 0 && end > start);
  const renderResults = appSource.slice(start, end);

  assert.match(renderResults, /buildContextTranslationHtml\(q,\s*escapeHtml\)/);
  assert.match(renderResults, /buildResultOptionMeaningHtml\(q,\s*letter,\s*escapeHtml\)/);
  assert.match(renderResults, /const translationHtml = !isMeaningReview\s*\?\s*buildContextTranslationHtml\(q,\s*escapeHtml\)\s*:\s*'';/);
  assert.match(renderResults, /\$\{optionsHtml\}\$\{translationHtml\}/);
  assert.doesNotMatch(renderResults, /buildQuestionExplanation\(q,\s*r,\s*escapeHtml\)/);
  assert.match(renderResults, /\$\{isMeaningReview \? `<div class="explain-box">/);
});

test('result feedback keeps every option meaning before the sentence translation', () => {
  const html = renderResultTranslations([
    {
      type: 1,
      recordId: 'basement',
      word: 'basement',
      context: 'After moving in, we discovered a hidden _____ beneath the old wooden floorboards.',
      contextCN: '\u642c\u8fdb\u53bb\u4e4b\u540e\uff0c\u6211\u4eec\u53d1\u73b0\u65e7\u6728\u5730\u677f\u4e0b\u9762\u85cf\u7740\u4e00\u4e2a\u9690\u85cf\u7684\u5730\u4e0b\u5ba4\u3002',
      options: ['A. subway', 'B. basement', 'C. bunker', 'D. tunnel'],
      optionMeanings: ['\u5730\u94c1', '\u5730\u4e0b\u5ba4', '\u5730\u4e0b\u78a7\u4f53', '\u96a7\u9053'],
      answer: 'B',
    },
  ], [{ recordId: 'basement', word: 'basement', your: 'D', correct: true }]);

  for (const meaning of ['\u5730\u94c1', '\u5730\u4e0b\u5ba4', '\u5730\u4e0b\u78a7\u4f53', '\u96a7\u9053']) assert.match(html, new RegExp(meaning));
  const lastMeaning = html.lastIndexOf('\u96a7\u9053');
  const translation = html.indexOf('\u642c\u8fdb\u53bb\u4e4b\u540e');
  assert.ok(lastMeaning >= 0 && translation > lastMeaning, 'sentence translation must follow all option meanings');
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
            recordId: 'q-one',
            word: 'bright',
            context: 'I used bright _____.',
            contextCN: '\\u6211\\u7528\\u4e86\\u660e\\u4eae\\u7684\\u8721\\u7b14\\u3002',
            options: ['A. bright', 'B. dark'],
            answer: 'A',
          },
          {
            type: 1,
            recordId: 'q-two',
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
    buildResultOptionMeaningHtml: (question, letter, escape) => {
      const index = String(letter).charCodeAt(0) - 65;
      const meaning = String(question?.optionMeanings?.[index] || '').trim();
      return meaning ? '<div class="opt-meaning">' + escape(meaning) + '</div>' : '';
    },
    buildResultOptionMeaningHtml: (question, letter, escape) => {
      const index = String(letter).charCodeAt(0) - 65;
      const meaning = String(question?.optionMeanings?.[index] || '').trim();
      return meaning ? '<div class="opt-meaning">' + escape(meaning) + '</div>' : '';
    },
    buildResultOptionMeaningHtml: (question, letter, escape) => {
      const index = String(letter).charCodeAt(0) - 65;
      const meaning = String(question?.optionMeanings?.[index] || '').trim();
      return meaning ? '<div class="opt-meaning">' + escape(meaning) + '</div>' : '';
    },
    buildResultOptionMeaningHtml: (question, letter, escape) => {
      const index = String(letter).charCodeAt(0) - 65;
      const meaning = String(question?.optionMeanings?.[index] || '').trim();
      return meaning ? '<div class="opt-meaning">' + escape(meaning) + '</div>' : '';
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
      { recordId: 'q-two', word: 'calm', your: 'A', correct: true },
      { recordId: 'q-one', word: 'bright', your: 'A', correct: true },
    ],
  });

  const html = resultContent.innerHTML;
  const lakePosition = html.indexOf('\\u6e56\\u9762\\u4fdd\\u6301\\u5e73\\u9759\\u3002');
  const crayonPosition = html.indexOf('\\u6211\\u7528\\u4e86\\u660e\\u4eae\\u7684\\u8721\\u7b14\\u3002');
  assert.ok(lakePosition >= 0 && crayonPosition >= 0);
  assert.ok(lakePosition < crayonPosition);
  assert.doesNotMatch(html, /correctMeaning/);
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
    buildResultOptionMeaningHtml: (question, letter) => {
      const index = String(letter).charCodeAt(0) - 65;
      const meaning = String(question?.optionMeanings?.[index] || '').trim();
      return meaning ? '<div class="opt-meaning">' + meaning + '</div>' : '';
    },
    buildResultOptionMeaningHtml: (question, letter) => {
      const index = String(letter).charCodeAt(0) - 65;
      const meaning = String(question?.optionMeanings?.[index] || '').trim();
      return meaning ? '<div class="opt-meaning">' + meaning + '</div>' : '';
    },
    buildResultOptionMeaningHtml: (question, letter) => {
      const index = String(letter).charCodeAt(0) - 65;
      const meaning = String(question?.optionMeanings?.[index] || '').trim();
      return meaning ? '<div class="opt-meaning">' + meaning + '</div>' : '';
    },
    buildResultOptionMeaningHtml: (question, letter) => {
      const index = String(letter).charCodeAt(0) - 65;
      const meaning = String(question?.optionMeanings?.[index] || '').trim();
      return meaning ? '<div class="opt-meaning">' + meaning + '</div>' : '';
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
    correct: results.length,
    total: results.length,
    accuracy: '100.0%',
    masteredWords: [],
    results,
  });
  return resultContent.innerHTML;
}

test('snake_case record_id binds reversed same-spelling results to the right translation', () => {
  const html = renderResultTranslations([
    { type: 1, record_id: 'bank-finance', word: 'bank', contextCN: 'finance bank sentence', options: ['A. bank'], answer: 'A' },
    { type: 1, record_id: 'bank-river', word: 'bank', contextCN: 'river bank sentence', options: ['A. bank'], answer: 'A' },
  ], [
    { record_id: 'bank-river', word: 'bank', your: 'A', correct: true },
    { record_id: 'bank-finance', word: 'bank', your: 'A', correct: true },
  ]);

  assert.match(html, /river bank sentence/);
  assert.match(html, /finance bank sentence/);
  assert.ok(html.indexOf('river bank sentence') < html.indexOf('finance bank sentence'));
});

test('wordRecordId binds reversed same-spelling results to the right translation', () => {
  const html = renderResultTranslations([
    { type: 1, wordRecordId: 'seal-animal', word: 'seal', contextCN: 'animal seal sentence', options: ['A. seal'], answer: 'A' },
    { type: 1, wordRecordId: 'seal-stamp', word: 'seal', contextCN: 'stamp seal sentence', options: ['A. seal'], answer: 'A' },
  ], [
    { wordRecordId: 'seal-stamp', word: 'seal', your: 'A', correct: true },
    { wordRecordId: 'seal-animal', word: 'seal', your: 'A', correct: true },
  ]);

  assert.match(html, /stamp seal sentence/);
  assert.match(html, /animal seal sentence/);
  assert.ok(html.indexOf('stamp seal sentence') < html.indexOf('animal seal sentence'));
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

test('question number binds same-spelling results when the response has no meaning alias', () => {
  const html = renderResultTranslations([
    { type: 1, wordRecordId: 'bank-finance', word: 'bank', contextCN: 'finance bank sentence', options: ['A. bank'], answer: 'A' },
    { type: 1, wordRecordId: 'bank-river', word: 'bank', contextCN: 'river bank sentence', options: ['A. bank'], answer: 'A' },
  ], [
    { q: 2, word: 'bank', your: 'A', correct: true },
    { q: 1, word: 'bank', your: 'A', correct: true },
  ]);

  assert.ok(html.indexOf('river bank sentence') >= 0);
  assert.ok(html.indexOf('finance bank sentence') >= 0);
  assert.ok(html.indexOf('river bank sentence') < html.indexOf('finance bank sentence'));
});

test('unique word remains a fallback when result source identity is absent', () => {
  const html = renderResultTranslations([
    { type: 1, word: 'unique', contextCN: 'unique fallback sentence', options: ['A. unique'], answer: 'A' },
    { type: 1, word: 'other', contextCN: 'other sentence', options: ['A. other'], answer: 'A' },
  ], [
    { word: 'unique', your: 'A', correct: true },
  ]);

  assert.match(html, /unique fallback sentence/);
});

test('wordId binds reversed same-spelling results to the right translation', () => {
  const html = renderResultTranslations([
    { type: 1, wordId: 'bat-animal', word: 'bat', contextCN: 'animal bat sentence', options: ['A. bat'], answer: 'A' },
    { type: 1, wordId: 'bat-tool', word: 'bat', contextCN: 'tool bat sentence', options: ['A. bat'], answer: 'A' },
  ], [
    { wordId: 'bat-tool', word: 'bat', your: 'A', correct: true },
    { wordId: 'bat-animal', word: 'bat', your: 'A', correct: true },
  ]);

  assert.match(html, /tool bat sentence/);
  assert.match(html, /animal bat sentence/);
  assert.ok(html.indexOf('tool bat sentence') < html.indexOf('animal bat sentence'));
});

test('sourceRecordId binds reversed same-spelling results to the right translation', () => {
  const html = renderResultTranslations([
    { type: 1, sourceRecordId: 'match-sport', word: 'match', contextCN: 'sport match sentence', options: ['A. match'], answer: 'A' },
    { type: 1, sourceRecordId: 'match-fire', word: 'match', contextCN: 'fire match sentence', options: ['A. match'], answer: 'A' },
  ], [
    { sourceRecordId: 'match-fire', word: 'match', your: 'A', correct: true },
    { sourceRecordId: 'match-sport', word: 'match', your: 'A', correct: true },
  ]);

  assert.match(html, /fire match sentence/);
  assert.match(html, /sport match sentence/);
  assert.ok(html.indexOf('fire match sentence') < html.indexOf('sport match sentence'));
});
