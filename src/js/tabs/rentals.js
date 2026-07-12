import { LitElement, html } from "../../lib/lit.min.js";
import { showConfirm } from "../confirm.js";
import { state } from "../state.js";
import { subscribeLanguage, t } from "../translations.js";
import "../components/inputAutocomplete.js";

function validateRentalForm(name) {
  return name ? [] : [t("rentals.error.nameRequired", "Name is required.")];
}

class RentalsTab extends LitElement {
  static properties = {
    _rentals: { state: true },
    _addErrors: { state: true },
    _addSaving: { state: true },
    _addExtraInfo: { state: true },
    _viewRental: { state: true },
    _viewMode: { state: true },
    _viewExtraInfo: { state: true },
    _viewErrors: { state: true },
    _viewSaving: { state: true },
  };


  constructor() {
    super();
    this._rentals = [];
    this._addErrors = [];
    this._addSaving = false;
    this._addExtraInfo = [];
    this._viewRental = null;
    this._viewMode = "view";
    this._viewExtraInfo = [];
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
    this._rentals = state.allRentals;
  }

  async #reload() {
    await window.api.loadAll();
    window.refreshCurrentTab();
  }

  #pastKeys() {
    const keys = new Set();
    for (const r of this._rentals)
      for (const e of (r.ExtraInfoJson || []))
        if (e.key) keys.add(e.key);
    return [...keys];
  }

  #pastValues() {
    const values = new Set();
    for (const r of this._rentals)
      for (const e of (r.ExtraInfoJson || []))
        if (e.value) values.add(e.value);
    return [...values];
  }

  #updateExtraInfoRow(isView, i, field, val) {
    const list = isView ? this._viewExtraInfo : this._addExtraInfo;
    const copy = list.map((e) => ({ ...e }));
    copy[i][field] = val;
    const last = copy[copy.length - 1];
    if (last.key.trim() && last.value.trim()) copy.push({ key: "", value: "" });
    if (isView) { this._viewExtraInfo = copy; } else { this._addExtraInfo = copy; }
  }

  #removeExtraInfoRow(isView, i) {
    const list = isView ? this._viewExtraInfo : this._addExtraInfo;
    const filtered = list.filter((_, idx) => idx !== i);
    if (!filtered.length || (filtered[filtered.length - 1].key.trim() && filtered[filtered.length - 1].value.trim())) {
      filtered.push({ key: "", value: "" });
    }
    if (isView) { this._viewExtraInfo = filtered; } else { this._addExtraInfo = filtered; }
  }

  #addExtraInfoRow(isView) {
    if (isView) {
      this._viewExtraInfo = [...this._viewExtraInfo, { key: "", value: "" }];
    } else {
      this._addExtraInfo = [...this._addExtraInfo, { key: "", value: "" }];
    }
  }

  // --- view/edit modal ---

  #openViewModal(rental) {
    this._viewRental = rental;
    this._viewMode = "view";
    this._viewErrors = [];
    this._viewSaving = false;
    this.updateComplete.then(() => {
      this.#populateFields();
      coreui.Modal.getOrCreateInstance(this.querySelector("#viewRentalModal")).show();
    });
  }

  #populateFields() {
    const r = this._viewRental;
    if (!r) return;
    const set = (id, val) => { const el = this.querySelector(`#${id}`); if (el) el.value = val ?? ""; };
    set("viewRentalName", r.Name);
    set("viewRentalAddress", r.Address);
    set("viewRentalFloorArea", r.FloorArea);
    set("viewRentalPropertyRegistryNumber", r.PropertyRegistryNumber);
    set("viewRentalElectricitySupplyNumber", r.ElectricitySupplyNumber);
    set("viewRentalWaterSupplyNumber", r.WaterSupplyNumber);
    set("viewRentalInternetPhoneNumber", r.InternetPhoneNumber);
  }

  #enterEditMode() {
    const r = this._viewRental;
    this._viewExtraInfo = [...(r.ExtraInfoJson || []).map((e) => ({ ...e })), { key: "", value: "" }];
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
    const rental = this._viewRental;
    const hasBookings = state.allBookings.some((b) => b.RentalId === rental.Id);
    const hasExpenses = state.allExpenses.some((e) => e.RentalIds.includes(rental.Id));
    if (hasBookings || hasExpenses) {
      this.#showNotification(t("rentals.error.cannotDelete", "Can't delete: rental has bookings or expenses."));
      return;
    }
    showConfirm(
      t("rentals.confirmDelete.title", "Delete Rental"),
      t("rentals.confirmDelete.message", "Are you sure you want to delete this rental?"),
      t("common.delete", "Delete"),
      "btn-danger",
      (done) => {
        window.api.deleteRental(rental.Id)
          .then(() => {
            done();
            coreui.Modal.getInstance(this.querySelector("#viewRentalModal"))?.hide();
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
    const rentalId = this._viewRental.Id;
    const name = this.querySelector("#viewRentalName").value.trim();
    const errors = validateRentalForm(name);
    if (errors.length) {
      this._viewErrors = errors;
      return;
    }
    this._viewErrors = [];
    const saveBtn = this.querySelector("#viewRentalSaveBtn");
    const lb = coreui.LoadingButton.getInstance(saveBtn) ?? new coreui.LoadingButton(saveBtn, { disabledOnLoading: true });
    this._viewSaving = true;
    lb.start();
    try {
      await window.api.updateRental(rentalId, {
        Name: name,
        Address: this.querySelector("#viewRentalAddress").value.trim(),
        PropertyRegistryNumber: this.querySelector("#viewRentalPropertyRegistryNumber").value.trim(),
        FloorArea: this.querySelector("#viewRentalFloorArea").value.trim(),
        ElectricitySupplyNumber: this.querySelector("#viewRentalElectricitySupplyNumber").value.trim(),
        WaterSupplyNumber: this.querySelector("#viewRentalWaterSupplyNumber").value.trim(),
        InternetPhoneNumber: this.querySelector("#viewRentalInternetPhoneNumber").value.trim(),
        ExtraInfoJson: this._viewExtraInfo.filter((e) => e.key.trim() && e.value.trim()),
      });
      await this.#reload();
      this._viewRental = state.allRentals.find((r) => r.Id === rentalId) ?? this._viewRental;
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
    this._addExtraInfo = [{ key: "", value: "" }];
    const modal = coreui.Modal.getOrCreateInstance(this.querySelector("#addRentalModal"));
    modal.show();
    this.updateComplete.then(() => {
      ["addRentalName", "addRentalAddress", "addRentalPropertyRegistryNumber",
       "addRentalFloorArea", "addRentalElectricitySupplyNumber",
       "addRentalWaterSupplyNumber", "addRentalInternetPhoneNumber"].forEach((id) => {
        this.querySelector(`#${id}`).value = "";
      });
    });
  }

  async #submitAdd() {
    const name = this.querySelector("#addRentalName").value.trim();
    const errors = validateRentalForm(name);
    if (errors.length) {
      this._addErrors = errors;
      return;
    }
    this._addErrors = [];
    const addBtn = this.querySelector("#addRentalSaveBtn");
    const addLb = coreui.LoadingButton.getInstance(addBtn) ?? new coreui.LoadingButton(addBtn, { disabledOnLoading: true });
    this._addSaving = true;
    addLb.start();
    try {
      await window.api.addRental({
        Name: name,
        Address: this.querySelector("#addRentalAddress").value.trim(),
        PropertyRegistryNumber: this.querySelector("#addRentalPropertyRegistryNumber").value.trim(),
        FloorArea: this.querySelector("#addRentalFloorArea").value.trim(),
        ElectricitySupplyNumber: this.querySelector("#addRentalElectricitySupplyNumber").value.trim(),
        WaterSupplyNumber: this.querySelector("#addRentalWaterSupplyNumber").value.trim(),
        InternetPhoneNumber: this.querySelector("#addRentalInternetPhoneNumber").value.trim(),
        ExtraInfoJson: this._addExtraInfo.filter((e) => e.key.trim() && e.value.trim()),
      });
      coreui.Modal.getInstance(this.querySelector("#addRentalModal")).hide();
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

  #renderExtraInfoEditor(isView) {
    const entries = isView ? this._viewExtraInfo : this._addExtraInfo;
    const pastKeys = this.#pastKeys();
    const pastValues = this.#pastValues();
    return html`
      <div class="mb-1">
        <label class="form-label fw-semibold small mb-1">
          <i class="bi bi-tags me-1"></i>${t("rentals.field.extraInfo", "Extra Info")}
        </label>
        ${entries.map((entry, i) => html`
          <div class="d-flex gap-1 mb-1 align-items-center">
            <input-autocomplete
              style="flex:1"
              .plain=${true}
              placeholder=${t("rentals.field.extraInfo.key", "Key")}
              .value=${entry.key}
              .suggestions=${pastKeys}
              @input=${(e) => this.#updateExtraInfoRow(isView, i, "key", e.target.value)}
            ></input-autocomplete>
            <input-autocomplete
              style="flex:1"
              .plain=${true}
              placeholder=${t("rentals.field.extraInfo.value", "Value")}
              .value=${entry.value}
              .suggestions=${pastValues}
              @input=${(e) => this.#updateExtraInfoRow(isView, i, "value", e.target.value)}
            ></input-autocomplete>
            <button type="button" class="btn btn-sm btn-outline-danger"
              @click=${() => this.#removeExtraInfoRow(isView, i)}>
              <i class="bi bi-x"></i>
            </button>
          </div>
        `)}
        <div class="d-flex justify-content-end">
          <button type="button" class="btn btn-sm btn-outline-success"
            @click=${() => this.#addExtraInfoRow(isView)}>
            <i class="bi bi-plus"></i>
          </button>
        </div>
      </div>
    `;
  }

  #renderExtraInfoView(entries) {
    if (!entries.length) return "";
    return html`
      ${entries.map((entry) => html`
        <div class="form-floating mb-3">
          <input type="text" class="form-control" readonly
            .value=${entry.value} placeholder=${entry.key} />
          <label>${entry.key}</label>
        </div>
      `)}
    `;
  }

  #renderViewModal() {
    const r = this._viewRental;
    const isEdit = this._viewMode === "edit";
    const hasBookings = r && state.allBookings.some((b) => b.RentalId === r.Id);
    const hasExpenses = r && state.allExpenses.some((e) => e.RentalIds.includes(r.Id));
    const canDelete = !hasBookings && !hasExpenses;

    const fields = [
      { id: "viewRentalName", label: t("rentals.field.name", "Name"), icon: "bi-house-door", required: true },
      { id: "viewRentalAddress", label: t("rentals.field.address", "Address"), icon: "bi-geo-alt" },
      { id: "viewRentalFloorArea", label: t("rentals.field.floorArea", "Floor Area (m²)"), icon: "bi-rulers" },
      { id: "viewRentalPropertyRegistryNumber", label: t("rentals.field.propertyRegistry", "Property Registry Number"), icon: "bi-file-earmark-text" },
      { id: "viewRentalElectricitySupplyNumber", label: t("rentals.field.electricitySupply", "Electricity Supply Number"), icon: "bi-lightning" },
      { id: "viewRentalWaterSupplyNumber", label: t("rentals.field.waterSupply", "Water Supply Number"), icon: "bi-droplet" },
      { id: "viewRentalInternetPhoneNumber", label: t("rentals.field.internetPhone", "Internet Phone Number"), icon: "bi-telephone" },
    ];

    return html`
      <div class="modal fade" data-coreui-backdrop="static" data-coreui-keyboard="false" id="viewRentalModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-house-door me-2"></i>${r?.Name ?? ""}
              </h5>
              <button type="button" class="btn-close" data-coreui-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              ${fields.map((f) => html`
                <div class="form-floating mb-3">
                  <input type="text" id=${f.id} class="form-control"
                    placeholder=${f.label}
                    ?readonly=${!isEdit}
                  />
                  <label><i class="bi ${f.icon} me-1"></i>${f.label}${f.required ? html` <span class="text-danger">*</span>` : ""}</label>
                </div>
              `)}
              ${isEdit
                ? this.#renderExtraInfoEditor(true)
                : this.#renderExtraInfoView(r?.ExtraInfoJson || [])
              }
              ${isEdit ? this.#renderErrors(this._viewErrors) : ""}
            </div>
            <div class="modal-footer">
              ${isEdit ? html`
                <button class="btn btn-secondary" @click=${this.#cancelEdit}
                  ?disabled=${this._viewSaving}>${t("common.cancel", "Cancel")}</button>
                <button class="btn btn-success" id="viewRentalSaveBtn" @click=${this.#submitViewEdit}>
                  <i class="bi bi-check-lg me-1"></i>${t("common.save", "Save")}
                </button>
              ` : html`
                <button class="btn btn-danger"
                  @click=${this.#handleDelete}
                  ?disabled=${this._viewSaving}
                >
                  ${t("common.delete", "Delete")}
                </button>
                <button class="btn btn-primary ms-auto"
                  @click=${this.#enterEditMode}
                  ?disabled=${this._viewSaving}
                >
                  ${t("common.edit", "Edit")}
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  #renderAddModal() {
    return html`
      <div class="modal fade" data-coreui-backdrop="static" data-coreui-keyboard="false" id="addRentalModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-house-add me-2"></i>${t("rentals.modal.add.title", "Add Rental")}</h5>
              <button type="button" class="btn-close" data-coreui-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="form-floating mb-3">
                <input type="text" id="addRentalName" class="form-control" placeholder=${t("rentals.field.name", "Name")} />
                <label><i class="bi bi-house-door me-1"></i>${t("rentals.field.name", "Name")} <span class="text-danger">*</span></label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addRentalAddress" class="form-control" placeholder=${t("rentals.field.address", "Address")} />
                <label><i class="bi bi-geo-alt me-1"></i>${t("rentals.field.address", "Address")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addRentalFloorArea" class="form-control" placeholder=${t("rentals.field.floorArea", "Floor Area (m²)")} />
                <label><i class="bi bi-rulers me-1"></i>${t("rentals.field.floorArea", "Floor Area (m²)")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addRentalPropertyRegistryNumber" class="form-control" placeholder=${t("rentals.field.propertyRegistry", "Property Registry Number")} />
                <label><i class="bi bi-file-earmark-text me-1"></i>${t("rentals.field.propertyRegistry", "Property Registry Number")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addRentalElectricitySupplyNumber" class="form-control" placeholder=${t("rentals.field.electricitySupply", "Electricity Supply Number")} />
                <label><i class="bi bi-lightning me-1"></i>${t("rentals.field.electricitySupply", "Electricity Supply Number")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addRentalWaterSupplyNumber" class="form-control" placeholder=${t("rentals.field.waterSupply", "Water Supply Number")} />
                <label><i class="bi bi-droplet me-1"></i>${t("rentals.field.waterSupply", "Water Supply Number")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addRentalInternetPhoneNumber" class="form-control" placeholder=${t("rentals.field.internetPhone", "Internet Phone Number")} />
                <label><i class="bi bi-telephone me-1"></i>${t("rentals.field.internetPhone", "Internet Phone Number")}</label>
              </div>
              ${this.#renderExtraInfoEditor(false)}
              ${this.#renderErrors(this._addErrors)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-coreui-dismiss="modal" ?disabled=${this._addSaving}>${t("common.cancel", "Cancel")}</button>
              <button class="btn btn-success" id="addRentalSaveBtn" @click=${this.#submitAdd}>
                <i class="bi bi-check-lg me-1"></i>${t("common.save", "Save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    const listContent = this._rentals.length
      ? html`
          <div class="table-responsive rm-table-scroll">
            <table class="table table-sm table-striped table-hover rm-table rm-sticky-footer mb-0">
              <thead class="table-success">
                <tr>
                  <th>${t("rentals.table.name", "Name")}</th>
                  <th class="text-center">${t("rentals.table.floorArea", "Floor Area (m²)")}</th>
                  <th class="text-center">${t("rentals.table.propertyRegistry", "Property Registry #")}</th>
                </tr>
              </thead>
              <tbody>
                ${this._rentals.map((rental) => html`
                  <tr
                    style="cursor:pointer"
                    @click=${() => this.#openViewModal(rental)}
                  >
                    <td class="fw-semibold">${rental.Name}</td>
                    <td class="text-center">${rental.FloorArea || ""}</td>
                    <td class="text-center">${rental.PropertyRegistryNumber || ""}</td>
                  </tr>
                `)}
              </tbody>
              <tfoot class="fw-bold">
                <tr>
                  <td>${t("common.total", "Total")} (${this._rentals.length})</td>
                  <td class="text-center"></td>
                  <td class="text-center"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        `
      : html`<p class="text-muted p-3">${t("rentals.empty", "No rentals yet.")}</p>`;

    return html`
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-house-door me-1"></i> ${t("rentals.title", "Rentals")}</span>
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

customElements.define("rentals-tab", RentalsTab);
