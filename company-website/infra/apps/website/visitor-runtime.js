import config from "./visitor-browser.json";

// Do not load the provider on previews or before an explicit visitor choice.
// This gate is stricter than the provider's cookie-consent flag, which can
// still send events before consent. No form capture or identify calls are added.
if (config.enabled && location.origin === new URL(config.siteUrl).origin) {
  const key = "company-website-visitors-consent-v1";
  let loaded = false;
  const read = () => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const save = (value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Choice still applies to this page. */
    }
  };
  const load = () => {
    if (loaded || navigator.globalPrivacyControl === true) return;
    loaded = true;
    const script = document.createElement("script");
    script.src = "/website-visitors-provider.js";
    script.async = true;
    script.dataset.websiteVisitors = "true";
    script.addEventListener("load", () => {
      // The captured bootstrap sets waitForConsent. Queue the provider's grant
      // only after this site's explicit choice, including after a later re-opt-in.
      if (navigator.globalPrivacyControl !== true)
        window.Snitcher?.giveCookieConsent?.();
    });
    document.head.append(script);
  };
  const panel = document.createElement("section");
  panel.setAttribute("aria-label", "Website visitor tracking");
  panel.dataset.visitorConsent = "true";
  panel.style.cssText =
    "position:fixed;inset:auto 16px 58px;max-width:520px;padding:20px;background:#fff;color:#18181b;border:1px solid #71717a;border-radius:12px;box-shadow:0 4px 24px #0003;z-index:2147483646;font:16px/1.5 system-ui;";
  const message = document.createElement("p");
  message.textContent =
    "Allow visitor tracking? We use Snitcher to identify visiting companies and understand page visits and sessions. Tracking stays off unless you accept.";
  const privacy = document.createElement("a");
  privacy.href = config.privacyPolicyUrl;
  privacy.textContent = "Privacy details";
  privacy.style.cssText =
    "color:#1d4ed8;text-decoration:underline;display:block;margin:8px 0;";
  panel.append(message, privacy);
  const button = (label, action) => {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = label;
    el.style.cssText =
      "font:inherit;background:#fff;color:#18181b;border:1px solid #52525b;border-radius:6px;padding:8px 14px;margin:4px;cursor:pointer;";
    el.addEventListener("click", action);
    return el;
  };
  const hide = () => {
    panel.hidden = true;
    choices.focus();
  };
  const stop = () => {
    // Reload removes tracker timers/listeners. Provider history is retained.
    try {
      window.Snitcher?.denyCookieConsent?.();
    } catch {
      /* Reload still stops collection. */
    }
    location.reload();
  };
  const accept = button("Accept tracking", () => {
    save("accepted");
    load();
    hide();
  });
  const reject = button("Reject tracking", () => {
    save("denied");
    if (loaded) {
      stop();
    } else hide();
  });
  panel.append(accept, reject);
  const choices = button("Privacy choices", () => {
    panel.hidden = false;
    reject.focus();
  });
  choices.style.cssText +=
    "position:fixed;bottom:10px;left:16px;z-index:2147483647;font-size:14px;";
  choices.dataset.visitorChoices = "true";
  document.body.append(panel, choices);
  window.addEventListener("storage", (event) => {
    // A choice withdrawn in another tab must stop this tab's active tracker too.
    if ((event.key === key || event.key === null) && read() !== "accepted") {
      if (loaded) stop();
      else panel.hidden = read() === "denied";
    }
  });
  const preference = read();
  panel.hidden = preference === "accepted" || preference === "denied";
  if (navigator.globalPrivacyControl === true) {
    accept.disabled = true;
    message.textContent =
      "Visitor tracking is off because your browser sends a Global Privacy Control signal.";
  } else if (preference === "accepted") load();
}
