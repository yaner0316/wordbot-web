const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function fn(name) {
  const match = new RegExp('(?:^|\\n)((?:async )?function ' + name + '\\()').exec(app);
  assert.ok(match, `missing ${name}`);
  const start = match.index + (app[match.index] === '\n' ? 1 : 0);
  const rest = app.slice(start);
  const end = /\n(?:async )?function \w+\(/.exec(rest);
  return end ? rest.slice(0, end.index) : rest;
}

function questionHarness() {
  const controls = new Map();
  const document = { activeElement: null, body: { style: {} } };
  function makeOption(className, rawAttributes, index) {
    const attributes = new Map([...rawAttributes.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
    const option = {
      kind: 'option', index, className, attributes,
      classList: {
        add(name) { if (!option.className.split(/\s+/).includes(name)) option.className += ' ' + name; },
        remove(name) { option.className = option.className.split(/\s+/).filter(value => value !== name).join(' '); },
        contains(name) { return option.className.split(/\s+/).includes(name); },
      },
      getAttribute(name) { return attributes.get(name) ?? null; },
      setAttribute(name, value) { attributes.set(name, String(value)); },
      focus() { document.activeElement = option; },
    };
    return option;
  }
  const questionArea = {
    _html: '',
    options: [],
    set innerHTML(value) {
      const focused = document.activeElement;
      this._html = value;
      this.options = [...value.matchAll(/<button class="([^"]*)"([^>]*)>/g)].map((match, index) => makeOption(match[1], match[2], index));
      if (focused && focused.kind === 'option') document.activeElement = { kind: 'body' };
    },
    get innerHTML() { return this._html; },
    querySelectorAll(selector) { return selector.includes('option-btn') ? this.options : []; },
  };
  for (const id of ['quizProgressFill', 'quizProgressText', 'quizTotalText', 'prevBtn', 'nextBtn', 'submitBtn']) {
    controls.set(id, { style: {}, disabled: false, textContent: '' });
  }
  controls.set('questionArea', questionArea);
  const context = {
    state: {
      answers: [null], currentQuestion: 0, mode: 'real', session: { kind: 'quiz' },
      quiz: { questions: [{ type: 1, context: 'A _____ example.', options: ['A. first', 'B. second', 'C. third', 'D. fourth'] }] },
    },
    document,
    $: id => controls.get(id),
    escapeHtml: value => String(value),
    formatOptionDisplayText: value => value,
    isMeaningReviewQuestion: () => false,
    saveCurrentSessionProgress() {},
  };
  document.querySelectorAll = selector => questionArea.querySelectorAll(selector);
  document.querySelector = selector => {
    const index = Number(selector.match(/data-option-index="(\d+)"/)?.[1]);
    return Number.isInteger(index) ? questionArea.options.find(option => option.index === index) || null : null;
  };
  vm.createContext(context);
  vm.runInContext([fn('renderQuestion'), fn('selectOption')].join('\n'), context);
  return { context, document, questionArea };
}

test('mobile viewport permits users to zoom', () => {
  const viewport = html.match(/<meta\s+name="viewport"\s+content="([^"]+)"/i)?.[1] || '';
  assert.ok(viewport, 'viewport meta tag exists');
  assert.doesNotMatch(viewport, /maximum-scale\s*=\s*1(?:\.0)?|user-scalable\s*=\s*no/i);
});

test('answer options expose pressed state and keep focus on the selected option after selection', () => {
  const { context, document, questionArea } = questionHarness();
  context.renderQuestion(0);
  const choice = questionArea.options[1];
  assert.equal(choice.getAttribute('aria-pressed'), 'false');
  choice.focus();
  context.selectOption(0, 1);
  const selected = questionArea.options.find(option => option.index === 1) || document.activeElement;
  assert.equal(selected.classList.contains('selected'), true);
  assert.equal(selected.getAttribute('aria-pressed'), 'true');
  assert.equal(document.activeElement, selected);
});

test('history details are a labelled modal dialog', () => {
  const sheet = html.match(/<div\b[^>]*id="hdSheet"[^>]*>/)?.[0] || '';
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /aria-modal="true"/);
  const labelledBy = sheet.match(/aria-labelledby="([^"]+)"/)?.[1];
  assert.ok(labelledBy, 'dialog names a visible title element');
  assert.match(html, new RegExp(`<[^>]+id="${labelledBy}"[^>]*>`));
});

