import { LitElement, html } from "../../lib/lit.min.js";
import { filterBar } from "../components/filterBar.js";
import "../components/rentalsMultiSelect.js";
import { state } from "../state.js";
import { subscribeLanguage, getLanguage, t } from "../translations.js";

class ExportTab extends LitElement {
  static properties = {
    _filteredBookings: { state: true },
    _includeOffRecord: { state: true },
    _includeExpenses: { state: true },
  };

  #fromDate = "";
  #toDate = "";
  #selectedRentalIds = [];
  #dateRangePicker = null;

  constructor() {
    super();
    this._filteredBookings = [];
    this._includeOffRecord = false;
    this._includeExpenses = false;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsubLang = subscribeLanguage(() => {
      this.requestUpdate();
      this.#dateRangePicker?.update(this.#rangePickerFormatOptions());
      this.#patchRangePickerInputs();
    });
  }

  #rangePickerFormatOptions() {
    const lang = getLanguage();
    return {
      locale: lang,
      inputDateFormat: (date) =>
        new Intl.DateTimeFormat(lang, { month: "long", year: "numeric" }).format(date),
    };
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubLang?.();
    this.#dateRangePicker?.dispose();
    this.#dateRangePicker = null;
  }

  firstUpdated() {
    const el = this.querySelector("#exportDateRange");
    if (!el) return;

    const currentYear = new Date().getFullYear();
    el.setAttribute("data-coreui-input-read-only", "true");
    el.setAttribute("data-coreui-cleaner", "false");
    el.setAttribute("data-coreui-selection-type", "month");
    el.setAttribute("data-coreui-start-date", `${currentYear}-01`);
    el.setAttribute("data-coreui-end-date", `${currentYear}-12`);

    this.#dateRangePicker = new coreui.DateRangePicker(el, {
      selectionType: "month",
      placeholder: [t("export.field.from", "From"), t("export.field.to", "To")],
      inputReadOnly: true,
      previewDateOnHover: false,
      cleaner: false,
      footer: true,
      size: "sm",
      ...this.#rangePickerFormatOptions(),
    });
    this.#patchRangePickerInputs();

    el.addEventListener("startDateChange.coreui.date-range-picker", (e) => {
      if (e.date) {
        // selectionType:"month" fires e.date as "YYYY-MM" string
        this.#fromDate = `${e.date}-01`;
      } else {
        this.#fromDate = "";
      }
      this.#applyFilters();
    });

    el.addEventListener("endDateChange.coreui.date-range-picker", (e) => {
      if (e.date) {
        const [year, month] = String(e.date).split("-").map(Number);
        const lastDay = new Date(year, month, 0);
        this.#toDate = this.#toDateStr(lastDay);
      } else {
        this.#toDate = "";
      }
      this.#applyFilters();
    });
  }

  #patchRangePickerInputs() {
    const el = this.querySelector("#exportDateRange");
    if (!el) return;
    const labels = [t("export.field.from", "From"), t("export.field.to", "To")];
    el.querySelectorAll("input.date-picker-input").forEach((input, i) => {
      if (!input.name) input.name = `export-date-${i}`;
      input.setAttribute("aria-label", labels[i] ?? labels[0]);
    });
  }

  #toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  load() {
    const currentYear = new Date().getFullYear();
    this.#fromDate = `${currentYear}-01-01`;
    this.#toDate = `${currentYear}-12-31`;
    this.#selectedRentalIds = [];
    this._includeOffRecord = false;
    this._includeExpenses = false;
    state.exportBookings = state.allBookings;

    const el = this.querySelector("#exportDateRange");
    if (el) {
      el.setAttribute("data-coreui-start-date", `${currentYear}-01`);
      el.setAttribute("data-coreui-end-date", `${currentYear}-12`);
    }
    this.#dateRangePicker?.update({
      startDate: `${currentYear}-01`,
      endDate: `${currentYear}-12`,
      ...this.#rangePickerFormatOptions(),
    });
    this.#patchRangePickerInputs();

    this.#applyFilters();
    this.updateComplete.then(() => {
      this.querySelector("rental-filter-dropdown")?.setSelected([]);
    });
  }

  #applyFilters() {
    const selectedRentalIds = this.#selectedRentalIds;
    this._filteredBookings = state.exportBookings.filter((booking) => {
      if (!this._includeOffRecord && booking.OffRecord) return false;
      if (selectedRentalIds !== null && !selectedRentalIds.includes(booking.RentalId)) return false;
      if (this.#fromDate && booking.ArrivalDate < this.#fromDate) return false;
      if (this.#toDate && booking.ArrivalDate > this.#toDate) return false;
      return true;
    });
  }

  #onRentalChange(event) {
    this.#selectedRentalIds = event.target.selectedIds;
    this.#applyFilters();
  }

  async #downloadXlsx() {
    const bookings = this._filteredBookings;
    if (!bookings.length) return;

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

    if (this._includeExpenses) {
      const expenseSheet = workbook.addWorksheet(t("export.sheet.expenses", "Expenses"));
      expenseSheet.views = [{ state: "frozen", ySplit: 1 }];
      expenseSheet.columns = [
        { header: t("expenses.field.name", "Name"), width: 30 },
        { header: t("export.table.rental", "Rental"), width: 24 },
        { header: t("expenses.field.amount", "Amount (€)"), width: 12 },
        { header: t("expenses.field.date", "Date"), width: 14 },
        { header: t("expenses.field.notes", "Notes"), width: 30 },
      ];
      expenseSheet.getRow(1).eachCell((cell) => {
        cell.fill = headerStyle.fill;
        cell.font = headerStyle.font;
        cell.alignment = headerStyle.alignment;
      });

      const selectedRentalIds = this.#selectedRentalIds;
      const filteredExpenses = state.allExpenses.filter((expense) => {
        if (selectedRentalIds !== null && !expense.RentalIds.some((id) => selectedRentalIds.includes(id))) return false;
        if (this.#fromDate && expense.DateCreated < this.#fromDate) return false;
        if (this.#toDate && expense.DateCreated > this.#toDate) return false;
        return true;
      });

      for (const expense of filteredExpenses) {
        const rentalNames = (expense.rentals || []).map((r) => r.Name).join(", ") || "-";
        const row = expenseSheet.addRow([
          expense.Name || "-",
          rentalNames,
          parseFloat(expense.AmountEuros) || 0,
          expense.DateCreated || "-",
          expense.Notes || "",
        ]);
        row.eachCell((cell) => {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        });
      }
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
        <div class="flex-shrink-0" style="width:320px"><div id="exportDateRange"></div></div>
        <div class="flex-shrink-0"><rental-filter-dropdown
          .rentals=${state.allRentals}
          .defaultNone=${true}
          @change=${(e) => this.#onRentalChange(e)}
        ></rental-filter-dropdown></div>
        <div class="form-check form-switch mb-0">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="exportIncludeOffRecord"
            .checked=${this._includeOffRecord}
            @change=${(e) => { this._includeOffRecord = e.target.checked; this.#applyFilters(); }}
          />
          <label class="form-check-label small text-nowrap" for="exportIncludeOffRecord">
            ${t("export.filter.includeOffRecord", "Include off record")}
          </label>
        </div>
        <div class="form-check form-switch mb-0">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="exportIncludeExpenses"
            .checked=${this._includeExpenses}
            @change=${(e) => { this._includeExpenses = e.target.checked; }}
          />
          <label class="form-check-label small text-nowrap" for="exportIncludeExpenses">
            ${t("export.filter.includeExpenses", "Include expenses")}
          </label>
        </div>
      `)}
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-download me-1"></i> ${t("export.title", "Export")}</span>
          <button
            class="btn btn-success btn-sm"
            @click=${() => this.#downloadXlsx()}
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
