import { LitElement, html } from "../../lib/lit.min.js";
import { filterBar } from "../components/filterBar.js";
import "../components/rentalsMultiSelect.js";
import "../components/yearMultiSelect.js";
import { state } from "../state.js";
import { subscribeLanguage, t } from "../translations.js";
import { computeSharedYears, defaultSharedYears } from "../utils.js";

class DashboardTab extends LitElement {
  static properties = {
    _years: { state: true },
    _selectedYears: { state: true },
    _summaries: { state: true },
    _missingVatCustomers: { state: true },
    _editingCustomer: { state: true },
    _editingSaving: { state: true },
  };

  constructor() {
    super();
    this._years = [];
    this._selectedYears = null;
    this._summaries = [];
    this._missingVatCustomers = [];
    this._editingCustomer = null;
    this._editingSaving = false;
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

  #openVatModal(customer) {
    this._editingCustomer = customer;
    this._editingSaving = false;
    const modal = coreui.Modal.getOrCreateInstance(this.querySelector("#addVatModal"));
    modal.show();
    this.updateComplete.then(() => {
      const input = this.querySelector("#vatInput");
      if (input) { input.value = ""; input.focus(); }
    });
  }

  async #saveVat() {
    const customer = this._editingCustomer;
    const value = this.querySelector("#vatInput")?.value?.trim();
    if (!value) return;
    const btn = this.querySelector("#addVatSaveBtn");
    const lb = coreui.LoadingButton.getInstance(btn) ?? new coreui.LoadingButton(btn, { disabledOnLoading: true });
    this._editingSaving = true;
    lb.start();
    try {
      await window.api.updateCustomer(customer.Id, {
        FullName: customer.FullName,
        VatOrPassport: value,
        PhoneNumber: customer.PhoneNumber || "",
        Rating: customer.Rating || 0,
        Notes: customer.Notes || "",
        IgnoreMissingVat: customer.IgnoreMissingVat || false,
      });
      coreui.Modal.getInstance(this.querySelector("#addVatModal"))?.hide();
      await window.api.loadAll();
      window.refreshCurrentTab();
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      lb.stop();
      this._editingSaving = false;
    }
  }

  #renderVatModal() {
    const customer = this._editingCustomer;
    return html`
      <div class="modal fade" data-coreui-backdrop="static" data-coreui-keyboard="false" id="addVatModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-card-text me-2"></i>${t("dashboard.missingVat.modal.title", "Add VAT / Passport")}</h5>
            </div>
            <div class="modal-body">
              ${customer ? html`<p class="mb-2 fw-semibold">${customer.FullName}</p>` : ""}
              <input
                type="text"
                id="vatInput"
                class="form-control"
                aria-label=${t("dashboard.missingVat.placeholder", "VAT / Passport number")}
                placeholder=${t("dashboard.missingVat.placeholder", "VAT / Passport number")}
                ?disabled=${this._editingSaving}
                @keydown=${(e) => { if (e.key === "Enter") this.#saveVat(); }}
              />
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-coreui-dismiss="modal" ?disabled=${this._editingSaving}>${t("common.cancel", "Cancel")}</button>
              <button class="btn btn-success" id="addVatSaveBtn" @click=${() => this.#saveVat()}>
                <i class="bi bi-check-lg me-1"></i>${t("common.save", "Save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
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
          ${this._missingVatCustomers.map((customer) => html`
            <li class="list-group-item d-flex justify-content-between align-items-center py-2">
              <span class="d-flex flex-column">
                <span class="fw-semibold">${customer.FullName}</span>
                ${customer.rentalNames.length
                  ? html`<span class="small text-muted fst-italic">${customer.rentalNames.join(", ")}</span>`
                  : ""}
              </span>
              <span class="d-flex align-items-center gap-2">
                ${customer.PhoneNumber
                  ? html`<span class="small text-muted"><i class="bi bi-telephone me-1"></i>${customer.PhoneNumber}</span>`
                  : ""}
                <button
                  class="btn btn-sm btn-outline-success"
                  @click=${() => this.#openVatModal(customer)}
                  title=${t("dashboard.missingVat.addVat", "Add VAT / Passport")}
                ><i class="bi bi-plus-lg"></i></button>
              </span>
            </li>
          `)}
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
        <div class="flex-shrink-0"><year-checkbox-dropdown
          .years=${this._years}
          @change=${this.#onYearChange}
        ></year-checkbox-dropdown></div>
        <div class="flex-shrink-0"><rental-filter-dropdown
          .rentals=${state.allRentals}
          @change=${this.#onRentalChange}
        ></rental-filter-dropdown></div>
      `)}
      ${this.#renderMissingVat()}
      ${this.#renderVatModal()}
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
