import { LitElement, html } from "../../lib/lit.min.js";
import "../components/rentalCheckboxes.js";
import "../components/rentalFilterDropdown.js";
import { extractYearsFromItems } from "../components/yearCheckboxDropdown.js";
import { showConfirm } from "../confirm.js";
import { state } from "../state.js";
import { formatDate, todayStr } from "../utils.js";

function validateExpenseForm(name, amountEuros, date) {
  const errors = [];
  if (!name) {
    errors.push("Please enter a name.");
  }

  if (!date) {
    errors.push("Please select a date.");
  }

  if (isNaN(amountEuros) || amountEuros <= 0) {
    errors.push("Amount must be greater than 0.");
  }

  return errors;
}

class ExpensesTab extends LitElement {
  static properties = {
    _filteredExpenses: { state: true },
    _years: { state: true },
    _addErrors: { state: true },
    _editErrors: { state: true },
    _addSaving: { state: true },
    _editSaving: { state: true },
  };

  #allExpenses = [];
  #selectedYears = [];
  #selectedRentalIds = [];

  constructor() {
    super();
    this._filteredExpenses = [];
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
    this.#allExpenses = state.allExpenses;
    this._years = extractYearsFromItems(this.#allExpenses, "DateCreated");
    this.#applyFilters();
  }

  async #reload() {
    await window.api.loadAll();
    window.refreshCurrentTab();
  }

  #applyFilters() {
    this._filteredExpenses = this.#allExpenses.filter((expense) => {
      if (this.#selectedYears.length > 0 && !this.#selectedYears.includes(expense.Year)) {
        return false;
      }

