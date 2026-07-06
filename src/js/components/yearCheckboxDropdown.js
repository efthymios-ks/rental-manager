import { LitElement, html } from "../../lib/lit.min.js";
import { subscribeLanguage, t } from "../translations.js";
import { initFixedStrategyDropdown } from "../utils.js";

class YearCheckboxDropdown extends LitElement {
  static properties = {
    years: { type: Array },
    defaultAll: { type: Boolean },
    _checkedYears: { state: true },
  };

  constructor() {
    super();
    this.years = [];
    this.defaultAll = false;
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
      if (this.defaultAll) {
        this._checkedYears = [...this.years];
      } else {
        const currentYear = String(new Date().getFullYear());
        const defaultYear = this.years.includes(currentYear) ? currentYear : this.years[0];
        this._checkedYears = [defaultYear];
      }
    }
  }

  setSelected(years) {
    this._userInitialized = true;
    this._checkedYears = years ? [...years] : [...this.years];
  }

  firstUpdated() {
    initFixedStrategyDropdown(this);
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsubLang = subscribeLanguage(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubLang?.();
  }

  get selectedYears() {
    return this._checkedYears.length === this.years.length ? null : this._checkedYears;
  }

  get #label() {
    const count = this._checkedYears.length;
    if (count === this.years.length) {
      return t("filter.year.all", "All Years");
    }

    if (count === 0) {
      return t("filter.year.none", "No Years");
    }

    if (count <= 2) {
      return [...this._checkedYears].sort().join(", ");
    }

    return t("filter.year.n", `${count} Years`, { n: count });
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
