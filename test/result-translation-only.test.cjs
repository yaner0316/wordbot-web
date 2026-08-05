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
  assert.match(renderResults, /const translationHtml = isCorrect\s*\?\s*buildContextTranslationHtml\(q,\s*escapeHtml\)\s*:\s*'';/);
  assert.match(renderResults, /\$\{tag\}\$\{translationHtml\}<\/div>/);
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
