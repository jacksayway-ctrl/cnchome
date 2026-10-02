// Existing office menus enter the PHP-rendered personnel, contract and payroll pages.
(()=>{
 'use strict';
 if(!window.CNCHOME_LIVE)return;
 const role=window.CNCHOME_LIVE.user.role;
 const routes=role==='admin'?{
  adminStaffNew:'personnel.php&new=1&popup=1',adminMemberships:'memberships.php',adminBusinessCalendar:'business-calendar.php',adminIntakeAlerts:'intake-alerts.php',
  adminIntake:'intake.php',adminPending:'intake.php&status=pending',adminIntakeRegister:'intake.php&new=1',
  adminStaff:'personnel.php',adminStaffRegister:'personnel.php&register=1',adminContracts:'contracts.php',adminPayroll:'pay-statements.php'
 }:{myInfo:'personnel.php',contracts:'contracts.php',payslips:'pay-statements.php'};
 let windowReady=!window.CNCWindowSession;
 window.CNCWindowSession?.ready.then(()=>{windowReady=true;go(location.hash.slice(1)||window.CNCHOME_LIVE.page);}).catch(()=>{});
 function go(page){
  if(!windowReady)return false;
  const path=routes[page];if(!path)return false;
  const [file,...extra]=path.split('&'),target=new URL('/'+file,location.origin);
  target.searchParams.set('role',role);
  for(const item of extra){const [key,...value]=item.split('=');target.searchParams.set(key,value.join('='));}
  if(role==='admin'&&['adminIntake','adminPending','adminIntakeRegister'].includes(page)){
   const currentTeam=new URL(location.href).searchParams.get('team');
   target.searchParams.set('team',['insurance','cosmetics','health'].includes(currentTeam)?currentTeam:'insurance');
   if(page==='adminIntake')target.searchParams.set('status','');
  }
  const url=target.pathname+target.search;
  if(page==='adminStaffNew'){
   const popup=window.open(url,'cnc-staff-register','popup,width=850,height=950,scrollbars=yes,resizable=yes');
   if(popup){if(location.hash.slice(1)===page)history.replaceState(null,'','#adminStaff');return true;}
  }
  location.replace(window.CNCWindowSession?.url(url)||url);return true;
 }
 document.addEventListener('click',event=>{
  if(role==='admin'&&event.target.closest('[data-aw="staff-new"],[data-hr="new"],[data-action="staff-add"]')){event.preventDefault();event.stopImmediatePropagation();go('adminStaffNew');return;}
  const node=event.target.closest('[data-page]');
  if(node&&routes[node.dataset.page]){event.preventDefault();event.stopImmediatePropagation();go(node.dataset.page);}
 },true);
 window.addEventListener('hashchange',()=>go(location.hash.slice(1)));
 go(location.hash.slice(1)||window.CNCHOME_LIVE.page);
})();
