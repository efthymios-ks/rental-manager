import { LitElement, html } from "../../lib/lit.min.js";

export function extractYearsFromItems(items, dateField) {
  const yearSet = new Set();
  items.forEach((item) => {
    const fieldValue = item[dateField];
    if (fieldValue) {
      const yearString = String(fieldValue).substring(0, 4);
      if (/^\d{4}$/.test(yearString)) {
        yearSet.add(yearString);
      }
    }
  });
  return Array.from(yearSet)
    .map(Number)
    .sort((yearA, yearB) => yearB - yearA)
    .map(String);
}

class YearCheckboxDropdown extends LitElement {
  static properties = {
    years: { type: Array },
    _checkedYears: { state: true },
  };

  constructor() {
    super();
    this.years = [];
    this._checkedYears = [];
  }

  createRenderRoot() {
    return this;
  }

  willUpdate(changedProperties) {
    if (changedProperties.has("years") && this.years.length) {
      const currentYear = String(new Date().getFullYear());
      const defaultYear = this.years.includes(currentYear) ? currentYear : this.years[0];
      this._checkedYears = [defaultYear];
    }
  }

  get selectedYears() {
    return this._checkedYears.length === this.years.length ? null : this._checkedYears;
  }

  get #label() {
    if (this._checkedYears.length === this.years.length) {
      return "All Years";
    }

    if (this._checkedYears.length === 0) {
      return "No Years";
    }

    return this._checkedYears.join(", ");
  }

  #handleChange(year, checked) {
    this._checkedYears = checked
      ? [...this._checkedYears, year]
      : this._checkedYears.filter((checkedYear) => checkedYear !== year);

    this.dispatchEvent(new CustomEvent("change", { bubbles: true, composed: true }));
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
          ${this.#label}
        </button>
        <ul class="dropdown-menu p-2" style="min-width:120px">
          ${this.years.map(
            (year) => html`
              <li>
                <label class="dropdown-item d-flex gap-2 align-items-center" style="cursor:pointer">
                  <input
                    type="checkbox"
                    .checked=${this._checkedYears.includes(year)}
                    @change=${(event) => { event.stopPropagation(); this.#handleChange(year, event.target.checked); }}
                  />${year}
                </label>
              </li>
            `,
          )}
        </ul>
      </div>
    `;
  }
}

customElements.define("year-checkbox-dropdown", YearCheckboxDropdown);
