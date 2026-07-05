import { LitElement, html } from "../../lib/lit.min.js";
import { filterBar } from "../components/filterBar.js";
import "../components/rentalFilterDropdown.js";
import { state } from "../state.js";

class ExportTab extends LitElement {
  static properties = {
    _filteredBookings: { state: true },
  };

  #fromDate = "";
  #toDate = "";

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
    state.exportBookings = state.allBookings;
    this.#applyFilters();
    this.updateComplete.then(() => {
      this.querySelector("#exportFrom").value = this.#fromDate;
      this.querySelector("#exportTo").value = this.#toDate;
      this.querySelector("rental-filter-dropdown")?.setSelected(state.sharedRentalIds);
    });
  }

  #applyFilters() {
    const selectedRentalIds = state.sharedRentalIds;
    this._filteredBookings = state.exportBookings.filter((booking) => {
      if (booking.OffRecord) {
        return false;
      }

      if (selectedRentalIds !== null && !selectedRentalIds.includes(booking.RentalId)) {
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
    state.sharedRentalIds = event.target.selectedIds;
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

  render() {
    const previewContent = this._filteredBookings.length
      ? html`
          <div class="table-responsive rm-table-scroll">
            <table class="table table-sm table-striped table-hover rm-table rm-sticky-footer mb-0">
              <thead class="table-success">
                <tr>
                  <th class="text-center">Πελάτης</th>
                  <th class="text-center">ΑΦΜ / ΑΔ</th>
                  <th class="text-center">Κατοικία</th>
                  <th class="text-center">Έσοδα</th>
                  <th class="text-center">Άφιξη</th>
                  <th class="text-center">Αναχώρηση</th>
                  <th class="text-center">Μέρες</th>
                </tr>
              </thead>
              <tbody>
                ${this._filteredBookings.map((booking) => {
                  const customer = booking.customer || {};
                  return html`
                    <tr>
                      <td class="text-center">${customer.FullName || "—"}</td>
                      <td class="text-center">${String(customer.VatOrPassport || "—")}</td>
                      <td class="text-center">${(booking.rental && booking.rental.Name) || "—"}</td>
                      <td class="text-center">${parseFloat(booking.AmountEuros).toFixed(2)}€</td>
                      <td class="text-center">${booking.ArrivalDate}</td>
                      <td class="text-center">${booking.DepartureDate}</td>
                      <td class="text-center">${booking.DurationDays}</td>
                    </tr>
                  `;
                })}
              </tbody>
              <tfoot class="fw-bold">
                <tr>
                  <td class="text-center">Total (${this._filteredBookings.length})</td>
                  <td class="text-center"></td>
                  <td class="text-center"></td>
                  <td class="text-center"></td>
                  <td class="text-center"></td>
                  <td class="text-center"></td>
                  <td class="text-center"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        `
      : html`<p class="text-muted p-3">No bookings for this range.</p>`;

    return html`
      ${filterBar(html`
        <div class="form-floating" style="width: 160px">
          <input
            type="date"
            id="exportFrom"
            class="form-control form-control-sm"
            placeholder="From"
            @input=${this.#onFromChange}
          />
          <label>From</label>
        </div>
        <div class="form-floating" style="width: 160px">
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
      `)}
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
        <div>${previewContent}</div>
      </div>
    `;
  }
}

customElements.define("export-tab", ExportTab);
