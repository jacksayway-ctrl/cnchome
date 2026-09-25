'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const test = require('node:test');

// Exercise the shipped app and its actual modules, with only browser plumbing stubbed.
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let app = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n');
const closing = 'render();\n})();';
assert.ok(app.includes(closing), 'the app exposes a stable closing marker');
app = app.replace(closing, `globalThis.integrationHooks = {
  save: intakeCodeSave,
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

function boot(saved = new Map()) {
  const storage = new Map(saved);
  const elements = new Map();
  const windowEvents = new Map();
  let failStorage = false;

  function get(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      value: '', selectedIndex: 0, innerHTML: '', textContent: '', dataset: {},
      style: {setProperty() {}}, classList: {toggle() {}, add() {}, remove() {}},
      setAttribute() {}, removeAttribute() {}, showModal() {}, close() {}, append() {}, before() {}, replaceChildren() {},
      querySelector: get, querySelectorAll: () => [], addEventListener() {},
      getBoundingClientRect: () => ({width: 600, height: 600}), isConnected: false
    });
    return elements.get(selector);
  }

  const context = {
    console, Date, Math, Map, Set, URL, URLSearchParams, TextEncoder, TextDecoder,
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
  context.window = context;
  vm.createContext(context);
  for (const file of ['korea-regions.js', 'intake-codes.js', 'region-rules.js', 'admin-workspace.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context, {filename: file});
  }
  vm.runInContext(app, context, {filename: 'index.html'});
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
    assert.deepEqual(plain(state.rows), [['지역', '수량'], ['서산시', '4']]);
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
