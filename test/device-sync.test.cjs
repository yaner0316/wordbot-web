const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/app.js'),'utf8');
function fn(name){const re=new RegExp('(?:^|\\n)((?:async )?function '+name+'\\()');const match=re.exec(source);assert.ok(match,`missing ${name}`);const start=match.index+(source[match.index]==='\n'?1:0);const rest=source.slice(start);const end=/\n(?:async )?function \w+\(/.exec(rest);return end?rest.slice(0,end.index):rest;}
function context(extra={}){const c={state:{user:'child',level:'高中',mode:'real',session:{kind:'quiz'}},DEMO_MODE:false,showToast(){},renderStudentTools(){},renderGameState(){},normalizeApiError:e=>e,...extra};vm.createContext(c);return c;}
test('cloud game balance replaces stale local balance and a read never writes it back',async()=>{
 let minutes=10;const writes=[];
 const c=context({api:async(path,opts)=>{if(opts?.method==='PUT')writes.push(opts);return {state:{minutes:2,claimIds:[],garden:{},revision:'r1'}};},getBankedGameMinutes:()=>minutes,setBankedGameMinutes:x=>minutes=x,getClaimedGameRewardIds:()=>new Set(),gameTimeRewardClaimKey:()=>'',getAnimalGardenState:()=>({}),setAnimalGardenState(){},localStorage:{setItem(){}},gameStateByUser:new Map(),gameMutationQueues:new Map()});
 vm.runInContext(['applyServerGameState','readGameStateFromServer','persistGameState','syncGameStateFromServer'].filter(n=>source.includes('function '+n+'(')).map(fn).join('\n'),c);
 await c.syncGameStateFromServer('child');assert.equal(minutes,2);assert.equal(writes.length,0);
});
test('continue reads cloud progress even when a local draft exists',async()=>{
 const calls=[];const c=context({quizProgressSavePromise:Promise.resolve(),restoreQuizDraft:async()=>{calls.push('local');return true;},loadRemoteQuizSession:async()=>calls.push('read'),restoreRemoteQuizSession:async()=>{calls.push('remote');return true;},clearQuizDraft(){},preserveUnsyncedQuiz(){},recoverPendingQuizDraft:async()=>false});
 vm.runInContext(fn('handleContinueQuizEntry'),c);assert.equal(await c.handleContinueQuizEntry(),true);assert.deepEqual(calls,['read','remote']);
});
test('resume through quiz generation honors cloud answers cursor and revision',async()=>{
 const c=context({getFormalChallengeQuestionCountIssue:()=>null,inspectFormalQuizResponse:()=>({blocked:false}),inspectQuizContentForBlockingIssue:()=>({blocked:false}),saveQuizDraft(){},navigateTo(){},renderQuestion(){}});
 vm.runInContext(fn('enterFormalQuiz'),c);await c.enterFormalQuiz({testId:'real-sync',mode:'real',questions:Array.from({length:10},()=>({})),progress:{currentQuestion:4,answers:[0,1,2,3,0],revision:8}});
 assert.equal(c.state.currentQuestion,4);assert.equal(c.state.answers[4],0);assert.equal(c.state.quiz.progressRevision,8);
});
test('settings response for a previous user cannot overwrite the current user',async()=>{
 let resolve;const c=context({api:()=>new Promise(r=>resolve=r),saveUserDifficulty(){},updateLevelButtons(){}});vm.runInContext(fn('syncLearningSettingsFromServer'),c);const pending=c.syncLearningSettingsFromServer('child');c.state.user='other';resolve({settings:{learningLevel:'小学'}});await pending;assert.equal(c.state.level,'高中');
});
test('progress uploads are serialized and advance the accepted revision',async()=>{
 let release;const calls=[];const c=context({remoteProgressSaveToken:0,quizProgressSavePromise:Promise.resolve(),remoteQuizSession:null,saveQuizDraft(){},api:async(path,options)=>{const body=JSON.parse(options.body);calls.push(body);if(calls.length===1)await new Promise(r=>release=r);return {saved:true,progress:{revision:calls.length}};}});c.state.quiz={testId:'real-sync',questions:[{},{}],progressRevision:0};c.state.answers=[0,null];c.state.currentQuestion=0;
 vm.runInContext(fn('saveQuizProgressToServer'),c);const a=c.saveQuizProgressToServer();await Promise.resolve();await Promise.resolve();c.state.answers=[0,1];c.state.currentQuestion=1;const b=c.saveQuizProgressToServer();await Promise.resolve();await Promise.resolve();const count=calls.length;release();await Promise.all([a,b]);assert.equal(count,1);assert.equal(calls[1].baseRevision,1);assert.equal(c.state.quiz.progressRevision,2);
});

test('game conflict refreshes cloud state without committing the rejected deduction',async()=>{
 const messages=[];let reads=0,local=4;
 const c=context({gameMutationQueues:new Map(),readGameStateFromServer:async()=>{reads++;local=reads===1?4:2;return {minutes:local,revision:'r'+reads};},persistGameState:async()=>{throw Object.assign(new Error('conflict'),{code:'GAME_STATE_CONFLICT'});},showToast:m=>messages.push(m)});
 vm.runInContext(fn('mutateGameState'),c);assert.equal(await c.mutateGameState('child',remote=>({...remote,minutes:remote.minutes-1})),null);assert.equal(local,2);assert.equal(reads,2);assert.match(messages[0],/另一设备/);
});
test('garden action waits for cloud acceptance and never spends a stale local balance',async()=>{
 let next,rendered=0;const c=context({getBankedGameMinutes:()=>99,mutateGameState:async(user,build)=>{next=build({minutes:1,garden:{hearts:3},claimIds:['real-a']});return null;},normalizeGardenOutfit:x=>x||'草帽',$:()=>{rendered++;return {};}});
 vm.runInContext(fn('playAnimalGardenAction'),c);await c.playAnimalGardenAction('care');assert.equal(next.minutes,0);assert.equal(next.garden.hearts,5);assert.equal(rendered,0);
});
test('real quiz rewards cannot be added locally',()=>{
 const c=context({getBankedGameMinutes:()=>2,setBankedGameMinutes:()=>{throw new Error('local reward');}});vm.runInContext(fn('addGameRewardToBank'),c);assert.equal(c.addGameRewardToBank({eligible:true,minutes:8}),2);
});

test('focus refresh restores a newer cloud quiz and retries only unchanged cloud revisions',async()=>{
 let restores=0,retries=0;const quiz={testId:'real-focus',progressRevision:2,syncFailed:true};const c=context({deviceRefreshPromise:null,document:{visibilityState:'visible'},quizProgressSavePromise:Promise.resolve(),syncLearningSettingsFromServer:async()=>{},syncGameStateFromServer:async()=>{},$:()=>null,loadRemoteQuizSession:async()=>({testId:'real-focus',progress:{revision:2}}),saveQuizProgressToServer:async()=>retries++,preserveUnsyncedQuiz(){},restoreRemoteQuizSession:async()=>restores++});c.state.quiz=quiz;c.state.currentPage='quiz';c.state.answers=[0];c.state.currentQuestion=0;
 vm.runInContext(fn('refreshDeviceState'),c);await c.refreshDeviceState();assert.equal(retries,1);assert.equal(restores,0);c.loadRemoteQuizSession=async()=>({testId:'real-focus',progress:{revision:3}});await c.refreshDeviceState();assert.equal(restores,1);assert.equal(retries,1);
});
test('pending draft is retried only when its cloud revision is still current',async()=>{
 let restored=0,uploaded=0,backups=0;const saved={quiz:{testId:'real-draft',syncPending:true,progressRevision:4},session:{kind:'quiz'},answers:[1],currentQuestion:0};const c=context({localStorage:{getItem:()=>JSON.stringify(saved),setItem:()=>backups++},activeQuizKey:()=>'',remoteQuizSession:{testId:'real-draft',progress:{revision:4}},enterFormalQuiz:async(q,options)=>{assert.equal(options.answers[0],1);restored++;return true;},saveQuizProgressToServer:async()=>uploaded++});vm.runInContext(fn('recoverPendingQuizDraft'),c);assert.equal(await c.recoverPendingQuizDraft(),true);assert.equal(uploaded,1);c.remoteQuizSession.progress.revision=5;assert.equal(await c.recoverPendingQuizDraft(),false);assert.equal(restored,1);assert.equal(backups,1);
});

test('home focus refreshes the stale six-question readiness after settings sync',async()=>{
 const calls=[];const c=context({deviceRefreshPromise:null,document:{visibilityState:'visible'},quizProgressSavePromise:Promise.resolve(),syncLearningSettingsFromServer:async()=>calls.push('settings'),syncGameStateFromServer:async()=>{},loadQuizCacheReadiness:async()=>calls.push('readiness'),loadRemoteQuizSession:async()=>null,$:()=>null});c.state.currentPage='home';vm.runInContext(fn('refreshDeviceState'),c);await c.refreshDeviceState();assert.deepEqual(calls,['settings','readiness']);
});
test('pending readiness refreshes once after delay and stops when ten questions are ready',async()=>{
 let callback,reads=0;const c=context({quizReadinessRefreshTimer:null,document:{visibilityState:'visible'},clearTimeout(){callback=null;},setTimeout:(cb,delay)=>{assert.equal(delay,15000);callback=cb;return 1;},getQuizCacheReadiness:status=>({disabled:status.eligibleReadyMeanings<10}),loadQuizCacheReadiness:async()=>reads++});c.state.currentPage='home';c.state.questionCacheStatus={eligibleReadyMeanings:6};vm.runInContext(fn('scheduleQuizReadinessRefresh'),c);c.scheduleQuizReadinessRefresh('child');assert.equal(typeof callback,'function');await callback();assert.equal(reads,1);c.state.questionCacheStatus.eligibleReadyMeanings=28;c.scheduleQuizReadinessRefresh('child');assert.equal(callback,null);
});

test('older readiness response cannot replace a newer result for the same user',async()=>{
 let resolveFirst,resolveSecond;let request=0;
 const c=context({quizReadinessRequestId:0,api:()=>new Promise(resolve=>{if(request++===0)resolveFirst=resolve;else resolveSecond=resolve;}),renderQuizCacheReadiness(){},scheduleQuizReadinessRefresh(){}});
 vm.runInContext(fn('loadQuizCacheReadiness'),c);
 const first=c.loadQuizCacheReadiness('child');const second=c.loadQuizCacheReadiness('child');
 resolveSecond({status:{eligibleReadyMeanings:28}});await second;
 resolveFirst({status:{eligibleReadyMeanings:1}});await first;
  assert.equal(c.state.questionCacheStatus.eligibleReadyMeanings,28);
});

test('readiness status requests bypass a cached browser response',async()=>{
  let options;
  const c=context({quizReadinessRequestId:0,api:async(_path, requestOptions)=>{
    options=requestOptions;
    return {status:{eligibleReadyMeanings:28}};
  },renderQuizCacheReadiness(){},scheduleQuizReadinessRefresh(){}});
  vm.runInContext(fn('loadQuizCacheReadiness'),c);
  await c.loadQuizCacheReadiness('child');
  assert.equal(options.cache,'no-store');
});
