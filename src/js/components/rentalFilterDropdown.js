import { LitElement, html } from "../../lib/lit.min.js";
import { subscribeLanguage } from "../translations.js";
import { formatRentalsLabel, initFixedStrategyDropdown } from "../utils.js";

class RentalFilterDropdown extends LitElement {
  static properties = {
    rentals: { type: Array },
    _checkedIds: { state: true },
  };

  constructor() {
    super();
    this.rentals = [];
    this._checkedIds = [];
    this._userInitialized = false;
  }

  createRenderRoot() {
    return this;
  }

  willUpdate(changedProperties) {
    if (
      changedProperties.has("rentals") &&
      this.rentals.length &&
      !this._userInitialized
    ) {
      this._checkedIds = this.rentals.map((rental) => rental.Id);
    }
  }

  setSelected(rentalIds) {
    this._userInitialized = true;
    this._checkedIds = rentalIds ? [...rentalIds] : this.rentals.map((rental) => rental.Id);
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

  get selectedIds() {
    return this._checkedIds.length === this.rentals.length ? null : this._checkedIds;
  }

  get #label() {
    const selected = this.rentals.filter((rental) => this._checkedIds.includes(rental.Id));
    return formatRentalsLabel(selected, this.rentals.length);
  }

  #handleChange(rentalId, checked) {
    this._checkedIds = checked
      ? [...this._checkedIds, rentalId]
      : this._checkedIds.filter((checkedId) => checkedId !== rentalId);
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
        <ul class="dropdown-menu p-2" style="min-width:160px">
          ${this.rentals.map(
            (rental) => html`
              <li>
                <label
                  class="dropdown-item d-flex gap-2 align-items-center"
                  style="cursor:pointer"
                >
                  <input
                    type="checkbox"
                    .checked=${this._checkedIds.includes(rental.Id)}
                    @change=${(event) => { event.stopPropagation(); this.#handleChange(rental.Id, event.target.checked); }}
                  />${rental.Name}
                </label>
              </li>
            `,
          )}
        </ul>
      </div>
    `;
  }
}

customElements.define("rental-filter-dropdown", RentalFilterDropdown);
