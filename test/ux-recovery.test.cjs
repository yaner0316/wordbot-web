const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
function fn(name){const match=new RegExp('(?:async )?function '+name+'\\(').exec(source);assert.ok(match,name);const rest=source.slice(match.index),next=/\n(?:async )?function \w+\(/.exec(rest);return next?rest.slice(0,next.index):rest;}
for(const primary of ['start-review','continue-review','finish'])test('expanded analysis retains next action: '+primary,()=>{
  const panel={};const c={_showAnalysis:true,state:{session:{kind:'quiz',analysisViewed:true,remainingRecordIds:['a']}},$:()=>panel,getResultActions:()=>({primary})};
  vm.createContext(c);vm.runInContext(fn('updateResultActions'),c);c.updateResultActions();
  assert.match(panel.innerHTML,/toggleAnalysis/);assert.match(panel.innerHTML,new RegExp(primary==='start-review'?'startWrongAnswerReview':primary==='continue-review'?'continueWrongAnswerReview':'showFinalReviewSummary'));
});
for(const handler of ['selectOption','setMeaningAnswer'])test('unconfirmed submission blocks answer edits: '+handler,()=>{
  const c={state:{quiz:{submissionUnknown:true},answers:[0]},showToast(){},document:{},saveCurrentSessionProgress(){},renderQuestion(){},$:()=>({})};
  vm.createContext(c);vm.runInContext(fn(handler),c);c[handler](0,1);assert.deepEqual(c.state.answers,[0]);
});
test('successful HTTP response with unreadable JSON cannot be mistaken for a saved result',async()=>{
  const c={API_BASE:'',setTimeout,clearTimeout,AbortController,fetch:async()=>({ok:true,status:200,json:async()=>{throw new SyntaxError('truncated');}}),normalizeApiPayload:x=>x};
  vm.createContext(c);vm.runInContext(fn('api'),c);
  await assert.rejects(c.api('/api/submit',{method:'POST'}),e=>e.code==='RESPONSE_UNREADABLE');
});

test('review confirmation reuses original text answers after response loss and clears uncertainty on success',async()=>{
  const calls=[];let saved=false;
  const c={state:{user:'kid',mode:'real',answers:['银行'],currentQuestion:0,quiz:{questions:[{type:4}]},session:{kind:'review',reviewId:'review-1',reviewRounds:[]}},DEMO_MODE:false,
    api:async(p,o)=>{calls.push(JSON.parse(o.body));if(!saved)throw new TypeError('Failed to fetch');return {results:[],remainingRecordIds:[]};},
    canLeaveCurrentQuestion:()=>true,isSenseChoiceReviewQuestion:()=>false,isMeaningReviewQuestion:()=>true,meaningAnswerValue:i=>c.state.answers[i],
    $:()=>({}),showLoading(){},hideLoading(){},showToast(){},saveCurrentSessionProgress(){},navigateTo(){},renderResults(){},normalizeApiError:x=>x};
  vm.createContext(c);vm.runInContext(['submitWithTimeoutConfirmation','submitReviewToBackend','submitQuiz'].map(fn).join('\n'),c);
  await c.submitQuiz();assert.equal(c.state.quiz.submissionUnknown,true);
  c.state.answers=['河岸'];saved=true;await c.submitQuiz();
  assert.equal(calls.length,3);assert.ok(calls.every(x=>x.answers[0].text==='银行'));
  assert.deepEqual(Array.from(c.state.answers),['银行']);assert.equal(c.state.quiz.submissionUnknown,false);
});
