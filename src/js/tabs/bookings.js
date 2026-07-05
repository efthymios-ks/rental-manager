import { LitElement, html } from "../../lib/lit.min.js";
import "../components/customerSelect.js";
import { filterBar } from "../components/filterBar.js";
import "../components/noteAutocomplete.js";
import "../components/rentalFilterDropdown.js";
import "../components/rentalSelect.js";
import "../components/yearCheckboxDropdown.js";
import { showConfirm } from "../confirm.js";
import { state } from "../state.js";
import {
  computeSharedYears,
  defaultSharedYears,
  formatDate,
  normalizeSearch,
  uniqueNotes,
  updateDurationField,
} from "../utils.js";

class BookingsTab extends LitElement {
  static properties = {
    _filteredBookings: { state: true },
    _years: { state: true },
    _addErrors: { state: true },
    _editErrors: { state: true },
    _addSaving: { state: true },
    _editSaving: { state: true },
  };

  #allBookings = [];
  #searchQuery = "";
  #offRecordOnly = false;

  constructor() {
    super();
    this._filteredBookings = [];
    this._years = [];
    this._addErrors = [];
    this._editErrors = [];
    this._addSaving = false;
    this._editSaving = false;
  }

  createRenderRoot() {
    return this;
  }

  load() {
    this.#allBookings = state.allBookings;
    this._years = computeSharedYears();
    if (state.sharedYears === null) {
      state.sharedYears = defaultSharedYears();
    }
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

  #openAddModal() {
    const rentalEl = this.querySelector("#addBookingRental");
    rentalEl.rentals = state.allRentals;
    rentalEl.selectedId = null;
    const customerEl = this.querySelector("#addBookingCustomer");
    customerEl.customers = state.allCustomers;
    customerEl.selectedId = null;
    ["addBookingArrival", "addBookingDeparture", "addBookingDuration", "addBookingAmount", "addBookingNotes"].forEach(
      (fieldId) => {
        this.querySelector(`#${fieldId}`).value = "";
      },
    );
    this.querySelector("#addBookingOffRecord").checked = false;
    this._addErrors = [];
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#addBookingModal")).show();
  }

