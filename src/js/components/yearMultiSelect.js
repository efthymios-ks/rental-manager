import { LitElement, html } from "../../lib/lit.min.js";
import { subscribeLanguage, t } from "../translations.js";

class YearMultiSelect extends LitElement {
  static properties = {
    years: { type: Array },
    defaultAll: { type: Boolean },
    defaultNone: { type: Boolean },
    cleaner: { type: Boolean },
  };

  #multiSelect = null;
  #selectedYears = [];
  #userInitialized = false;
  #programmatic = false;

  constructor() {
    super();
    this.years = [];
    this.defaultAll = false;
    this.defaultNone = false;
    this.cleaner = false;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsubLang = subscribeLanguage(() => this.#updateLabels());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubLang?.();
    document.removeEventListener("show.coreui.multi-select", this._onOtherShow);
    this.#multiSelect?.dispose();
    this.#multiSelect = null;
  }

  get selectedYears() {
    return this.#selectedYears.length === this.years.length ? null : this.#selectedYears;
  }

  setSelected(years) {
    this.#userInitialized = true;
    this.#selectedYears = years ? [...years] : [...this.years];
    if (this.#multiSelect) {
      this.#programmaticUpdate(() => {
        this.#syncToSelect();
        this.#multiSelect.update({ selectionTypeCounterText: this.#counterText() });
      });
    }
  }

  #syncToSelect() {
    const select = this.querySelector("select");
    if (!select) return;
    for (const o of select.options) {
      o.selected = this.#selectedYears.includes(o.value);
    }
  }

  #getDefaultSelected() {
    if (this.defaultNone) return [];
    if (this.defaultAll) return [...this.years];
    const currentYear = String(new Date().getFullYear());
    const def = this.years.includes(currentYear) ? currentYear : this.years[0];
    return def ? [def] : [];
  }

  #counterText() {
    return this.#selectedYears.length === 1
      ? t("filter.year.unit.one", "Year")
      : t("filter.year.unit", "Years");
  }

  #programmaticUpdate(fn) {
    this.#programmatic = true;
    fn();
    queueMicrotask(() => { this.#programmatic = false; });
  }

  #updateLabels() {
    if (!this.#multiSelect) return;
    this.#programmaticUpdate(() => this.#multiSelect.update({
      placeholder: t("filter.year.none", "No Years"),
      selectionTypeCounterText: this.#counterText(),
    }));
  }

  #buildNativeOptions() {
    const select = this.querySelector("select");
    if (!select) return;
    select.innerHTML = "";
    for (const year of this.years) {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      option.selected = this.#selectedYears.includes(year);
      select.appendChild(option);
    }
  }

  #initMultiSelect() {
    if (!this.#userInitialized) {
      this.#selectedYears = this.#getDefaultSelected();
    }
    this.#buildNativeOptions();

    const select = this.querySelector("select");
    this.#multiSelect = new coreui.MultiSelect(select, {
      multiple: true,
      selectionType: "counter",
      selectionTypeCounterText: this.#counterText(),
      placeholder: t("filter.year.none", "No Years"),
      selectAll: false,
      cleaner: this.cleaner,
      search: false,
    });

    this._onOtherShow = (e) => { if (e.target !== select) this.#multiSelect.hide(); };
    document.addEventListener("show.coreui.multi-select", this._onOtherShow);

    select.addEventListener("changed.coreui.multi-select", (e) => {
      if (this.#programmatic) return;
      this.#selectedYears = (e.value ?? []).map((v) => String(v?.value ?? v));
      this.dispatchEvent(new CustomEvent("change", { bubbles: true, composed: true }));
    });

    select.addEventListener("hidden.coreui.multi-select", () => {
      if (this.#programmatic) return;
      this.#programmaticUpdate(() => this.#multiSelect.update({ selectionTypeCounterText: this.#counterText() }));
    });
  }

  updated(changedProperties) {
    if (changedProperties.has("years") && this.years.length && !this.#multiSelect) {
      this.#initMultiSelect();
    }
  }

  render() {
    return html`<select multiple></select>`;
  }
}

customElements.define("year-checkbox-dropdown", YearMultiSelect);