      if (
        this.#selectedRentalIds.length > 0 &&
        !expense.RentalIds.some((rentalId) => this.#selectedRentalIds.includes(rentalId))
      ) {
        return false;
      }

      return true;
    });
  }

  #onYearChange(event) {
    this.#selectedYears = event.target.selectedYears;
    this.#applyFilters();
  }

  #onRentalChange(event) {
    this.#selectedRentalIds = event.target.selectedIds;
    this.#applyFilters();
  }

  #openAddModal() {
    this._addErrors = [];
    this._addSaving = false;
    const modal = bootstrap.Modal.getOrCreateInstance(this.querySelector("#addExpenseModal"));
    modal.show();
    this.updateComplete.then(() => {
      this.querySelector("#addExpenseName").value = "";
      this.querySelector("#addExpenseAmount").value = "";
      this.querySelector("#addExpenseDate").value = todayStr();
      this.querySelector("#addExpenseNotes").value = "";
      const checkboxes = this.querySelector("#addExpenseRentalCheckboxes");
      checkboxes.rentals = state.allRentals;
      checkboxes.initialIds = null;
    });
  }

  #openEditModal(expense) {
    this._editErrors = [];
    this._editSaving = false;
    const modal = bootstrap.Modal.getOrCreateInstance(this.querySelector("#editExpenseModal"));
    modal.show();
    this.updateComplete.then(() => {
      this.querySelector("#editExpenseId").value = expense.Id;
      this.querySelector("#editExpenseName").value = expense.Name;
      this.querySelector("#editExpenseAmount").value = expense.AmountEuros;
      this.querySelector("#editExpenseDate").value = expense.DateCreated || "";
      this.querySelector("#editExpenseNotes").value = expense.Notes || "";
      const checkboxes = this.querySelector("#editExpenseRentalCheckboxes");
      checkboxes.rentals = state.allRentals;
      checkboxes.initialIds = expense.RentalIds;
    });
  }

  async #submitAdd() {
    const name = this.querySelector("#addExpenseName").value.trim();
    const amountEuros = parseFloat(this.querySelector("#addExpenseAmount").value);
    const date = this.querySelector("#addExpenseDate").value;
    const notes = this.querySelector("#addExpenseNotes").value.trim();
    const rentalIds = this.querySelector("#addExpenseRentalCheckboxes").selectedIds;
    const errors = validateExpenseForm(name, amountEuros, date);
    if (errors.length) {
      this._addErrors = errors;
      return;
    }

    this._addErrors = [];
    this._addSaving = true;
    try {
      await window.api.addExpense({
        RentalIds: rentalIds.join(","),
        Name: name,
        AmountEuros: amountEuros,
        Notes: notes,
        DateCreated: date,
      });
      bootstrap.Modal.getInstance(this.querySelector("#addExpenseModal")).hide();
      await this.#reload();
    } catch (error) {
      this._addErrors = [error.message];
    } finally {
      this._addSaving = false;
    }
  }

  async #submitEdit() {
    const expenseId = this.querySelector("#editExpenseId").value;
    const name = this.querySelector("#editExpenseName").value.trim();
    const amountEuros = parseFloat(this.querySelector("#editExpenseAmount").value);
    const date = this.querySelector("#editExpenseDate").value;
    const notes = this.querySelector("#editExpenseNotes").value.trim();
    const rentalIds = this.querySelector("#editExpenseRentalCheckboxes").selectedIds;
    const errors = validateExpenseForm(name, amountEuros, date);
    if (errors.length) {
      this._editErrors = errors;
      return;
    }

    this._editErrors = [];
    this._editSaving = true;
    try {
      await window.api.updateExpense(expenseId, {
        RentalIds: rentalIds.join(","),
        Name: name,
        AmountEuros: amountEuros,
        Notes: notes,
        DateCreated: date,
      });
      bootstrap.Modal.getInstance(this.querySelector("#editExpenseModal")).hide();
      await this.#reload();
    } catch (error) {
      this._editErrors = [error.message];
    } finally {
      this._editSaving = false;
    }
  }

  #confirmDelete(expense) {
    showConfirm(
      "Delete Expense",
      "Are you sure you want to delete this expense?",
      "Delete",
      "btn-danger",
      (done) => {
        window.api.deleteExpense(expense.Id)
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
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="addExpenseModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-receipt me-2"></i>Add Expense</h5>
            </div>
            <div class="modal-body">
              <div class="form-floating mb-3">
                <input type="text" id="addExpenseName" class="form-control" placeholder="Name" />
                <label><i class="bi bi-tag me-1"></i>Name</label>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold small"><i class="bi bi-house-door me-1"></i>Rentals</label>
                <rental-checkboxes id="addExpenseRentalCheckboxes"></rental-checkboxes>
              </div>
              <div class="form-floating mb-3">
                <input type="number" id="addExpenseAmount" class="form-control" step="0.01" min="0.01" placeholder="0.00" />
                <label><i class="bi bi-currency-euro me-1"></i>Amount (€)</label>
              </div>
              <div class="form-floating mb-3">
                <input type="date" id="addExpenseDate" class="form-control" placeholder="Date" />
                <label><i class="bi bi-calendar-event me-1"></i>Date</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="addExpenseNotes" class="form-control" placeholder="Notes" />
                <label><i class="bi bi-chat-left-text me-1"></i>Notes</label>
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
      <div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" id="editExpenseModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Edit Expense</h5>
            </div>
            <div class="modal-body">
              <input type="hidden" id="editExpenseId" />
              <div class="form-floating mb-3">
                <input type="text" id="editExpenseName" class="form-control" placeholder="Name" />
                <label><i class="bi bi-tag me-1"></i>Name</label>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold small"><i class="bi bi-house-door me-1"></i>Rentals</label>
                <rental-checkboxes id="editExpenseRentalCheckboxes"></rental-checkboxes>
              </div>
              <div class="form-floating mb-3">
                <input type="number" id="editExpenseAmount" class="form-control" step="0.01" min="0.01" placeholder="0.00" />
                <label><i class="bi bi-currency-euro me-1"></i>Amount (€)</label>
              </div>
              <div class="form-floating mb-3">
                <input type="date" id="editExpenseDate" class="form-control" placeholder="Date" />
                <label><i class="bi bi-calendar-event me-1"></i>Date</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" id="editExpenseNotes" class="form-control" placeholder="Notes" />
                <label><i class="bi bi-chat-left-text me-1"></i>Notes</label>
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
    const expenses = this._filteredExpenses;
    const totalAmount = expenses.reduce((sum, e) => sum + (parseFloat(e.AmountEuros) || 0), 0);

    const rentalMap = new Map();
    expenses.forEach((e) => {
      const amount = parseFloat(e.AmountEuros) || 0;
      const share = e.rentals.length > 0 ? amount / e.rentals.length : amount;
      e.rentals.forEach((rental) => {
        const existing = rentalMap.get(rental.Name) || { name: rental.Name, amount: 0 };
        existing.amount += share;
        rentalMap.set(rental.Name, existing);
      });
    });

    const rentalPalette = [
      { bg: "bg-warning bg-opacity-10", text: "text-warning" },
      { bg: "bg-danger bg-opacity-10", text: "text-danger" },
      { bg: "bg-secondary bg-opacity-10", text: "text-secondary" },
      { bg: "bg-dark bg-opacity-10", text: "text-dark" },
    ];

    return html`
      <div class="row g-3 p-3 border-bottom">
        <div class="col-6 col-lg">
          <div class="rounded-3 p-3 bg-primary bg-opacity-10 h-100 text-center">
            <div class="text-uppercase small fw-semibold text-muted">Total Expenses</div>
            <div class="fs-4 fw-bold text-primary">${expenses.length}</div>
          </div>
        </div>
        <div class="col-6 col-lg">
          <div class="rounded-3 p-3 bg-success bg-opacity-10 h-100 text-center">
            <div class="text-uppercase small fw-semibold text-muted">Total Amount</div>
            <div class="fs-4 fw-bold text-success">${totalAmount.toFixed(2)}€</div>
          </div>
        </div>
        ${[...rentalMap.values()].map((r, i) => {
          const { bg, text } = rentalPalette[i % rentalPalette.length];
          return html`
            <div class="col-6 col-lg">
              <div class="rounded-3 p-3 ${bg} h-100 text-center">
                <div class="text-uppercase small fw-semibold text-muted">${r.name}</div>
                <div class="fs-4 fw-bold ${text}">${r.amount.toFixed(2)}€</div>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  render() {
    const listContent = this._filteredExpenses.length
      ? html`
          <!-- Desktop layout -->
          <ul class="list-group list-group-flush d-none d-md-block">
            ${this._filteredExpenses.map((expense) => html`
              <li class="list-group-item d-flex align-items-center py-2 gap-3">
                <div class="d-flex gap-1 flex-shrink-0 flex-wrap">
                  ${expense.rentals.map((rental) => html`<span class="badge bg-secondary">${rental.Name}</span>`)}
                </div>
                <span class="fw-semibold flex-shrink-0">${expense.Name}</span>
                ${expense.DateCreated
                  ? html`<span class="text-muted small flex-shrink-0"><i class="bi bi-calendar-event me-1"></i>${formatDate(expense.DateCreated)}</span>`
                  : ""}
                <span class="fw-bold ms-auto flex-shrink-0">${parseFloat(expense.AmountEuros).toFixed(2)}€</span>
                <div class="d-flex gap-2 flex-shrink-0">
                  <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEditModal(expense)}>
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger" @click=${() => this.#confirmDelete(expense)}>
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </li>
            `)}
          </ul>

          <!-- Mobile layout -->
          <div class="d-md-none d-flex flex-column gap-2 p-2">
            ${this._filteredExpenses.map((expense) => html`
              <div class="card border rounded-3 px-3 pt-3 pb-2">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <div class="d-flex gap-1 flex-wrap">
                    ${expense.rentals.map((rental) => html`<span class="badge bg-secondary">${rental.Name}</span>`)}
                  </div>
                  <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEditModal(expense)}>
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" @click=${() => this.#confirmDelete(expense)}>
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
                <div class="fw-semibold mb-1">${expense.Name}</div>
                <div class="d-flex justify-content-between align-items-center">
                  ${expense.DateCreated
                    ? html`<span class="text-muted small"><i class="bi bi-calendar-event me-1"></i>${formatDate(expense.DateCreated)}</span>`
                    : html`<span></span>`}
                  <span class="fw-bold">${parseFloat(expense.AmountEuros).toFixed(2)}€</span>
                </div>
              </div>
            `)}
          </div>
        `
      : html`<p class="text-muted p-3">No expenses found.</p>`;

    return html`
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-receipt me-1"></i> Expenses</span>
          <button class="btn btn-success btn-sm" @click=${this.#openAddModal}>
            <i class="bi bi-plus-lg me-1"></i>Add
          </button>
        </div>
        ${this.#renderSummaryCards()}
        <div class="card-body border-bottom py-3">
          <div class="d-flex flex-wrap gap-2 justify-content-center align-items-center">
            <year-checkbox-dropdown
              .years=${this._years}
              @change=${this.#onYearChange}
            ></year-checkbox-dropdown>
            <rental-filter-dropdown
              .rentals=${state.allRentals}
              @change=${this.#onRentalChange}
            ></rental-filter-dropdown>
          </div>
        </div>
        <div>${listContent}</div>
      </div>
      ${this.#renderAddModal()}
      ${this.#renderEditModal()}
    `;
  }
}

customElements.define("expenses-tab", ExpensesTab);