  #openEditModal(booking) {
    this.querySelector("#editBookingId").value = booking.Id;
    this.querySelector("#editBookingArrival").value = booking.ArrivalDate;
    this.querySelector("#editBookingDeparture").value = booking.DepartureDate;
    this.querySelector("#editBookingAmount").value = booking.AmountEuros;
    this.querySelector("#editBookingNotes").value = booking.Notes || "";
    this.querySelector("#editBookingOffRecord").checked = !!booking.OffRecord;
    this.querySelector("#editBookingDuration").value =
      `${booking.DurationDays} day${booking.DurationDays !== 1 ? "s" : ""}`;
    const rentalEl = this.querySelector("#editBookingRental");
    rentalEl.rentals = state.allRentals;
    rentalEl.selectedId = booking.RentalId;
    const customerEl = this.querySelector("#editBookingCustomer");
    customerEl.customers = state.allCustomers;
    customerEl.selectedId = booking.CustomerId;
    this._editErrors = [];
    bootstrap.Modal.getOrCreateInstance(this.querySelector("#editBookingModal")).show();
  }

  #validateBooking(rentalId, customerId, arrival, departure, amount) {
    const errors = [];
    if (!rentalId) {
      errors.push("Please select a rental.");
    }

    if (!customerId) {
      errors.push("Please select a customer.");
    }

    if (!arrival) {
      errors.push("Please select an arrival date.");
    }

    if (!departure) {
      errors.push("Please select a departure date.");
    }

    if (arrival && departure && arrival >= departure) {
      errors.push("Departure must be after arrival.");
    }

    if (isNaN(amount) || amount <= 0) {
      errors.push("Amount must be greater than 0.");
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
    this._addSaving = true;
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
      this._addSaving = false;
      bootstrap.Modal.getInstance(this.querySelector("#addBookingModal")).hide();
      await this.#reload();
    } catch (error) {
      this._addSaving = false;
      this._addErrors = [error.message];
    }
  }

  async #submitEdit() {
    const bookingId = this.querySelector("#editBookingId").value;
    const rentalId = this.querySelector("#editBookingRental").value;
    const customerId = this.querySelector("#editBookingCustomer").value;
    const arrival = this.querySelector("#editBookingArrival").value;
    const departure = this.querySelector("#editBookingDeparture").value;
    const amount = parseFloat(this.querySelector("#editBookingAmount").value);
    const notes = this.querySelector("#editBookingNotes").value.trim();
    const offRecord = this.querySelector("#editBookingOffRecord").checked;
    const errors = this.#validateBooking(rentalId, customerId, arrival, departure, amount);
    if (errors.length) {
      this._editErrors = errors;
      return;
    }

    this._editErrors = [];
    this._editSaving = true;
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
      this._editSaving = false;
      bootstrap.Modal.getInstance(this.querySelector("#editBookingModal")).hide();
      await this.#reload();
    } catch (error) {
      this._editSaving = false;
      this._editErrors = [error.message];
    }
  }

  #confirmDelete(bookingId) {
    showConfirm(
      "Delete Booking",
      "Are you sure you want to delete this booking?",
      "Delete",
      "btn-danger",
      (done) => {
        window.api
          .deleteBooking(bookingId)
          .then(() => {
            done();
            this.#reload();
          })
          .catch((error) => {
            done();
            alert(`Error: ${error.message}`);
          });
      },
    );
  }

  #renderErrors(errors) {
    if (!errors.length) {
      return "";
    }

    return html`
      <div class="alert alert-danger py-2 mb-2">
        ${errors.map(
          (errorMessage) => html`<div><i class="bi bi-exclamation-circle me-1"></i>${errorMessage}</div>`,
        )}
      </div>
    `;
  }


  #renderList() {
    const bookings = this._filteredBookings;
    if (!bookings.length) {
      return html`<p class="text-muted p-3">No bookings found.</p>`;
    }

    const totalDays = bookings.reduce((sum, b) => sum + (parseInt(b.DurationDays) || 0), 0);
    const totalAmount = bookings.reduce((sum, b) => sum + (parseFloat(b.AmountEuros) || 0), 0);

    return html`
      <div class="table-responsive rm-table-scroll">
        <table class="table table-sm table-striped table-hover rm-table rm-sticky-footer mb-0">
          <thead class="table-success">
            <tr>
              <th>Rental</th>
              <th class="text-center">Customer</th>
              <th class="text-center">Arrival</th>
              <th class="text-center">Departure</th>
              <th class="text-center">Days</th>
              <th class="text-center">Amount</th>
              <th class="text-center">Off Record</th>
              <th class="text-center"></th>
            </tr>
          </thead>
          <tbody>
            ${bookings.map((booking) => {
              const customer = booking.customer || {};
              const rental = booking.rental || {};
              return html`
                <tr>
                  <td class="fw-semibold">${rental.Name || booking.RentalId}</td>
                  <td class="text-center">${customer.FullName || booking.CustomerId}</td>
                  <td class="text-center">${formatDate(booking.ArrivalDate)}</td>
                  <td class="text-center">${formatDate(booking.DepartureDate)}</td>
                  <td class="text-center">${booking.DurationDays}</td>
                  <td class="text-center">${parseFloat(booking.AmountEuros).toFixed(2)}€</td>
                  <td class="text-center">
                    ${booking.OffRecord ? html`<span class="badge bg-dark">Off</span>` : ""}
                  </td>
                  <td class="text-center">
                    <div class="d-flex gap-1 justify-content-center">
                      <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEditModal(booking)}>
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button class="btn btn-sm btn-outline-danger" @click=${() => this.#confirmDelete(booking.Id)}>
                        <i class="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            })}
          </tbody>
          <tfoot class="fw-bold">
            <tr>
              <td>Total (${bookings.length})</td>
              <td class="text-center"></td>
              <td class="text-center"></td>
              <td class="text-center"></td>
              <td class="text-center">${totalDays}</td>
              <td class="text-center">${totalAmount.toFixed(2)}€</td>
              <td class="text-center"></td>
              <td class="text-center"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  #renderAddModal() {
    return html`
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="addBookingModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-calendar-plus me-2"></i>Add Booking</h5>
            </div>
            <div class="modal-body">
              <rental-select id="addBookingRental"></rental-select>
              <customer-select id="addBookingCustomer"></customer-select>
              <div class="row mb-3">
                <div class="col">
                  <div class="form-floating">
                    <input type="date" id="addBookingArrival" class="form-control" placeholder="Arrival"
                      @input=${() => updateDurationField("addBookingArrival", "addBookingDeparture", "addBookingDuration")} />
                    <label><i class="bi bi-box-arrow-in-right me-1"></i>Arrival</label>
                  </div>
                </div>
                <div class="col">
                  <div class="form-floating">
                    <input type="date" id="addBookingDeparture" class="form-control" placeholder="Departure"
                      @input=${() => updateDurationField("addBookingArrival", "addBookingDeparture", "addBookingDuration")} />
                    <label><i class="bi bi-box-arrow-right me-1"></i>Departure</label>
                  </div>
                </div>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addBookingDuration" class="form-control" placeholder="Duration" readonly />
                <label><i class="bi bi-moon-stars me-1"></i>Duration</label>
              </div>
              <div class="form-floating mb-3">
                <input type="number" id="addBookingAmount" class="form-control" step="0.01" min="0.01" placeholder="0.00" />
                <label><i class="bi bi-currency-euro me-1"></i>Amount Paid</label>
              </div>
              <note-autocomplete
                id="addBookingNotes"
                class="mb-3"
                .suggestions=${uniqueNotes(state.allBookings)}
              ></note-autocomplete>
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" role="switch" id="addBookingOffRecord" />
                <label class="form-check-label" for="addBookingOffRecord">
                  <i class="bi bi-eye-slash me-1"></i>Off record
                </label>
              </div>
              ${this.#renderErrors(this._addErrors)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" id="addBookingCancelBtn" data-bs-dismiss="modal"
                ?disabled=${this._addSaving}>Cancel</button>
              <button class="btn btn-success" id="addBookingSaveBtn" @click=${this.#submitAdd}
                ?disabled=${this._addSaving}>
                ${this._addSaving
                  ? html`<span class="spinner-border spinner-border-sm me-1"></span>Saving…`
                  : html`<i class="bi bi-check-lg me-1"></i>Save`}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  #renderEditModal() {
    return html`
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="editBookingModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Edit Booking</h5>
            </div>
            <div class="modal-body">
              <input type="hidden" id="editBookingId" />
              <rental-select id="editBookingRental"></rental-select>
              <customer-select id="editBookingCustomer"></customer-select>
              <div class="row mb-3">
                <div class="col">
                  <div class="form-floating">
                    <input type="date" id="editBookingArrival" class="form-control" placeholder="Arrival"
                      @input=${() => updateDurationField("editBookingArrival", "editBookingDeparture", "editBookingDuration")} />
                    <label><i class="bi bi-box-arrow-in-right me-1"></i>Arrival</label>
                  </div>
                </div>
                <div class="col">
                  <div class="form-floating">
                    <input type="date" id="editBookingDeparture" class="form-control" placeholder="Departure"
                      @input=${() => updateDurationField("editBookingArrival", "editBookingDeparture", "editBookingDuration")} />
                    <label><i class="bi bi-box-arrow-right me-1"></i>Departure</label>
                  </div>
                </div>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="editBookingDuration" class="form-control" placeholder="Duration" readonly />
                <label><i class="bi bi-moon-stars me-1"></i>Duration</label>
              </div>
              <div class="form-floating mb-3">
                <input type="number" id="editBookingAmount" class="form-control" step="0.01" min="0.01" placeholder="0.00" />
                <label><i class="bi bi-currency-euro me-1"></i>Amount Paid</label>
              </div>
              <note-autocomplete
                id="editBookingNotes"
                class="mb-3"
                .suggestions=${uniqueNotes(state.allBookings)}
              ></note-autocomplete>
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" role="switch" id="editBookingOffRecord" />
                <label class="form-check-label" for="editBookingOffRecord">
                  <i class="bi bi-eye-slash me-1"></i>Off record
                </label>
              </div>
              ${this.#renderErrors(this._editErrors)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" id="editBookingCancelBtn" data-bs-dismiss="modal"
                ?disabled=${this._editSaving}>Cancel</button>
              <button class="btn btn-success" id="editBookingSaveBtn" @click=${this.#submitEdit}
                ?disabled=${this._editSaving}>
                ${this._editSaving
                  ? html`<span class="spinner-border spinner-border-sm me-1"></span>Saving…`
                  : html`<i class="bi bi-check-lg me-1"></i>Save`}
              </button>
            </div>
          </div>
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
        <input
          type="text"
          id="bookingSearchInput"
          class="form-control form-control-sm"
          style="width: 240px"
          placeholder="Search customer…"
          @input=${this.#onSearchInput}
        />
        <div class="form-check form-switch mb-0">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="bookingOffRecordFilter"
            @change=${this.#onOffRecordChange}
          />
          <label class="form-check-label small text-nowrap" for="bookingOffRecordFilter">
            Off record only
          </label>
        </div>
      `)}
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-calendar-check me-1"></i> Bookings</span>
          <button class="btn btn-success btn-sm" @click=${this.#openAddModal}>
            <i class="bi bi-plus-lg me-1"></i>Add
          </button>
        </div>
        ${this.#renderList()}
      </div>
      ${this.#renderAddModal()}
      ${this.#renderEditModal()}
    `;
  }
}

customElements.define("bookings-tab", BookingsTab);