test('opening history focuses its close button and closing returns focus to the opener', () => {
  const focusEvents = [];
  const opener = { focus() { focusEvents.push('opener'); } };
  const nodes = Object.fromEntries(['hdDate', 'hdScore', 'hdBody', 'hdBackdrop', 'hdSheet', 'hdClose'].map(id => [id, {
    textContent: '', className: '', style: {},
    classList: { add() {}, remove() {} },
    replaceChildren() {}, appendChild() {},
    focus() { focusEvents.push(id); },
  }]));
  const c = {
    state: {},
    $: id => nodes[id],
    document: { activeElement: opener, body: { style: {} }, createElement: () => ({}) },
    formatDate: () => 'today',
  };
  vm.createContext(c);
  vm.runInContext([fn('openHistoryDetail'), fn('closeHistoryDetail')].join('\n'), c);
  c.openHistoryDetail({ correct: 1, total: 1, questions: [] });
  assert.deepEqual(focusEvents, ['hdClose']);
  assert.equal(nodes.hdSheet.inert, false);
  c.closeHistoryDetail();
  assert.deepEqual(focusEvents, ['hdClose', 'opener']);
  assert.equal(nodes.hdSheet.inert, true);
});

test('history cards can be opened with the keyboard and become the focus return target', () => {
  const doc = { activeElement: null };
  function node() {
    return { children: [], style: {}, attrs: {}, events: {},
      append(...children) { this.children.push(...children); },
      appendChild(child) { this.children.push(child); },
      replaceChildren() { this.children = []; },
      setAttribute(key, value) { this.attrs[key] = String(value); },
      addEventListener(key, handler) { this.events[key] = handler; },
      focus() { doc.activeElement = this; },
      click() { this.events.click(); },
    };
  }
  doc.createElement = node;
  const content = node();
  const opened = [];
  const c = { state: {}, document: doc, $: () => content, formatDate: () => 'today',
    openHistoryDetail: item => opened.push([item, doc.activeElement]) };
  vm.createContext(c);
  vm.runInContext(fn('renderHistoryList'), c);
  const item = { correct: 1, total: 1, time: 1, questions: [] };
  c.renderHistoryList([item]);
  const card = content.children[0].children[0];
  assert.equal(card.tabIndex, 0);
  assert.equal(card.attrs.role, 'button');
  let prevented = 0;
  for (const key of ['Enter', ' ']) card.events.keydown({ key, preventDefault() { prevented++; } });
  assert.equal(prevented, 2);
  assert.equal(opened.length, 2);
  assert.equal(opened[0][1], card);
});

test('the history modal keeps Tab inside and Escape closes it', () => {
  assert.match(html, /id="hdSheet"[^>]*\binert\b/);
  assert.match(html, /id="hdSheet"[^>]*onkeydown="handleHistoryDetailKeydown\(event\)"/);
  let closed = 0, prevented = 0, focused = 0;
  const button = { focus() { focused++; } };
  const c = { document: { activeElement: button },
    $: () => ({ querySelectorAll: () => [button] }), closeHistoryDetail() { closed++; } };
  vm.createContext(c);
  vm.runInContext(fn('handleHistoryDetailKeydown'), c);
  c.handleHistoryDetailKeydown({ key: 'Tab', preventDefault() { prevented++; } });
  c.handleHistoryDetailKeydown({ key: 'Escape', preventDefault() { prevented++; }, stopPropagation() {} });
  assert.equal(prevented, 2);
  assert.equal(focused, 1);
  assert.equal(closed, 1);
});
