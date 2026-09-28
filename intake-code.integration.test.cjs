'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const test = require('node:test');

// Exercise the shipped app and its actual modules, with only browser plumbing stubbed.
const html = fs.readFileSync(path.join(__dirname, 'office.js'), 'utf8');
let app = html;
const closing = 'render();\n})();';
assert.ok(app.includes(closing), 'the app exposes a stable closing marker');
app = app.replace(closing, `globalThis.integrationHooks = {
  save: intakeCodeSave,
  convertText(text){policyApplyConvertedText(text);return this.snapshot();},
  parse(text) {
    policyRows = policyCleanRows(parsePolicyText(text));
    return this.snapshot();
  },
  publish(carrier, kind = 'general') {
    if (carrier !== undefined) policyPublicationCarrier = carrier;
    if (!policyPublicationClient) policyPublicationClient = 'legacy';
    policyPublicationKind = kind;
    return policyPublishRows();
  },
  snapshot() {
    return JSON.parse(JSON.stringify({
      codes: intakeCodes, settings: regionCarrierSettings,
      detected: policyDetectedCodes, title: policyIntakeTitle,
      carrier: policyPublicationCarrier, rows: policyRows,
      policies: policyPublications, registeredLabel: policyRegisteredCode
    }));
  },
  result(id, province, name, kind = 'general') {
    const scopes = policyPublishedScopes.get(id + ':' + kind);
    return scopes ? JSON.parse(JSON.stringify(PolicyRegionRules.evaluate(scopes, {province, name, path: []}))) : null;
  },
  addClient: policyClientSave,
  publishWithoutClient() { policyPublicationClient=''; return policyPublishRows(); },
  selectedKeys() { return [...policySelectedKeys()]; },
  client(id) { policyPublicationClient=id; policyViewClient=id; },
  clientResult(id, carrier, province, name) { return JSON.parse(JSON.stringify(PolicyRegionRules.evaluate(policyPublishedScopes.get(policyClientKey(carrier,'general',id)),{province,name,path:[]}))); },
  scopeMarkup() { return policyScopeTable(policyRows); },
  label: policyKeyLabel,
  markup() {
    intake();
    return {admin: adminIntake(), map: regionPage(), intake: body.innerHTML};
  },
  setPage(value) { page = value; },
  codeStorageKey: intakeCodeStorageKey,
  policyStorageKey: policyStorageKey
};\n${closing}`);

function boot(saved = new Map(), remote = null) {
  const storage = new Map(saved);
  const elements = new Map();
  const windowEvents = new Map();
  let failStorage = false;

  function get(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      value: '', selectedIndex: 0, innerHTML: '', textContent: '', dataset: {}, children: [],
      style: {setProperty() {}}, classList: {toggle() {}, add() {}, remove() {}},
      setAttribute() {}, removeAttribute() {}, showModal() {}, close() {}, append() {}, before() {}, replaceChildren() {},
      querySelector: get, querySelectorAll: () => [], addEventListener() {},
      getBoundingClientRect: () => ({width: 600, height: 600}), isConnected: false
    });
    return elements.get(selector);
  }

  const context = {
    console, Date, Math, Map, Set, structuredClone, URL, URLSearchParams, TextEncoder, TextDecoder, AbortController,
    crypto: webcrypto, document: {getElementById: () => get('root'), createElement: tag => get('created-'+tag)},
    MutationObserver: class {observe() {}},
    location: {hash: ''},
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem(key, value) {
        if (failStorage) throw new Error('Storage quota exceeded for test');
        storage.set(key, String(value));
      }
    },
    addEventListener(type, fn) {
      if (!windowEvents.has(type)) windowEvents.set(type, []);
      windowEvents.get(type).push(fn);
    },
    requestAnimationFrame() {}, setTimeout, clearTimeout, setInterval() {}
  };
  if(remote){context.CNCHOME_POLICY={role:remote.role||'admin',csrf:'test-token'};context.fetch=remote.fetch;}
  context.window = context;
  vm.createContext(context);
  for (const file of ['korea-regions.js', 'intake-codes.js', 'region-rules.js', 'grade-numbers.js', 'grade-calendar.js', 'grade-calendar-preview.js', 'policy-dates.js', 'policy-input.js', 'policy-sync.js', 'admin-workspace.js', 'hr-workspace.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context, {filename: file});
  }
  vm.runInContext(app, context, {filename: 'office.js'});
  return {
    api: context.integrationHooks, storage, elements,
    failWrites(value) { failStorage = value; },
    storageEvent(key, newValue) {
      const oldValue = storage.get(key) ?? null;
      if (newValue === null) storage.delete(key); else storage.set(key, newValue);
      for (const fn of windowEvents.get('storage') || []) fn({key, oldValue, newValue, storageArea: context.localStorage});
    }
  };
}

