import { LitElement, html } from "../../lib/lit.min.js";
import { initFixedStrategyDropdown } from "../utils.js";

class YearCheckboxDropdown extends LitElement {
  static properties = {
    years: { type: Array },
    _checkedYears: { state: true },
  };

  constructor() {
    super();
    this.years = [];
    this._checkedYears = [];
    this._userInitialized = false;
  }

  createRenderRoot() {
    return this;
  }

  willUpdate(changedProperties) {
    if (
      changedProperties.has("years") &&
      this.years.length &&
      !this._userInitialized
    ) {
      const currentYear = String(new Date().getFullYear());
      const defaultYear = this.years.includes(currentYear) ? currentYear : this.years[0];
      this._checkedYears = [defaultYear];
    }
  }

  setSelected(years) {
    this._userInitialized = true;
    this._checkedYears = years ? [...years] : [...this.years];
  }

  firstUpdated() {
    initFixedStrategyDropdown(this);
  }

  get selectedYears() {
    return this._checkedYears.length === this.years.length ? null : this._checkedYears;
  }

  get #label() {
    const count = this._checkedYears.length;
    if (count === this.years.length) {
      return "All Years";
    }

    if (count === 0) {
      return "No Years";
    }

    if (count <= 2) {
      return [...this._checkedYears].sort().join(", ");
    }

    return `${count} Years`;
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
