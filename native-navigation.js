// Existing office menus enter the PHP-rendered personnel, contract and payroll pages.
(()=>{'use strict';if(!window.CNCHOME_LIVE)return;const role=window.CNCHOME_LIVE.user.role;
const routes=role==='admin'?{adminStaff:'personnel.php',adminStaffRegister:'personnel.php&new=1',adminContracts:'contracts.php',adminPayroll:'pay-statements.php'}:{myInfo:'personnel.php',contracts:'contracts.php',payslips:'pay-statements.php'};
function go(page){const path=routes[page];if(!path)return false;const [file,extra]=path.split('&');location.replace('/'+file+'?role='+role+(extra?'&'+extra:''));return true;}
document.addEventListener('click',event=>{const node=event.target.closest('[data-page]');if(node&&routes[node.dataset.page]){event.preventDefault();event.stopImmediatePropagation();go(node.dataset.page);}},true);
window.addEventListener('hashchange',()=>go(location.hash.slice(1)));go(location.hash.slice(1)||window.CNCHOME_LIVE.page);
})();
