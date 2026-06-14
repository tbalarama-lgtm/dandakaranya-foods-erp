/** Inline script injected via ThemeScript + useServerInsertedHTML (React 19–safe). */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var d = document.documentElement;
    var t = localStorage.getItem("theme");
    var dark = t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches);
    d.classList.remove("light", "dark");
    d.classList.add(dark ? "dark" : "light");
    d.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
`.trim();
