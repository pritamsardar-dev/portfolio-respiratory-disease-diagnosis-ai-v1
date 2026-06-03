// Apply saved theme before first render to prevent flash
(() => {
  const saved = localStorage.getItem("pulmo-theme");
  document.documentElement.classList.toggle("dark", saved === "dark");
})();
