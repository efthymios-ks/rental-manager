import { LitElement, html } from "../../lib/lit.min.js";
import "../components/customerSelect.js";
import "../components/datePickerInput.js";
import { filterBar } from "../components/filterBar.js";
import "../components/noteAutocomplete.js";
import "../components/rentalsMultiSelect.js";
import "../components/rentalSelect.js";
import "../components/yearMultiSelect.js";
import { showConfirm } from "../confirm.js";
import { state } from "../state.js";
import { subscribeLanguage, t } from "../translations.js";
import {
  computeSharedYears,
  defaultSharedYears,
  formatDate,
  normalizeSearch,
  uniqueByField,
  uniqueNotes,
  updateDurationField,
} from "../utils.js";

class BookingsTab extends LitElement {
  static properties = {
    _filteredBookings: { state: true },
    _years: { state: true },
    _addErrors: { state: true },
    _addSaving: { state: true },
    _viewBooking: { state: true },
    _viewMode: { state: true },
    _viewErrors: { state: true },
    _viewSaving: { state: true },
  };

  #allBookings = [];
  #searchQuery = "";
  #offRecordOnly = false;

  constructor() {
    super();
    this._filteredBookings = [];
    this._years = [];
    this._addErrors = [];
    this._addSaving = false;
    this._viewBooking = null;
    this._viewMode = "view";
    this._viewErrors = [];
    this._viewSaving = false;
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
    this.#allBookings = state.allBookings;
    this._years = computeSharedYears();
    this.#searchQuery = "";
    this.#offRecordOnly = false;
    this.updateComplete.then(() => {
      this.querySelector("year-checkbox-dropdown")?.setSelected(state.sharedYears);
      this.querySelector("rental-filter-dropdown")?.setSelected(state.sharedRentalIds);
      const searchInput = this.querySelector("#bookingSearchInput");
      if (searchInput) searchInput.value = "";
      const offRecordInput = this.querySelector("#bookingOffRecordFilter");
      if (offRecordInput) offRecordInput.checked = false;
    });
    this.#applyFilters();
  }

