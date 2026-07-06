import { getSettings, updateSettings } from "./settings.js";

let _data = {};
let _current = getSettings().selectedLanguage || "en";

async function loadTranslations() {
  const response = await fetch("translations.json");
  _data = await response.json();
  if (!_data[_current]) {
    _current = Object.keys(_data)[0] || "en";
  }
  applyTranslations();
  document.dispatchEvent(new CustomEvent("translations-loaded"));
}

function applyTranslations() {
  const keys = (_data[_current] && _data[_current].keys) || {};
  document.querySelectorAll("[data-translations-key]").forEach((element) => {
    const key = element.dataset.translationsKey;
    const field = element.dataset.translationsField || "textContent";
    const value = keys[key];
    if (value !== undefined) {
      element[field] = value;
    }
  });
}

export function setLanguage(code) {
  if (!_data[code]) {
    return;
  }

  _current = code;
  updateSettings({ selectedLanguage: code });
  applyTranslations();
  document.dispatchEvent(new CustomEvent("language-changed", { detail: { code } }));
}

export function getLanguage() {
  return _current;
}

export function getLanguages() {
  return Object.entries(_data).map(([code, entry]) => ({
    code,
    label: entry.label,
  }));
}

export function t(key, fallback, params) {
  const keys = (_data[_current] && _data[_current].keys) || {};
  let value = keys[key];
  if (value === undefined) {
    value = fallback;
  }
  if (params && typeof value === "string") {
    Object.entries(params).forEach(([name, replacement]) => {
      value = value.replace(new RegExp(`\\{${name}\\}`, "g"), replacement);
    });
  }
  return value;
}

export function subscribeLanguage(callback) {
  document.addEventListener("language-changed", callback);
  document.addEventListener("translations-loaded", callback);
  return () => {
    document.removeEventListener("language-changed", callback);
    document.removeEventListener("translations-loaded", callback);
  };
}

window.setLanguage = setLanguage;
window.getLanguage = getLanguage;
window.getLanguages = getLanguages;
window.applyTranslations = applyTranslations;
window.t = t;

loadTranslations().catch((error) => console.error("Failed to load translations:", error));
