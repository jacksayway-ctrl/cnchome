(function(){
  'use strict';
  const destination=document.body.dataset.cncDestination;
  if(!['office.php','payroll.php','preview.php'].includes(destination))return;
  const next=new URL(destination,location.href);
  if(destination==='office.php'&&!location.search&&!location.hash){
    try{const saved=sessionStorage.getItem('cnc.currentPage.v1'),target=saved?new URL(saved,location.origin):null;
      if(target&&target.origin===location.origin&&/^\/(?:office|employee|admin|preview|login|signup|personnel|profile-entry|memberships|business-calendar|contracts|pay-statements|payroll|intake|intake-alerts|documents)\.php$/.test(target.pathname)){location.replace(target.href);return;}
    }catch(_){}
  }
  next.search=location.search;next.hash=location.hash;
  if(destination!=='office.php'&&!next.searchParams.has('role'))next.searchParams.set('role','admin');
  location.replace(next.href);
})();
