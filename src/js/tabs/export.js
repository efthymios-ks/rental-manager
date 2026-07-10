import { LitElement, html } from "../../lib/lit.min.js";
import { filterBar } from "../components/filterBar.js";
import "../components/rentalFilterDropdown.js";
import { state } from "../state.js";
import { subscribeLanguage, t } from "../translations.js";

class ExportTab extends LitElement {
  static properties = {
    _filteredBookings: { state: true },
  };

  #fromDate = "";
  #toDate = "";
  #selectedRentalIds = [];

  constructor() {
    super();
    this._filteredBookings = [];
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
    const currentYear = new Date().getFullYear();
    this.#fromDate = `${currentYear}-01-01`;
    this.#toDate = `${currentYear}-12-31`;
    this.#selectedRentalIds = [];
    state.exportBookings = state.allBookings;
    this.#applyFilters();
    this.updateComplete.then(() => {
      this.querySelector("#exportFrom").value = this.#fromDate;
      this.querySelector("#exportTo").value = this.#toDate;
      this.querySelector("rental-filter-dropdown")?.setSelected(this.#selectedRentalIds);
    });
  }

  #applyFilters() {
    const selectedRentalIds = this.#selectedRentalIds;
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
    this.#selectedRentalIds = event.target.selectedIds;
    this.#applyFilters();
  }

  async #downloadXlsx() {
    const bookings = this._filteredBookings;
    if (!bookings.length) {
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(t("bookings.title", "Bookings"));

    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.columns = [
      { header: t("export.table.customer", "Customer"), width: 30 },
      { header: t("export.table.vatOrPassport", "VAT / Passport"), width: 18 },
      { header: t("export.table.rental", "Rental"), width: 18 },
      { header: t("export.table.income", "Income"), width: 12 },
      { header: t("export.table.arrival", "Arrival"), width: 14 },
      { header: t("export.table.departure", "Departure"), width: 14 },
      { header: t("export.table.days", "Days"), width: 8 },
    ];

    const headerStyle = {
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } },
      font: { bold: true },
      alignment: { horizontal: "center", vertical: "middle" },
    };
    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = headerStyle.fill;
      cell.font = headerStyle.font;
      cell.alignment = headerStyle.alignment;
    });

    for (const booking of bookings) {
      const customer = booking.customer || {};
      const row = worksheet.addRow([
        customer.FullName || "-",
        String(customer.VatOrPassport || "-"),
        (booking.rental && booking.rental.Name) || "-",
        parseFloat(booking.AmountEuros) || 0,
        booking.ArrivalDate || "-",
        booking.DepartureDate || "-",
        booking.DurationDays || 0,
      ]);
      row.eachCell((cell) => {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bookings_${this.#fromDate || "export"}_${this.#toDate || ""}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  render() {
    const totalIncome = this._filteredBookings.reduce(
      (sum, booking) => sum + (parseFloat(booking.AmountEuros) || 0),
      0,
    );
    const totalDays = this._filteredBookings.reduce(
      (sum, booking) => sum + (parseInt(booking.DurationDays) || 0),
      0,
    );
    const previewContent = this._filteredBookings.length
      ? html`
          <div class="table-responsive rm-table-scroll">
            <table class="table table-sm table-striped table-hover rm-table rm-sticky-footer mb-0">
              <thead class="table-success">
                <tr>
                  <th class="text-center">${t("export.table.customer", "Customer")}</th>
                  <th class="text-center">${t("export.table.vatOrPassport", "VAT / Passport")}</th>
                  <th class="text-center">${t("export.table.rental", "Rental")}</th>
                  <th class="text-center">${t("export.table.income", "Income")}</th>
                  <th class="text-center">${t("export.table.arrival", "Arrival")}</th>
                  <th class="text-center">${t("export.table.departure", "Departure")}</th>
                  <th class="text-center">${t("export.table.days", "Days")}</th>
                </tr>
              </thead>
              <tbody>
                ${this._filteredBookings.map((booking) => {
                  const customer = booking.customer || {};
                  return html`
                    <tr>
                      <td class="text-center">${customer.FullName || "-"}</td>
                      <td class="text-center">${String(customer.VatOrPassport || "-")}</td>
                      <td class="text-center">${(booking.rental && booking.rental.Name) || "-"}</td>
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
                  <td class="text-center">${t("common.total", "Total")} (${this._filteredBookings.length})</td>
                  <td class="text-center"></td>
                  <td class="text-center"></td>
                  <td class="text-center">${totalIncome.toFixed(2)}€</td>
                  <td class="text-center"></td>
                  <td class="text-center"></td>
                  <td class="text-center">${totalDays}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        `
      : html`<p class="text-muted p-3">${t("export.empty", "No bookings for this range.")}</p>`;

    return html`
      ${filterBar(html`
        <div class="form-floating" style="width: 160px">
          <input
            type="date"
            id="exportFrom"
            class="form-control form-control-sm"
            placeholder=${t("export.field.from", "From")}
            @input=${this.#onFromChange}
          />
          <label>${t("export.field.from", "From")}</label>
        </div>
        <div class="form-floating" style="width: 160px">
          <input
            type="date"
            id="exportTo"
            class="form-control form-control-sm"
            placeholder=${t("export.field.to", "To")}
            @input=${this.#onToChange}
          />
          <label>${t("export.field.to", "To")}</label>
        </div>
        <rental-filter-dropdown
          .rentals=${state.allRentals}
          @change=${this.#onRentalChange}
        ></rental-filter-dropdown>
      `)}
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-download me-1"></i> ${t("export.title", "Export")}</span>
          <button
            class="btn btn-success btn-sm"
            @click=${this.#downloadXlsx}
            ?disabled=${!this._filteredBookings.length}
          >
            <i class="bi bi-download me-1"></i>${t("export.download", "Download .xlsx")}
          </button>
        </div>
        <div>${previewContent}</div>
      </div>
    `;
  }
}

customElements.define("export-tab", ExportTab);
