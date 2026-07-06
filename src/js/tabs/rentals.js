import { LitElement, html } from "../../lib/lit.min.js";
import { showConfirm } from "../confirm.js";
import { state } from "../state.js";
import { subscribeLanguage, t } from "../translations.js";

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
  };

  constructor() {
    super();
    this._rentals = [];
    this._addErrors = [];
    this._editErrors = [];
    this._addSaving = false;
    this._editSaving = false;
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

  #openAddModal() {
    this._addErrors = [];
    this._addSaving = false;
    const modal = bootstrap.Modal.getOrCreateInstance(this.querySelector("#addRentalModal"));
    modal.show();
    this.updateComplete.then(() => {
      this.querySelector("#addRentalName").value = "";
      this.querySelector("#addRentalPropertyRegistryNumber").value = "";
      this.querySelector("#addRentalFloorArea").value = "";
      this.querySelector("#addRentalElectricitySupplyNumber").value = "";
    });
  }

  #openEditModal(rental) {
    this._editErrors = [];
    this._editSaving = false;
    const modal = bootstrap.Modal.getOrCreateInstance(this.querySelector("#editRentalModal"));
    modal.show();
    this.updateComplete.then(() => {
      this.querySelector("#editRentalId").value = rental.Id;
      this.querySelector("#editRentalName").value = rental.Name;
      this.querySelector("#editRentalPropertyRegistryNumber").value = rental.PropertyRegistryNumber ?? "";
      this.querySelector("#editRentalFloorArea").value = rental.FloorArea ?? "";
      this.querySelector("#editRentalElectricitySupplyNumber").value = rental.ElectricitySupplyNumber ?? "";
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
    this._addSaving = true;
    try {
      await window.api.addRental({
        Name: name,
        PropertyRegistryNumber: this.querySelector("#addRentalPropertyRegistryNumber").value.trim(),
        FloorArea: this.querySelector("#addRentalFloorArea").value.trim(),
        ElectricitySupplyNumber: this.querySelector("#addRentalElectricitySupplyNumber").value.trim(),
      });
      bootstrap.Modal.getInstance(this.querySelector("#addRentalModal")).hide();
      await this.#reload();
    } catch (error) {
      this._addErrors = [error.message];
    } finally {
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
    this._editSaving = true;
    try {
      await window.api.updateRental(rentalId, {
        Name: name,
        PropertyRegistryNumber: this.querySelector("#editRentalPropertyRegistryNumber").value.trim(),
        FloorArea: this.querySelector("#editRentalFloorArea").value.trim(),
        ElectricitySupplyNumber: this.querySelector("#editRentalElectricitySupplyNumber").value.trim(),
      });
      bootstrap.Modal.getInstance(this.querySelector("#editRentalModal")).hide();
      await this.#reload();
    } catch (error) {
      this._editErrors = [error.message];
    } finally {
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

  #renderAddModal() {
    return html`
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="addRentalModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-house-add me-2"></i>${t("rentals.modal.add.title", "Add Rental")}</h5>
            </div>
            <div class="modal-body">
              <div class="form-floating mb-3">
                <input type="text" id="addRentalName" class="form-control" placeholder=${t("rentals.field.name", "Name")} />
                <label><i class="bi bi-house-door me-1"></i>${t("rentals.field.name", "Name")} <span class="text-danger">*</span></label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addRentalPropertyRegistryNumber" class="form-control" placeholder=${t("rentals.field.propertyRegistry", "Property Registry Number")} />
                <label>${t("rentals.field.propertyRegistry", "Property Registry Number")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addRentalFloorArea" class="form-control" placeholder=${t("rentals.field.floorArea", "Floor Area (m²)")} />
                <label>${t("rentals.field.floorArea", "Floor Area (m²)")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addRentalElectricitySupplyNumber" class="form-control" placeholder=${t("rentals.field.electricitySupply", "Electricity Supply Number")} />
                <label>${t("rentals.field.electricitySupply", "Electricity Supply Number")}</label>
              </div>
              ${this.#renderErrors(this._addErrors)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal" ?disabled=${this._addSaving}>${t("common.cancel", "Cancel")}</button>
              <button class="btn btn-success" @click=${this.#submitAdd} ?disabled=${this._addSaving}>
                ${this._addSaving
                  ? html`<span class="spinner-border spinner-border-sm me-1"></span>${t("common.saving", "Saving…")}`
                  : html`<i class="bi bi-check-lg me-1"></i>${t("common.save", "Save")}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  #renderEditModal() {
    return html`
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="editRentalModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>${t("rentals.modal.edit.title", "Edit Rental")}</h5>
            </div>
            <div class="modal-body">
              <input type="hidden" id="editRentalId" />
              <div class="form-floating mb-3">
                <input type="text" id="editRentalName" class="form-control" placeholder=${t("rentals.field.name", "Name")} />
                <label><i class="bi bi-house-door me-1"></i>${t("rentals.field.name", "Name")} <span class="text-danger">*</span></label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="editRentalPropertyRegistryNumber" class="form-control" placeholder=${t("rentals.field.propertyRegistry", "Property Registry Number")} />
                <label>${t("rentals.field.propertyRegistry", "Property Registry Number")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="editRentalFloorArea" class="form-control" placeholder=${t("rentals.field.floorArea", "Floor Area (m²)")} />
                <label>${t("rentals.field.floorArea", "Floor Area (m²)")}</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="editRentalElectricitySupplyNumber" class="form-control" placeholder=${t("rentals.field.electricitySupply", "Electricity Supply Number")} />
                <label>${t("rentals.field.electricitySupply", "Electricity Supply Number")}</label>
              </div>
              ${this.#renderErrors(this._editErrors)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal" ?disabled=${this._editSaving}>${t("common.cancel", "Cancel")}</button>
              <button class="btn btn-success" @click=${this.#submitEdit} ?disabled=${this._editSaving}>
                ${this._editSaving
                  ? html`<span class="spinner-border spinner-border-sm me-1"></span>${t("common.saving", "Saving…")}`
                  : html`<i class="bi bi-check-lg me-1"></i>${t("common.save", "Save")}`}
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
                  <th class="text-center">${t("rentals.table.propertyRegistry", "Property Registry #")}</th>
                  <th class="text-center">${t("rentals.table.floorArea", "Floor Area (m²)")}</th>
                  <th class="text-center">${t("rentals.table.electricitySupply", "Electricity Supply #")}</th>
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
                      <td class="text-center">${rental.PropertyRegistryNumber || ""}</td>
                      <td class="text-center">${rental.FloorArea || ""}</td>
                      <td class="text-center">${rental.ElectricitySupplyNumber || ""}</td>
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
