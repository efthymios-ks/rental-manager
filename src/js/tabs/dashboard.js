import { LitElement, html } from "../../lib/lit.min.js";
import { state } from "../state.js";
import "../components/calendar.js";

class DashboardTab extends LitElement {
  static properties = {
    _years: { state: true },
    _selectedYear: { state: true },
    _summaries: { state: true },
    _missingVatCustomers: { state: true },
  };

  constructor() {
    super();
    this._years = [];
    this._selectedYear = "";
    this._summaries = [];
    this._missingVatCustomers = [];
  }

  createRenderRoot() {
    return this;
  }

  load() {
    const yearSummaries = window.api.computeDashboardSummaries();
    state.allDashboardSummaries = yearSummaries;

    const years = yearSummaries
      .map((summary) => summary.year)
      .sort((yearA, yearB) => yearB.localeCompare(yearA));
    if (years.length && !years.includes(state.selectedDashboardYear)) {
      state.selectedDashboardYear = years[0];
    }

    this._summaries = yearSummaries;
    this._years = years;
    this._selectedYear = state.selectedDashboardYear;
    this._missingVatCustomers = state.allCustomers.filter(
      (customer) => !customer.VatOrPassport && !customer.IgnoreMissingVat,
    );
    this.updateComplete.then(() => {
      this.querySelector("calendar-tab")?.load();
    });
  }

  #onYearChange(event) {
    this._selectedYear = event.target.value;
    state.selectedDashboardYear = this._selectedYear;
  }

  #copyPhone(phone) {
    navigator.clipboard.writeText(phone).catch(() => {
      const textArea = document.createElement("textarea");
      textArea.value = phone;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    });
  }

  #renderMissingVat() {
    if (!this._missingVatCustomers.length) {
      return "";
    }

    return html`
      <div class="card border-warning mb-3">
        <div class="card-header bg-warning text-dark fw-semibold">
          <i class="bi bi-exclamation-triangle me-1"></i> Customers Missing VAT / Passport
          (${this._missingVatCustomers.length})
        </div>
        <ul class="list-group list-group-flush">
          ${this._missingVatCustomers.map(
            (customer) => html`
              <li
                class="list-group-item d-flex justify-content-between align-items-center py-2"
              >
                <span class="fw-semibold">${customer.FullName}</span>
                ${customer.PhoneNumber
                  ? html`
                      <span class="small text-muted d-flex align-items-center gap-1">
                        <i class="bi bi-telephone"></i>${customer.PhoneNumber}
                        <button
                          class="btn btn-outline-secondary copy-phone-btn ms-1"
                          @click=${() => this.#copyPhone(customer.PhoneNumber)}
                          title="Copy phone"
                        >
                          <i class="bi bi-clipboard"></i>
                        </button>
                      </span>
                    `
                  : html`<span class="small text-muted fst-italic">No phone</span>`}
              </li>
            `,
          )}
        </ul>
      </div>
    `;
  }

  #renderTotalsCard() {
    const yearData = this._summaries.find((summary) => summary.year === this._selectedYear);
    if (!yearData) {
      return html`<p class="text-muted p-3">No data for this year.</p>`;
    }

    let totalBookings = 0;
    let totalDays = 0;
    let totalIncome = 0;
    let totalExpenses = 0;
    yearData.rentals.forEach((rentalSummary) => {
      totalBookings += rentalSummary.bookingCount;
      totalDays += rentalSummary.totalDays;
      totalIncome += rentalSummary.totalIncome;
      totalExpenses += rentalSummary.totalExpenses;
    });
    const totalDiff = totalIncome - totalExpenses;

    const rows = yearData.rentals
      .filter(
        (rental) =>
          rental.bookingCount > 0 || rental.totalIncome > 0 || rental.totalExpenses > 0,
      )
      .map((rental) => {
        const diff = rental.totalIncome - rental.totalExpenses;
        return html`
          <tr>
            <td class="fw-semibold">${rental.rentalName}</td>
            <td class="text-center">${rental.bookingCount}</td>
            <td class="text-center">${rental.totalDays}</td>
            <td class="text-end text-success">${rental.totalIncome.toFixed(2)}€</td>
            <td class="text-end text-danger">${rental.totalExpenses.toFixed(2)}€</td>
            <td class="text-end fw-semibold ${diff >= 0 ? "text-success" : "text-danger"}">
              ${diff >= 0 ? "+" : ""}${diff.toFixed(2)}€
            </td>
          </tr>
        `;
      });

    return html`
      <div class="card-body">
        <div class="table-responsive">
          <table class="table table-sm table-borderless mb-0">
            <thead class="table-light">
              <tr>
                <th>Rental</th>
                <th class="text-center">Bookings</th>
                <th class="text-center">Days</th>
                <th class="text-end">Income</th>
                <th class="text-end">Expenses</th>
                <th class="text-end">Difference</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot class="table-light fw-bold">
              <tr>
                <td>Total</td>
                <td class="text-center">${totalBookings}</td>
                <td class="text-center">${totalDays}</td>
                <td class="text-end text-success">${totalIncome.toFixed(2)}€</td>
                <td class="text-end text-danger">${totalExpenses.toFixed(2)}€</td>
                <td class="text-end ${totalDiff >= 0 ? "text-success" : "text-danger"}">
                  ${totalDiff >= 0 ? "+" : ""}${totalDiff.toFixed(2)}€
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      ${this.#renderMissingVat()}
      <calendar-tab></calendar-tab>
      <div class="row g-3 mt-0">
        <div class="col-12 col-md-6">
          <div class="card">
            <div class="card-header"><i class="bi bi-bar-chart-line me-1"></i> Totals</div>
            <div class="card-body border-bottom py-3">
              <div class="d-flex flex-wrap gap-2 justify-content-center align-items-center">
                <select
                  class="form-select form-select-sm w-auto"
                  @change=${this.#onYearChange}
                >
                  ${this._years.map(
                    (year) => html`
                      <option value="${year}" .selected=${year === this._selectedYear}>
                        ${year}
                      </option>
                    `,
                  )}
                </select>
              </div>
            </div>
            ${this.#renderTotalsCard()}
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("dashboard-tab", DashboardTab);
