const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
function harness(response){
 const start=source.indexOf('async function startHistoryReview('),end=source.indexOf('\nfunction historyTypeLabel',start);assert.ok(start>=0);
 const context={state:{user:'synthetic',mode:'real',session:{}},DEMO_MODE:false,showLoading(){},hideLoading(){},showToast(){},normalizeApiError:e=>e,closeHistoryDetail(){},navigateTo(){},renderQuestion(){},saveCurrentSessionProgress(){},calls:[],api:async(url,options)=>{context.calls.push({url,body:JSON.parse(options.body)});return response;}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);return context;
}
test('history launches a review with original source and first result without a formal quiz request',async()=>{
 const h=harness({reviewId:'real-review-1',sourceTestId:'real-source',round:1,mode:'real',questions:[{word:'library',recordId:'w',type:4}]});
 await h.startHistoryReview({testId:'real-source',correct:2,total:3,mode:'real',questions:[{recordId:'w',isCorrect:false}]});
 assert.equal(h.calls[0].url,'/api/reviews');assert.equal(h.calls[0].body.sourceTestId,'real-source');
 assert.equal(h.state.session.firstResult.correct,2);assert.equal(h.state.session.firstResult.total,3);assert.equal(h.state.session.kind,'review');
});
test('completed or archived-only history cannot enter an empty question page',async()=>{
 const h=harness({complete:true,reason:'review_complete',questions:[]});
 await h.startHistoryReview({testId:'real-source',correct:2,total:3});
 assert.equal(h.state.quiz,undefined);assert.equal(h.state.session.kind,undefined);
});
