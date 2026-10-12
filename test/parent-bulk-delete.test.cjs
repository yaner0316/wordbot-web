const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
function fn(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0, `${name} exists`);
  const next = source.slice(start + 1).search(/\n(?:async )?function /);
  return next < 0 ? source.slice(start) : source.slice(start, start + 1 + next);
}
function setup() {
  const nodes = new Map();
  const ctx = { Set, Date, Intl, console, encodeURIComponent,
    parentWordLibraryState: { words: [{recordId:'bank-one'},{recordId:'bank-two'}],selectedIds:new Set(),deleting:false,total:2,page:1,totalPages:1 },
    $: id => { if(!nodes.has(id)) nodes.set(id,{innerHTML:'',textContent:'',disabled:false}); return nodes.get(id); },
    escapeHtml: String, parentWordStatusOptions: () => '',
    window: {confirm:()=>true}, showToast:()=>{},showLoading:()=>{},hideLoading:()=>{},
    DEMO_MODE:false,state:{user:'child'},loadStats:()=>{}, normalizeApiError:e=>e,
    loadParentWordLibrary: async()=>{}, api:async()=>({success:true}),
  };
  vm.createContext(ctx);
  for (const name of ['parentWordRecordId','formatParentWordEnteredAt','updateParentWordSelectionControls','toggleParentWordSelection','selectAllLoadedParentWords','deleteSelectedParentWords']) vm.runInContext(fn(name),ctx);
  return ctx;
}
test('entry time uses Shanghai calendar time and rejects missing or malformed values',()=>{
  const ctx=setup();
  assert.equal(ctx.formatParentWordEnteredAt({entered_at:'2026-10-12T06:30:00Z'}),'录入于 2026-10-12 14:30');
  assert.equal(ctx.formatParentWordEnteredAt({entered_at:null}),'时间未知');
  assert.equal(ctx.formatParentWordEnteredAt({entered_at:'not-a-date'}),'时间未知');
});
test('select all includes only loaded stable meaning IDs and individual deselection is independent',()=>{
  const ctx=setup();
  ctx.selectAllLoadedParentWords(true);
  assert.deepEqual([...ctx.parentWordLibraryState.selectedIds],['bank-one','bank-two']);
  ctx.toggleParentWordSelection('bank-one',false);
  assert.deepEqual([...ctx.parentWordLibraryState.selectedIds],['bank-two']);
  ctx.toggleParentWordSelection('not-loaded',true);
  assert.deepEqual([...ctx.parentWordLibraryState.selectedIds],['bank-two']);
});
test('cancel and duplicate clicks cause no deletion; successful delete uses IDs and resets pagination',async()=>{
  const ctx=setup();let calls=0;let refresh=0;
  ctx.api=async(url,opts)=>{calls++;assert.equal(url,'/api/admin/words/delete');assert.deepEqual(JSON.parse(opts.body).recordIds,['bank-one']);return {success:true};};
  ctx.loadParentWordLibrary=async(page,opts)=>{refresh++;assert.equal(page,1);assert.equal(opts.reset,true);};
  ctx.parentWordLibraryState.selectedIds.add('bank-one');
  ctx.window.confirm=()=>false; await ctx.deleteSelectedParentWords(); assert.equal(calls,0);
  ctx.window.confirm=()=>true; ctx.parentWordLibraryState.deleting=true; await ctx.deleteSelectedParentWords();assert.equal(calls,0);
  ctx.parentWordLibraryState.deleting=false; await ctx.deleteSelectedParentWords();assert.equal(calls,1);assert.equal(refresh,1);
  assert.equal(ctx.parentWordLibraryState.selectedIds.size,0);
});
test('failed delete keeps selection and unlocks the controls',async()=>{
  const ctx=setup();ctx.parentWordLibraryState.selectedIds.add('bank-one');
  ctx.api=async()=>{throw new Error('offline');};
  await ctx.deleteSelectedParentWords();
  assert.deepEqual([...ctx.parentWordLibraryState.selectedIds],['bank-one']);
  assert.equal(ctx.parentWordLibraryState.deleting,false);
});

test('multi-batch deletion retains only the unfinished IDs after partial failure',async()=>{
  const ctx=setup();
  const ids=Array.from({length:102},(_,i)=>'meaning-'+i);
  ctx.parentWordLibraryState.words=ids.map(recordId=>({recordId}));
  ctx.parentWordLibraryState.total=102;
  ctx.parentWordLibraryState.selectedIds=new Set(ids);
  let calls=0;
  ctx.renderParentWordLibrary=()=>{};
  ctx.api=async(url,opts)=>{calls++;assert.ok(JSON.parse(opts.body).recordIds.length<=100);if(calls===2)throw new Error('offline');return {success:true};};
  await ctx.deleteSelectedParentWords();
  assert.equal(calls,2);
  assert.deepEqual([...ctx.parentWordLibraryState.selectedIds],ids.slice(100));
  assert.equal(ctx.parentWordLibraryState.total,2);
  assert.equal(ctx.parentWordLibraryState.paginationDirty,true);
});

test('rendered rows pair the timestamp and checkbox with the exact meaning ID',()=>{
  const ctx=setup();vm.runInContext(fn('renderParentWordLibrary'),ctx);
  ctx.parentWordLibraryState.selectedIds.add('bank-two');
  ctx.parentWordLibraryState.words=[{recordId:'bank-two',word:'bank',cnMeaning:'河岸',entered_at:'2026-10-12T06:30:00Z'}];
  ctx.renderParentWordLibrary({...ctx.parentWordLibraryState});
  const html=ctx.$('parentWordLibrary').innerHTML;
  assert.match(html,/data-parent-word-select="bank-two"/);
  assert.match(html,/选择 bank：河岸/);
  assert.match(html,/录入于 2026-10-12 14:30/);
  assert.equal(ctx.$('parentWordSelectionCount').textContent,'已选 1 个词义');
  assert.equal(ctx.$('parentWordBulkDelete').disabled,false);
});

test('a completed library load renders the ready state instead of a stale loading label',async()=>{
  const ctx=setup();
  ctx.getParentWordStatusFilter=()=>'';
  ctx.api=async()=>({words:[{recordId:'one'}],total:1,page:1,totalPages:1});
  let renderedLoading;
  ctx.renderParentWordLibrary=()=>{renderedLoading=ctx.parentWordLibraryState.loading;};
  for(const name of ['resetParentWordLibraryState','mergeParentWordPages','loadParentWordLibrary'])vm.runInContext(fn(name),ctx);
  await ctx.loadParentWordLibrary(1,{reset:true});
  assert.equal(renderedLoading,false);
});
