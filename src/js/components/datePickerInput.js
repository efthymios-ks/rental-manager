import { LitElement, html } from "../../lib/lit.min.js";
import { getLanguage, subscribeLanguage, t } from "../translations.js";

const toDisplayDate = (date) => {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
};

const fromDisplayDate = (str) => {
  const [d, m, y] = String(str).split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
};

class DatePickerInput extends LitElement {
  #picker = null;
  #value = "";

  get value() {
    return this.#value;
  }

  #dateOrNull() {
    return this.#value ? new Date(this.#value + "T00:00:00") : null;
  }

  #formatOptions() {
    return {
      date: this.#dateOrNull(),
      inputDateFormat: toDisplayDate,
      inputDateParse: fromDisplayDate,
      locale: getLanguage(),
      placeholder: t("common.selectDate", "Select date"),
    };
  }

  set value(v) {
    this.#value = v || "";
    if (this.#picker) {
      this.#picker.update(this.#formatOptions());
      this.#patchInputs();
    }
  }

  #patchInputs() {
    const label = t("common.selectDate", "Select date");
    this.querySelectorAll("input.date-picker-input").forEach((input, i) => {
      input.name = `date-picker-${i}`;
      input.setAttribute("aria-label", label);
    });
  }

  createRenderRoot() {
    return this;
  }

  firstUpdated() {
    const el = this.querySelector("div");
    el.setAttribute("data-coreui-input-read-only", "true");
    this.#picker = new coreui.DatePicker(el, {
      ...this.#formatOptions(),
      inputReadOnly: true,
      previewDateOnHover: false,
      cleaner: false,
      container: "body",
    });

    this.#patchInputs();

    el.addEventListener("dateChange.coreui.date-picker", (e) => {
      const date = e.date;
      if (date instanceof Date && !isNaN(date)) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        this.#value = `${y}-${m}-${d}`;
      } else {
        this.#value = "";
      }
      this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsubLang = subscribeLanguage(() => {
      this.#picker?.update(this.#formatOptions());
      this.#patchInputs();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubLang?.();
    this.#picker?.dispose();
    this.#picker = null;
  }

  render() {
    return html`<div></div>`;
  }
}

customElements.define("date-picker-input", DatePickerInput);
