(function(global){
 'use strict';
 const attached=new WeakMap();
 const keys={q:'ㅂ',w:'ㅈ',e:'ㄷ',r:'ㄱ',t:'ㅅ',y:'ㅛ',u:'ㅕ',i:'ㅑ',o:'ㅐ',p:'ㅔ',a:'ㅁ',s:'ㄴ',d:'ㅇ',f:'ㄹ',g:'ㅎ',h:'ㅗ',j:'ㅓ',k:'ㅏ',l:'ㅣ',z:'ㅋ',x:'ㅌ',c:'ㅊ',v:'ㅍ',b:'ㅠ',n:'ㅜ',m:'ㅡ'};
 const shifted={q:'ㅃ',w:'ㅉ',e:'ㄸ',r:'ㄲ',t:'ㅆ',o:'ㅒ',p:'ㅖ'};
 const selector='input[name="counselorName"],input[name="customer"],input[name="consultationPlace"],input[name="visitSchedule"],textarea[name="note"],input[data-receipt-calltime]';

 function inputEvent(type,text,inputType,cancelable=false){
  try{return new global.InputEvent(type,{bubbles:true,cancelable,data:text||null,inputType});}
  catch(_){return new global.Event(type,{bubbles:true,cancelable});}
 }

 function attach(form){
  if(!form||!global.Hangul)return null;
  if(attached.has(form))return attached.get(form);
  const hangul=global.Hangul,modeSelect=form.querySelector('[data-receipt-input-mode]'),states=[];
  let fallbackMode='ko';
  const mode=()=>modeSelect?.value==='en'||(!modeSelect&&fallbackMode==='en')?'en':'ko';
  const commitAll=()=>{for(const state of states)state.active=null;};
  const controller={setMode(value){fallbackMode=value==='en'?'en':'ko';if(modeSelect)modeSelect.value=fallbackMode;commitAll();},getMode:mode};
  attached.set(form,controller);
  modeSelect?.addEventListener('change',commitAll);
  form.addEventListener('reset',()=>{commitAll();fallbackMode='ko';});

  for(const field of form.querySelectorAll(selector)){
   const state={active:null,composing:false,writing:false,inputSeen:false,beforeInput:null};
   states.push(state);
   const commit=()=>{state.active=null;};
   function current(){
    const active=state.active;
    if(active&&(field.value!==active.value||field.selectionStart!==active.end||field.selectionEnd!==active.end))commit();
    return state.active;
   }

   // Prefer the browser's editing command so Ctrl/Cmd+Z keeps its native history.
   // The range fallback is needed where insertText is unsupported; its edits may
   // not enter the browser undo history. Neither path replaces the whole value.
   function replace(start,end,text,inputType){
    const before=field.value,expected=before.slice(0,start)+text+before.slice(end),caret=start+text.length;
    if(field.maxLength>=0&&expected.length>field.maxLength)return false;
    const selection=[field.selectionStart,field.selectionEnd,field.selectionDirection];
    state.writing=true;state.inputSeen=false;state.beforeInput=null;
    try{
     field.setSelectionRange(start,end);
     try{
      if(field.ownerDocument.activeElement===field&&typeof field.ownerDocument.execCommand==='function'){
       field.ownerDocument.execCommand(text?'insertText':'delete',false,text);
      }
     }catch(_){/* A disabled editing command can fall back to the field API. */}
     if(field.value===before&&!state.inputSeen){
      const event=state.beforeInput||inputEvent('beforeinput',text,inputType,true);
      if(!state.beforeInput)field.dispatchEvent(event);
      if(event.defaultPrevented){field.setSelectionRange(...selection);return false;}
      // A beforeinput listener may edit the value or move focus itself.
      if(field.value!==before||field.ownerDocument.activeElement!==field)return false;
      field.setRangeText(text,start,end,'end');
     }
     if(field.value!==before&&!state.inputSeen)field.dispatchEvent(inputEvent('input',text,inputType));
     return field.value===expected&&field.selectionStart===caret&&field.selectionEnd===caret;
    }finally{state.writing=false;}
   }

   function remember(start,text){
    // Everything before the last syllable is committed, just as with an IME.
    // Never reassemble existing text, pasted text, or a previous field value.
    const last=text.slice(-1),end=start+text.length;
    state.active=last?{start:end-1,end,text:last,value:field.value}:null;
   }

   field.addEventListener('compositionstart',()=>{state.composing=true;commit();});
   field.addEventListener('compositionend',()=>{state.composing=false;commit();});
   field.addEventListener('beforeinput',event=>{
    if(state.writing)state.beforeInput=event;
    else commit();
   });
   field.addEventListener('input',()=>{
    if(state.writing)state.inputSeen=true;
    else commit();
   });
   for(const name of ['blur','pointerdown','mousedown','paste','cut','drop'])field.addEventListener(name,commit);
   for(const name of ['select','selectionchange'])field.addEventListener(name,()=>{if(!state.writing)current();});
   field.addEventListener('keydown',event=>{
    // Native IMEs, shortcuts, alternate keyboard layouts and mobile composition
    // retain control. Only plain Latin-letter keydowns need the page helper.
    if(event.defaultPrevented||mode()!=='ko'||field.disabled||field.readOnly||state.composing||event.isComposing||event.keyCode===229||event.ctrlKey||event.metaKey||event.altKey||event.getModifierState?.('AltGraph')){
     commit();return;
    }
    if(event.key==='Shift'||event.key==='CapsLock')return;
    const active=current();
    if(event.key==='Backspace'){
     if(!active)return;
     event.preventDefault();
     const text=hangul.assemble(hangul.disassemble(active.text).slice(0,-1));
     if(replace(active.start,active.end,text,'deleteContentBackward'))remember(active.start,text);
     else current();
     return;
    }
    if(!/^[a-z]$/i.test(event.key)){commit();return;}
    const key=event.key.toLowerCase(),jamo=event.shiftKey&&shifted[key]||keys[key];
    event.preventDefault();
    let start=field.selectionStart,end=field.selectionEnd,text=jamo;
    if(start===null||end===null){commit();return;}
    if(active){
     start=active.start;end=active.end;
     // Standalone consonants must remain separate for initials such as ㄱㅅ.
     text=hangul.isConsonant(active.text)&&hangul.isConsonant(jamo)?active.text+jamo:hangul.assemble([...hangul.disassemble(active.text),jamo]);
    }
    if(replace(start,end,text,'insertText'))remember(start,text);
    else current();
   });
  }
  return controller;
 }
 global.KoreanInput={attach};
})(window);
