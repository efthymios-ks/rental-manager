import { LitElement, html } from "../../lib/lit.min.js";
import { showConfirm } from "../confirm.js";
import { state } from "../state.js";
import { normalizeSearch } from "../utils.js";

function validateCustomerForm(fullName) {
  return fullName ? [] : ["Full name is required."];
}

class CustomersTab extends LitElement {
  static properties = {
    _filteredCustomers: { state: true },
    _addErrors: { state: true },
    _editErrors: { state: true },
    _addSaving: { state: true },
    _editSaving: { state: true },
    _addRating: { state: true },
    _editRating: { state: true },
  };

  #searchQuery = "";
  #vatIgnoredOnly = false;

  constructor() {
    super();
    this._filteredCustomers = [];
    this._addErrors = [];
    this._editErrors = [];
    this._addSaving = false;
    this._editSaving = false;
    this._addRating = 0;
    this._editRating = 0;
  }

  createRenderRoot() {
    return this;
  }

  load() {
    this.#applyFilters();
  }

  async #reload() {
    await window.api.loadAll();
    window.refreshCurrentTab();
  }

  #applyFilters() {
    this._filteredCustomers = state.allCustomers.filter((customer) => {
      if (this.#vatIgnoredOnly && customer.VatOrPassport) {
        return false;
      }

      if (!this.#searchQuery) {
        return true;
      }

      return (
        normalizeSearch(customer.FullName).includes(this.#searchQuery) ||
        normalizeSearch(customer.PhoneNumber).includes(this.#searchQuery) ||
        normalizeSearch(customer.VatOrPassport).includes(this.#searchQuery)
      );
    });
  }

  #onSearch(event) {
    this.#searchQuery = normalizeSearch(event.target.value);
    this.#applyFilters();
  }

  #onVatFilterChange(event) {
    this.#vatIgnoredOnly = event.target.checked;
    this.#applyFilters();
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

  #openAddModal() {
    this._addErrors = [];
    this._addSaving = false;
    const modal = bootstrap.Modal.getOrCreateInstance(this.querySelector("#addCustomerModal"));
    modal.show();
    this.updateComplete.then(() => {
      this.querySelector("#addCustomerFullName").value = "";
      this.querySelector("#addCustomerVat").value = "";
      this.querySelector("#addCustomerPhone").value = "";
      this.querySelector("#addCustomerNotes").value = "";
      this.querySelector("#addCustomerIgnoreMissingVat").checked = false;
      this._addRating = 0;
    });
  }

  #openEditModal(customer) {
    this._editErrors = [];
    this._editSaving = false;
    const modal = bootstrap.Modal.getOrCreateInstance(this.querySelector("#editCustomerModal"));
    modal.show();
    this.updateComplete.then(() => {
      this.querySelector("#editCustomerId").value = customer.Id;
      this.querySelector("#editCustomerFullName").value = customer.FullName;
      this.querySelector("#editCustomerVat").value = customer.VatOrPassport || "";
      this.querySelector("#editCustomerPhone").value = customer.PhoneNumber || "";
      this.querySelector("#editCustomerNotes").value = customer.Notes || "";
      this.querySelector("#editCustomerIgnoreMissingVat").checked = !!customer.IgnoreMissingVat;
      this._editRating = customer.Rating ?? 0;
    });
  }

  async #submitAdd() {
    const fullName = this.querySelector("#addCustomerFullName").value.trim();
    const vatOrPassport = this.querySelector("#addCustomerVat").value.trim();
    const phoneNumber = this.querySelector("#addCustomerPhone").value.trim();
    const notes = this.querySelector("#addCustomerNotes").value.trim();
    const ignoreMissingVat = this.querySelector("#addCustomerIgnoreMissingVat").checked;
    const rating = this._addRating;
    const errors = validateCustomerForm(fullName);
    if (errors.length) {
      this._addErrors = errors;
      return;
    }

    this._addErrors = [];
    this._addSaving = true;
    try {
      await window.api.addCustomer({
        FullName: fullName,
        VatOrPassport: vatOrPassport,
        Rating: rating,
        Notes: notes,
        PhoneNumber: phoneNumber,
        IgnoreMissingVat: ignoreMissingVat,
      });
      bootstrap.Modal.getInstance(this.querySelector("#addCustomerModal")).hide();
      await this.#reload();
    } catch (error) {
      this._addErrors = [error.message];
    } finally {
      this._addSaving = false;
    }
  }

  async #submitEdit() {
    const customerId = this.querySelector("#editCustomerId").value;
    const fullName = this.querySelector("#editCustomerFullName").value.trim();
    const vatOrPassport = this.querySelector("#editCustomerVat").value.trim();
    const phoneNumber = this.querySelector("#editCustomerPhone").value.trim();
    const notes = this.querySelector("#editCustomerNotes").value.trim();
    const ignoreMissingVat = this.querySelector("#editCustomerIgnoreMissingVat").checked;
    const rating = this._editRating;
    const errors = validateCustomerForm(fullName);
    if (errors.length) {
      this._editErrors = errors;
      return;
    }

    this._editErrors = [];
    this._editSaving = true;
    try {
      await window.api.updateCustomer(customerId, {
        FullName: fullName,
        VatOrPassport: vatOrPassport,
        Rating: rating,
        Notes: notes,
        PhoneNumber: phoneNumber,
        IgnoreMissingVat: ignoreMissingVat,
      });
      bootstrap.Modal.getInstance(this.querySelector("#editCustomerModal")).hide();
      await this.#reload();
    } catch (error) {
      this._editErrors = [error.message];
    } finally {
      this._editSaving = false;
    }
  }

  #confirmDelete(customer) {
    showConfirm(
      "Delete Customer",
      "Are you sure you want to delete this customer?",
      "Delete",
      "btn-danger",
      (done) => {
        window.api.deleteCustomer(customer.Id)
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
      <div class="alert alert-danger py-2 mb-0 mt-2">
        <ul class="mb-0 ps-3">${errors.map((errorMessage) => html`<li>${errorMessage}</li>`)}</ul>
      </div>
    `;
  }

  #renderRatingButtons(currentRating, onChange) {
    return html`
      <div class="mb-3">
        <label class="form-label fw-semibold small mb-2"><i class="bi bi-star me-1"></i>Rating</label>
        <div class="d-flex gap-2">
          <button type="button"
            class="btn btn-sm ${currentRating === -1 ? "btn-danger" : "btn-outline-danger"}"
            @click=${() => onChange(currentRating === -1 ? 0 : -1)}>
            <i class="bi bi-hand-thumbs-down${currentRating === -1 ? "-fill" : ""} me-1"></i>Dislike
          </button>
          <button type="button"
            class="btn btn-sm ${currentRating === 1 ? "btn-success" : "btn-outline-success"}"
            @click=${() => onChange(currentRating === 1 ? 0 : 1)}>
            <i class="bi bi-hand-thumbs-up${currentRating === 1 ? "-fill" : ""} me-1"></i>Like
          </button>
        </div>
      </div>
    `;
  }

  #renderAddModal() {
    return html`
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="addCustomerModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-person-plus me-2"></i>Add Customer</h5>
            </div>
            <div class="modal-body">
              <div class="form-floating mb-3">
                <input type="text" id="addCustomerFullName" class="form-control" placeholder="Full Name" />
                <label><i class="bi bi-person me-1"></i>Full Name <span class="text-danger">*</span></label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addCustomerVat" class="form-control" placeholder="VAT / Passport" />
                <label><i class="bi bi-card-text me-1"></i>VAT / Passport Number</label>
              </div>
              <div class="input-group mb-3">
                <div class="form-floating flex-grow-1">
                  <input type="text" id="addCustomerPhone" class="form-control" placeholder="Phone" />
                  <label><i class="bi bi-telephone me-1"></i>Phone Number</label>
                </div>
                <button class="btn btn-outline-secondary" type="button" title="Copy phone"
                  @click=${() => this.#copyPhone(this.querySelector("#addCustomerPhone").value)}>
                  <i class="bi bi-clipboard"></i>
                </button>
              </div>
              ${this.#renderRatingButtons(this._addRating, (v) => this._addRating = v)}
              <div class="form-floating mb-3">
                <input type="text" id="addCustomerNotes" class="form-control" placeholder="Notes" />
                <label><i class="bi bi-chat-left-text me-1"></i>Notes</label>
              </div>
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" role="switch" id="addCustomerIgnoreMissingVat" />
                <label class="form-check-label" for="addCustomerIgnoreMissingVat">
                  <i class="bi bi-slash-circle me-1"></i>Ignore missing VAT
                </label>
              </div>
              ${this.#renderErrors(this._addErrors)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal" ?disabled=${this._addSaving}>Cancel</button>
              <button class="btn btn-success" @click=${this.#submitAdd} ?disabled=${this._addSaving}>
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
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="editCustomerModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Edit Customer</h5>
            </div>
            <div class="modal-body">
              <input type="hidden" id="editCustomerId" />
              <div class="form-floating mb-3">
                <input type="text" id="editCustomerFullName" class="form-control" placeholder="Full Name" />
                <label><i class="bi bi-person me-1"></i>Full Name <span class="text-danger">*</span></label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="editCustomerVat" class="form-control" placeholder="VAT / Passport" />
                <label><i class="bi bi-card-text me-1"></i>VAT / Passport Number</label>
              </div>
              <div class="input-group mb-3">
                <div class="form-floating flex-grow-1">
                  <input type="text" id="editCustomerPhone" class="form-control" placeholder="Phone" />
                  <label><i class="bi bi-telephone me-1"></i>Phone Number</label>
                </div>
                <button class="btn btn-outline-secondary" type="button" title="Copy phone"
                  @click=${() => this.#copyPhone(this.querySelector("#editCustomerPhone").value)}>
                  <i class="bi bi-clipboard"></i>
                </button>
              </div>
              ${this.#renderRatingButtons(this._editRating, (v) => this._editRating = v)}
              <div class="form-floating mb-3">
                <input type="text" id="editCustomerNotes" class="form-control" placeholder="Notes" />
                <label><i class="bi bi-chat-left-text me-1"></i>Notes</label>
              </div>
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" role="switch" id="editCustomerIgnoreMissingVat" />
                <label class="form-check-label" for="editCustomerIgnoreMissingVat">
                  <i class="bi bi-slash-circle me-1"></i>Ignore missing VAT
                </label>
              </div>
              ${this.#renderErrors(this._editErrors)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal" ?disabled=${this._editSaving}>Cancel</button>
              <button class="btn btn-success" @click=${this.#submitEdit} ?disabled=${this._editSaving}>
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

  #renderSummaryCards() {
    const customers = this._filteredCustomers;
    return html`
      <div class="row g-3 p-3 border-bottom">
        <div class="col-6 col-md-4 col-lg-3">
          <div class="rounded-3 p-3 bg-primary bg-opacity-10 h-100 text-center">
            <div class="text-uppercase small fw-semibold text-muted">Total Customers</div>
            <div class="fs-4 fw-bold text-primary">${customers.length}</div>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    const listContent = this._filteredCustomers.length
      ? html`
          <!-- Desktop layout -->
          <ul class="list-group list-group-flush d-none d-md-block">
            ${this._filteredCustomers.map((customer) => {
              const hasBookings = state.allBookings.some((booking) => booking.CustomerId === customer.Id);
              return html`
                <li class="list-group-item d-flex align-items-center py-2 gap-3 ${customer.Rating === 1 ? "bg-success bg-opacity-25" : customer.Rating === -1 ? "bg-danger bg-opacity-25" : ""}">
                  <span class="fw-semibold flex-shrink-0">${customer.FullName}</span>
                  ${customer.PhoneNumber
                    ? html`<span class="text-muted small flex-shrink-0"><i class="bi bi-telephone me-1"></i>${customer.PhoneNumber}</span>`
                    : ""}
                  <div class="d-flex gap-2 flex-shrink-0 ms-auto">
                    <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEditModal(customer)}>
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button
                      class="btn btn-sm btn-outline-danger"
                      @click=${() => this.#confirmDelete(customer)}
                      ?disabled=${hasBookings}
                      title=${hasBookings ? "Has bookings" : ""}
                    >
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </li>
              `;
            })}
          </ul>

          <!-- Mobile layout -->
          <div class="d-md-none d-flex flex-column gap-2 p-2">
            ${this._filteredCustomers.map((customer) => {
              const hasBookings = state.allBookings.some((booking) => booking.CustomerId === customer.Id);
              const ratingClass = customer.Rating === 1 ? "border-success bg-success bg-opacity-10" : customer.Rating === -1 ? "border-danger bg-danger bg-opacity-10" : "";
              return html`
                <div class="card border rounded-3 px-3 pt-3 pb-2 ${ratingClass}">
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="fw-semibold">${customer.FullName}</span>
                    <div class="d-flex gap-2">
                      <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEditModal(customer)}>
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button
                        class="btn btn-sm btn-outline-danger"
                        @click=${() => this.#confirmDelete(customer)}
                        ?disabled=${hasBookings}
                        title=${hasBookings ? "Has bookings" : ""}
                      >
                        <i class="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                  ${customer.PhoneNumber
                    ? html`<div class="text-muted small"><i class="bi bi-telephone me-1"></i>${customer.PhoneNumber}</div>`
                    : ""}
                </div>
              `;
            })}
          </div>
        `
      : html`<p class="text-muted p-3">No customers found.</p>`;

    return html`
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-people me-1"></i> Customers</span>
          <button class="btn btn-success btn-sm" @click=${this.#openAddModal}>
            <i class="bi bi-plus-lg me-1"></i>Add
          </button>
        </div>
        ${this.#renderSummaryCards()}
        <div class="card-body border-bottom py-3">
          <div class="d-flex flex-wrap gap-2 justify-content-center align-items-center">
            <div class="input-group input-group-sm flex-grow-1 flex-lg-grow-0" style="max-width: 300px">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input
                type="text"
                class="form-control"
                placeholder="Search customer fields..."
                @input=${this.#onSearch}
              />
            </div>
            <div class="w-100 d-lg-none"></div>
            <div class="form-check form-switch mb-0">
              <input
                class="form-check-input"
                type="checkbox"
                role="switch"
                id="customerVatIgnoredFilter"
                @change=${this.#onVatFilterChange}
              />
              <label class="form-check-label small" for="customerVatIgnoredFilter">Missing VAT only</label>
            </div>
          </div>
        </div>
        <div>${listContent}</div>
      </div>
      ${this.#renderAddModal()}
      ${this.#renderEditModal()}
    `;
  }
}

customElements.define("customers-tab", CustomersTab);
