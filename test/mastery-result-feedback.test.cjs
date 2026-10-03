const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const start = app.indexOf('function renderResults(data)');
const end = app.indexOf('function toggleAnalysis()', start);
assert.ok(start >= 0 && end > start, 'renderResults must exist');

function render(data) {
  const result = { innerHTML: '' };
  const c = {
    state: { session: { kind: 'quiz', analysisViewed: false, remainingRecordIds: [] }, quiz: { questions: [] } },
    _showAnalysis: false,
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    buildAnimalGardenRewardHtml: () => '',
    getEncourage: () => '继续加油',
    isMeaningReviewQuestion: () => false,
    mergeResultQuestionSnapshot: (_question, item) => item,
    buildOptionMeaningsExplanation: () => '',
    buildContextTranslationHtml: () => '',
    formatOptionDisplayText: value => value,
    buildMeaningReviewExplanation: () => '',
    updateResultActions() {},
    launchConfetti() {},
    $: id => id === 'resultContent' ? result : null,
  };
  vm.createContext(c);
  vm.runInContext('let _showAnalysis = false;\n' + app.slice(start, end), c);
  c.renderResults(data);
  return result.innerHTML;
}

test('results show newly mastered meanings with escaped meaning text and fully mastered word count', () => {
  const html = render({
    correct: 9, total: 10, accuracy: '90%', masteredWords: ['bright'],
    newlyMasteredMeanings: [
      { meaningId: 'bright-1', recordId: 'bright-1', word: 'bright', meaningZh: '明亮的 <清楚的>' },
      { meaningId: 'bright-2', recordId: 'bright-2', word: 'bright', meaningZh: '聪明的 & 机敏的' },
    ],
    results: [],
  });
  assert.match(html, /本次新掌握\s*2\s*个词义/);
  assert.match(html, /bright/);
  assert.match(html, /明亮的 &lt;清楚的&gt;/);
  assert.match(html, /聪明的 &amp; 机敏的/);
  assert.match(html, /其中\s*1\s*个单词已全部掌握/);
});

test('empty mastery feedback does not invent new mastery and keeps legacy fully mastered words', () => {
  const empty = render({ correct: 7, total: 10, accuracy: '70%', masteredWords: [], newlyMasteredMeanings: [], results: [] });
  assert.doesNotMatch(empty, /本次新掌握|其中.*已全部掌握/);
  const legacy = render({ correct: 8, total: 10, accuracy: '80%', masteredWords: ['steady'], results: [] });
  assert.match(legacy, /新掌握\s*1\s*个单词/);
});
