// Printing and optional document windows are the only enhanced native-page actions.
document.addEventListener('click',event=>{
 const print=event.target.closest('[data-print]');if(print){event.preventDefault();window.print();return;}
 const contract=event.target.closest('.nf-contract-open');if(contract&&!event.ctrlKey&&!event.metaKey){const popup=window.open(contract.href,'cnc-contract','popup,width=1000,height=900,scrollbars=yes,resizable=yes');if(popup){event.preventDefault();popup.focus();}}
});
