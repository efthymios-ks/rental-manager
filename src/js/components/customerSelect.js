import { LitElement, html } from "../../lib/lit.min.js";
import { subscribeLanguage, t } from "../translations.js";

class CustomerSelect extends LitElement {
  static properties = {
    customers: { type: Array },
    selectedId: { type: String },
    defaultNone: { type: Boolean },
    invalid: { type: Boolean },
  };

  #multiSelect = null;
  #currentId = null;
  #programmatic = false;

  constructor() {
    super();
    this.customers = [];
    this.selectedId = null;
    this.defaultNone = false;
    this.invalid = false;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsubLang = subscribeLanguage(() => {
      this.#multiSelect?.update({ placeholder: t("common.field.customer", "Customer") });
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubLang?.();
    this.#multiSelect?.dispose();
    this.#multiSelect = null;
  }

  get value() {
    return this.#currentId ?? "";
  }

  #buildOptions() {
    const select = this.querySelector("select");
    if (!select) return;
    select.innerHTML = "";
    if (this.defaultNone) {
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "";
      blank.selected = !this.#currentId;
      select.appendChild(blank);
    }
    for (const customer of this.customers) {
      const opt = document.createElement("option");
      opt.value = customer.Id;
      opt.textContent = customer.FullName;
      opt.selected = customer.Id === this.#currentId;
      select.appendChild(opt);
    }
  }

  #initMultiSelect() {
    this.#currentId = this.selectedId ?? null;
    this.#buildOptions();
    const select = this.querySelector("select");
    select.setAttribute("aria-label", t("common.field.customer", "Customer"));
    this.#multiSelect = new coreui.MultiSelect(select, {
      multiple: false,
      search: true,
      placeholder: t("common.field.customer", "Customer"),
      cleaner: false,
    });
    this.querySelector(".form-multi-select")?.setAttribute("aria-label", t("common.field.customer", "Customer"));

    select.addEventListener("changed.coreui.multi-select", (e) => {
      if (this.#programmatic) return;
      const raw = e.value;
      if (!raw || (Array.isArray(raw) && !raw.length)) {
        this.#currentId = null;
      } else if (Array.isArray(raw)) {
        this.#currentId = String(raw[0]?.value ?? raw[0]);
      } else {
        this.#currentId = String(raw?.value ?? raw);
      }
      this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    });
  }

  #syncSelection() {
    this.#programmatic = true;
    this.#currentId = this.selectedId ?? null;
    const select = this.querySelector("select");
    if (select) {
      for (const opt of select.options) {
        opt.selected = opt.value === (this.#currentId ?? "");
      }
      this.#multiSelect?.update({ placeholder: t("common.field.customer", "Customer") });
    }
    queueMicrotask(() => { this.#programmatic = false; });
  }

  updated(changedProperties) {
    if (changedProperties.has("customers") && this.customers.length && !this.#multiSelect) {
      this.#initMultiSelect();
    } else if (changedProperties.has("selectedId") && this.#multiSelect) {
      this.#syncSelection();
    }
    if (changedProperties.has("invalid") && this.#multiSelect) {
      this.querySelector(".form-multi-select")?.classList.toggle("is-invalid", this.invalid);
    }
  }

  render() {
    return html`<div class="mb-3"><select name="customer-select" aria-label=${t("common.field.customer", "Customer")}></select></div>`;
  }
}

customElements.define("customer-select", CustomerSelect);
