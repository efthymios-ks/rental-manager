import { LitElement, html } from "../../lib/lit.min.js";

class CustomerSelect extends LitElement {
  static properties = {
    customers: { type: Array },
    selectedId: { type: String },
  };

  constructor() {
    super();
    this.customers = [];
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
          ${this.customers.map(
            (customer) => html`
              <option value="${customer.Id}" .selected=${customer.Id === this.selectedId}>
                ${customer.FullName}
              </option>
            `,
          )}
        </select>
        <label><i class="bi bi-person me-1"></i>Customer</label>
      </div>
    `;
  }
}

customElements.define("customer-select", CustomerSelect);
