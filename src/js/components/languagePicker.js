import { LitElement, html } from "../../lib/lit.min.js";
import { getLanguage, getLanguages, setLanguage } from "../translations.js";
import { initFixedStrategyDropdown } from "../utils.js";

class LanguagePicker extends LitElement {
  static properties = {
    _languages: { state: true },
    _current: { state: true },
  };

  constructor() {
    super();
    this._languages = getLanguages();
    this._current = getLanguage();
  }

  createRenderRoot() {
    return this;
  }

  #onLanguagesReady = () => {
    this._languages = getLanguages();
    this._current = getLanguage();
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("translations-loaded", this.#onLanguagesReady);
    document.addEventListener("language-changed", this.#onLanguagesReady);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("translations-loaded", this.#onLanguagesReady);
    document.removeEventListener("language-changed", this.#onLanguagesReady);
  }

  firstUpdated() {
    initFixedStrategyDropdown(this);
  }

  updated() {
    initFixedStrategyDropdown(this);
  }

  #select(code) {
    setLanguage(code);
  }

  render() {
    const currentEntry = this._languages.find((lang) => lang.code === this._current);
    const currentLabel = (currentEntry && currentEntry.label) || this._current;
    return html`
      <div class="dropdown">
        <button
          class="btn btn-outline-light btn-sm dropdown-toggle w-100 d-flex align-items-center justify-content-between"
          type="button"
          data-bs-toggle="dropdown"
        >
          <span><i class="bi bi-globe me-1"></i>${currentLabel}</span>
        </button>
        <ul class="dropdown-menu">
          ${this._languages.map((lang) => html`
            <li>
              <button
                class="dropdown-item ${lang.code === this._current ? "active" : ""}"
                type="button"
                @click=${() => this.#select(lang.code)}
              >${lang.label}</button>
            </li>
          `)}
        </ul>
      </div>
    `;
  }
}

customElements.define("language-picker", LanguagePicker);
