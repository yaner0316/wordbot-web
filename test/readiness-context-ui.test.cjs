const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');

function fn(name) {
  const match = new RegExp('(?:^|\\n)((?:async )?function ' + name + '\\()').exec(source);
  assert.ok(match, `missing ${name}`);
  const start = match.index + (source[match.index] === '\n' ? 1 : 0);
  const rest = source.slice(start);
  const end = /\n(?:async )?function \w+\(/.exec(rest);
  return end ? rest.slice(0, end.index) : rest;
}

function readinessContext({ status = null, api = async () => ({ status: {} }), timers = {} } = {}) {
  const label = { textContent: '' };
  const inline = {
    hidden: false,
    innerHTML: '',
    setAttribute() {},
    insertAdjacentElement() {},
  };
  const button = {
    disabled: false,
    querySelector: () => label,
    childNodes: [],
    appendChild() {},
    insertAdjacentElement() {},
  };
  const c = {
    state: {
      user: 'synthetic-kid', level: '中学', mode: 'real', currentPage: 'home',
      quizReadinessRevealed: true, questionCacheStatus: status,
    },
    DEMO_MODE: false,
    quizReadinessRequestId: 0,
    quizReadinessRefreshTimer: null,
    document: {
      visibilityState: 'visible',
      querySelector: selector => selector.includes('home-primary') ? button : inline,
      createElement: () => ({ className: '', id: '', setAttribute() {}, appendChild() {} }),
    },
    api,
    normalizeApiError: error => ({ message: error.message || String(error) }),
    escapeHtml: value => String(value),
    clearTimeout: timers.clearTimeout || (() => {}),
    setTimeout: timers.setTimeout || (() => 1),
  };
  vm.createContext(c);
  vm.runInContext([
    fn('getLevelCacheStatus'), fn('getLevelCacheReadyCount'), fn('hasLevelCacheReadyCount'), fn('getQuizCacheReadiness'),
    fn('renderQuizCacheReadiness'), fn('loadQuizCacheReadiness'), fn('scheduleQuizReadinessRefresh'),
  ].join('\n'), c);
  return { c, button, label, inline };
}

test('a readiness query failure with no prior response shows an unknown quantity, not zero', async () => {
  const { c, inline } = readinessContext({ api: async () => { throw new Error('offline'); } });
  const readiness = await c.loadQuizCacheReadiness();
  assert.equal(readiness.readyCount, null);
  assert.doesNotMatch(inline.innerHTML, /\b0\s*题/);
  assert.match(inline.innerHTML, /未知|暂不可用|无法确认/);
});

test('a real successful query records the timestamp used by a later failed refresh', async () => {
  let failed = false;
  const { c, inline } = readinessContext({ api: async () => {
    if (failed) throw new Error('offline');
    return { status: { eligibleReadyMeanings: 12 } };
  } });
  const started = Date.now();
  await c.loadQuizCacheReadiness();
  const recorded = c.state.questionCacheStatus.lastSuccessAt;
  assert.ok(Date.parse(recorded) >= started);
  failed = true;
  await c.loadQuizCacheReadiness();
  assert.equal(c.state.questionCacheStatus.lastSuccessAt, recorded);
  assert.match(inline.innerHTML, /上次成功查询/);
  assert.equal(c.getQuizCacheReadiness(c.state.questionCacheStatus).disabled, true);
});

test('a failed refresh preserves the last successful count and timestamp for context', async () => {
  const lastSuccessAt = '2026-10-04T02:30:00.000Z';
  const previous = {
    eligibleReadyMeanings: 12,
    lastSuccessAt,
    learning: { totalMeanings: 12, masteredMeanings: 3, coolingMeanings: 2, availableMeanings: 4 },
  };
  const { c } = readinessContext({ status: previous, api: async () => { throw new Error('offline'); } });
  const readiness = await c.loadQuizCacheReadiness();
  assert.equal(c.state.questionCacheStatus.eligibleReadyMeanings, 12);
  assert.equal(c.state.questionCacheStatus.lastSuccessAt, lastSuccessAt);
  assert.equal(c.state.questionCacheStatus.queryError, 'offline');
  assert.equal(readiness.disabled, true, 'stale counts cannot authorize a challenge after a failed refresh');
});

test('an empty learning account gets an add-word call to action', () => {
  const { c, inline } = readinessContext();
  const readiness = c.renderQuizCacheReadiness({ eligibleReadyMeanings: 0, learning: { totalMeanings: 0 } });
  assert.equal(readiness.disabled, true);
  assert.match(inline.innerHTML, /添加单词|录入单词/);
  assert.match(inline.innerHTML, /button/);
});

test('an all-mastered account gets a success message and an add-words call to action', () => {
  const { c, inline } = readinessContext();
  const readiness = c.renderQuizCacheReadiness({
    eligibleReadyMeanings: 0,
    learning: { totalMeanings: 8, masteredMeanings: 8, coolingMeanings: 0, awaitingReviewMeanings: 0, missingEntryTimeMeanings: 0, availableMeanings: 0 },
  });
  assert.equal(readiness.disabled, true);
  assert.match(inline.innerHTML, /全部掌握|都已掌握|全部学会/);
  assert.match(inline.innerHTML, /添加单词|录入单词/);
});

test('cooling readiness explains the wait time without promising quiz readiness', () => {
  const nextCooldownEndsAt = '2026-10-04T05:00:00.000Z';
  const formattedEnd = new Date(nextCooldownEndsAt).toLocaleString();
  const { c, inline, button } = readinessContext();
  const readiness = c.renderQuizCacheReadiness({
    eligibleReadyMeanings: 0,
    learning: {
      totalMeanings: 12, masteredMeanings: 2, coolingMeanings: 3,
      awaitingReviewMeanings: 1, missingEntryTimeMeanings: 0, availableMeanings: 0,
      nextCooldownEndsAt,
    },
  });
  assert.equal(readiness.disabled, true);
  assert.match(inline.innerHTML, /冷却|等待复习/);
  assert.ok(inline.innerHTML.includes(formattedEnd));
  assert.match(inline.innerHTML, /不代表.*一定.*就绪/);
  assert.equal(button.disabled, true);
});

test('pending and retrying readiness keep the existing poll interval and ten-question gate', () => {
  const delays = [];
  const { c, button } = readinessContext({
    timers: { setTimeout: (_callback, delay) => { delays.push(delay); return delays.length; } },
  });
  for (const generation of [{ pending: true }, { retrying: true }]) {
    const status = { eligibleReadyMeanings: 9, generation };
    const readiness = c.renderQuizCacheReadiness(status);
    assert.equal(readiness.disabled, true);
    c.state.questionCacheStatus = status;
    c.scheduleQuizReadinessRefresh('synthetic-kid');
  }
  assert.deepEqual(delays, [15000, 15000]);
  assert.equal(button.disabled, true);
});