const plain = value => JSON.parse(JSON.stringify(value));
function addCode(app, label = '테스트접수', aliases = ['TEST']) {
  assert.equal(app.api.save({label, aliases}), true);
  const added = app.api.snapshot().codes.find(code => code.label === label);
  assert.ok(added?.id, 'a new code receives a stable identifier');
  return added;
}

test('default codes survive adding, renaming and reloading a custom code', () => {
  const a = boot(), code = addCode(a);
  for (const id of ['hanwha', 'shinhan', 'ga']) assert.ok(a.api.snapshot().codes.some(item => item.id === id));
  a.api.parse('테스트접수\n지역\t수량\n성주군\t7');
  assert.equal(a.api.publish(), true);
  assert.equal(a.api.result(code.id, '경북', '성주군').quantity, 7);
  assert.equal(a.api.save({id: code.id, label: '새접수이름', aliases: ['TEST']}), true);
  const renamed = a.api.snapshot().codes.find(item => item.id === code.id);
  assert.equal(renamed.label, '새접수이름');
  assert.equal(a.api.label(code.id + ':general'), '메타버스 · 새접수이름 일반');
  assert.equal(a.api.result(code.id, '경북', '성주군').quantity, 7);
  assert.equal(a.api.parse('테스트접수\n지역\t수량\n성주군\t7').carrier, code.id,
    'the old code name remains an alias without the administrator reentering it');
  const b = boot(a.storage);
  assert.equal(b.api.snapshot().codes.find(item => item.id === code.id).label, '새접수이름');
  assert.equal(b.api.result(code.id, '경북', '성주군').quantity, 7);
  assert.equal(b.api.snapshot().policies[code.id + ':general'].carrier, code.id);
  for (const id of ['hanwha', 'shinhan', 'ga']) assert.ok(b.api.snapshot().codes.some(item => item.id === id));
});

test('custom title and aliases are metadata, never geographic rows', () => {
  const a = boot(), code = addCode(a);
  for (const title of ['테스트접수', 'TEST', '접수 코드: 테스트접수 일반 2026년 9월']) {
    const state = a.api.parse(title + '\n지역\t수량\n서산시\t4');
    assert.deepEqual(plain(state.detected), [code.id]);
    assert.equal(state.carrier, code.id);
    assert.equal(state.title, title);
    assert.deepEqual(plain(state.rows), title.includes('일반') ? [['지역', '수량', '상품 구분'], ['서산시', '4', '일반']] : [['지역', '수량'], ['서산시', '4']]);
  }
});

test('dedicated code column remains separate and puts the region first for editing', () => {
  const a = boot(), code = addCode(a);
  const state = a.api.parse('접수 코드\t수량\t지역\nTEST\t4\t서산시');
  assert.deepEqual(plain(state.detected), [code.id]);
  assert.deepEqual(plain(state.rows), [['지역', '수량', '접수 코드'], ['서산시', '4', 'TEST']]);
  assert.equal(a.api.publish(), true);
  assert.equal(a.api.result(code.id, '충남', '서산시').state, 'possible');
  assert.equal(a.api.result(code.id, '충남', '서산시').quantity, 4);
});

