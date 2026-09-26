(function(){
'use strict';
const role=window.CNCHOME_LIVE?.user.role;
if(!['employee','admin'].includes(role))return;
const pageUrl=new URL(location.href);pageUrl.searchParams.set('role',role);history.replaceState(history.state,'',pageUrl);
const originalFetch=window.fetch.bind(window);
const endpoints=new Set(['/grade-api.php','/hr-api.php','/session-api.php','/logout.php','/test-api.php']);
window.fetch=function(input,init){
 const url=new URL(input instanceof Request?input.url:input,location.href);
 if(url.origin===location.origin&&endpoints.has(url.pathname)){
  const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));
  headers.set('X-CNC-Role',role);
  return originalFetch(input,{...init,headers});
 }
 return originalFetch(input,init);
};
document.addEventListener('click',event=>{
 const link=event.target.closest?.('a[href]');if(!link)return;
 const url=new URL(link.href,location.href);
 if(url.origin===location.origin&&/\.(php|html)$/.test(url.pathname)&&!url.searchParams.has('role')){url.searchParams.set('role',role);link.href=url.href;}
},true);
})();
