import { LitElement, html } from "../../lib/lit.min.js";
import { subscribeLanguage, t } from "../translations.js";

class RentalsMultiSelect extends LitElement {
  static properties = {
    rentals: { type: Array },
    defaultNone: { type: Boolean },
    cleaner: { type: Boolean },
  };

  #multiSelect = null;
  #selectedIds = [];
  #userInitialized = false;
  #programmatic = false;

  constructor() {
    super();
    this.rentals = [];
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

  get selectedIds() {
    return this.#selectedIds.length === this.rentals.length ? null : this.#selectedIds;
  }

  setSelected(rentalIds) {
    this.#userInitialized = true;
    this.#selectedIds = rentalIds ? [...rentalIds] : this.rentals.map((r) => r.Id);
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
      o.selected = this.#selectedIds.includes(o.value);
    }
  }

  #counterText() {
    return this.#selectedIds.length === 1
      ? t("filter.rentals.unit.one", "Rental")
      : t("filter.rentals.unit", "Rentals");
  }

  #programmaticUpdate(fn) {
    this.#programmatic = true;
    fn();
    queueMicrotask(() => { this.#programmatic = false; });
  }

  #updateLabels() {
    if (!this.#multiSelect) return;
    this.#programmaticUpdate(() => this.#multiSelect.update({
      placeholder: t("filter.rentals.none", "No Rentals"),
      selectionTypeCounterText: this.#counterText(),
    }));
  }

  #buildNativeOptions() {
    const select = this.querySelector("select");
    if (!select) return;
    select.innerHTML = "";
    for (const rental of this.rentals) {
      const option = document.createElement("option");
      option.value = rental.Id;
      option.textContent = rental.Name;
      option.selected = this.#selectedIds.includes(rental.Id);
      select.appendChild(option);
    }
  }

  #initMultiSelect() {
    if (!this.#userInitialized) {
      this.#selectedIds = this.defaultNone ? [] : this.rentals.map((r) => r.Id);
    }
    this.#buildNativeOptions();

    const select = this.querySelector("select");
    this.#multiSelect = new coreui.MultiSelect(select, {
      multiple: true,
      selectionType: "counter",
      selectionTypeCounterText: this.#counterText(),
      placeholder: t("filter.rentals.none", "No Rentals"),
      selectAll: false,
      cleaner: this.cleaner,
      search: false,
    });

    this._onOtherShow = (e) => { if (e.target !== select) this.#multiSelect.hide(); };
    document.addEventListener("show.coreui.multi-select", this._onOtherShow);

    select.addEventListener("changed.coreui.multi-select", (e) => {
      if (this.#programmatic) return;
      this.#selectedIds = (e.value ?? []).map((v) => String(v?.value ?? v));
      this.dispatchEvent(new CustomEvent("change", { bubbles: true, composed: true }));
    });

    select.addEventListener("hidden.coreui.multi-select", () => {
      if (this.#programmatic) return;
      this.#programmaticUpdate(() => this.#multiSelect.update({ selectionTypeCounterText: this.#counterText() }));
    });
  }

  updated(changedProperties) {
    if (changedProperties.has("rentals") && this.rentals.length && !this.#multiSelect) {
      this.#initMultiSelect();
    }
  }

  render() {
    return html`<select multiple></select>`;
  }
}

customElements.define("rental-filter-dropdown", RentalsMultiSelect);