test('multiple codes cannot be silently merged into one published policy', () => {
  const a = boot(), code = addCode(a);
  a.api.parse('접수 코드\t지역\t수량\nTEST\t서산시\t4\n한화\t천안시\t3');
  assert.equal(a.api.snapshot().detected.length, 2);
  assert.equal(a.api.publish(code.id), false);
  assert.deepEqual(plain(a.api.snapshot().policies), {});
});

test('selected code must match the code printed in the policy', () => {
  const a = boot(); addCode(a);
  a.api.parse('TEST\n지역\t수량\n성주군\t3');
  assert.equal(a.api.publish('hanwha'), false);
  assert.deepEqual(plain(a.api.snapshot().policies), {});
});

test('an explicit unregistered code cannot be published under a selected default', () => {
  const a = boot();
  a.api.parse('접수 코드\t지역\t수량\n미등록접수\t서산시\t4');
  assert.equal(a.api.publish('hanwha'), false);
  assert.deepEqual(plain(a.api.snapshot().policies), {});
});

test('saving a policy retains another tab policy before its storage event arrives', () => {
  const a = boot(), b = boot();
  a.api.parse('한화\n지역\t수량\n서산시\t4');
  b.api.parse('신한\n지역\t수량\n성주군\t7');
  assert.equal(a.api.publish(), true);
  // Browser storage already changed; the queued event has not run in tab b yet.
  b.storage.set(a.api.policyStorageKey, a.storage.get(a.api.policyStorageKey));
  assert.equal(b.api.publish(), true);
  assert.equal(b.api.result('hanwha', '충남', '서산시').quantity, 4);
  assert.equal(b.api.result('shinhan', '경북', '성주군').quantity, 7);
});

test('code-like geographic text and source misspellings remain unchanged', () => {
  const a = boot(); addCode(a);
  for (const geographic of ['테스트접수 서울', '테스트접수동', '신한면', '찬안시', '중남 서부']) {
    const state = a.api.parse('지역\t수량\n' + geographic + '\t4');
    assert.deepEqual(plain(state.detected), []);
    assert.equal(state.rows[1][0], geographic);
    assert.equal(a.api.publish('hanwha'), false);
  }
  const state = a.api.parse('지역\t수량\nTEST\t4');
  assert.equal(state.rows[1][0], 'TEST', 'a code with a numeric quantity is not a title');
  assert.equal(a.api.publish('hanwha'), false);
});

test('failed registry persistence leaves in-memory registry and policies untouched', () => {
  const a = boot(), code = addCode(a);
  a.api.parse('TEST\n지역\t수량\n서산시\t4');
  assert.equal(a.api.publish(), true);
  const before = a.api.snapshot(), stored = new Map(a.storage);
  a.failWrites(true);
  assert.equal(a.api.save({id: code.id, label: '저장실패', aliases: ['TEST']}), false);
  assert.deepEqual(plain(a.api.snapshot()), plain(before));
  assert.deepEqual(a.storage, stored);
  assert.equal(a.api.save({label: '새코드실패', aliases: []}), false);
  assert.deepEqual(plain(a.api.snapshot()), plain(before));
});

test('custom registry and policy updates reach an already-open second tab', () => {
  const a = boot(), b = boot(), code = addCode(a);
  b.storageEvent(a.api.codeStorageKey, a.storage.get(a.api.codeStorageKey));
  assert.ok(b.api.snapshot().codes.some(item => item.id === code.id));
  assert.equal(b.api.parse('TEST\n지역\t수량\n성주군\t7').carrier, code.id);
  a.api.parse('TEST\n지역\t수량\n성주군\t7');
  assert.equal(a.api.publish(), true);
  b.storageEvent(a.api.policyStorageKey, a.storage.get(a.api.policyStorageKey));
  assert.equal(b.api.result(code.id, '경북', '성주군').quantity, 7);
  assert.equal(a.api.save({id: code.id, label: '변경접수', aliases: ['TEST']}), true);
  b.storageEvent(a.api.codeStorageKey, a.storage.get(a.api.codeStorageKey));
  assert.equal(b.api.label(code.id + ':general'), '메타버스 · 변경접수 일반');
  assert.equal(b.api.result(code.id, '경북', '성주군').quantity, 7);
});