  async #reload() {
    await window.api.loadAll();
    window.refreshCurrentTab();
  }

  #applyFilters() {
    const selectedYears = state.sharedYears;
    const selectedRentalIds = state.sharedRentalIds;
    this._filteredBookings = this.#allBookings.filter((booking) => {
      if (
        selectedYears !== null &&
        !selectedYears.includes(booking.ArrivalDate.substring(0, 4))
      ) {
        return false;
      }

      if (
        selectedRentalIds !== null &&
        !selectedRentalIds.includes(booking.RentalId)
      ) {
        return false;
      }

      if (this.#offRecordOnly && !booking.OffRecord) {
        return false;
      }

      if (this.#searchQuery) {
        const customer = booking.customer || {};
        if (
          !normalizeSearch(customer.FullName).includes(this.#searchQuery) &&
          !normalizeSearch(customer.VatOrPassport).includes(this.#searchQuery) &&
          !normalizeSearch(customer.PhoneNumber).includes(this.#searchQuery)
        ) {
          return false;
        }
      }

      return true;
    });
    state._filteredBookings = this._filteredBookings;
  }

  #onYearChange(event) {
    state.sharedYears = event.target.selectedYears;
    this.#applyFilters();
  }

  #onRentalChange(event) {
    state.sharedRentalIds = event.target.selectedIds;
    this.#applyFilters();
  }

  #onSearchInput(event) {
    this.#searchQuery = normalizeSearch(event.target.value);
    this.#applyFilters();
  }

  #onOffRecordChange(event) {
    this.#offRecordOnly = event.target.checked;
    this.#applyFilters();
  }

  // --- view/edit modal ---

  #openViewModal(booking) {
    this._viewBooking = booking;
    this._viewMode = "view";
    this._viewErrors = [];
    this._viewSaving = false;
    this.updateComplete.then(() => {
      this.#populateFields();
      coreui.Modal.getOrCreateInstance(this.querySelector("#viewBookingModal")).show();
    });
  }

  #populateFields() {
    const b = this._viewBooking;
    if (!b) return;
    const isEdit = this._viewMode === "edit";
    const set = (id, val) => { const el = this.querySelector(`#${id}`); if (el) el.value = val ?? ""; };

    if (isEdit) {
      const rentalEl = this.querySelector("#viewBookingRental");
      if (rentalEl) { rentalEl.rentals = state.allRentals; rentalEl.selectedId = b.RentalId; }
      const customerEl = this.querySelector("#viewBookingCustomer");
      if (customerEl) { customerEl.customers = state.allCustomers; customerEl.selectedId = b.CustomerId; }
      set("viewBookingArrival", b.ArrivalDate);
      set("viewBookingDeparture", b.DepartureDate);
    } else {
      set("viewBookingRental", b.rental?.Name ?? b.RentalId);
      set("viewBookingCustomer", b.customer?.FullName ?? b.CustomerId);
      set("viewBookingArrival", b.ArrivalDate ? formatDate(b.ArrivalDate) : "");
      set("viewBookingDeparture", b.DepartureDate ? formatDate(b.DepartureDate) : "");
    }

    set("viewBookingDuration", `${b.DurationDays} ${b.DurationDays !== 1 ? t("common.days", "days") : t("common.day", "day")}`);
    set("viewBookingAmount", parseFloat(b.AmountEuros || 0).toFixed(2));
    set("viewBookingNotes", b.Notes || "");
    const offRecordEl = this.querySelector("#viewBookingOffRecord");
    if (offRecordEl) offRecordEl.checked = !!b.OffRecord;
  }

  #enterEditMode() {
    this._viewErrors = [];
    this._viewMode = "edit";
    this.updateComplete.then(() => this.#populateFields());
  }

  #cancelEdit() {
    this._viewMode = "view";
    this._viewErrors = [];
    this.updateComplete.then(() => this.#populateFields());
  }

  #handleDelete() {
    const booking = this._viewBooking;
    showConfirm(
      t("bookings.confirmDelete.title", "Delete Booking"),
      t("bookings.confirmDelete.message", "Are you sure you want to delete this booking?"),
      t("common.delete", "Delete"),
      "btn-danger",
      (done) => {
        window.api.deleteBooking(booking.Id)
          .then(() => {
            done();
            coreui.Modal.getInstance(this.querySelector("#viewBookingModal"))?.hide();
            this.#reload();
          })
          .catch((error) => {
            done();
            alert(`Error: ${error.message}`);
          });
      },
    );
  }

  async #submitViewEdit() {
    const bookingId = this._viewBooking.Id;
    const rentalId = this.querySelector("#viewBookingRental")?.value ?? "";
    const customerId = this.querySelector("#viewBookingCustomer")?.value ?? "";
    const arrival = this.querySelector("#viewBookingArrival")?.value ?? "";
    const departure = this.querySelector("#viewBookingDeparture")?.value ?? "";
    const amount = parseFloat(this.querySelector("#viewBookingAmount")?.value);
    const notes = (this.querySelector("#viewBookingNotes")?.value ?? "").trim();
    const offRecord = this.querySelector("#viewBookingOffRecord")?.checked ?? false;
    const errors = this.#validateBooking(rentalId, customerId, arrival, departure, amount);
    if (errors.length) {
      this._viewErrors = errors;
      return;
    }
    this._viewErrors = [];
    const saveBtn = this.querySelector("#viewBookingSaveBtn");
    const lb = coreui.LoadingButton.getInstance(saveBtn) ?? new coreui.LoadingButton(saveBtn, { disabledOnLoading: true });
    this._viewSaving = true;
    lb.start();
    try {
      await window.api.updateBooking(bookingId, {
        RentalId: rentalId,
        CustomerId: customerId,
        ArrivalDate: arrival,
        DepartureDate: departure,
        AmountEuros: amount,
        Notes: notes,
        OffRecord: offRecord,
      });
      await this.#reload();
      this._viewBooking = state.allBookings.find((b) => b.Id === bookingId) ?? this._viewBooking;
      this._viewMode = "view";
      this._viewErrors = [];
      this.updateComplete.then(() => this.#populateFields());
    } catch (error) {
      this._viewErrors = [error.message];
    } finally {
      lb.stop();
      this._viewSaving = false;
    }
  }

  // --- add modal ---

  #openAddModal() {
    const rentalEl = this.querySelector("#addBookingRental");
    rentalEl.rentals = state.allRentals;
    rentalEl.selectedId = null;
    const customerEl = this.querySelector("#addBookingCustomer");
    customerEl.customers = state.allCustomers;
    customerEl.selectedId = null;
    ["addBookingArrival", "addBookingDeparture", "addBookingDuration", "addBookingAmount", "addBookingNotes"].forEach(
      (fieldId) => { this.querySelector(`#${fieldId}`).value = ""; },
    );
    this.querySelector("#addBookingOffRecord").checked = false;
    this._addErrors = [];
    coreui.Modal.getOrCreateInstance(this.querySelector("#addBookingModal")).show();
  }

  #validateBooking(rentalId, customerId, arrival, departure, amount) {
    const errors = [];
    if (!rentalId) errors.push(t("bookings.error.rentalRequired", "Please select a rental."));
    if (!customerId) errors.push(t("bookings.error.customerRequired", "Please select a customer."));
    if (!arrival) errors.push(t("bookings.error.arrivalRequired", "Please select an arrival date."));
    if (!departure) errors.push(t("bookings.error.departureRequired", "Please select a departure date."));
    if (arrival && departure && arrival >= departure) {
      errors.push(t("bookings.error.departureAfterArrival", "Departure must be after arrival."));
    }
    if (isNaN(amount) || amount <= 0) {
      errors.push(t("bookings.error.amountPositive", "Amount must be greater than 0."));
    }
    return errors;
  }

  async #submitAdd() {
    const rentalId = this.querySelector("#addBookingRental").value;
    const customerId = this.querySelector("#addBookingCustomer").value;
    const arrival = this.querySelector("#addBookingArrival").value;
    const departure = this.querySelector("#addBookingDeparture").value;
    const amount = parseFloat(this.querySelector("#addBookingAmount").value);
    const notes = this.querySelector("#addBookingNotes").value.trim();
    const offRecord = this.querySelector("#addBookingOffRecord").checked;
    const errors = this.#validateBooking(rentalId, customerId, arrival, departure, amount);
    if (errors.length) {
      this._addErrors = errors;
      return;
    }

    this._addErrors = [];
    const addBtn = this.querySelector("#addBookingSaveBtn");
    const addLb = coreui.LoadingButton.getInstance(addBtn) ?? new coreui.LoadingButton(addBtn, { disabledOnLoading: true });
    this._addSaving = true;
    addLb.start();
    try {
      await window.api.addBooking({
        RentalId: rentalId,
        CustomerId: customerId,
        ArrivalDate: arrival,
        DepartureDate: departure,
        AmountEuros: amount,
        Notes: notes,
        OffRecord: offRecord,
      });
      addLb.stop();
      this._addSaving = false;
      coreui.Modal.getInstance(this.querySelector("#addBookingModal")).hide();
      await this.#reload();
    } catch (error) {
      addLb.stop();
      this._addSaving = false;
      this._addErrors = [error.message];
    }
  }

  // --- rendering ---

  #renderErrors(errors) {
    if (!errors.length) return "";
    return html`
      <div class="alert alert-danger py-2 mb-2">
        ${errors.map((errorMessage) => html`<div><i class="bi bi-exclamation-circle me-1"></i>${errorMessage}</div>`)}
      </div>
    `;
  }

  #renderViewModal() {
    const b = this._viewBooking;
    const isEdit = this._viewMode === "edit";

    return html`
      <div class="modal fade" data-coreui-backdrop="static" data-coreui-keyboard="false" id="viewBookingModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-calendar-event me-2"></i>${b?.rental?.Name ?? ""}</h5>
              <button type="button" class="btn-close" data-coreui-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              ${isEdit ? html`
                <rental-select id="viewBookingRental"
                  .invalid=${this._viewErrors.some(e => e.includes(t("bookings.error.rentalRequired", "Please select a rental.")))}
                ></rental-select>
                <customer-select id="viewBookingCustomer"
                  .invalid=${this._viewErrors.some(e => e.includes(t("bookings.error.customerRequired", "Please select a customer.")))}
                ></customer-select>
              ` : html`
                <div class="form-floating mb-3">
                  <input type="text" id="viewBookingRental" class="form-control" readonly
                    placeholder=${t("common.field.rental", "Rental")} />
                  <label for="viewBookingRental"><i class="bi bi-house-door me-1"></i>${t("common.field.rental", "Rental")}</label>
                </div>
                <div class="form-floating mb-3">
                  <input type="text" id="viewBookingCustomer" class="form-control" readonly
                    placeholder=${t("common.field.customer", "Customer")} />
                  <label for="viewBookingCustomer"><i class="bi bi-person me-1"></i>${t("common.field.customer", "Customer")}</label>
                </div>
              `}
              <div class="row mb-3">
                <div class="col">
                  ${isEdit ? html`
                    <date-picker-input id="viewBookingArrival"
                      @change=${() => updateDurationField("viewBookingArrival", "viewBookingDeparture", "viewBookingDuration")}>
                    </date-picker-input>
                  ` : html`
                    <div class="form-floating">
                      <input type="text" id="viewBookingArrival" class="form-control" readonly
                        placeholder=${t("bookings.field.arrival", "Arrival")} />
                      <label for="viewBookingArrival"><i class="bi bi-box-arrow-in-right me-1"></i>${t("bookings.field.arrival", "Arrival")}</label>
                    </div>
                  `}
                </div>
                <div class="col">
                  ${isEdit ? html`
                    <date-picker-input id="viewBookingDeparture"
                      @change=${() => updateDurationField("viewBookingArrival", "viewBookingDeparture", "viewBookingDuration")}>
                    </date-picker-input>
                  ` : html`
                    <div class="form-floating">
                      <input type="text" id="viewBookingDeparture" class="form-control" readonly
                        placeholder=${t("bookings.field.departure", "Departure")} />
                      <label for="viewBookingDeparture"><i class="bi bi-box-arrow-right me-1"></i>${t("bookings.field.departure", "Departure")}</label>
                    </div>
                  `}
                </div>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="viewBookingDuration" class="form-control" readonly
                  placeholder=${t("bookings.field.duration", "Duration")} />
                <label for="viewBookingDuration"><i class="bi bi-moon-stars me-1"></i>${t("bookings.field.duration", "Duration")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="viewBookingAmount" class="form-control" placeholder="0.00"
                  inputmode="decimal" ?readonly=${!isEdit}
                  @input=${(e) => { const v = e.target.value.replace(",", "."); if (v !== e.target.value) e.target.value = v; }} />
                <label for="viewBookingAmount"><i class="bi bi-currency-euro me-1"></i>${t("bookings.field.amountPaid", "Amount Paid")}</label>
              </div>
              ${isEdit ? html`
                <input-autocomplete
                  id="viewBookingNotes"
                  class="mb-3"
                  .plain=${true}
                  placeholder=${t("bookings.field.notes", "Notes")}
                  .suggestions=${uniqueNotes(state.allBookings)}
                ></input-autocomplete>
              ` : html`
                <div class="form-floating mb-3">
                  <input type="text" id="viewBookingNotes" class="form-control" readonly
                    placeholder=${t("bookings.field.notes", "Notes")} />
                  <label for="viewBookingNotes">${t("bookings.field.notes", "Notes")}</label>
                </div>
              `}
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" role="switch"
                  id="viewBookingOffRecord" ?disabled=${!isEdit} />
                <label class="form-check-label" for="viewBookingOffRecord">
                  <i class="bi bi-eye-slash me-1"></i>${t("bookings.field.offRecord", "Off record")}
                </label>
              </div>
              ${isEdit ? this.#renderErrors(this._viewErrors) : ""}
            </div>
            <div class="modal-footer">
              ${isEdit ? html`
                <button class="btn btn-secondary" @click=${this.#cancelEdit}
                  ?disabled=${this._viewSaving}>${t("common.cancel", "Cancel")}</button>
                <button class="btn btn-success" id="viewBookingSaveBtn" @click=${this.#submitViewEdit}>
                  <i class="bi bi-check-lg me-1"></i>${t("common.save", "Save")}
                </button>
              ` : html`
                <button class="btn btn-danger" @click=${this.#handleDelete}
                  ?disabled=${this._viewSaving}>${t("common.delete", "Delete")}</button>
                <button class="btn btn-primary ms-auto" @click=${this.#enterEditMode}
                  ?disabled=${this._viewSaving}>${t("common.edit", "Edit")}</button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  #renderAddModal() {
    return html`
      <div class="modal fade" data-coreui-backdrop="static" data-coreui-keyboard="false" id="addBookingModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-calendar-plus me-2"></i>${t("bookings.modal.add.title", "Add Booking")}</h5>
              <button type="button" class="btn-close" data-coreui-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <rental-select id="addBookingRental"
                .defaultNone=${true}
                .invalid=${this._addErrors.some(e => e.includes(t("bookings.error.rentalRequired", "Please select a rental.")))}
              ></rental-select>
              <customer-select id="addBookingCustomer"
                .defaultNone=${true}
                .invalid=${this._addErrors.some(e => e.includes(t("bookings.error.customerRequired", "Please select a customer.")))}
              ></customer-select>
              <div class="row mb-3">
                <div class="col">
                  <date-picker-input id="addBookingArrival"
                    @change=${() => updateDurationField("addBookingArrival", "addBookingDeparture", "addBookingDuration")}>
                  </date-picker-input>
                </div>
                <div class="col">
                  <date-picker-input id="addBookingDeparture"
                    @change=${() => updateDurationField("addBookingArrival", "addBookingDeparture", "addBookingDuration")}>
                  </date-picker-input>
                </div>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addBookingDuration" class="form-control" placeholder=${t("bookings.field.duration", "Duration")} readonly />
                <label for="addBookingDuration"><i class="bi bi-moon-stars me-1"></i>${t("bookings.field.duration", "Duration")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addBookingAmount" class="form-control" placeholder="0.00" inputmode="decimal"
                  @input=${(e) => { const v = e.target.value.replace(",", "."); if (v !== e.target.value) e.target.value = v; }} />
                <label for="addBookingAmount"><i class="bi bi-currency-euro me-1"></i>${t("bookings.field.amountPaid", "Amount Paid")}</label>
              </div>
              <input-autocomplete
                id="addBookingNotes"
                class="mb-3"
                .plain=${true}
                placeholder=${t("bookings.field.notes", "Notes")}
                .suggestions=${uniqueNotes(state.allBookings)}
              ></input-autocomplete>
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" role="switch" id="addBookingOffRecord" />
                <label class="form-check-label" for="addBookingOffRecord">
                  <i class="bi bi-eye-slash me-1"></i>${t("bookings.field.offRecord", "Off record")}
                </label>
              </div>
              ${this.#renderErrors(this._addErrors)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" id="addBookingCancelBtn" data-coreui-dismiss="modal"
                ?disabled=${this._addSaving}>${t("common.cancel", "Cancel")}</button>
              <button class="btn btn-success" id="addBookingSaveBtn" @click=${this.#submitAdd}>
                <i class="bi bi-check-lg me-1"></i>${t("common.save", "Save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  #renderList() {
    const bookings = this._filteredBookings;
    if (!bookings.length) {
      return html`<p class="text-muted p-3">${t("bookings.empty", "No bookings found.")}</p>`;
    }

    const totalDays = bookings.reduce((sum, b) => sum + (parseInt(b.DurationDays) || 0), 0);
    const totalAmount = bookings.reduce((sum, b) => sum + (parseFloat(b.AmountEuros) || 0), 0);

    return html`
      <div class="table-responsive rm-table-scroll">
        <table class="table table-sm table-striped table-hover rm-table rm-sticky-footer mb-0">
          <thead class="table-success">
            <tr>
              <th>${t("bookings.table.rental", "Rental")}</th>
              <th class="text-center">${t("bookings.table.customer", "Customer")}</th>
              <th class="text-center">${t("bookings.table.arrival", "Arrival")}</th>
              <th class="text-center">${t("bookings.table.departure", "Departure")}</th>
              <th class="text-center">${t("bookings.table.days", "Days")}</th>
              <th class="text-center">${t("bookings.table.amount", "Amount")}</th>
              <th class="text-center">${t("bookings.table.offRecord", "Off Record")}</th>
            </tr>
          </thead>
          <tbody>
            ${bookings.map((booking) => {
              const customer = booking.customer || {};
              const rental = booking.rental || {};
              return html`
                <tr style="cursor:pointer" @click=${() => this.#openViewModal(booking)}>
                  <td class="fw-semibold">${rental.Name || booking.RentalId}</td>
                  <td class="text-center">${customer.FullName || booking.CustomerId}</td>
                  <td class="text-center">${formatDate(booking.ArrivalDate)}</td>
                  <td class="text-center">${formatDate(booking.DepartureDate)}</td>
                  <td class="text-center">${booking.DurationDays}</td>
                  <td class="text-center">${parseFloat(booking.AmountEuros).toFixed(2)}€</td>
                  <td class="text-center">
                    ${booking.OffRecord ? html`<span class="badge bg-dark">${t("bookings.table.offRecord.short", "Off")}</span>` : ""}
                  </td>
                </tr>
              `;
            })}
          </tbody>
          <tfoot class="fw-bold">
            <tr>
              <td>${t("common.total", "Total")} (${bookings.length})</td>
              <td class="text-center"></td>
              <td class="text-center"></td>
              <td class="text-center"></td>
              <td class="text-center">${totalDays}</td>
              <td class="text-center">${totalAmount.toFixed(2)}€</td>
              <td class="text-center"></td>
            </tr>
          </tfoot>
        </table>
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
        <input-autocomplete
          id="bookingSearchInput"
          class="flex-shrink-0"
          style="width: 240px"
          .plain=${true}
          placeholder=${t("bookings.filter.search.placeholder", "Search customer...")}
          .suggestions=${uniqueByField(state.allCustomers, "FullName")}
          @input=${this.#onSearchInput}
        ></input-autocomplete>
        <div class="form-check form-switch mb-0">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="bookingOffRecordFilter"
            @change=${this.#onOffRecordChange}
          />
          <label class="form-check-label small text-nowrap" for="bookingOffRecordFilter">
            ${t("bookings.filter.offRecord", "Off record only")}
          </label>
        </div>
      `)}
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-calendar-check me-1"></i> ${t("bookings.title", "Bookings")}</span>
          <button class="btn btn-success btn-sm" @click=${this.#openAddModal}>
            <i class="bi bi-plus-lg me-1"></i>${t("common.add", "Add")}
          </button>
        </div>
        ${this.#renderList()}
      </div>
      ${this.#renderAddModal()}
      ${this.#renderViewModal()}
    `;
  }
}

customElements.define("bookings-tab", BookingsTab);
