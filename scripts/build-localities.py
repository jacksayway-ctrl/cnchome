"""Build the bundled legal locality catalog from a pinned admincode-kr checkout.
Usage: python scripts/build-localities.py /path/to/admincode-kr
Reads data only; never executes code from the source checkout.
"""
import json,re,sys
from pathlib import Path
source=Path(sys.argv[1]);root=Path(__file__).resolve().parents[1]
province_keys={'서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종','경기도':'경기','강원특별자치도':'강원','충청북도':'충북','충청남도':'충남','전북특별자치도':'전북','전라남도':'전남','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주'}
groups=[];dates=set();province_dates={};count=0
for province,key in province_keys.items():
 text=(source/'kr'/(province+'.md')).read_text();generated=re.search(r'^generated: (.+)$',text,re.M)[1];dates.add(generated);province_dates[key]=generated;parent=None
 for line in text.splitlines():
  if line.startswith('## '):parent=line[3:];parent='' if parent=='(직할)' else parent
  elif parent is not None and line.strip() and not line.startswith('('):
   names=line.split(' · ')
   assert all(re.fullmatch(r'[가-힣一-龥0-9·()]+(?: [가-힣一-龥0-9·()]+)*',name) for name in names),line
   groups.append([key,parent,names]);count+=len(names)
assert count>19000,(dates,count)
data={'generatedAt':max(dates),'provinceDates':province_dates,'source':'https://www.code.go.kr/stdcode/regCodeL.do','mirror':'https://github.com/wellsa-ai/admincode-kr/tree/5bc9fc6c176950ab8fb2104fc525484de6430451','count':count,'groups':groups}
lines=['/* Legal 읍·면·동·리, source and attribution: docs/localities-source.md. */','(function(root){',' const data={...'+json.dumps({k:v for k,v in data.items() if k!='groups'},ensure_ascii=False,separators=(',',':'))+',groups:[']
lines += [json.dumps(group,ensure_ascii=False,separators=(',',':'))+',' for group in groups]
lines += [']};'," if(typeof module!=='undefined'&&module.exports)module.exports=data;root.KoreaLocalities=data;", "})(typeof globalThis!=='undefined'?globalThis:this);",'']
(root/'korea-localities.js').write_text('\n'.join(lines))
print(json.dumps({'groups':len(groups),'localities':count,'generatedAt':data['generatedAt'],'bytes':(root/'korea-localities.js').stat().st_size},ensure_ascii=False))