test('editable code labels are escaped in administrator, map and intake markup', () => {
  const a = boot(), label = 'A&B <img src=x onerror="x">', code = addCode(a, label, ['AB']);
  a.api.parse('AB\n지역\t수량\n서산시\t4');
  assert.equal(a.api.publish(), true);
  const markup = a.api.markup();
  for (const [surface, text] of Object.entries(markup)) {
    assert.ok(text.includes('A&amp;B'), surface + ' escapes ampersands');
    assert.ok(text.includes('&lt;img'), surface + ' renders angle brackets as text');
    assert.ok(!text.includes('<img src=x'), surface + ' does not create an element from the label');
    assert.ok(!text.includes(label), surface + ' never interpolates the raw label');
  }
  assert.equal(a.api.result(code.id, '충남', '서산시').quantity, 4);
});


test('policy region categories render and publish only listed municipalities', () => {
  const a=boot();
  a.api.parse('한화\n지역\t수량\n충남북부: 천안 아산\t4\n충남서부: 서산 태안\t3\n충남: 공주\t2\n경기남부: 용인 안성\t5');
  const markup=a.api.scopeMarkup();
  for(const label of ['충청남도','충청남도북부','충청남도서부','권역 구분 없음','경기도남부','기재 지역만 가능']) assert.ok(markup.includes(label),label);
  assert.equal(a.api.publish('hanwha'),true);
  for(const name of ['용인시','안성시']) assert.equal(a.api.result('hanwha','경기',name).state,'possible');
  assert.equal(a.api.result('hanwha','경기','수원시').state,'blocked');
  assert.equal(a.api.result('hanwha','충남','논산시').state,'blocked');
  const b=boot(a.storage);
  assert.equal(b.api.result('hanwha','경기','안성시').state,'possible');
  assert.equal(b.api.result('hanwha','경기','수원시').state,'blocked');
});

test('same code policies remain independent across clients and survive reload and rename',()=>{
 const a=boot(),first=a.api.addClient({label:'거래처 A'}),second=a.api.addClient({label:'거래처 B'});
 assert.ok(first);assert.ok(second);assert.notEqual(first,second);
 a.api.client(first);a.api.parse('한화\n지역\t수량\n경기남부: 용인 안성\t5');assert.equal(a.api.publish('hanwha'),true);
 a.api.client(second);a.api.parse('한화\n지역\t수량\n경기동부: 구리 하남\t2');assert.equal(a.api.publish('hanwha'),true);
 assert.equal(a.api.clientResult(first,'hanwha','경기','용인시').state,'possible');
 assert.equal(a.api.clientResult(second,'hanwha','경기','용인시').state,'blocked');
 assert.equal(a.api.clientResult(second,'hanwha','경기','구리시').quantity,2);
 assert.deepEqual(plain(a.api.selectedKeys()),['hanwha:'+second+':general']);
 assert.equal(a.api.publishWithoutClient(),false);
 const ui=a.api.markup();assert.ok(ui.admin.includes('거래처 관리'));assert.ok(ui.admin.includes('tm-policy-publication-client'));assert.ok(ui.map.includes('tm-region-client'));
 assert.equal(a.api.addClient({id:first,label:'거래처 A 수정'}),first);
 const b=boot(a.storage);
 assert.equal(b.api.clientResult(first,'hanwha','경기','용인시').quantity,5);
 assert.equal(b.api.clientResult(second,'hanwha','경기','용인시').state,'blocked');
 assert.ok(b.api.label('hanwha:'+first+':general').includes('거래처 A 수정'));
});

