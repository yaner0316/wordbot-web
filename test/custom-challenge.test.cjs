const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = path.join(__dirname, '../src/custom-challenge.js');
test('selection searches English only so hidden meanings cannot be inferred through search', () => {
  assert.ok(fs.existsSync(file), 'self-selection module exists');
  const { filterChallengeWords, challengeSelectionSummary } = require(file);
  const words = [ { meaningId:'a',word:'bank',meaning:'银行',status:'pending',eligible:true }, {meaningId:'b',word:'bank',meaning:'河岸',status:'consolidating',eligible:true} ];
  assert.deepEqual(filterChallengeWords(words, '河岸', 'all'), []);
  assert.equal(filterChallengeWords(words, 'BANK', 'pending').length, 1);
  assert.deepEqual(challengeSelectionSummary(words, new Set(['b'])), {total:2,selected:1,automatic:1,available:2});
});

const bankSenses = [
  {meaningId:'a',word:'bank',meaning:'银行',status:'pending',eligible:true},
  {meaningId:'b',word:'bank',meaning:'河岸',status:'consolidating',eligible:true},
];
function pickerHarness(words = bankSenses) {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id,{value:'',textContent:'',innerHTML:'',querySelectorAll:()=>[]});
    return nodes.get(id);
  };
  const c = {$:get,document:{querySelectorAll:()=>[]},escapeHtml:String,showToast:()=>{},setTimeout,clearTimeout,
    state:{user:'child',currentPage:'challenge'},DEMO_MODE:false};
  vm.createContext(c);vm.runInContext(fs.readFileSync(file,'utf8'),c);
  c.words=words;vm.runInContext('challengePicker.candidates=words',c);
  return {c,get,selected:()=>Array.from(vm.runInContext('[...challengePicker.selected]',c))};
}
test('picker hides meanings and merges the word even under a single-status filter', () => {
  const h=pickerHarness();h.c.setChallengeFilter('pending');
  const html=h.get('challengeWordList').innerHTML;
  assert.equal((html.match(/class="challenge-word /g)||[]).length,1);
  assert.ok(!html.includes('银行')&&!html.includes('河岸'));
  h.c.toggleChallengeWord('a');assert.deepEqual(h.selected(),['a','b']);
  h.c.toggleChallengeWord('a');assert.deepEqual(h.selected(),[]);
});
test('a grouped word is never partially selected when one sense is cooling or the quiz has one slot left', () => {
  const cooling=pickerHarness([bankSenses[0],{...bankSenses[1],eligible:false}]);
  cooling.c.toggleChallengeWord('a');assert.deepEqual(cooling.selected(),[]);
  const h=pickerHarness();vm.runInContext("challengePicker.selected=new Set(Array.from({length:9},(_,i)=>'other-'+i))",h.c);
  h.c.toggleChallengeWord('a');assert.equal(h.selected().length,9);
});
test('selected word sends both meaning IDs to quiz creation', async () => {
  const h=pickerHarness();let sent;
  h.c.api=async(url,options)=>{sent=JSON.parse(options.body);return {questions:[]};};
  h.c.clearActiveReview=()=>{};h.c.enterFormalQuiz=async()=>true;
  h.c.toggleChallengeWord('a');await h.c.beginSelectedChallenge();
  assert.deepEqual(sent.selection.meaningIds,['a','b']);
});
test('cooling words cannot increase the available count or selected count', () => {
  const { challengeSelectionSummary } = require(file);
  assert.deepEqual(challengeSelectionSummary([{meaningId:'a',eligible:false},{meaningId:'b',eligible:true}],new Set(['a','b'])), {total:2,selected:1,automatic:1,available:1});
});
test('short formal count accepts declared complete sets and rejects truncated sets', () => {
  const app = fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
  const start = app.indexOf('function getFormalChallengeQuestionCountIssue(');
  const end = app.indexOf('\nasync function enterFormalQuiz',start);
  const c = {};vm.createContext(c);vm.runInContext(app.slice(start,end),c);
  const quiz = {mode:'real',questions:[{challengeSize:2},{challengeSize:2}]};
  assert.equal(c.getFormalChallengeQuestionCountIssue(quiz), null);
  assert.ok(c.getFormalChallengeQuestionCountIssue({...quiz,questions:quiz.questions.slice(0,1)}));
  assert.ok(c.getFormalChallengeQuestionCountIssue({mode:'real',questions:[{}]}));
});

function loadChallengeFlow(overrides = {}) {
  const backedUp = [];
  const oldQuiz = {testId:'real-unconfirmed',submissionUnknown:true,submissionPayload:{answers:[{option:2}]}};
  const c = {
    state:{user:'child',currentPage:'challenge',mode:'real',quiz:oldQuiz,answers:[2]}, DEMO_MODE:false,
    setTimeout, clearTimeout, $:()=>null,
    api:async()=>({testId:'real-new',level:'中学',questions:[{challengeSize:1}]}),
    renderChallengePicker(){}, challengeStatus(){}, clearActiveReview(){}, showToast(){},
    preserveUnsyncedQuiz:(user,quiz)=>backedUp.push({user,quiz,answers:[...c.state.answers]}),
    enterFormalQuiz:async quiz=>{c.state.quiz=quiz;c.state.answers=[null];return true;},
    ...overrides,
  };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(file,'utf8'),c);
  c.renderChallengePicker=()=>{};
  c.challengeStatus=()=>{};
  vm.runInContext("challengePicker.selected.add('meaning-one');",c);
  return {c,backedUp,oldQuiz,selected:()=>vm.runInContext('[...challengePicker.selected]',c)};
}

test('custom entry preserves an unconfirmed answer before replacing the quiz and consumes this selection only once', async () => {
  const h=loadChallengeFlow();
  await h.c.beginSelectedChallenge();
  assert.equal(h.backedUp.length,1);
  assert.equal(h.backedUp[0].quiz,h.oldQuiz);
  assert.deepEqual(h.backedUp[0].answers,[2]);
  assert.equal(h.c.state.quiz.testId,'real-new');
  assert.equal(h.selected().length,0);
});

test('failed opening and supply preparation retain the chosen meanings', async () => {
  for (const overrides of [
    {enterFormalQuiz:async()=>false},
    {api:async()=>({pending:true,meaningIds:['meaning-one'],requiredCount:1,readyCount:0}),setTimeout:()=>1},
  ]) {
    const h=loadChallengeFlow(overrides);
    await h.c.beginSelectedChallenge();
    assert.equal(h.selected().join(','),'meaning-one');
  }
});

test('a successful challenge does not make its selected words the next challenge default', async () => {
  const h=loadChallengeFlow();
  h.c.state.quiz=null;
  await h.c.beginSelectedChallenge();
  assert.equal(h.selected().length,0);
});
