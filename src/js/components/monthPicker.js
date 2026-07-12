import { LitElement, html } from "../../lib/lit.min.js";
import { subscribeLanguage, getLanguage, t } from "../translations.js";

class MonthPicker extends LitElement {
  #datePicker = null;
  #currentMonth = null; // "YYYY-MM"

  createRenderRoot() {
    return this;
  }

  #toMonthStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  #formatDate = (date) =>
    new Intl.DateTimeFormat(getLanguage(), { month: "long", year: "numeric" }).format(date);

  #patchInputs() {
    const label = t("filter.month.placeholder", "Select month");
    this.querySelectorAll("input.date-picker-input").forEach((input, i) => {
      input.name = `month-picker-${i}`;
      input.setAttribute("aria-label", label);
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsubLang = subscribeLanguage(() => {
      this.#datePicker?.update({
        selectionType: "month",
        locale: getLanguage(),
        placeholder: t("filter.month.placeholder", "Select month"),
        date: this.#currentMonth,
        inputDateFormat: this.#formatDate,
        cleaner: false,
      });
      this.#patchInputs();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubLang?.();
    this.#datePicker?.dispose();
    this.#datePicker = null;
  }

  firstUpdated() {
    this.#currentMonth = this.#toMonthStr(new Date());

    const el = this.querySelector("div");
    el.setAttribute("data-coreui-input-read-only", "true");
    this.#datePicker = new coreui.DatePicker(el, {
      selectionType: "month",
      date: this.#currentMonth,
      locale: getLanguage(),
      placeholder: t("filter.month.placeholder", "Select month"),
      inputDateFormat: this.#formatDate,
      inputReadOnly: true,
      previewDateOnHover: false,
      cleaner: false,
      container: "body",
      size: "sm",
    });

    this.#patchInputs();

    el.addEventListener("dateChange.coreui.date-picker", (event) => {
      const raw = event.date;
      if (!raw) return;
      const str = raw instanceof Date ? this.#toMonthStr(raw) : String(raw);
      if (!/^\d{4}-\d{2}$/.test(str)) return;
      this.#currentMonth = str;
      const [year, month] = str.split("-").map(Number);
      this.dispatchEvent(new CustomEvent("change", {
        detail: { year, month: month - 1 },
        bubbles: true,
        composed: true,
      }));
    });
  }

  render() {
    return html`<div></div>`;
  }
}

customElements.define("month-picker", MonthPicker);