test('existing two-part policy keys are attributed to Metaverse without changing their rows',()=>{
 const a=boot();a.api.parse('한화\n지역\t수량\n경기남부: 용인 안성\t5');assert.equal(a.api.publish('hanwha'),true);
 const original=a.api.snapshot().policies['hanwha:general'];
 const b=boot(a.storage);
 assert.equal(b.api.label('hanwha:general'),'메타버스 · 한화 일반');
 assert.deepEqual(plain(b.api.snapshot().policies['hanwha:general'].rows),plain(original.rows));
 assert.equal(b.api.clientResult('legacy','hanwha','경기','용인시').quantity,5);
 const newClient=b.api.addClient({label:'다른 거래처'});b.api.client(newClient);
 b.api.parse('한화\n지역\t수량\n구리\t2');assert.equal(b.api.publish('hanwha'),true);
 assert.equal(b.api.clientResult('legacy','hanwha','경기','용인시').quantity,5);
 assert.equal(b.api.clientResult(newClient,'hanwha','경기','용인시').state,'blocked');
});

test('unclassified Hanwha and Shinhan publication persists both products and survives reload',()=>{
 for(const [carrier,title] of [['hanwha','한화'],['shinhan','신한']]){
  const a=boot();a.api.parse(title+'\n지역\t수량\n수도권\t4\n광주주전남\t1');
  assert.equal(a.api.publish(carrier,'auto'),true);
  for(const kind of ['general','silver'])assert.equal(a.api.result(carrier,'서울','서울특별시',kind).quantity,4);
  const b=boot(a.storage);
  for(const kind of ['general','silver'])assert.equal(b.api.result(carrier,'광주','광주광역시',kind).quantity,1);
 }
});
test('Hanwha publication with no product selection applies both',()=>{
 const a=boot();a.api.parse('한화\n지역\t수량\n수도권\t4');assert.equal(a.api.publish('hanwha',''),true);
 for(const kind of ['general','silver'])assert.equal(a.api.result('hanwha','서울','서울특별시',kind).quantity,4);
});

test('employee policy page uses server rows and never renders local/example policies',async()=>{
 const local=boot();local.api.parse('한화\n지역\t수량\n수도권\t99');local.api.publish('hanwha','auto');
 let resolveGet;
 const remote=boot(local.storage,{role:'employee',fetch:async()=>new Promise(resolve=>resolveGet=resolve)});
 assert.match(remote.api.markup().map,/불러오는 중/);assert.doesNotMatch(remote.api.markup().map,/접수 정책표 · 예시|정책 등록일 표시 예시/);
 resolveGet({ok:true,status:200,json:async()=>({revision:1,version:1,clients:[{id:'legacy',label:'메타버스'}],codes:[{id:'hanwha',label:'한화',aliases:[]}],policies:{'hanwha:general':{client:'legacy',carrier:'hanwha',kind:'general',rows:[['지역','수량'],['수도권','4']],savedAt:'2026-09-28T06:00:00Z'}}})});
 await new Promise(r=>setImmediate(r));
 assert.equal(remote.api.result('hanwha','서울','서울특별시').quantity,4);
 const html=remote.api.markup().map;assert.match(html,/접수 정책표/);assert.doesNotMatch(html,/접수 정책표 · 예시|정책 등록일 표시 예시|실제 접수 기준이 아닙니다/);
});
test('empty server policy store has no sample fallback',async()=>{
 const a=boot(new Map(),{role:'employee',fetch:async()=>({ok:true,status:200,json:async()=>({revision:0,version:1,clients:[{id:'legacy',label:'메타버스'}],codes:[],policies:{}})})});
 await new Promise(r=>setImmediate(r));assert.match(a.api.markup().map,/아직 서버에 등록된 정책이 없습니다/);assert.doesNotMatch(a.api.markup().map,/예시/);
});
test('live registration uses POST and reports failure without local success',async()=>{
 let fail=true,posted;
 const state={revision:0,version:1,clients:[{id:'legacy',label:'메타버스'}],codes:[{id:'hanwha',label:'한화',aliases:[]}],policies:{}};
 const a=boot(new Map(),{fetch:async(url,options)=>{
  if(options.method==='POST'){posted=JSON.parse(options.body);if(fail)return {ok:false,status:503,json:async()=>({error:'DB unavailable'})};state.revision++;for(const [kind,rows] of Object.entries(posted.groups))state.policies['hanwha:'+kind]={client:'legacy',carrier:'hanwha',kind,rows,savedAt:'2026-09-28T06:00:00Z'};}
  return {ok:true,status:200,json:async()=>JSON.parse(JSON.stringify(state))};
 }});
 await new Promise(r=>setImmediate(r));a.api.parse('한화\n지역\t수량\n수도권\t4');
 assert.equal(await a.api.publish('hanwha','auto'),false);assert.deepEqual(plain(a.api.snapshot().policies),{});
 fail=false;assert.equal(await a.api.publish('hanwha','auto'),true);assert.equal(posted.action,'publish');assert.equal(posted.revision,0);
 for(const kind of ['general','silver'])assert.equal(a.api.result('hanwha','서울','서울특별시',kind).quantity,4);
 assert.equal(a.storage.has(a.api.policyStorageKey),false);
});

