// Aplica el tema elegido antes del primer pintado (sin parpadeo). Solo lee la preferencia local de la demo;
// con "sistema" no hace nada y manda prefers-color-scheme.
(function () {
  try {
    var raw = window.localStorage.getItem('dentalos.demo.v1:ui');
    var theme = raw ? JSON.parse(raw).theme : null;
    if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    /* sin almacenamiento: tema del sistema */
  }
})();
