import { LitElement, html } from "../../lib/lit.min.js";
import "../components/rentalFilterDropdown.js";
import { state } from "../state.js";

class ExportTab extends LitElement {
  static properties = {
    _filteredBookings: { state: true },
  };

  #fromDate = "";
  #toDate = "";
  #selectedRentalIds = null;

  constructor() {
    super();
    this._filteredBookings = [];
  }

  createRenderRoot() {
    return this;
  }

  load() {
    const currentYear = new Date().getFullYear();
    this.#fromDate = `${currentYear}-01-01`;
    this.#toDate = `${currentYear}-12-31`;
    this.#selectedRentalIds = null;
    state.exportBookings = state.allBookings;
    this.#applyFilters();
    this.updateComplete.then(() => {
      this.querySelector("#exportFrom").value = this.#fromDate;
      this.querySelector("#exportTo").value = this.#toDate;
    });
  }

  #applyFilters() {
    this._filteredBookings = state.exportBookings.filter((booking) => {
      if (booking.OffRecord) {
        return false;
      }

      if (this.#selectedRentalIds !== null && !this.#selectedRentalIds.includes(booking.RentalId)) {
        return false;
      }

      if (this.#fromDate && booking.ArrivalDate < this.#fromDate) {
        return false;
      }

      if (this.#toDate && booking.ArrivalDate > this.#toDate) {
        return false;
      }

      return true;
    });
  }

  #onFromChange(event) {
    this.#fromDate = event.target.value;
    this.#applyFilters();
  }

  #onToChange(event) {
    this.#toDate = event.target.value;
    this.#applyFilters();
  }

  #onRentalChange(event) {
    this.#selectedRentalIds = event.target.selectedIds;
    this.#applyFilters();
  }

  #downloadXlsx() {
    const bookings = this._filteredBookings;
    if (!bookings.length) {
      return;
    }

    const headers = ["Πελάτης", "ΑΦΜ / ΑΔ", "Κατοικία", "Έσοδα", "Άφιξη", "Αναχώρηση", "Μέρες"];
    const dataRows = bookings.map((booking) => {
      const customer = booking.customer || {};
      return [
        customer.FullName || "",
        String(customer.VatOrPassport || ""),
        (booking.rental && booking.rental.Name) || "",
        parseFloat(booking.AmountEuros) || 0,
        booking.ArrivalDate || "",
        booking.DepartureDate || "",
        booking.DurationDays || 0,
      ];
    });
    const worksheet = XLSX.utils.aoa_to_sheet([headers].concat(dataRows));
    worksheet["!cols"] = [30, 16, 16, 10, 12, 12, 8].map((wch) => ({ wch }));
    const cellRange = XLSX.utils.decode_range(worksheet["!ref"]);
    for (let rowIndex = cellRange.s.r; rowIndex <= cellRange.e.r; rowIndex++) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: 1 });
      if (!worksheet[cellAddress]) {
        continue;
      }

      worksheet[cellAddress].t = "s";
      worksheet[cellAddress].v = String(worksheet[cellAddress].v || "");
      delete worksheet[cellAddress].z;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bookings");
    XLSX.writeFile(workbook, `bookings_${this.#fromDate || "export"}_${this.#toDate || ""}.xlsx`);
  }

  #renderSummaryCards() {
    const bookings = this._filteredBookings;
    const totalRevenue = bookings.reduce((sum, b) => sum + (parseFloat(b.AmountEuros) || 0), 0);
    return html`
      <div class="row g-3 p-3 border-bottom">
        <div class="col-6 col-lg">
          <div class="rounded-3 p-3 bg-primary bg-opacity-10 h-100 text-center">
            <div class="text-uppercase small fw-semibold text-muted">Total Bookings</div>
            <div class="fs-4 fw-bold text-primary">${bookings.length}</div>
          </div>
        </div>
        <div class="col-6 col-lg">
          <div class="rounded-3 p-3 bg-success bg-opacity-10 h-100 text-center">
            <div class="text-uppercase small fw-semibold text-muted">Total Revenue</div>
            <div class="fs-4 fw-bold text-success">${totalRevenue.toFixed(2)}€</div>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    const previewContent = this._filteredBookings.length
      ? html`
          <!-- Desktop layout -->
          <div class="table-responsive d-none d-md-block">
            <table class="table table-sm table-bordered table-hover text-center align-middle">
              <thead class="table-light fw-bold">
                <tr>
                  <th>Πελάτης</th><th>ΑΦΜ / ΑΔ</th><th>Κατοικία</th>
                  <th>Έσοδα</th><th>Άφιξη</th><th>Αναχώρηση</th><th>Μέρες</th>
                </tr>
              </thead>
              <tbody>
                ${this._filteredBookings.map((booking) => {
                  const customer = booking.customer || {};
                  return html`
                    <tr>
                      <td>${customer.FullName || "—"}</td>
                      <td>${String(customer.VatOrPassport || "—")}</td>
                      <td>${(booking.rental && booking.rental.Name) || "—"}</td>
                      <td>${parseFloat(booking.AmountEuros).toFixed(2)}€</td>
                      <td>${booking.ArrivalDate}</td>
                      <td>${booking.DepartureDate}</td>
                      <td>${booking.DurationDays}</td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </div>

          <!-- Mobile layout -->
          <div class="d-md-none d-flex flex-column gap-2 p-2">
            ${this._filteredBookings.map((booking) => {
              const customer = booking.customer || {};
              return html`
                <div class="card border rounded-3 px-3 pt-3 pb-2">
                  <div class="mb-2">
                    ${booking.rental ? html`<span class="badge bg-secondary">${booking.rental.Name}</span>` : ""}
                  </div>
                  <div class="fw-semibold mb-1">${customer.FullName || "—"}</div>
                  ${customer.VatOrPassport
                    ? html`<div class="text-muted small mb-1"><i class="bi bi-card-text me-1"></i>${String(customer.VatOrPassport)}</div>`
                    : ""}
                  <div class="text-muted small mb-1">
                    <i class="bi bi-calendar2-arrow me-1"></i>${booking.ArrivalDate} → ${booking.DepartureDate}
                  </div>
                  <div class="d-flex justify-content-between align-items-center">
                    <span class="badge bg-light text-dark border">${booking.DurationDays} day${booking.DurationDays !== 1 ? "s" : ""}</span>
                    <span class="fw-bold">${parseFloat(booking.AmountEuros).toFixed(2)}€</span>
                  </div>
                </div>
              `;
            })}
          </div>
        `
      : html`<p class="text-muted p-3">No bookings for this range.</p>`;

    return html`
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-download me-1"></i> Export</span>
          <button
            class="btn btn-success btn-sm"
            @click=${this.#downloadXlsx}
            ?disabled=${!this._filteredBookings.length}
          >
            <i class="bi bi-download me-1"></i>Download .xlsx
          </button>
        </div>
        ${this.#renderSummaryCards()}
        <div class="card-body border-bottom py-3">
          <div class="d-flex flex-wrap gap-2 justify-content-center align-items-center">
            <div class="form-floating" style="max-width: 180px">
              <input
                type="date"
                id="exportFrom"
                class="form-control form-control-sm"
                placeholder="From"
                @input=${this.#onFromChange}
              />
              <label>From</label>
            </div>
            <div class="form-floating" style="max-width: 180px">
              <input
                type="date"
                id="exportTo"
                class="form-control form-control-sm"
                placeholder="To"
                @input=${this.#onToChange}
              />
              <label>To</label>
            </div>
            <rental-filter-dropdown
              .rentals=${state.allRentals}
              @change=${this.#onRentalChange}
            ></rental-filter-dropdown>
          </div>
        </div>
        <div>${previewContent}</div>
      </div>
    `;
  }
}

customElements.define("export-tab", ExportTab);