test('registered carriers form equal horizontal columns and empty carriers are hidden',()=>{
 const a=boot();a.api.parse('한화\n지역\t수량\n수도권\t4');a.api.publish('hanwha','general');
 let html=a.api.markup().map;assert.match(html,/grid-template-columns:repeat\(1,minmax/);assert.doesNotMatch(html,/등록된 정책 없음|data-policy-carrier="ga"|data-policy-carrier="shinhan"/);
 a.api.parse('GA\n지역\t수량\n부산\t2');a.api.publish('ga','general');a.api.parse('신한\n지역\t수량\n인천\t3');a.api.publish('shinhan','general');
 html=a.api.markup().map;assert.match(html,/grid-template-columns:repeat\(3,minmax/);assert.ok(html.indexOf('data-policy-carrier="ga"')<html.indexOf('data-policy-carrier="hanwha"'));assert.ok(html.indexOf('data-policy-carrier="hanwha"')<html.indexOf('data-policy-carrier="shinhan"'));
});

test('common Hanwha policies appear once with new-window access',()=>{
 const a=boot();a.api.parse('한화\n지역\t수량\n수도권\t4');a.api.publish('hanwha','auto');
 const html=a.api.markup().map;assert.equal((html.match(/class="policy-table-heading"/g)||[]).length,1);assert.match(html,/한화 · 일반·실버 공통/);assert.match(html,/data-policy-new-window[^>]+target="_blank"/);
 const b=boot();b.api.parse('한화\n일반\n수도권 4\n실버\n부산 2');b.api.publish('hanwha','auto');assert.equal((b.api.markup().map.match(/class="policy-table-heading"/g)||[]).length,2);
});

test('text and OCR tabular input share the same regional postprocessing',()=>{
 const a=boot(),b=boot();a.api.convertText('한화\n경상남도전체 4\n광주, 이천 3\n수도권 (서울특별시 강남구 제외) 2');b.api.convertText('한화\n지역\t수량\n경상남도전체\t4\n광주, 이천\t3\n수도권 (서울특별시 강남구 제외)\t2');
 assert.equal(a.api.publish('hanwha','auto'),true);assert.equal(b.api.publish('hanwha','auto'),true);
 for(const [province,name] of [['경남','진주시'],['경기','광주시'],['경기','이천시']])assert.equal(JSON.stringify(a.api.result('hanwha',province,name)),JSON.stringify(b.api.result('hanwha',province,name)));
});
