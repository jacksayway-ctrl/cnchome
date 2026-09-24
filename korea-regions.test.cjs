'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('./korea-regions.js');

test('nationwide catalog keeps complete snapshot counts and unique identities', () => {
  assert.deepEqual(catalog.counts, {
    policyNamespaces: 17,
    officialProvinces: 16,
    cities: 77,
    metropolitanScopes: 8,
    counties: 82,
    autonomousDistricts: 70,
    generalDistricts: 39
  });
  assert.equal(catalog.municipalities.length, 167);
  assert.equal(catalog.districts.length, 109);
  assert.equal(catalog.entries.length, 276);
  assert.equal(new Set(catalog.entries.map(entry => entry.id)).size, catalog.entries.length);
});

test('every district has an existing municipality parent and exact path', () => {
  const parents = new Map(catalog.municipalities.map(entry => [entry.id, entry]));
  for (const district of catalog.districts) {
    const parent = parents.get(district.parentId);
    assert(parent, `Missing parent for ${district.id}`);
    assert.equal(parent.province, district.province, district.id);
    assert.equal(parent.name, district.parent, district.id);
    assert.deepEqual(district.path, [district.name], district.id);
    assert(catalog.children(district.province, district.parent).includes(district), district.id);
  }
});

test('all entries have reviewed official sources and valid province keys', () => {
  const sourceIds = new Set(catalog.sources.map(source => source.id));
  assert.equal(sourceIds.size, catalog.sources.length);
  for (const entry of catalog.entries) {
    assert(sourceIds.has(entry.sourceId), `Missing source for ${entry.id}`);
    assert(catalog.provinceNames[entry.province], `Unknown policy namespace ${entry.id}`);
    assert(catalog.officialProvinceNames[entry.officialProvince], `Unknown official province ${entry.id}`);
    assert(entry.aliases.includes(entry.name), `Canonical name missing from aliases: ${entry.id}`);
    for (const alias of entry.aliases) {
      assert(catalog.resolve(alias, entry.province).includes(entry), `Alias lookup failed: ${entry.id}/${alias}`);
    }
  }
  for (const source of catalog.sources) {
    assert.equal(source.checkedAt, catalog.checkedAt);
    assert.equal(new URL(source.url).protocol, 'https:');
    assert(new URL(source.url).hostname.endsWith('.go.kr'), `Not an official government source: ${source.url}`);
  }
});

test('same-name cities, counties and districts require their correct parent', () => {
  assert.deepEqual(catalog.resolve('고성군').map(entry => entry.province).sort(), ['강원', '경남']);
  assert.equal(catalog.resolve('광주시').length, 2);
  assert.equal(catalog.resolve('광주시', '경기')[0].name, '광주시');
  assert.equal(catalog.resolve('광주시', '광주')[0].name, '광주광역시');
  assert.deepEqual(catalog.resolve('중구', '서울').map(entry => entry.parent), ['서울특별시']);
  assert.deepEqual(catalog.resolve('남구', '경북', '포항시').map(entry => entry.id), ['경북:포항시:남구']);
  assert.deepEqual(catalog.resolve('남구', '경북', '경주시'), []);
  assert.deepEqual(catalog.resolve('남구', '서울'), []);
});

test('current district changes are represented without silently widening historical boundaries', () => {
  assert.deepEqual(catalog.children('인천', '인천광역시').map(entry => entry.name), [
    '제물포구', '영종구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서해구', '검단구'
  ]);
  assert.deepEqual(catalog.children('경기', '부천시').map(entry => entry.name), ['원미구', '소사구', '오정구']);
  assert.deepEqual(catalog.children('경기', '화성시').map(entry => entry.name), ['만세구', '효행구', '병점구', '동탄구']);
  for (const name of ['중구', '동구', '서구']) {
    assert.deepEqual(catalog.resolve(name, '인천'), []);
    const legacy = catalog.legacyRegions.find(entry => entry.province === '인천' && entry.name === name);
    assert(legacy, `Historical name lost: ${name}`);
    assert.equal(legacy.reviewRequired, true);
    for (const current of legacy.current) assert.equal(catalog.resolve(current, '인천').length, 1);
  }
});

test('official province changes do not merge previously separate insurance policy scopes', () => {
  const mokpo = catalog.resolve('목포시')[0];
  const gwangsan = catalog.resolve('광산구')[0];
  assert.equal(mokpo.province, '전남');
  assert.equal(gwangsan.province, '광주');
  assert.equal(mokpo.officialProvince, '전남광주');
  assert.equal(gwangsan.officialProvince, '전남광주');
  assert.deepEqual(catalog.provinceGroups.전남광주, ['전남', '광주']);
  assert.equal(catalog.resolve('광주광역시')[0].referenceOnly, true);
  assert.equal(catalog.resolve('광주시', '경기')[0].referenceOnly, false);
});

test('lookup supports exact aliases without OCR typo substitutions', () => {
  assert.equal(catalog.resolve('수원')[0].name, '수원시');
  assert.equal(catalog.resolve('성주')[0].name, '성주군');
  assert.equal(catalog.resolve('서울시')[0].name, '서울특별시');
  assert.equal(catalog.resolve('세종시')[0].name, '세종특별자치시');
  assert.equal(catalog.resolve(' 수원시 ')[0].name, '수원시');
  for (const unrecognized of ['성수', '중남', '찬안시', '중남북구', '', null]) {
    assert.deepEqual(catalog.resolve(unrecognized), [], `Unexpected inferred correction: ${unrecognized}`);
  }
});
