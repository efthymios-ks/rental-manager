import { LitElement, html } from "../../lib/lit.min.js";

class RentalCheckboxes extends LitElement {
  static properties = {
    rentals: { type: Array },
    initialIds: { type: Array },
    _checkedIds: { state: true },
  };

  constructor() {
    super();
    this.rentals = [];
    this.initialIds = null;
    this._checkedIds = [];
  }

  createRenderRoot() {
    return this;
  }

  willUpdate(changedProperties) {
    if (changedProperties.has("rentals") || changedProperties.has("initialIds")) {
      const allSelected = !this.initialIds || this.initialIds.length === 0;
      this._checkedIds = allSelected ? this.rentals.map((rental) => rental.Id) : [...this.initialIds];
    }
  }

  get selectedIds() {
    return this._checkedIds;
  }

  get #label() {
    if (this._checkedIds.length === this.rentals.length) {
      return "All Rentals";
    }

    if (this._checkedIds.length === 0) {
      return "No Rentals";
    }

    return this.rentals
      .filter((rental) => this._checkedIds.includes(rental.Id))
      .map((rental) => rental.Name)
      .join(", ");
  }

  #handleChange(rentalId, checked) {
    this._checkedIds = checked
      ? [...this._checkedIds, rentalId]
      : this._checkedIds.filter((checkedId) => checkedId !== rentalId);
  }

  render() {
    return html`
      <div class="dropdown">
        <button
          class="btn btn-outline-secondary w-100 text-start dropdown-toggle"
          type="button"
          data-bs-toggle="dropdown"
          data-bs-auto-close="outside"
        >
          ${this.#label}
        </button>
        <ul class="dropdown-menu p-2 w-100">
          ${this.rentals.map(
            (rental) => html`
              <li>
                <label
                  class="dropdown-item d-flex gap-2 align-items-center"
                  style="cursor:pointer"
                >
                  <input
                    class="form-check-input"
                    type="checkbox"
                    .checked=${this._checkedIds.includes(rental.Id)}
                    @change=${(event) => this.#handleChange(rental.Id, event.target.checked)}
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

customElements.define("rental-checkboxes", RentalCheckboxes);
