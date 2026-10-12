const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8').replace(/\r\n/g, '\n');

function loadEntry(value, parent = false) {
  const calls = [], notices = [], input = { value };
  const panel = {
    querySelector: () => ({ dataset: { selectedSenseWord: value } }),
    querySelectorAll: () => [{ dataset: { selectedSense: '0' } }],
    _dictionarySenses: [{ definition: 'a meaning', cnMeaning: '释义' }],
  };
  const context = {
    state: { user: 'test-user' }, DEMO_MODE: false,
    $: id => id === (parent ? 'parentWordsInput' : 'studentWordsInput') ? input : null,
    getWordEntryDuplicatePanel: () => panel,
    api: async (...args) => { calls.push(args); return { success: true, count: 1, senses: [] }; },
    showToast: message => notices.push(message), showLoading: () => calls.push(['loading']), hideLoading() {},
    clearDuplicateWordConfirmation() {}, loadStats() {}, escapeHtml: value => value,
    normalizeApiError: e => e, buildParentWordCooldownNotice: () => '已录入',
    isParentWordSubmissionSuccessful: result => result.success,
  };
  vm.createContext(context);
  for (const name of ['parseParentWordEntries', 'validateWordEntryFormat', 'shouldChooseDictionarySenses',
    'getWordEntryEndpoint', 'buildSelectedSenseEntries', 'submitWordEntry', 'lookupSelectedSenses',
    'submitParentWords', 'submitSelectedSenses']) {
    const start = app.search(new RegExp(`(?:async )?function ${name}\\(`));
    if (start < 0 && name === 'validateWordEntryFormat') continue;
    assert.ok(start >= 0, name);
    vm.runInContext(app.slice(start, app.indexOf('\n}', start) + 2), context);
  }
  return { context, calls, notices, input };
}

for (const parent of [false, true]) {
  test(`${parent ? 'parent' : 'child'} rejects Chinese and malformed entries before lookup or submission`, async () => {
    for (const value of ['恶心', '固体', '一个单词', 'apple\n固体', '固体 | 固态物质', '123', 'ō', '😀', 'apple中文']) {
      for (const action of ['submitWordEntry', 'submitParentWords']) {
        const h = loadEntry(value, parent);
        await h.context[action]();
        assert.deepEqual(h.calls, [], `${action}: ${value} must make no request or start loading`);
        assert.equal(h.input.value, value);
        assert.match(h.notices[0], /英文/);
      }
    }
  });
}

test('direct dictionary lookup and stale selected-sense confirmation also reject Chinese', async () => {
  for (const action of ['lookupSelectedSenses', 'submitSelectedSenses']) {
    const h = loadEntry('恶心');
    await h.context[action]();
    assert.deepEqual(h.calls, []);
    assert.equal(h.input.value, '恶心');
    assert.match(h.notices[0], /英文/);
  }
});

test('valid English with a Chinese meaning still reaches the normal save flow', async () => {
  for (const parent of [false, true]) {
    for (const value of ['bank | 银行', "don't | 不要", 'ice-cream | 冰淇淋', 'look after | 照顾']) {
      const h = loadEntry(value, parent);
      await h.context.submitWordEntry();
      const request = h.calls.find(call => call[0] === (parent ? '/api/admin/addWords' : '/api/words'));
      assert.ok(request, value);
      const body = JSON.parse(request[1].body);
      assert.equal(body.words[0].cnMeaning, value.split('|')[1].trim());
    }
  }
});

test('entry parser preserves phrases and only splits explicit list separators', () => {
  const h = loadEntry('');
  const parse = value => JSON.parse(JSON.stringify(h.context.parseParentWordEntries(value)));
  assert.deepEqual(parse('up to\ncarrying the banner'), [
    { word: 'up to', cnMeaning: '' }, { word: 'carrying the banner', cnMeaning: '' },
  ]);
  assert.deepEqual(parse('  Up   to, look\tafter；carry on;ice-cream，don\'t\napple'), [
    { word: 'up to', cnMeaning: '' }, { word: 'look after', cnMeaning: '' },
    { word: 'carry on', cnMeaning: '' }, { word: 'ice-cream', cnMeaning: '' },
    { word: "don't", cnMeaning: '' }, { word: 'apple', cnMeaning: '' },
  ]);
  assert.deepEqual(parse('up to | 多达，直到\nup   to | 多达，直到'), [{ word: 'up to', cnMeaning: '多达，直到' }]);
  assert.deepEqual(parse('the\nto').map(entry => entry.word), ['the', 'to']);
});

for (const parent of [false, true]) {
  test(`${parent ? 'parent' : 'child'} submits two intact phrases and looks up a single intact phrase`, async () => {
    const h = loadEntry('up to\ncarrying the banner', parent);
    await h.context.submitWordEntry();
    const request = h.calls.find(call => call[0] === (parent ? '/api/admin/addWords' : '/api/words'));
    assert.ok(request);
    assert.deepEqual(JSON.parse(request[1].body).words.map(entry => entry.word), ['up to', 'carrying the banner']);
    const single = loadEntry('up to', parent);
    await single.context.submitWordEntry();
    assert.ok(single.calls.some(call => call[0] === '/api/word-senses?word=up%20to'));
    assert.ok(!single.calls.some(call => call[1]?.method === 'POST'));
  });
}

test('suffix spelling is not classified as malformed English by the new UI guard', () => {
  const h = loadEntry('-ish');
  assert.equal(typeof h.context.validateWordEntryFormat, 'function');
  assert.equal(h.context.validateWordEntryFormat([{ word: '-ish' }, { word: '-ism' }]), true);
  assert.deepEqual(h.notices, []);
});
