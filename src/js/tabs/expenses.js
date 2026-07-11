import { LitElement, html } from "../../lib/lit.min.js";
import { filterBar } from "../components/filterBar.js";
import "../components/datePickerInput.js";
import "../components/noteAutocomplete.js";
import "../components/rentalCheckboxes.js";
import "../components/rentalsMultiSelect.js";
import "../components/yearMultiSelect.js";
import { showConfirm } from "../confirm.js";
import { state } from "../state.js";
import { subscribeLanguage, t } from "../translations.js";
import {
  computeSharedYears,
  defaultSharedYears,
  formatDate,
  formatRentalsLabel,
  todayStr,
  uniqueByField,
  uniqueNotes,
} from "../utils.js";

function validateExpenseForm(name, amountEuros, date) {
  const errors = [];
  if (!name) {
    errors.push(t("expenses.error.nameRequired", "Please enter a name."));
  }

  if (!date) {
    errors.push(t("expenses.error.dateRequired", "Please select a date."));
  }

  if (isNaN(amountEuros) || amountEuros <= 0) {
    errors.push(t("expenses.error.amountPositive", "Amount must be greater than 0."));
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

  connectedCallback() {
    super.connectedCallback();
    this._unsubLang = subscribeLanguage(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubLang?.();
  }

  load() {
    this.#allExpenses = state.allExpenses;
    this._years = computeSharedYears();
    this.updateComplete.then(() => {
      this.querySelector("year-checkbox-dropdown")?.setSelected(state.sharedYears);
      this.querySelector("rental-filter-dropdown")?.setSelected(state.sharedRentalIds);
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
    this._filteredExpenses = this.#allExpenses.filter((expense) => {
      if (selectedYears !== null && !selectedYears.includes(expense.Year)) {
        return false;
      }

      if (
        selectedRentalIds !== null &&
        !expense.RentalIds.some((rentalId) => selectedRentalIds.includes(rentalId))
      ) {
        return false;
      }

      return true;
    });
  }

  #onYearChange(event) {
    state.sharedYears = event.target.selectedYears;
    this.#applyFilters();
  }

  #onRentalChange(event) {
    state.sharedRentalIds = event.target.selectedIds;
    this.#applyFilters();
  }

  #openAddModal() {
    this._addErrors = [];
    this._addSaving = false;
    const modal = coreui.Modal.getOrCreateInstance(this.querySelector("#addExpenseModal"));
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
    const modal = coreui.Modal.getOrCreateInstance(this.querySelector("#editExpenseModal"));
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
    const addBtn = this.querySelector("#addExpenseSaveBtn");
    const addLb = coreui.LoadingButton.getInstance(addBtn) ?? new coreui.LoadingButton(addBtn, { disabledOnLoading: true });
    this._addSaving = true;
    addLb.start();
    try {
      await window.api.addExpense({
        RentalIds: rentalIds.join(","),
        Name: name,
        AmountEuros: amountEuros,
        Notes: notes,
        DateCreated: date,
      });
      coreui.Modal.getInstance(this.querySelector("#addExpenseModal")).hide();
      await this.#reload();
    } catch (error) {
      this._addErrors = [error.message];
    } finally {
      addLb.stop();
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
    const editBtn = this.querySelector("#editExpenseSaveBtn");
    const editLb = coreui.LoadingButton.getInstance(editBtn) ?? new coreui.LoadingButton(editBtn, { disabledOnLoading: true });
    this._editSaving = true;
    editLb.start();
    try {
      await window.api.updateExpense(expenseId, {
        RentalIds: rentalIds.join(","),
        Name: name,
        AmountEuros: amountEuros,
        Notes: notes,
        DateCreated: date,
      });
      coreui.Modal.getInstance(this.querySelector("#editExpenseModal")).hide();
      await this.#reload();
    } catch (error) {
      this._editErrors = [error.message];
    } finally {
      editLb.stop();
      this._editSaving = false;
    }
  }

  #confirmDelete(expense) {
    showConfirm(
      t("expenses.confirmDelete.title", "Delete Expense"),
      t("expenses.confirmDelete.message", "Are you sure you want to delete this expense?"),
      t("common.delete", "Delete"),
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
      <div class="modal fade" data-coreui-backdrop="static" data-coreui-keyboard="false" id="addExpenseModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-receipt me-2"></i>${t("expenses.modal.add.title", "Add Expense")}</h5>
            </div>
            <div class="modal-body">
              <input-autocomplete
                id="addExpenseName"
                class="mb-3"
                label=${t("expenses.field.name", "Name")}
                placeholder=${t("expenses.field.name", "Name")}
                icon="bi-tag"
                .suggestions=${uniqueByField(state.allExpenses, "Name")}
              ></input-autocomplete>
              <div class="mb-3">
                <label class="form-label fw-semibold small"><i class="bi bi-house-door me-1"></i>${t("expenses.field.rentals", "Rentals")}</label>
                <rental-checkboxes id="addExpenseRentalCheckboxes"></rental-checkboxes>
              </div>
              <div class="form-floating mb-3">
                <input type="number" id="addExpenseAmount" class="form-control" step="0.01" min="0.01" placeholder="0.00" />
                <label><i class="bi bi-currency-euro me-1"></i>${t("expenses.field.amount", "Amount (€)")}</label>
              </div>
              <div class="mb-3">
                <label class="form-label small fw-semibold"><i class="bi bi-calendar-event me-1"></i>${t("expenses.field.date", "Date")}</label>
                <date-picker-input id="addExpenseDate"></date-picker-input>
              </div>
              <input-autocomplete
                id="addExpenseNotes"
                class="mb-3"
                label=${t("expenses.field.notes", "Notes")}
                placeholder=${t("expenses.field.notes", "Notes")}
                .suggestions=${uniqueNotes(state.allExpenses)}
              ></input-autocomplete>
              ${this.#renderErrors(this._addErrors)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-coreui-dismiss="modal" ?disabled=${this._addSaving}>${t("common.cancel", "Cancel")}</button>
              <button class="btn btn-success" id="addExpenseSaveBtn" @click=${this.#submitAdd}>
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
      <div class="modal fade" data-coreui-backdrop="static" data-coreui-keyboard="false" id="editExpenseModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>${t("expenses.modal.edit.title", "Edit Expense")}</h5>
            </div>
            <div class="modal-body">
              <input type="hidden" id="editExpenseId" />
              <input-autocomplete
                id="editExpenseName"
                class="mb-3"
                label=${t("expenses.field.name", "Name")}
                placeholder=${t("expenses.field.name", "Name")}
                icon="bi-tag"
                .suggestions=${uniqueByField(state.allExpenses, "Name")}
              ></input-autocomplete>
              <div class="mb-3">
                <label class="form-label fw-semibold small"><i class="bi bi-house-door me-1"></i>${t("expenses.field.rentals", "Rentals")}</label>
                <rental-checkboxes id="editExpenseRentalCheckboxes"></rental-checkboxes>
              </div>
              <div class="form-floating mb-3">
                <input type="number" id="editExpenseAmount" class="form-control" step="0.01" min="0.01" placeholder="0.00" />
                <label><i class="bi bi-currency-euro me-1"></i>${t("expenses.field.amount", "Amount (€)")}</label>
              </div>
              <div class="mb-3">
                <label class="form-label small fw-semibold"><i class="bi bi-calendar-event me-1"></i>${t("expenses.field.date", "Date")}</label>
                <date-picker-input id="editExpenseDate"></date-picker-input>
              </div>
              <input-autocomplete
                id="editExpenseNotes"
                class="mb-3"
                label=${t("expenses.field.notes", "Notes")}
                placeholder=${t("expenses.field.notes", "Notes")}
                .suggestions=${uniqueNotes(state.allExpenses)}
              ></input-autocomplete>
              ${this.#renderErrors(this._editErrors)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-coreui-dismiss="modal" ?disabled=${this._editSaving}>${t("common.cancel", "Cancel")}</button>
              <button class="btn btn-success" id="editExpenseSaveBtn" @click=${this.#submitEdit}>
                <i class="bi bi-check-lg me-1"></i>${t("common.save", "Save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }


  render() {
    const expenses = this._filteredExpenses;
    const totalAmount = expenses.reduce((sum, e) => sum + (parseFloat(e.AmountEuros) || 0), 0);
    const listContent = expenses.length
      ? html`
          <div class="table-responsive rm-table-scroll">
            <table class="table table-sm table-striped table-hover rm-table rm-sticky-footer mb-0">
              <thead class="table-success">
                <tr>
                  <th>${t("expenses.table.name", "Name")}</th>
                  <th class="text-center">${t("expenses.table.rentals", "Rentals")}</th>
                  <th class="text-center">${t("expenses.table.date", "Date")}</th>
                  <th class="text-center">${t("expenses.table.amount", "Amount")}</th>
                  <th class="text-center"></th>
                </tr>
              </thead>
              <tbody>
                ${expenses.map((expense) => html`
                  <tr>
                    <td class="fw-semibold">${expense.Name}</td>
                    <td class="text-center">
                      ${formatRentalsLabel(expense.rentals, state.allRentals.length)}
                    </td>
                    <td class="text-center">${expense.DateCreated ? formatDate(expense.DateCreated) : ""}</td>
                    <td class="text-center">${parseFloat(expense.AmountEuros).toFixed(2)}€</td>
                    <td class="text-center">
                      <div class="d-flex gap-1 justify-content-center">
                        <button class="btn btn-sm btn-outline-secondary" @click=${() => this.#openEditModal(expense)}>
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" @click=${() => this.#confirmDelete(expense)}>
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `)}
              </tbody>
              <tfoot class="fw-bold">
                <tr>
                  <td>${t("common.total", "Total")} (${expenses.length})</td>
                  <td class="text-center"></td>
                  <td class="text-center"></td>
                  <td class="text-center">${totalAmount.toFixed(2)}€</td>
                  <td class="text-center"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        `
      : html`<p class="text-muted p-3">${t("expenses.empty", "No expenses found.")}</p>`;

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
      `)}
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span><i class="bi bi-receipt me-1"></i> ${t("expenses.title", "Expenses")}</span>
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

customElements.define("expenses-tab", ExpensesTab);
