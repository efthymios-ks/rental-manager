import { LitElement, html } from "../../lib/lit.min.js";
import { filterBar } from "../components/filterBar.js";
import "../components/rentalFilterDropdown.js";
import "../components/yearCheckboxDropdown.js";
import { state } from "../state.js";
import { subscribeLanguage, t } from "../translations.js";
import { computeSharedYears, defaultSharedYears } from "../utils.js";

class DashboardTab extends LitElement {
  static properties = {
    _years: { state: true },
    _selectedYears: { state: true },
    _summaries: { state: true },
    _missingVatCustomers: { state: true },
  };

  constructor() {
    super();
    this._years = [];
    this._selectedYears = null;
    this._summaries = [];
    this._missingVatCustomers = [];
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

  load() {
    const yearSummaries = window.api.computeDashboardSummaries();
    state.allDashboardSummaries = yearSummaries;

    if (state.sharedYears === null) {
      state.sharedYears = defaultSharedYears();
    }

    this._summaries = yearSummaries;
    this._years = computeSharedYears();
    this._selectedYears = state.sharedYears;
    const rentalById = Object.fromEntries(state.allRentals.map((r) => [r.Id, r.Name]));
    const rentalsByCustomer = {};
    for (const booking of state.allBookings) {
      if (!rentalsByCustomer[booking.CustomerId]) rentalsByCustomer[booking.CustomerId] = new Set();
      rentalsByCustomer[booking.CustomerId].add(rentalById[booking.RentalId]);
    }
    this._missingVatCustomers = state.allCustomers
      .filter((customer) => !customer.VatOrPassport && !customer.IgnoreMissingVat)
      .map((customer) => ({
        ...customer,
        rentalNames: [...(rentalsByCustomer[customer.Id] ?? [])].filter(Boolean),
      }));
    this.updateComplete.then(() => {
      this.querySelector("year-checkbox-dropdown")?.setSelected(state.sharedYears);
      this.querySelector("rental-filter-dropdown")?.setSelected(state.sharedRentalIds);
    });
  }

  #onYearChange(event) {
    state.sharedYears = event.target.selectedYears;
    this._selectedYears = state.sharedYears;
  }

  #onRentalChange(event) {
    state.sharedRentalIds = event.target.selectedIds;
    this.requestUpdate();
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
          <i class="bi bi-exclamation-triangle me-1"></i> ${t("dashboard.missingVat.title", "Customers Missing VAT / Passport")}
          (${this._missingVatCustomers.length})
        </div>
        <ul class="list-group list-group-flush">
          ${this._missingVatCustomers.map(
            (customer) => html`
              <li
                class="list-group-item d-flex justify-content-between align-items-start py-2"
              >
                <span class="d-flex flex-column">
                  <span class="fw-semibold">${customer.FullName}</span>
                  ${customer.rentalNames.length
                    ? html`<span class="small text-muted fst-italic">${customer.rentalNames.join(", ")}</span>`
                    : ""}
                </span>
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

  #aggregateRentals() {
    const activeYears = this._selectedYears;
    const activeRentalIds = state.sharedRentalIds;
    const selectedSummaries = activeYears
      ? this._summaries.filter((summary) => activeYears.includes(summary.year))
      : this._summaries;

    if (!selectedSummaries.length) {
      return null;
    }

    const rentalMap = new Map();
    selectedSummaries.forEach((summary) => {
      summary.rentals.forEach((rental) => {
        if (activeRentalIds !== null && !activeRentalIds.includes(rental.rentalId)) {
          return;
        }
        const existing = rentalMap.get(rental.rentalId) || {
          rentalId: rental.rentalId,
          rentalName: rental.rentalName,
          bookingCount: 0,
          totalDays: 0,
          totalIncome: 0,
          totalExpenses: 0,
        };
        existing.bookingCount += rental.bookingCount;
        existing.totalDays += rental.totalDays;
        existing.totalIncome += rental.totalIncome;
        existing.totalExpenses += rental.totalExpenses;
        rentalMap.set(rental.rentalId, existing);
      });
    });

    return Array.from(rentalMap.values());
  }

  #renderTotalsCard() {
    const aggregated = this.#aggregateRentals();
    if (!aggregated) {
      return html`<p class="text-muted p-3">${t("dashboard.totals.empty", "No data for this selection.")}</p>`;
    }

    let totalBookings = 0;
    let totalDays = 0;
    let totalIncome = 0;
    let totalExpenses = 0;
    aggregated.forEach((rentalSummary) => {
      totalBookings += rentalSummary.bookingCount;
      totalDays += rentalSummary.totalDays;
      totalIncome += rentalSummary.totalIncome;
      totalExpenses += rentalSummary.totalExpenses;
    });
    const totalDiff = totalIncome - totalExpenses;

    const rows = aggregated
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
            <td class="text-center text-success">${rental.totalIncome.toFixed(2)}€</td>
            <td class="text-center text-danger">${rental.totalExpenses.toFixed(2)}€</td>
            <td class="text-end fw-semibold ${diff >= 0 ? "text-success" : "text-danger"}">
              ${diff >= 0 ? "+" : ""}${diff.toFixed(2)}€
            </td>
          </tr>
        `;
      });

    return html`
      <div class="card-body">
        <div class="table-responsive rm-table-scroll">
          <table class="table table-sm table-striped rm-table rm-sticky-footer mb-0">
            <thead class="table-success">
              <tr>
                <th>${t("dashboard.totals.header.rental", "Rental")}</th>
                <th class="text-center">${t("dashboard.totals.header.bookings", "Bookings")}</th>
                <th class="text-center">${t("dashboard.totals.header.days", "Days")}</th>
                <th class="text-center">${t("dashboard.totals.header.income", "Income")}</th>
                <th class="text-center">${t("dashboard.totals.header.expenses", "Expenses")}</th>
                <th class="text-end">${t("dashboard.totals.header.difference", "Difference")}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot class="fw-bold">
              <tr>
                <td>${t("dashboard.totals.total", "Total")}</td>
                <td class="text-center">${totalBookings}</td>
                <td class="text-center">${totalDays}</td>
                <td class="text-center text-success">${totalIncome.toFixed(2)}€</td>
                <td class="text-center text-danger">${totalExpenses.toFixed(2)}€</td>
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
      ${filterBar(html`
        <year-checkbox-dropdown
          .years=${this._years}
          @change=${this.#onYearChange}
        ></year-checkbox-dropdown>
        <rental-filter-dropdown
          .rentals=${state.allRentals}
          @change=${this.#onRentalChange}
        ></rental-filter-dropdown>
      `)}
      ${this.#renderMissingVat()}
      <div class="row g-3 mt-0">
        <div class="col-12 col-md-6">
          <div class="card">
            <div class="card-header"><i class="bi bi-bar-chart-line me-1"></i> ${t("dashboard.totals.title", "Totals")}</div>
            ${this.#renderTotalsCard()}
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("dashboard-tab", DashboardTab);
