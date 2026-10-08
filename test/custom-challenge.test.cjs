const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = path.join(__dirname, '../src/custom-challenge.js');
test('selection supports Chinese search and keeps different senses independent', () => {
  assert.ok(fs.existsSync(file), 'self-selection module exists');
  const { filterChallengeWords, challengeSelectionSummary } = require(file);
  const words = [ { meaningId:'a',word:'bank',meaning:'银行',status:'pending',eligible:true }, {meaningId:'b',word:'bank',meaning:'河岸',status:'consolidating',eligible:true} ];
  assert.deepEqual(filterChallengeWords(words, '河岸', 'all').map(w=>w.meaningId), ['b']);
  assert.equal(filterChallengeWords(words, 'BANK', 'pending').length, 1);
  assert.deepEqual(challengeSelectionSummary(words, new Set(['b'])), {total:2,selected:1,automatic:1,available:2});
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
