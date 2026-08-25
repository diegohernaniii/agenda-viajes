if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// iOS (Safari, Chrome-iOS, etc. — todos usan WebKit) nunca dispara
// "beforeinstallprompt": ahí solo se puede instalar a mano desde el botón
// Compartir. En el resto de navegadores sí se puede lanzar el aviso nativo.
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

let deferredInstallPrompt = null;

function showInstallButtons() {
  document.querySelectorAll(".install-app-btn").forEach((btn) => {
    btn.style.display = "inline-flex";
  });
}

function hideInstallButtons() {
  document.querySelectorAll(".install-app-btn").forEach((btn) => {
    btn.style.display = "none";
  });
}

if (isStandalone) {
  // Ya está instalada y abierta como app: no hace falta ofrecer instalarla.
  hideInstallButtons();
} else if (isIos) {
  // No hay aviso nativo posible: se muestra el botón siempre y se explica
  // el paso manual al pulsarlo.
  showInstallButtons();
} else {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showInstallButtons();
  });
  window.addEventListener("appinstalled", hideInstallButtons);
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".install-app-btn");
  if (!btn) return;
  e.preventDefault();

  if (isIos) {
    alert(
      'Para instalar la app en tu iPhone/iPad:\n\n1. Pulsa el icono de Compartir (el cuadrado con la flecha hacia arriba), en la barra del navegador.\n2. Baja y elige "Añadir a pantalla de inicio".\n3. Pulsa "Añadir".'
    );
    return;
  }

  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.finally(() => {
    deferredInstallPrompt = null;
    hideInstallButtons();
  });
});
