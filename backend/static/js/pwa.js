if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Botón "Instalar app" explícito: no todos los navegadores muestran el
// aviso automático de instalación, así que se ofrece siempre un botón
// visible en cuanto el navegador confirma que la web es instalable.
let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.querySelectorAll(".install-app-btn").forEach((btn) => {
    btn.style.display = "inline-flex";
  });
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".install-app-btn");
  if (!btn) return;
  e.preventDefault();
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.finally(() => {
    deferredInstallPrompt = null;
    document.querySelectorAll(".install-app-btn").forEach((b) => (b.style.display = "none"));
  });
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  document.querySelectorAll(".install-app-btn").forEach((b) => (b.style.display = "none"));
});

// iOS (Safari) no dispara "beforeinstallprompt": ahí solo se puede instalar
// a mano desde el botón Compartir, así que se muestra esa instrucción.
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
if (isIos && !isStandalone) {
  document.querySelectorAll(".ios-install-hint").forEach((el) => {
    el.style.display = "block";
  });
}
