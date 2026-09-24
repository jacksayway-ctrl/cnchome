/* Nationwide Korean region reference, independent of uploaded OCR images.
 * Verified against the official sources listed below on 2026-09-24.
 * province is the insurance policy namespace; officialProvince is the current
 * legal province. Old 광주/전남 policy labels remain separate business scopes.
 * No fuzzy matching, OCR character substitution, or geographic-boundary inference.
 */
(function(root) {
  'use strict';
  const provinceNames = {서울:'서울특별시',부산:'부산광역시',대구:'대구광역시',인천:'인천광역시',광주:'광주광역시',대전:'대전광역시',울산:'울산광역시',세종:'세종특별자치시',경기:'경기도',강원:'강원특별자치도',충북:'충청북도',충남:'충청남도',전북:'전북특별자치도',전남:'전라남도',경북:'경상북도',경남:'경상남도',제주:'제주특별자치도'};
  const cityNames = {
    서울:'서울특별시',부산:'부산광역시',대구:'대구광역시',인천:'인천광역시',광주:'광주광역시',대전:'대전광역시',울산:'울산광역시',세종:'세종특별자치시',
    경기:'수원시 성남시 의정부시 안양시 부천시 광명시 평택시 동두천시 안산시 고양시 과천시 구리시 남양주시 오산시 시흥시 군포시 의왕시 하남시 용인시 파주시 이천시 안성시 김포시 화성시 광주시 양주시 포천시 여주시',
    강원:'춘천시 원주시 강릉시 동해시 태백시 속초시 삼척시',충북:'청주시 충주시 제천시',충남:'천안시 공주시 보령시 아산시 서산시 논산시 계룡시 당진시',전북:'전주시 군산시 익산시 정읍시 남원시 김제시',전남:'목포시 여수시 순천시 나주시 광양시',경북:'포항시 경주시 김천시 안동시 구미시 영주시 영천시 상주시 문경시 경산시',경남:'창원시 진주시 통영시 사천시 김해시 밀양시 거제시 양산시',제주:'제주시 서귀포시'
  };
  const countyNames = {
    부산:'기장군',대구:'달성군 군위군',인천:'강화군 옹진군',울산:'울주군',경기:'연천군 가평군 양평군',강원:'홍천군 횡성군 영월군 평창군 정선군 철원군 화천군 양구군 인제군 고성군 양양군',충북:'보은군 옥천군 영동군 증평군 진천군 괴산군 음성군 단양군',충남:'금산군 부여군 서천군 청양군 홍성군 예산군 태안군',전북:'완주군 진안군 무주군 장수군 임실군 순창군 고창군 부안군',전남:'담양군 곡성군 구례군 고흥군 보성군 화순군 장흥군 강진군 해남군 영암군 무안군 함평군 영광군 장성군 완도군 진도군 신안군',경북:'의성군 청송군 영양군 영덕군 청도군 고령군 성주군 칠곡군 예천군 봉화군 울진군 울릉군',경남:'의령군 함안군 창녕군 고성군 남해군 하동군 산청군 함양군 거창군 합천군'
  };
  const municipalities = Object.keys(provinceNames).flatMap(province => [
    ...(cityNames[province] || '').split(' ').filter(Boolean).map(name => ({id:province+':'+name,province,name,kind:'city',metropolitan:name===provinceNames[province],aliases:[name,name.replace(/(?:특별자치시|특별시|광역시|시)$/,'')]})),
    ...(countyNames[province] || '').split(' ').filter(Boolean).map(name => ({id:province+':'+name,province,name,kind:'county',metropolitan:false,aliases:[name,name.slice(0,-1)]}))
  ]);

  const officialProvinceNames = {서울:'서울특별시',전남광주:'전남광주통합특별시',부산:'부산광역시',대구:'대구광역시',인천:'인천광역시',대전:'대전광역시',울산:'울산광역시',세종:'세종특별자치시',경기:'경기도',강원:'강원특별자치도',충북:'충청북도',충남:'충청남도',전북:'전북특별자치도',경북:'경상북도',경남:'경상남도',제주:'제주특별자치도'};
  const officialProvince = province => province==='광주'||province==='전남'?'전남광주':province;
  const autonomousDistrictNames = {
    서울:'종로구 중구 용산구 성동구 광진구 동대문구 중랑구 성북구 강북구 도봉구 노원구 은평구 서대문구 마포구 양천구 강서구 구로구 금천구 영등포구 동작구 관악구 서초구 강남구 송파구 강동구',
    부산:'중구 서구 동구 영도구 부산진구 동래구 남구 북구 해운대구 사하구 금정구 강서구 연제구 수영구 사상구',
    대구:'중구 동구 서구 남구 북구 수성구 달서구',
    인천:'제물포구 영종구 미추홀구 연수구 남동구 부평구 계양구 서해구 검단구',
    광주:'동구 서구 남구 북구 광산구',대전:'동구 중구 서구 유성구 대덕구',울산:'중구 남구 동구 북구'
  };
  const generalDistrictGroups = [
    ['경기','수원시','장안구 권선구 팔달구 영통구','suwon'],
    ['경기','성남시','수정구 중원구 분당구','seongnam'],
    ['경기','안양시','만안구 동안구','anyang'],
    ['경기','부천시','원미구 소사구 오정구','bucheon'],
    ['경기','안산시','상록구 단원구','ansan'],
    ['경기','고양시','덕양구 일산동구 일산서구','goyang'],
    ['경기','용인시','처인구 기흥구 수지구','yongin'],
    ['경기','화성시','만세구 효행구 병점구 동탄구','hwaseong'],
    ['충북','청주시','상당구 서원구 흥덕구 청원구','cheongju'],
    ['충남','천안시','동남구 서북구','cheonan'],
    ['전북','전주시','완산구 덕진구','jeonju'],
    ['경북','포항시','남구 북구','pohang'],
    ['경남','창원시','의창구 성산구 마산합포구 마산회원구 진해구','changwon']
  ];
  const districts = [
    ...Object.entries(autonomousDistrictNames).flatMap(([province,names]) => names.split(' ').map(name => ({id:province+':'+provinceNames[province]+':'+name,province,name,parent:provinceNames[province],parentId:province+':'+provinceNames[province],path:[name],aliases:[name],kind:'district',autonomous:true,officialProvince:officialProvince(province),sourceId:'mois'}))),
    ...generalDistrictGroups.flatMap(([province,parent,names,sourceId]) => names.split(' ').map(name => ({id:province+':'+parent+':'+name,province,name,parent,parentId:province+':'+parent,path:[name],aliases:[name],kind:'district',autonomous:false,officialProvince:officialProvince(province),sourceId})))
  ];
  municipalities.forEach(item => {
    item.officialProvince=officialProvince(item.province);
    item.officialName=item.name;
    item.sourceId='mois';
    item.path=[];
    if(item.metropolitan&&!item.aliases.includes(item.province+'시'))item.aliases.push(item.province+'시');
    item.referenceOnly=item.province==='광주'&&item.metropolitan;
    if(item.referenceOnly)item.note='기존 정책의 광주 권역. 현행 행정명은 전남광주통합특별시이며 전남 권역과 자동 병합하지 않습니다.';
    if(item.province==='제주')item.administrativeCity=true;
  });
  const sources = [
    {id:'mois',title:'행정안전부 전국 지자체 누리집',url:'https://www.mois.go.kr/frt/sub/a04/localGovernment/screen.do'},
    {id:'suwon',title:'수원시 권선구 관내도',url:'https://ksun.suwon.go.kr/submain_view.asp?MenuID=sub0107&TopID=sub01'},
    {id:'seongnam',title:'성남시 행정구역',url:'https://www.seongnam.go.kr/city/1000013/10010/contents.do'},
    {id:'anyang',title:'안양시 행정구역',url:'https://www.anyang.go.kr/main/contents.do?key=281'},
    {id:'bucheon',title:'부천시 행정구역',url:'https://www.bucheon.go.kr/site/homepage/menu/viewMenu?menuid=148009003001'},
    {id:'ansan',title:'안산시 행정구역 통계',url:'https://www.ansan.go.kr/stat/common/cntnts/selectContents.do?cntnts_id=C0001014'},
    {id:'goyang',title:'고양시 행정구역안내',url:'https://www.goyang.go.kr/www/www05/www05_1/www05_1_8.jsp'},
    {id:'yongin',title:'용인시 통계',url:'https://yongin.go.kr/estat/index.do'},
    {id:'hwaseong',title:'화성시 구청 안내 (만세·효행·병점·동탄)',url:'https://www.hscity.go.kr/hyohaeng/index.do'},
    {id:'cheongju',title:'청주시 행정지도',url:'https://www.cheongju.go.kr/www/contents.do?key=547'},
    {id:'cheonan',title:'천안시 행정구역',url:'https://mng.cheonan.go.kr/kor/sub04_01_03.do'},
    {id:'jeonju',title:'전주시 행정구역',url:'https://www.jeonju.go.kr/index.9is?contentUid=ff8080818990c349018b041a9ed03a70'},
    {id:'pohang',title:'포항시 공간정보포털 시·구 선택',url:'https://pohang.go.kr/phgis/system'},
    {id:'changwon',title:'창원시 구청 안내',url:'https://www.changwon.go.kr/cwportal/gu/11098/11613/11733.web?cpage=6'},
    {id:'incheon-change',title:'인천광역시 서해구의회 (서해구·검단구 개편)',url:'https://www.seohae.go.kr/open_content/council/'},
    {id:'jeonnam-gwangju',title:'전남광주통합특별시 공식 소개',url:'https://www.jeonnam.go.kr/contentsView.do?menuId=jeonnam0600000000'}
  ].map(source=>({...source,checkedAt:'2026-09-24'}));
  const legacyRegions = [
    {province:'인천',name:'중구',validUntil:'2026-06-30',current:['제물포구','영종구'],reviewRequired:true,reason:'종전 중구는 제물포구와 영종구로 나뉘어 새 구를 확인해야 합니다.'},
    {province:'인천',name:'동구',validUntil:'2026-06-30',current:['제물포구'],reviewRequired:true,reason:'종전 동구 범위와 현행 제물포구 전체 범위가 다릅니다.'},
    {province:'인천',name:'서구',validUntil:'2026-06-30',current:['서해구','검단구'],reviewRequired:true,reason:'종전 서구는 서해구와 검단구로 나뉘어 새 구를 확인해야 합니다.'}
  ];
  const entries=[...municipalities,...districts];
  const lookup=new Map();
  for(const entry of entries) for(const alias of entry.aliases){if(!lookup.has(alias))lookup.set(alias,[]);lookup.get(alias).push(entry)}
  const resolve=(name,province='',parent='')=>(lookup.get(String(name||'').trim())||[]).filter(entry=>(!province||entry.province===province||entry.officialProvince===province)&&(!parent||entry.parent===parent));
  const children=(province,parent)=>districts.filter(entry=>entry.province===province&&entry.parent===parent);
  const api={version:'2026.09.24',checkedAt:'2026-09-24',provinceNames,officialProvinceNames,provinceGroups:{전남광주:['전남','광주']},municipalities,districts,entries,legacyRegions,sources,resolve,children,counts:{policyNamespaces:Object.keys(provinceNames).length,officialProvinces:Object.keys(officialProvinceNames).length,cities:municipalities.filter(item=>item.kind==='city'&&!item.metropolitan).length,metropolitanScopes:municipalities.filter(item=>item.metropolitan).length,counties:municipalities.filter(item=>item.kind==='county').length,autonomousDistricts:districts.filter(item=>item.autonomous).length,generalDistricts:districts.filter(item=>!item.autonomous).length}};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.KoreaRegionCatalog=api;
})(typeof globalThis!=='undefined'?globalThis:this);
