const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
function fn(name,next){return source.slice(source.indexOf(`function ${name}(`),source.indexOf(`function ${next}(`));}
test('blocked challenge shows reason and recovery before first click',()=>{
 const label={},inline={};const button={querySelector:()=>label};
 const context={state:{level:'elementary',quizReadinessRevealed:false},document:{querySelector:s=>s.includes('home-primary')?button:inline},getQuizCacheReadiness:()=>({disabled:true,buttonLabel:'准备中',state:'pending',detail:'等待题目',action:'query'}),escapeHtml:s=>s};
 vm.createContext(context);vm.runInContext(fn('renderQuizCacheReadiness','renderQuizCacheReadinessFromDiagnostics'),context);
 context.renderQuizCacheReadiness({});assert.equal(button.disabled,true);assert.equal(inline.hidden,false);assert.match(inline.innerHTML,/retryQuestionCacheStatusQuery/);
});
test('logout waits for server cookie clearing and retains state on failure',async()=>{
 const events=[];const context={state:{user:'child'},api:async()=>{events.push('api');throw Error('offline')},clearAllQuizDrafts:()=>events.push('clear'),clearSessionUser:()=>events.push('clear'),resetParentConsole(){},showLoginPage(){},showToast(){}};
 vm.createContext(context);let code=fn('logout','renderUsers');if(source.includes('async function logout'))code='async '+code;vm.runInContext(code,context);
 await context.logout();assert.deepEqual(events,['api']);assert.equal(context.state.user,'child');
});
