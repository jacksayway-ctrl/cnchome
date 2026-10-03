'use strict';
// Browser primitives for isolated DOM checks; all API calls need explicit fixtures.
module.exports=function prepareWindow(window){
 window.structuredClone=structuredClone;
 window.TextEncoder=TextEncoder;
 window.TextDecoder=TextDecoder;
 window.fetch??=async()=>({ok:false,status:503,json:async()=>({error:'격리 검사: API 응답을 설정해 주세요.'})});
 // Session isolation has its own integration suite. These fixtures test screen logic.
 window.CNCWindowSession??={url:value=>String(value),decorateForm(){},ready:Promise.resolve({id:'fixture'})};
 window.setInterval=()=>0;
};
