import { LitElement, html } from "../../lib/lit.min.js";
import { getLanguage } from "../translations.js";

const toDisplayDate = (date) => {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
};

class DatePickerInput extends LitElement {
  #picker = null;
  #value = "";

  get value() {
    return this.#value;
  }

  set value(v) {
    this.#value = v || "";
    if (this.#picker) {
      this.#picker.update({ date: this.#value ? new Date(this.#value + "T00:00:00") : null });
    }
  }

  createRenderRoot() {
    return this;
  }

  firstUpdated() {
    const el = this.querySelector("div");
    el.setAttribute("data-coreui-input-read-only", "true");
    this.#picker = new coreui.DatePicker(el, {
      date: this.#value ? new Date(this.#value + "T00:00:00") : null,
      inputDateFormat: toDisplayDate,
      inputReadOnly: true,
      previewDateOnHover: false,
      locale: getLanguage(),
      cleaner: false,
      container: "body",
    });

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

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#picker?.dispose();
    this.#picker = null;
  }

  render() {
    return html`<div></div>`;
  }
}

customElements.define("date-picker-input", DatePickerInput);
