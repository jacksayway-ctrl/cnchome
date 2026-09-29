(() => {
  'use strict';
  const dialog = document.getElementById('contract-dialog');
  const canOpen = dialog && typeof dialog.showModal === 'function';
  document.querySelectorAll('[data-contract-open]').forEach(link => link.addEventListener('click', event => {
    if (!canOpen) return;
    event.preventDefault();
    if (!dialog.open) dialog.showModal();
  }));
  document.querySelectorAll('[data-contract-close]').forEach(button => button.addEventListener('click', () => {
    if (canOpen) dialog.close();
  }));
  document.querySelectorAll('[data-contract-print]').forEach(button => button.addEventListener('click', () => window.print()));
  if (canOpen && dialog.hasAttribute('data-auto-open') && !dialog.open) dialog.showModal();
})();
