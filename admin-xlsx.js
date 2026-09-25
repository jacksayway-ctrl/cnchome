(function(global){
 'use strict';
 // Minimal OOXML workbook writer. Strings use inlineStr, never spreadsheet formulas.
 const enc=new TextEncoder();
 const xml=s=>String(s??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 const crc=b=>{let n=0xffffffff;for(const c of b)n=crcTable[(n^c)&255]^(n>>>8);return(n^0xffffffff)>>>0;};
 const join=chunks=>{const b=new Uint8Array(chunks.reduce((n,x)=>n+x.length,0));let p=0;for(const x of chunks){b.set(x,p);p+=x.length;}return b;};
 function zip(files){
  const local=[],central=[];let offset=0;
  for(const [path,text] of Object.entries(files)){
   const name=enc.encode(path),data=enc.encode(text),checksum=crc(data),h=new Uint8Array(30),v=new DataView(h.buffer);
   v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(10,0,true);v.setUint16(12,33,true);v.setUint32(14,checksum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);
   local.push(h,name,data);
   const ch=new Uint8Array(46),cv=new DataView(ch.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(14,33,true);cv.setUint32(16,checksum,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);central.push(ch,name);offset+=h.length+name.length+data.length;
  }
  const directory=join(central),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,Object.keys(files).length,true);ev.setUint16(10,Object.keys(files).length,true);ev.setUint32(12,directory.length,true);ev.setUint32(16,offset,true);return join([...local,directory,end]);
 }
 function workbook(rows,sheet='급여대장'){
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const col=i=>{let name='';do{name=String.fromCharCode(65+i%26)+name;i=Math.floor(i/26)-1;}while(i>=0);return name;};
  const cells=rows.map((row,r)=>`<row r="${r+1}">${row.map((value,c)=>typeof value==='number'&&Number.isFinite(value)?`<c r="${col(c)}${r+1}"><v>${value}</v></c>`:`<c r="${col(c)}${r+1}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join('')}</row>`).join('');
  const name=xml(sheet.replace(/[\\/*?:\[\]]/g,' ').slice(0,31)||'Sheet1');
  return zip({
   '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
   '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
   'xl/workbook.xml':`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
   'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
   'xl/worksheets/sheet1.xml':`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><cols><col min="1" max="12" width="22" customWidth="1"/></cols><sheetData>${cells}</sheetData></worksheet>`
  });
 }
 function download(rows,filename){const bytes=workbook(rows),url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const api={workbook,download};if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.AdminXlsx=api;
})(typeof window!=='undefined'?window:globalThis);
