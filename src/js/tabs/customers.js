import { LitElement, html } from "../../lib/lit.min.js";
import { filterBar } from "../components/filterBar.js";
import "../components/noteAutocomplete.js";
import "../components/rentalsMultiSelect.js";
import "../components/yearMultiSelect.js";
import { showConfirm } from "../confirm.js";
import { state } from "../state.js";
import { subscribeLanguage, t } from "../translations.js";
import { computeSharedYears, normalizeSearch, uniqueNotes } from "../utils.js";

function normalizePhone(raw) {
  return raw.replace(/\s/g, "");
}

function validateCustomerForm(fullName) {
  return fullName ? [] : [t("customers.error.fullNameRequired", "Full name is required.")];
}

class CustomersTab extends LitElement {
  static properties = {
    _filteredCustomers: { state: true },
    _addErrors: { state: true },
    _addSaving: { state: true },
    _addRating: { state: true },
    _viewCustomer: { state: true },
    _viewMode: { state: true },
    _viewRating: { state: true },
    _viewErrors: { state: true },
    _viewSaving: { state: true },
  };

  #searchQuery = "";
  #vatIgnoredOnly = false;
  #years = [];
  #filterYears = null;
  #filterRentalIds = null;

  constructor() {
    super();
    this._filteredCustomers = [];
    this._addErrors = [];
    this._addSaving = false;
    this._addRating = 0;
    this._viewCustomer = null;
    this._viewMode = "view";
    this._viewRating = 0;
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
    this.#searchQuery = "";
    this.#vatIgnoredOnly = false;
    this.#years = computeSharedYears();
    this.updateComplete.then(() => {
      const searchInput = this.querySelector("#customerSearchInput");
      if (searchInput) searchInput.value = "";
      const vatInput = this.querySelector("#customerVatIgnoredFilter");
      if (vatInput) vatInput.checked = false;
      this.querySelector("year-checkbox-dropdown")?.setSelected(this.#filterYears ?? []);
      this.querySelector("rental-filter-dropdown")?.setSelected(this.#filterRentalIds ?? []);
    });
    this.#applyFilters();
  }

  async #reload() {
    await window.api.loadAll();
    window.refreshCurrentTab();
  }

  #applyFilters() {
    const selectedYears = this.#filterYears?.length ? this.#filterYears : null;
    const selectedRentalIds = this.#filterRentalIds?.length ? this.#filterRentalIds : null;
    this._filteredCustomers = state.allCustomers.filter((customer) => {
      if (this.#vatIgnoredOnly && customer.VatOrPassport) return false;

      if (selectedYears !== null || selectedRentalIds !== null) {
        const customerBookings = state.allBookings.filter((b) => b.CustomerId === customer.Id);
        if (!customerBookings.length) return true;
        if (selectedYears !== null && !customerBookings.some((b) => selectedYears.includes(b.ArrivalDate.substring(0, 4)))) return false;
        if (selectedRentalIds !== null && !customerBookings.some((b) => selectedRentalIds.includes(b.RentalId))) return false;
      }

      if (!this.#searchQuery) return true;
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

  #onYearChange(event) {
    this.#filterYears = event.target.selectedYears;
    this.#applyFilters();
  }

  #onRentalChange(event) {
    this.#filterRentalIds = event.target.selectedIds;
    this.#applyFilters();
  }

  // --- view/edit modal ---

  #openViewModal(customer) {
    this._viewCustomer = customer;
    this._viewMode = "view";
    this._viewErrors = [];
    this._viewSaving = false;
    this.updateComplete.then(() => {
      this.#populateFields();
      coreui.Modal.getOrCreateInstance(this.querySelector("#viewCustomerModal")).show();
    });
  }

  #populateFields() {
    const c = this._viewCustomer;
    if (!c) return;
    const set = (id, val) => { const el = this.querySelector(`#${id}`); if (el) el.value = val ?? ""; };
    set("viewCustomerFullName", c.FullName);
    set("viewCustomerVat", c.VatOrPassport);
    set("viewCustomerPhone", c.PhoneNumber);
    set("viewCustomerNotes", c.Notes);
    const ignoreMissingVatEl = this.querySelector("#viewCustomerIgnoreMissingVat");
    if (ignoreMissingVatEl) ignoreMissingVatEl.checked = !!c.IgnoreMissingVat;
  }

  #enterEditMode() {
    this._viewRating = this._viewCustomer?.Rating ?? 0;
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
    const customer = this._viewCustomer;
    const hasBookings = state.allBookings.some((b) => b.CustomerId === customer.Id);
    if (hasBookings) {
      this.#showNotification(t("customers.error.cannotDelete", "Can't delete: customer has bookings."));
      return;
    }
    showConfirm(
      t("customers.confirmDelete.title", "Delete Customer"),
      t("customers.confirmDelete.message", "Are you sure you want to delete this customer?"),
      t("common.delete", "Delete"),
      "btn-danger",
      (done) => {
        window.api.deleteCustomer(customer.Id)
          .then(() => {
            done();
            coreui.Modal.getInstance(this.querySelector("#viewCustomerModal"))?.hide();
            this.#reload();
          })
          .catch((error) => {
            done();
            alert(`Error: ${error.message}`);
          });
      },
    );
  }

