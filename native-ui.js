// Shared live notices reuse the same feed as the home page; the initial bar is PHP-rendered.
const nativeSession=document.getElementById('native-session-data');
if(nativeSession){window.CNCHOME_LIVE=JSON.parse(nativeSession.textContent);const bar=document.querySelector('.cnc-session-bar');window.NoticeTicker?.attach(bar);const size=()=>document.documentElement.style.setProperty('--cnc-session-height',bar.getBoundingClientRect().height+'px');if(window.ResizeObserver)new ResizeObserver(size).observe(bar);size();}
// Printing, row expansion and optional document windows.
document.addEventListener('click',event=>{
 const close=event.target.closest('[data-window-close]');if(close){window.close();return;}
 const windowLink=event.target.closest('[data-intake-window],[data-personnel-window],a[href*="personnel.php"][href*="new=1"]');if(windowLink&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){const popup=window.open(windowLink.href,'_blank','popup,width=850,height=950,scrollbars=yes,resizable=yes');if(popup){popup.opener=null;event.preventDefault();popup.focus();}return;}
 const print=event.target.closest('[data-print]');if(print){event.preventDefault();const row=print.closest('.nf-pay-detail');if(row){document.body.classList.add('nf-print-statement');row.classList.add('nf-print-target');}window.print();return;}
 const contract=event.target.closest('.nf-contract-open');if(contract&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){const url=new URL(contract.href);url.searchParams.set('document','1');const popup=window.open(url.href,'_blank','popup,width=900,height=950,scrollbars=yes,resizable=yes');if(popup){popup.opener=null;event.preventDefault();popup.focus();}}
});
function togglePayRow(row){const detail=document.getElementById(row.dataset.payToggle);if(!detail)return;detail.hidden=!detail.hidden;row.setAttribute('aria-expanded',String(!detail.hidden));}
document.addEventListener('click',event=>{const row=event.target.closest('[data-pay-toggle]');if(row&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();togglePayRow(row);}});
document.addEventListener('keydown',event=>{const row=event.target.closest('[data-pay-toggle]');if(row&&(event.key==='Enter'||event.key===' ')){event.preventDefault();togglePayRow(row);}});
window.addEventListener('afterprint',()=>{document.body.classList.remove('nf-print-statement');document.querySelectorAll('.nf-print-target').forEach(el=>el.classList.remove('nf-print-target'));});
