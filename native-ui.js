// Printing and optional document windows are the only enhanced native-page actions.
document.addEventListener('click',event=>{
 const close=event.target.closest('[data-window-close]');if(close){window.close();return;}
 const windowLink=event.target.closest('[data-intake-window],[data-personnel-window],a[href*="personnel.php"][href*="new=1"]');if(windowLink&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){const popup=window.open(windowLink.href,'_blank','popup,width=850,height=950,scrollbars=yes,resizable=yes');if(popup){popup.opener=null;event.preventDefault();popup.focus();}return;}
 const print=event.target.closest('[data-print]');if(print){event.preventDefault();window.print();return;}
 const contract=event.target.closest('.nf-contract-open');if(contract&&!event.ctrlKey&&!event.metaKey){const popup=window.open(contract.href,'cnc-contract','popup,width=1000,height=900,scrollbars=yes,resizable=yes');if(popup){event.preventDefault();popup.focus();}}
});
