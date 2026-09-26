(function(){
  'use strict';
  const destination=document.body.dataset.cncDestination;
  if(!['office.php','payroll.php','preview.php'].includes(destination))return;
  const next=new URL(destination,location.href);
  next.search=location.search;next.hash=location.hash;
  if(destination!=='office.php'&&!next.searchParams.has('role'))next.searchParams.set('role','admin');
  location.replace(next.href);
})();
