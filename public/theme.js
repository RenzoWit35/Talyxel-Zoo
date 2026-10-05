// Applies a theme picked earlier before the app renders, so pages don't flash in the wrong colours.
// Without a saved choice the CSS follows the system setting (prefers-color-scheme).
try {
  var theme = localStorage.getItem('talyxel.theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch (e) {
  /* storage blocked: follow the system */
}
