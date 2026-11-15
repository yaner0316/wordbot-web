const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
function fn(name){const i=source.indexOf('function '+name+'('),rest=source.slice(i),next=/\n(?:async )?function \w+\(/.exec(rest);return next?rest.slice(0,next.index):rest;}
test('primary choices preserve existing saved upper band and show explicit grade ranges',()=>{
 const c=vm.createContext({});vm.runInContext(fn('formatLearningLevel'),c);
 assert.equal(c.formatLearningLevel('小学'),'小学高年级（4–6年级）');assert.equal(c.formatLearningLevel('小学低年级'),'小学低年级（1–3年级）');
 assert.match(fn('loadParentLearningSettings'),/小学低年级/);
});