  #showNotification(message) {
    let container = document.querySelector(".rm-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container position-fixed top-0 end-0 p-3 rm-toast-container";
      container.style.zIndex = "1090";
      document.body.appendChild(container);
    }
    const body = document.createElement("div");
    body.className = "toast-body";
    body.textContent = message;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn-close me-2 m-auto";
    closeBtn.setAttribute("data-coreui-dismiss", "toast");
    const wrapper = document.createElement("div");
    wrapper.className = "d-flex";
    wrapper.append(body, closeBtn);
    const toastEl = document.createElement("div");
    toastEl.className = "toast align-items-center text-bg-warning border-0";
    toastEl.setAttribute("role", "alert");
    toastEl.append(wrapper);
    container.appendChild(toastEl);
    const toast = new coreui.Toast(toastEl, { delay: 4000 });
    toast.show();
    toastEl.addEventListener("hidden.coreui.toast", () => toastEl.remove());
  }

  async #submitViewEdit() {
    const customerId = this._viewCustomer.Id;
    const fullName = this.querySelector("#viewCustomerFullName").value.trim();
    const vatOrPassport = this.querySelector("#viewCustomerVat").value.trim();
    const phoneNumber = normalizePhone(this.querySelector("#viewCustomerPhone").value);
    const notes = (this.querySelector("#viewCustomerNotes")?.value ?? "").trim();
    const ignoreMissingVat = this.querySelector("#viewCustomerIgnoreMissingVat").checked;
    const rating = this._viewRating;
    const errors = validateCustomerForm(fullName);
    if (errors.length) {
      this._viewErrors = errors;
      return;
    }
    this._viewErrors = [];
    const saveBtn = this.querySelector("#viewCustomerSaveBtn");
    const lb = coreui.LoadingButton.getInstance(saveBtn) ?? new coreui.LoadingButton(saveBtn, { disabledOnLoading: true });
    this._viewSaving = true;
    lb.start();
    try {
      await window.api.updateCustomer(customerId, {
        FullName: fullName,
        VatOrPassport: vatOrPassport,
        Rating: rating,
        Notes: notes,
        PhoneNumber: phoneNumber,
        IgnoreMissingVat: ignoreMissingVat,
      });
      await this.#reload();
      this._viewCustomer = state.allCustomers.find((c) => c.Id === customerId) ?? this._viewCustomer;
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
    this._addErrors = [];
    this._addSaving = false;
    this._addRating = 0;
    const modal = coreui.Modal.getOrCreateInstance(this.querySelector("#addCustomerModal"));
    modal.show();
    this.updateComplete.then(() => {
      this.querySelector("#addCustomerFullName").value = "";
      this.querySelector("#addCustomerVat").value = "";
      this.querySelector("#addCustomerPhone").value = "";
      this.querySelector("#addCustomerNotes").value = "";
      this.querySelector("#addCustomerIgnoreMissingVat").checked = false;
    });
  }

  async #submitAdd() {
    const fullName = this.querySelector("#addCustomerFullName").value.trim();
    const vatOrPassport = this.querySelector("#addCustomerVat").value.trim();
    const phoneNumber = normalizePhone(this.querySelector("#addCustomerPhone").value);
    const notes = this.querySelector("#addCustomerNotes").value.trim();
    const ignoreMissingVat = this.querySelector("#addCustomerIgnoreMissingVat").checked;
    const rating = this._addRating;
    const errors = validateCustomerForm(fullName);
    if (errors.length) {
      this._addErrors = errors;
      return;
    }
    this._addErrors = [];
    const addBtn = this.querySelector("#addCustomerSaveBtn");
    const addLb = coreui.LoadingButton.getInstance(addBtn) ?? new coreui.LoadingButton(addBtn, { disabledOnLoading: true });
    this._addSaving = true;
    addLb.start();
    try {
      await window.api.addCustomer({
        FullName: fullName,
        VatOrPassport: vatOrPassport,
        Rating: rating,
        Notes: notes,
        PhoneNumber: phoneNumber,
        IgnoreMissingVat: ignoreMissingVat,
      });
      coreui.Modal.getInstance(this.querySelector("#addCustomerModal")).hide();
      await this.#reload();
    } catch (error) {
      this._addErrors = [error.message];
    } finally {
      addLb.stop();
      this._addSaving = false;
    }
  }

  // --- rendering ---

  #renderErrors(errors) {
    if (!errors.length) return "";
    return html`
      <div class="alert alert-danger py-2 mb-0 mt-2">
        <ul class="mb-0 ps-3">${errors.map((e) => html`<li>${e}</li>`)}</ul>
      </div>
    `;
  }

  #renderRatingButtons(currentRating, onChange) {
    return html`
      <div class="mb-3">
        <span class="form-label fw-semibold small mb-2 d-block"><i class="bi bi-star me-1"></i>${t("customers.field.rating", "Rating")}</span>
        <div class="d-flex gap-2">
          <button type="button"
            class="btn btn-sm ${currentRating === -1 ? "btn-danger" : "btn-outline-danger"}"
            @click=${() => onChange(currentRating === -1 ? 0 : -1)}>
            <i class="bi bi-hand-thumbs-down${currentRating === -1 ? "-fill" : ""} me-1"></i>${t("customers.field.rating.dislike", "Dislike")}
          </button>
          <button type="button"
            class="btn btn-sm ${currentRating === 1 ? "btn-success" : "btn-outline-success"}"
            @click=${() => onChange(currentRating === 1 ? 0 : 1)}>
            <i class="bi bi-hand-thumbs-up${currentRating === 1 ? "-fill" : ""} me-1"></i>${t("customers.field.rating.like", "Like")}
          </button>
        </div>
      </div>
    `;
  }

  #renderRatingView(rating) {
    return html`
      <div class="mb-3">
        <span class="form-label fw-semibold small mb-2 d-block"><i class="bi bi-star me-1"></i>${t("customers.field.rating", "Rating")}</span>
        <div>
          ${rating === 1
            ? html`<span class="badge bg-success">${t("customers.table.rating.good", "Good")}</span>`
            : rating === -1
            ? html`<span class="badge bg-danger">${t("customers.table.rating.bad", "Bad")}</span>`
            : html`<span class="text-muted small">—</span>`
          }
        </div>
      </div>
    `;
  }

  #renderViewModal() {
    const c = this._viewCustomer;
    const isEdit = this._viewMode === "edit";

    return html`
      <div class="modal fade" data-coreui-backdrop="static" data-coreui-keyboard="false" id="viewCustomerModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-person me-2"></i>${c?.FullName ?? ""}</h5>
              <button type="button" class="btn-close" data-coreui-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="form-floating mb-3">
                <input type="text" id="viewCustomerFullName" class="form-control"
                  placeholder=${t("customers.field.fullName", "Full Name")}
                  ?readonly=${!isEdit} />
                <label for="viewCustomerFullName"><i class="bi bi-person me-1"></i>${t("customers.field.fullName", "Full Name")} <span class="text-danger">*</span></label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="viewCustomerVat" class="form-control"
                  placeholder=${t("customers.field.vatOrPassport", "VAT / Passport")}
                  ?readonly=${!isEdit} />
                <label for="viewCustomerVat"><i class="bi bi-card-text me-1"></i>${t("customers.field.vatOrPassportNumber", "VAT / Passport Number")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="viewCustomerPhone" class="form-control"
                  placeholder=${t("customers.field.phone", "Phone")}
                  ?readonly=${!isEdit} />
                <label for="viewCustomerPhone"><i class="bi bi-telephone me-1"></i>${t("customers.field.phoneNumber", "Phone Number")}</label>
              </div>
              ${isEdit
                ? this.#renderRatingButtons(this._viewRating, (v) => this._viewRating = v)
                : this.#renderRatingView(c?.Rating ?? 0)
              }
              ${isEdit ? html`
                <input-autocomplete
                  id="viewCustomerNotes"
                  class="mb-3"
                  label=${t("customers.field.notes", "Notes")}
                  placeholder=${t("customers.field.notes", "Notes")}
                  .suggestions=${uniqueNotes(state.allCustomers)}
                ></input-autocomplete>
              ` : html`
                <div class="form-floating mb-3">
                  <input type="text" id="viewCustomerNotes" class="form-control" readonly
                    placeholder=${t("customers.field.notes", "Notes")} />
                  <label for="viewCustomerNotes">${t("customers.field.notes", "Notes")}</label>
                </div>
              `}
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" role="switch"
                  id="viewCustomerIgnoreMissingVat" ?disabled=${!isEdit} />
                <label class="form-check-label" for="viewCustomerIgnoreMissingVat">
                  <i class="bi bi-slash-circle me-1"></i>${t("customers.field.ignoreMissingVat", "Ignore missing VAT")}
                </label>
              </div>
              ${isEdit ? this.#renderErrors(this._viewErrors) : ""}
            </div>
            <div class="modal-footer">
              ${isEdit ? html`
                <button class="btn btn-secondary" @click=${this.#cancelEdit}
                  ?disabled=${this._viewSaving}>${t("common.cancel", "Cancel")}</button>
                <button class="btn btn-success" id="viewCustomerSaveBtn" @click=${this.#submitViewEdit}>
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
      <div class="modal fade" data-coreui-backdrop="static" data-coreui-keyboard="false" id="addCustomerModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-person-plus me-2"></i>${t("customers.modal.add.title", "Add Customer")}</h5>
              <button type="button" class="btn-close" data-coreui-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="form-floating mb-3">
                <input type="text" id="addCustomerFullName" class="form-control" placeholder=${t("customers.field.fullName", "Full Name")} />
                <label for="addCustomerFullName"><i class="bi bi-person me-1"></i>${t("customers.field.fullName", "Full Name")} <span class="text-danger">*</span></label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addCustomerVat" class="form-control" placeholder=${t("customers.field.vatOrPassport", "VAT / Passport")} />
                <label for="addCustomerVat"><i class="bi bi-card-text me-1"></i>${t("customers.field.vatOrPassportNumber", "VAT / Passport Number")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addCustomerPhone" class="form-control" placeholder=${t("customers.field.phone", "Phone")} />
                <label for="addCustomerPhone"><i class="bi bi-telephone me-1"></i>${t("customers.field.phoneNumber", "Phone Number")}</label>
              </div>
              ${this.#renderRatingButtons(this._addRating, (v) => this._addRating = v)}
              <input-autocomplete
                id="addCustomerNotes"
                class="mb-3"
                label=${t("customers.field.notes", "Notes")}
                placeholder=${t("customers.field.notes", "Notes")}
                .suggestions=${uniqueNotes(state.allCustomers)}
              ></input-autocomplete>
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" role="switch" id="addCustomerIgnoreMissingVat" />
                <label class="form-check-label" for="addCustomerIgnoreMissingVat">
                  <i class="bi bi-slash-circle me-1"></i>${t("customers.field.ignoreMissingVat", "Ignore missing VAT")}
                </label>
              </div>
              ${this.#renderErrors(this._addErrors)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-coreui-dismiss="modal" ?disabled=${this._addSaving}>${t("common.cancel", "Cancel")}</button>
              <button class="btn btn-success" id="addCustomerSaveBtn" @click=${this.#submitAdd}>
                <i class="bi bi-check-lg me-1"></i>${t("common.save", "Save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    const customers = this._filteredCustomers;
    const listContent = customers.length
      ? html`
          <div class="table-responsive rm-table-scroll">
            <table class="table table-sm table-striped table-hover rm-table rm-sticky-footer mb-0">
              <thead class="table-success">
                <tr>
                  <th>${t("customers.table.name", "Name")}</th>
                  <th class="text-center">${t("customers.table.phone", "Phone")}</th>
                  <th class="text-center">${t("customers.table.vatOrPassport", "VAT / Passport")}</th>
                  <th class="text-center">${t("customers.table.rating", "Rating")}</th>
                </tr>
              </thead>
              <tbody>
                ${customers.map((customer) => html`
                  <tr style="cursor:pointer" @click=${() => this.#openViewModal(customer)}>
                    <td class="fw-semibold">${customer.FullName}</td>
                    <td class="text-center">${customer.PhoneNumber || ""}</td>
                    <td class="text-center">${customer.VatOrPassport || ""}</td>
                    <td class="text-center">
                      ${customer.Rating === 1
                        ? html`<span class="badge bg-success">${t("customers.table.rating.good", "Good")}</span>`
                        : customer.Rating === -1
                        ? html`<span class="badge bg-danger">${t("customers.table.rating.bad", "Bad")}</span>`
                        : ""}
                    </td>
                  </tr>
                `)}
              </tbody>
              <tfoot class="fw-bold">
                <tr>
                  <td>${t("common.total", "Total")} (${customers.length})</td>
                  <td class="text-center"></td>
                  <td class="text-center"></td>
                  <td class="text-center"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        `
      : html`<p class="text-muted p-3">${t("customers.empty", "No customers found.")}</p>`;

    return html`
      ${filterBar(html`
        <div class="flex-shrink-0"><year-checkbox-dropdown
          .years=${this.#years}
          .defaultNone=${true}
          .cleaner=${true}
          @change=${this.#onYearChange}
        ></year-checkbox-dropdown></div>
        <div class="flex-shrink-0"><rental-filter-dropdown
          .rentals=${state.allRentals}
          .defaultNone=${true}
          .cleaner=${true}
          @change=${this.#onRentalChange}
        ></rental-filter-dropdown></div>
        <input
          type="text"
          id="customerSearchInput"
          class="form-control form-control-sm flex-shrink-0"
          style="width: 240px"
          aria-label=${t("customers.filter.search.placeholder", "Search...")}
          placeholder=${t("customers.filter.search.placeholder", "Search...")}
          @input=${this.#onSearch}
        />
        <div class="form-check form-switch mb-0">
          <input class="form-check-input" type="checkbox" role="switch"
            id="customerVatIgnoredFilter" @change=${this.#onVatFilterChange} />
          <label class="form-check-label small text-nowrap" for="customerVatIgnoredFilter">
            ${t("customers.filter.missingVatOnly", "Missing VAT only")}
          </label>
        </div>
      `)}
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-people me-1"></i> ${t("customers.title", "Customers")}</span>
          <button class="btn btn-success btn-sm" @click=${this.#openAddModal}>
            <i class="bi bi-plus-lg me-1"></i>${t("common.add", "Add")}
          </button>
        </div>
        <div>${listContent}</div>
      </div>
      ${this.#renderAddModal()}
      ${this.#renderViewModal()}
    `;
  }
}

customElements.define("customers-tab", CustomersTab);
