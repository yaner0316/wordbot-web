const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');

function extractNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} function should exist`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`could not extract ${name}`);
}

function loadFunction(name) {
  if (name === 'mergeParentWordPages') {
    return Function(
      `"use strict"; ${extractNamedFunction(app, 'parentWordRecordId')} ${extractNamedFunction(app, name)}; return ${name};`
    )();
  }
  return Function(`"use strict"; return (${extractNamedFunction(app, name)});`)();
}

test('parent library deduplicates appended pages by stable recordId', () => {
  const dedupe = loadFunction('mergeParentWordPages');
  const result = dedupe([
    { recordId: 'bank-finance', word: 'bank', cnMeaning: '银行' },
    { recordId: 'bank-river', word: 'bank', cnMeaning: '河岸' },
  ], [
    { recordId: 'bank-river', word: 'bank', cnMeaning: '河岸（旧）' },
    { recordId: 'other-1', word: 'other' },
  ]);
  assert.deepEqual(result.map(item => item.recordId), ['bank-finance', 'bank-river', 'other-1']);
  assert.equal(result[1].cnMeaning, '河岸');
});

test('parent entry response only counts as success when backend accepts it without errors', () => {
  const accepted = loadFunction('isParentWordSubmissionSuccessful');
  assert.equal(accepted({ success: true, count: 2 }), true);
  assert.equal(accepted({ success: false, count: 2 }), false);
  assert.equal(accepted({ success: true, count: 2, errors: [{ word: 'bank' }] }), false);
});

test('parent entry cooldown notice clearly states the 18-hour wait', () => {
  const notice = loadFunction('buildParentWordCooldownNotice');
  assert.match(notice(), /18/);
  assert.match(notice(2), /2/);
  assert.match(notice(2), /18/);
});

test('parent library has continuous loading and per-meaning edit/delete controls', () => {
  assert.match(app, /function handleParentWordLibraryScroll/);
  assert.match(app, /IntersectionObserver|scrollY|scrollTop/);
  assert.match(app, /DELETE/);
  assert.match(app, /confirm\(/);
  assert.match(app, /function deleteParentWord/);
  assert.match(app, /data-record-id/);
  assert.doesNotMatch(app, /parent-word-pager/);
});
