import { LitElement, html } from "../../lib/lit.min.js";
import { showConfirm } from "../confirm.js";
import { state } from "../state.js";

function validateRentalForm(name) {
  return name ? [] : ["Name is required."];
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
      await window.api.addRental({ Name: name });
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
      await window.api.updateRental(rentalId, { Name: name });
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
      "Delete Rental",
      "Are you sure you want to delete this rental?",
      "Delete",
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
              <h5 class="modal-title"><i class="bi bi-house-add me-2"></i>Add Rental</h5>
            </div>
            <div class="modal-body">
              <div class="form-floating mb-3">
                <input type="text" id="addRentalName" class="form-control" placeholder="Name" />
                <label><i class="bi bi-house-door me-1"></i>Name <span class="text-danger">*</span></label>
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
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="editRentalModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Edit Rental</h5>
            </div>
            <div class="modal-body">
              <input type="hidden" id="editRentalId" />
              <div class="form-floating mb-3">
                <input type="text" id="editRentalName" class="form-control" placeholder="Name" />
                <label><i class="bi bi-house-door me-1"></i>Name <span class="text-danger">*</span></label>
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

  render() {
    const listContent = this._rentals.length
      ? html`
          <!-- Desktop layout -->
          <ul class="list-group list-group-flush d-none d-md-block">
            ${this._rentals.map((rental) => {
              const hasBookings = state.allBookings.some((booking) => booking.RentalId === rental.Id);
              const hasExpenses = state.allExpenses.some((expense) => expense.RentalIds.includes(rental.Id));
              const canDelete = !hasBookings && !hasExpenses;
              return html`
                <li class="list-group-item d-flex align-items-center py-2 gap-3">
                  <i class="bi bi-house-fill text-secondary flex-shrink-0"></i>
                  <span class="fw-semibold">${rental.Name}</span>
                  <div class="d-flex gap-2 flex-shrink-0 ms-auto">
                    <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEditModal(rental)}>
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button
                      class="btn btn-sm btn-outline-danger"
                      @click=${() => this.#confirmDelete(rental)}
                      ?disabled=${!canDelete}
                      title=${!canDelete ? "Has bookings or expenses" : ""}
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
            ${this._rentals.map((rental) => {
              const hasBookings = state.allBookings.some((booking) => booking.RentalId === rental.Id);
              const hasExpenses = state.allExpenses.some((expense) => expense.RentalIds.includes(rental.Id));
              const canDelete = !hasBookings && !hasExpenses;
              return html`
                <div class="card border rounded-3 px-3 py-2">
                  <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center gap-2">
                      <i class="bi bi-house-fill text-secondary"></i>
                      <span class="fw-semibold">${rental.Name}</span>
                    </div>
                    <div class="d-flex gap-2">
                      <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEditModal(rental)}>
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button
                        class="btn btn-sm btn-outline-danger"
                        @click=${() => this.#confirmDelete(rental)}
                        ?disabled=${!canDelete}
                        title=${!canDelete ? "Has bookings or expenses" : ""}
                      >
                        <i class="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              `;
            })}
          </div>
        `
      : html`<p class="text-muted p-3">No rentals yet.</p>`;

    return html`
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-house-door me-1"></i> Rentals</span>
          <button class="btn btn-success btn-sm" @click=${this.#openAddModal}>
            <i class="bi bi-plus-lg me-1"></i>Add
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
