import { LitElement, html } from "../../lib/lit.min.js";
import { subscribeLanguage, t } from "../translations.js";

let _rentalSelectUid = 0;

class RentalSelect extends LitElement {
  static properties = {
    rentals: { type: Array },
    selectedId: { type: String },
    defaultNone: { type: Boolean },
    invalid: { type: Boolean },
  };

  #selectId = `rental-select-${++_rentalSelectUid}`;

  constructor() {
    super();
    this.rentals = [];
    this.selectedId = null;
    this.defaultNone = false;
    this.invalid = false;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsubLang = subscribeLanguage(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubLang?.();
  }

  get value() {
    return this.querySelector("select")?.value ?? "";
  }

  render() {
    return html`
      <div class="form-floating mb-3">
        <select id=${this.#selectId} class=${`form-select${this.invalid ? " is-invalid" : ""}`}>
          ${this.defaultNone ? html`<option value="" .selected=${!this.selectedId}></option>` : ""}
          ${this.rentals.map(
            (rental) => html`
              <option value="${rental.Id}" .selected=${rental.Id === this.selectedId}>
                ${rental.Name}
              </option>
            `,
          )}
        </select>
        <label for=${this.#selectId}><i class="bi bi-house-door me-1"></i>${t("common.field.rental", "Rental")}</label>
      </div>
    `;
  }
}

customElements.define("rental-select", RentalSelect);
