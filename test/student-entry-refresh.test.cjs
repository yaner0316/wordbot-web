const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
function fn(name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(source);
  const rest = source.slice(match.index), next = /\n(?:async )?function \w+\(/.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}
function harness() {
  let release;
  const section = { dataset: {}, className: '', children: {} };
  Object.defineProperty(section, 'innerHTML', {
    get() { return this.html; },
    set(html) {
      this.html = html;
      this.children = {
        '.home-v2-quick-grid': { outerHTML: html },
        '#studentBackupPanel': { innerHTML: '' },
        '#studentToolPanel': { style: { display: 'none' }, innerHTML: '', input: null, host: null },
      };
    },
  });
  section.querySelector = selector => section.children[selector] || null;
  const panel = () => section.querySelector('#studentToolPanel');
  const c = { state: { user: 'child' },
    $: id => id === 'studentTools' ? section : id === 'studentToolPanel' ? panel() : id === 'studentWordsInput' ? panel()?.input : null,
    getWordEntryDuplicatePanel: () => panel()?.host,
    getBankedGameMinutes: () => c.minutes, hasActiveQuizDraft: () => false,
    renderUnsyncedQuizBackups: () => '<details>备份</details>', escapeHtml: x => x,
    parseParentWordEntries: value => [{ word: value }], validateWordEntryFormat: () => true,
    showLoading() {}, hideLoading() {}, showToast() {},
    api: () => new Promise(resolve => release = resolve), minutes: 0,
  };
  vm.createContext(c);
  vm.runInContext(['renderStudentTools', 'lookupSelectedSenses', 'renderDictionarySenseOption'].map(fn).join('\n'), c);
  c.renderStudentTools();
  const open = () => { panel().style.display = 'block'; panel().input = { value: 'carry the banner' }; panel().host = { innerHTML: '' }; return panel(); };
  return { c, section, panel, open, respond: () => release({ senses: [{ cnMeaning: '带头', partOfSpeech: 'phrase', example: 'They carry the banner for the team.', exampleCN: '他们为团队带头。' }] }) };
}
test('home refresh preserves the open phrase input and pending lookup while updating quick tools', async () => {
  const h = harness(), original = h.open(), input = original.input, host = original.host;
  const pending = h.c.lookupSelectedSenses();
  h.c.minutes = 7;
  h.c.renderStudentTools();
  assert.equal(h.panel(), original);
  assert.equal(h.panel().input, input);
  assert.equal(input.value, 'carry the banner');
  assert.equal(h.panel().style.display, 'block');
  assert.match(h.section.querySelector('.home-v2-quick-grid').outerHTML, /7 分钟/);
  h.respond(); await pending;
  assert.equal(h.panel().host, host);
  assert.match(host.innerHTML, /sense-option-row/);
  assert.match(host.innerHTML, /carry the banner for the team/);
});
test('switching learner clears the entry and ignores the previous learner pending lookup', async () => {
  const h = harness(), original = h.open();
  const pending = h.c.lookupSelectedSenses();
  h.c.state.user = 'other-child'; h.c.renderStudentTools();
  assert.notEqual(h.panel(), original);
  assert.equal(h.panel().style.display, 'none');
  const other = h.open(); other.input.value = 'library';
  h.respond(); await pending;
  assert.equal(other.host.innerHTML, '');
  assert.equal(other.input.value, 'library');
});
