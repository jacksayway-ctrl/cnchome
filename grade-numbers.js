(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.GradeNumbers=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const raw=value=>String(value??'').replace(/,/g,'').trim();
  function parse(value){const text=raw(value);return /^-?\d+(?:\.\d*)?$/.test(text)?Number(text):NaN;}
  function format(value){
    const text=raw(value);if(!/^-?\d+(?:\.\d*)?$/.test(text))return text;
    const [whole,fraction]=text.split('.');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction===undefined?'':'.'+fraction);
  }
  function validate(el){
    const value=parse(el.value),empty=raw(el.value)==='',min=Number(el.getAttribute('min')??'-Infinity'),max=Number(el.getAttribute('max')??'Infinity'),step=Number(el.getAttribute('step')||1);
    let message='';
    if(empty){if(el.required)message='숫자를 입력해 주세요.';}
    else if(!Number.isFinite(value))message='숫자와 소수점만 입력해 주세요.';
    else if(value<min||value>max)message=format(min)+'~'+format(max)+' 사이로 입력해 주세요.';
    else if(step>0&&Math.abs((value-(Number.isFinite(min)?min:0))/step-Math.round((value-(Number.isFinite(min)?min:0))/step))>1e-8)message=format(step)+' 단위로 입력해 주세요.';
    el.setCustomValidity(message);return !message;
  }
  function bind(root){
    root.addEventListener('input',event=>{
      const el=event.target;if(!el.matches?.('[data-grade-number]')||event.isComposing)return;
      const before=el.value,position=el.selectionStart??before.length,offset=before.slice(0,position).replace(/,/g,'').length;
      el.value=format(before);validate(el);
      let cursor=0,seen=0;while(cursor<el.value.length&&seen<offset){if(el.value[cursor]!==',')seen++;cursor++;}
      el.setSelectionRange?.(cursor,cursor);
    },true);
    root.addEventListener('focusout',event=>{const el=event.target;if(!el.matches?.('[data-grade-number]'))return;if(validate(el)&&raw(el.value)!=='')el.value=format(parse(el.value));});
  }
  return Object.freeze({raw,parse,format,validate,bind});
});
