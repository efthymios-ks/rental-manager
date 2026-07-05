import { LitElement, html } from "../../lib/lit.min.js";
import { initFixedStrategyDropdown } from "../utils.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

class MonthPicker extends LitElement {
  static properties = {
    years: { type: Array },
    year: { type: Number },
    month: { type: Number },
  };

  constructor() {
    super();
    this.years = [];
    this.year = new Date().getFullYear();
    this.month = new Date().getMonth();
  }

  createRenderRoot() {
    return this;
  }

  firstUpdated() {
    initFixedStrategyDropdown(this);
  }

  #emitChange() {
    this.dispatchEvent(new CustomEvent("change", {
      detail: { year: this.year, month: this.month },
      bubbles: true,
      composed: true,
    }));
  }

  #selectYear(year, event) {
    event.stopPropagation();
    this.year = year;
    this.#emitChange();
  }

  #selectMonth(month, event) {
    event.stopPropagation();
    this.month = month;
    this.#emitChange();
  }

  render() {
    return html`
      <div class="dropdown">
        <button
          class="btn btn-outline-secondary btn-sm dropdown-toggle"
          type="button"
          data-bs-toggle="dropdown"
          data-bs-auto-close="outside"
        >
          ${MONTH_NAMES[this.month]} ${this.year}
        </button>
        <div class="dropdown-menu p-2" style="min-width: 260px">
          <div class="d-flex gap-2">
            <div class="flex-fill">
              <div class="text-muted small mb-1 fw-semibold text-uppercase">Year</div>
              <div style="max-height: 200px; overflow-y: auto">
                ${this.years.map(
                  (year) => html`
                    <button
                      type="button"
                      class="dropdown-item ${year === this.year ? "active" : ""}"
                      @click=${(event) => this.#selectYear(year, event)}
                    >${year}</button>
                  `,
                )}
              </div>
            </div>
            <div class="flex-fill">
              <div class="text-muted small mb-1 fw-semibold text-uppercase">Month</div>
              <div style="max-height: 200px; overflow-y: auto">
                ${MONTH_NAMES.map(
                  (name, idx) => html`
                    <button
                      type="button"
                      class="dropdown-item ${idx === this.month ? "active" : ""}"
                      @click=${(event) => this.#selectMonth(idx, event)}
                    >${name}</button>
                  `,
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("month-picker", MonthPicker);
