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
    _editErrors: { state: true },
    _addSaving: { state: true },
    _editSaving: { state: true },
    _addExtraInfo: { state: true },
    _editExtraInfo: { state: true },
  };

  constructor() {
    super();
    this._rentals = [];
    this._addErrors = [];
    this._editErrors = [];
    this._addSaving = false;
    this._editSaving = false;
    this._addExtraInfo = [];
    this._editExtraInfo = [];
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

  #updateExtraInfoRow(isEdit, i, field, val) {
    const list = isEdit ? this._editExtraInfo : this._addExtraInfo;
    const copy = list.map((e) => ({ ...e }));
    copy[i][field] = val;
    const last = copy[copy.length - 1];
    if (last.key.trim() && last.value.trim()) {
      copy.push({ key: "", value: "" });
    }
    if (isEdit) { this._editExtraInfo = copy; } else { this._addExtraInfo = copy; }
  }

  #removeExtraInfoRow(isEdit, i) {
    const list = isEdit ? this._editExtraInfo : this._addExtraInfo;
    const filtered = list.filter((_, idx) => idx !== i);
    if (!filtered.length || (filtered[filtered.length - 1].key.trim() && filtered[filtered.length - 1].value.trim())) {
      filtered.push({ key: "", value: "" });
    }
    if (isEdit) { this._editExtraInfo = filtered; } else { this._addExtraInfo = filtered; }
  }

  #openAddModal() {
    this._addErrors = [];
    this._addSaving = false;
    this._addExtraInfo = [{ key: "", value: "" }];
    const modal = coreui.Modal.getOrCreateInstance(this.querySelector("#addRentalModal"));
    modal.show();
    this.updateComplete.then(() => {
      this.querySelector("#addRentalName").value = "";
      this.querySelector("#addRentalAddress").value = "";
      this.querySelector("#addRentalPropertyRegistryNumber").value = "";
      this.querySelector("#addRentalFloorArea").value = "";
      this.querySelector("#addRentalElectricitySupplyNumber").value = "";
      this.querySelector("#addRentalWaterSupplyNumber").value = "";
      this.querySelector("#addRentalInternetPhoneNumber").value = "";
    });
  }

  #openEditModal(rental) {
    this._editErrors = [];
    this._editSaving = false;
    this._editExtraInfo = [...(rental.ExtraInfoJson || []).map((e) => ({ ...e })), { key: "", value: "" }];
    const modal = coreui.Modal.getOrCreateInstance(this.querySelector("#editRentalModal"));
    modal.show();
    this.updateComplete.then(() => {
      this.querySelector("#editRentalId").value = rental.Id;
      this.querySelector("#editRentalName").value = rental.Name;
      this.querySelector("#editRentalAddress").value = rental.Address ?? "";
      this.querySelector("#editRentalPropertyRegistryNumber").value = rental.PropertyRegistryNumber ?? "";
      this.querySelector("#editRentalFloorArea").value = rental.FloorArea ?? "";
      this.querySelector("#editRentalElectricitySupplyNumber").value = rental.ElectricitySupplyNumber ?? "";
      this.querySelector("#editRentalWaterSupplyNumber").value = rental.WaterSupplyNumber ?? "";
      this.querySelector("#editRentalInternetPhoneNumber").value = rental.InternetPhoneNumber ?? "";
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

  async #submitEdit() {
    const rentalId = this.querySelector("#editRentalId").value;
    const name = this.querySelector("#editRentalName").value.trim();
    const errors = validateRentalForm(name);
    if (errors.length) {
      this._editErrors = errors;
      return;
    }

    this._editErrors = [];
    const editBtn = this.querySelector("#editRentalSaveBtn");
    const editLb = coreui.LoadingButton.getInstance(editBtn) ?? new coreui.LoadingButton(editBtn, { disabledOnLoading: true });
    this._editSaving = true;
    editLb.start();
    try {
      await window.api.updateRental(rentalId, {
        Name: name,
        Address: this.querySelector("#editRentalAddress").value.trim(),
        PropertyRegistryNumber: this.querySelector("#editRentalPropertyRegistryNumber").value.trim(),
        FloorArea: this.querySelector("#editRentalFloorArea").value.trim(),
        ElectricitySupplyNumber: this.querySelector("#editRentalElectricitySupplyNumber").value.trim(),
        WaterSupplyNumber: this.querySelector("#editRentalWaterSupplyNumber").value.trim(),
        InternetPhoneNumber: this.querySelector("#editRentalInternetPhoneNumber").value.trim(),
        ExtraInfoJson: this._editExtraInfo.filter((e) => e.key.trim() && e.value.trim()),
      });
      coreui.Modal.getInstance(this.querySelector("#editRentalModal")).hide();
      await this.#reload();
    } catch (error) {
      this._editErrors = [error.message];
    } finally {
      editLb.stop();
      this._editSaving = false;
    }
  }

  #confirmDelete(rental) {
    showConfirm(
      t("rentals.confirmDelete.title", "Delete Rental"),
      t("rentals.confirmDelete.message", "Are you sure you want to delete this rental?"),
      t("common.delete", "Delete"),
      "btn-danger",
      (done) => {
        window.api.deleteRental(rental.Id)
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

  #addExtraInfoRow(isEdit) {
    if (isEdit) {
      this._editExtraInfo = [...this._editExtraInfo, { key: "", value: "" }];
    } else {
      this._addExtraInfo = [...this._addExtraInfo, { key: "", value: "" }];
    }
  }

  #renderExtraInfoEditor(isEdit) {
    const entries = isEdit ? this._editExtraInfo : this._addExtraInfo;
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
              @input=${(e) => this.#updateExtraInfoRow(isEdit, i, "key", e.target.value)}
            ></input-autocomplete>
            <input-autocomplete
              style="flex:1"
              .plain=${true}
              placeholder=${t("rentals.field.extraInfo.value", "Value")}
              .value=${entry.value}
              .suggestions=${pastValues}
              @input=${(e) => this.#updateExtraInfoRow(isEdit, i, "value", e.target.value)}
            ></input-autocomplete>
            <button type="button" class="btn btn-sm btn-outline-danger" @click=${() => this.#removeExtraInfoRow(isEdit, i)}>
              <i class="bi bi-x"></i>
            </button>
          </div>
        `)}
        <div class="d-flex justify-content-end">
          <button type="button" class="btn btn-sm btn-outline-success" @click=${() => this.#addExtraInfoRow(isEdit)}>
            <i class="bi bi-plus"></i>
          </button>
        </div>
      </div>
    `;
  }

  #renderModalBody(prefix, isEdit, errors) {
    return html`
      <div class="form-floating mb-3">
        <input type="text" id="${prefix}RentalName" class="form-control" placeholder=${t("rentals.field.name", "Name")} />
        <label><i class="bi bi-house-door me-1"></i>${t("rentals.field.name", "Name")} <span class="text-danger">*</span></label>
      </div>
      <div class="form-floating mb-3">
        <input type="text" id="${prefix}RentalAddress" class="form-control" placeholder=${t("rentals.field.address", "Address")} />
        <label><i class="bi bi-geo-alt me-1"></i>${t("rentals.field.address", "Address")}</label>
      </div>
      <div class="form-floating mb-3">
        <input type="text" id="${prefix}RentalFloorArea" class="form-control" placeholder=${t("rentals.field.floorArea", "Floor Area (m²)")} />
        <label><i class="bi bi-rulers me-1"></i>${t("rentals.field.floorArea", "Floor Area (m²)")}</label>
      </div>
      <div class="form-floating mb-3">
        <input type="text" id="${prefix}RentalPropertyRegistryNumber" class="form-control" placeholder=${t("rentals.field.propertyRegistry", "Property Registry Number")} />
        <label><i class="bi bi-file-earmark-text me-1"></i>${t("rentals.field.propertyRegistry", "Property Registry Number")}</label>
      </div>
      <div class="form-floating mb-3">
        <input type="text" id="${prefix}RentalElectricitySupplyNumber" class="form-control" placeholder=${t("rentals.field.electricitySupply", "Electricity Supply Number")} />
        <label><i class="bi bi-lightning me-1"></i>${t("rentals.field.electricitySupply", "Electricity Supply Number")}</label>
      </div>
      <div class="form-floating mb-3">
        <input type="text" id="${prefix}RentalWaterSupplyNumber" class="form-control" placeholder=${t("rentals.field.waterSupply", "Water Supply Number")} />
        <label><i class="bi bi-droplet me-1"></i>${t("rentals.field.waterSupply", "Water Supply Number")}</label>
      </div>
      <div class="form-floating mb-3">
        <input type="text" id="${prefix}RentalInternetPhoneNumber" class="form-control" placeholder=${t("rentals.field.internetPhone", "Internet Phone Number")} />
        <label><i class="bi bi-telephone me-1"></i>${t("rentals.field.internetPhone", "Internet Phone Number")}</label>
      </div>
      ${this.#renderExtraInfoEditor(isEdit)}
      ${this.#renderErrors(errors)}
    `;
  }

  #renderAddModal() {
    return html`
      <div class="modal fade" data-coreui-backdrop="static" data-coreui-keyboard="false" id="addRentalModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-house-add me-2"></i>${t("rentals.modal.add.title", "Add Rental")}</h5>
            </div>
            <div class="modal-body">
              ${this.#renderModalBody("add", false, this._addErrors)}
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

  #renderEditModal() {
    return html`
      <div class="modal fade" data-coreui-backdrop="static" data-coreui-keyboard="false" id="editRentalModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>${t("rentals.modal.edit.title", "Edit Rental")}</h5>
            </div>
            <div class="modal-body">
              <input type="hidden" id="editRentalId" />
              ${this.#renderModalBody("edit", true, this._editErrors)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-coreui-dismiss="modal" ?disabled=${this._editSaving}>${t("common.cancel", "Cancel")}</button>
              <button class="btn btn-success" id="editRentalSaveBtn" @click=${this.#submitEdit}>
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
                  <th class="text-center"></th>
                </tr>
              </thead>
              <tbody>
                ${this._rentals.map((rental) => {
                  const hasBookings = state.allBookings.some((booking) => booking.RentalId === rental.Id);
                  const hasExpenses = state.allExpenses.some((expense) => expense.RentalIds.includes(rental.Id));
                  const canDelete = !hasBookings && !hasExpenses;
                  return html`
                    <tr>
                      <td class="fw-semibold">${rental.Name}</td>
                      <td class="text-center">${rental.FloorArea || ""}</td>
                      <td class="text-center">${rental.PropertyRegistryNumber || ""}</td>
                      <td class="text-center">
                        <div class="d-flex gap-1 justify-content-center">
                          <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEditModal(rental)}>
                            <i class="bi bi-pencil"></i>
                          </button>
                          <button
                            class="btn btn-sm btn-outline-danger"
                            @click=${() => this.#confirmDelete(rental)}
                            ?disabled=${!canDelete}
                            title=${!canDelete ? t("rentals.table.hasReferences", "Has bookings or expenses") : ""}
                          >
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
                  <td>${t("common.total", "Total")} (${this._rentals.length})</td>
                  <td class="text-center"></td>
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
      ${this.#renderEditModal()}
    `;
  }
}

customElements.define("rentals-tab", RentalsTab);
