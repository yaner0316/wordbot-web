const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8'),logic=require('../src/quiz-logic');
const choice={type:4,answerMode:'sense_choice',meaningId:'library-id',word:'library',options:['食堂','教室','书店','图书馆'],answer:'D',correctMeaning:'D'};
function predicates(c){const start=source.indexOf('function isMeaningReviewQuestion('),end=source.indexOf('function meaningAnswerValue(',start);vm.runInContext(source.slice(start,end),c);}
function nodes(){const map=new Map();const node=()=>({innerHTML:'',textContent:'',children:[],style:{},classList:{add(){},remove(){}},replaceChildren(){this.children=[];},appendChild(child){this.children.push(child);},focus(){}});return {get:id=>{if(!map.has(id))map.set(id,node());return map.get(id);},node};}
test('sense-choice explanation maps letters to saved Chinese choices and uses recognition wording',()=>{
 const html=logic.buildMeaningReviewExplanation(choice,{your:'A',answer:'D',correct:false},String);
 assert.match(html,/食堂/);assert.match(html,/图书馆/);assert.doesNotMatch(html,/主动回忆|写对|参考释义：<\/strong>D</);
});
test('sense-choice result shows Chinese options, chosen/correct markers and no recall prompt',()=>{
 const n=nodes(),result={meaningId:'library-id',word:'library',your:'A',answer:'D',correct:false};
 const c={...logic,state:{session:{kind:'review',remainingRecordIds:[],reviewRounds:[]},quiz:{questions:[choice]}},escapeHtml:String,buildAnimalGardenRewardHtml:()=>'',getEncourage:()=>'',updateResultActions(){},launchConfetti(){},$:n.get};vm.createContext(c);predicates(c);
 const start=source.indexOf('function renderResults(data)'),end=source.indexOf('function toggleAnalysis()',start);vm.runInContext(source.slice(start,end),c);
 c.renderResults({correct:0,total:1,accuracy:'0%',results:[result]});const html=n.get('resultContent').innerHTML;
 assert.match(html,/中文释义选择/);assert.doesNotMatch(html,/请写出|中文释义回忆/);
 assert.match(html,/opt-correct[^]*图书馆/);assert.match(html,/opt-wrong[^]*食堂/);assert.match(html,/你的选择/);
});
test('history shows Chinese choice mapping and a complete free-recall answer without legacy placeholders',()=>{
 const n=nodes(),body={style:{}},c={...logic,$:n.get,escapeHtml:String,formatDate:()=>'',startHistoryReview(){},document:{body,activeElement:body,createElement:n.node}};
 vm.createContext(c);predicates(c);const start=source.indexOf('function historyTypeLabel('),end=source.indexOf('function closeHistoryDetail()',start);vm.runInContext(source.slice(start,end),c);
 c.openHistoryDetail({time:1,correct:1,total:2,questions:[{...choice,contentState:'complete',question:'请选择对应中文释义',yourAnswer:'A',correctAnswer:'D',isCorrect:false},{word:'kitten',type:4,answerMode:'cn_meaning',contentState:'complete',question:'请写出中文释义',options:[],yourAnswer:'小猫',correctAnswer:'小猫；幼猫',isCorrect:true}]});
 const [choiceCard,recallCard]=n.get('hdBody').children;
 assert.match(choiceCard.innerHTML,/中文释义选择/);assert.match(choiceCard.innerHTML,/孩子答案：食堂/);assert.match(choiceCard.innerHTML,/正确答案：图书馆/);
 assert.match(choiceCard.innerHTML,/hd-opt correct[^]*图书馆/);assert.match(recallCard.innerHTML,/小猫；幼猫/);assert.doesNotMatch(recallCard.innerHTML,/细节不完整|早期考核/);
});
