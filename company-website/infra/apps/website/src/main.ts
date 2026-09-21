const button = document.querySelector<HTMLButtonElement>("#theme");
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
let preference: string | null = null;
try {
  preference = localStorage.getItem("company-website-theme");
} catch {
  /* Storage can be unavailable in a private session. */
}
function applyTheme() {
  const dark = preference ? preference === "dark" : systemTheme.matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  if (button) {
    button.textContent = dark ? "Light theme" : "Dark theme";
    button.setAttribute(
      "aria-label",
      dark ? "Use light theme" : "Use dark theme",
    );
    button.setAttribute("aria-pressed", String(dark));
  }
}
button?.addEventListener("click", () => {
  preference =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem("company-website-theme", preference);
  } catch {
    /* The current session still updates. */
  }
  applyTheme();
});
systemTheme.addEventListener("change", applyTheme);
applyTheme();
// The control needs JavaScript; keep it absent when only static HTML renders.
if (button) button.hidden = false;
