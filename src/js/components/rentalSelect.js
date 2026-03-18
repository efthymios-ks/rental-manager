import { LitElement, html } from "../../lib/lit.min.js";

class RentalSelect extends LitElement {
  static properties = {
    rentals: { type: Array },
    selectedId: { type: String },
  };

  constructor() {
    super();
    this.rentals = [];
    this.selectedId = null;
  }

  createRenderRoot() {
    return this;
  }

  get value() {
    return this.querySelector("select")?.value ?? "";
  }

  render() {
    return html`
      <div class="form-floating mb-3">
        <select class="form-select">
          ${this.rentals.map(
            (rental) => html`
              <option value="${rental.Id}" .selected=${rental.Id === this.selectedId}>
                ${rental.Name}
              </option>
            `,
          )}
        </select>
        <label><i class="bi bi-house-door me-1"></i>Rental</label>
      </div>
    `;
  }
}

customElements.define("rental-select", RentalSelect);
