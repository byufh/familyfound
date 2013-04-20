
$(function () {
  if (window.app) return;
  if (typeof(google) === 'undefined') {
    show_error('Google API not loaded', 'It looks like the internet has problems. Check your connection and reload.');
    return;
  }
  window.app = new FamilyFound();
  window.app.start();
});

