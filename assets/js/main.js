document.addEventListener('DOMContentLoaded', function(){
  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});