import { LitElement, html } from "../../lib/lit.min.js";
import { filterBar } from "../components/filterBar.js";
import "../components/datePickerInput.js";
import "../components/noteAutocomplete.js";
import "../components/amountCalculator.js";
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

function validateExpenseForm(name, amountEuros, date, rentalIds) {
  const errors = [];
  if (!name) {
    errors.push(t("expenses.error.nameRequired", "Please enter a name."));
  }

  if (!rentalIds.length) {
    errors.push(t("expenses.error.rentalRequired", "Please select at least one rental."));
  }

  if (isNaN(amountEuros) || amountEuros <= 0) {
    errors.push(t("expenses.error.amountPositive", "Amount must be greater than 0."));
  }

  if (!date) {
    errors.push(t("expenses.error.dateRequired", "Please select a date."));
  }

  return errors;
}

class ExpensesTab extends LitElement {
  static properties = {
    _filteredExpenses: { state: true },
    _years: { state: true },
    _addErrors: { state: true },
    _addSaving: { state: true },
    _viewExpense: { state: true },
    _viewMode: { state: true },
    _viewErrors: { state: true },
    _viewSaving: { state: true },
    _calcOpen: { state: true },
  };

  #allExpenses = [];

  constructor() {
    super();
    this._filteredExpenses = [];
    this._years = [];
    this._addErrors = [];
    this._addSaving = false;
    this._viewExpense = null;
    this._viewMode = "view";
    this._viewErrors = [];
    this._viewSaving = false;
    this._calcOpen = false;
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

  // --- view/edit modal ---

  #openViewModal(expense) {
    this._viewExpense = expense;
    this._viewMode = "view";
    this._viewErrors = [];
    this._viewSaving = false;
    this._calcOpen = false;
    this.updateComplete.then(() => {
      this.#populateFields();
      coreui.Modal.getOrCreateInstance(this.querySelector("#viewExpenseModal")).show();
    });
  }

  #populateFields() {
    const e = this._viewExpense;
    if (!e) return;
    const set = (id, val) => { const el = this.querySelector(`#${id}`); if (el) el.value = val ?? ""; };
    set("viewExpenseName", e.Name);
    set("viewExpenseAmount", parseFloat(e.AmountEuros || 0).toFixed(2));
    set("viewExpenseNotes", e.Notes || "");
    const dateEl = this.querySelector("#viewExpenseDate");
    if (dateEl) dateEl.value = e.DateCreated || "";
    const checkboxes = this.querySelector("#viewExpenseRentalCheckboxes");
    if (checkboxes) {
      checkboxes.rentals = state.allRentals;
      checkboxes.initialIds = e.RentalIds;
    }
  }

  #enterEditMode() {
    this._viewErrors = [];
    this._viewMode = "edit";
    this.updateComplete.then(() => this.#populateFields());
  }

  #cancelEdit() {
    this._viewMode = "view";
    this._viewErrors = [];
    this._calcOpen = false;
    this.updateComplete.then(() => this.#populateFields());
  }

  #handleDelete() {
    const expense = this._viewExpense;
    showConfirm(
      t("expenses.confirmDelete.title", "Delete Expense"),
      t("expenses.confirmDelete.message", "Are you sure you want to delete this expense?"),
      t("common.delete", "Delete"),
      "btn-danger",
      (done) => {
        window.api.deleteExpense(expense.Id)
          .then(() => {
            done();
            coreui.Modal.getInstance(this.querySelector("#viewExpenseModal"))?.hide();
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
    const expenseId = this._viewExpense.Id;
    const name = (this.querySelector("#viewExpenseName")?.value ?? "").trim();
    const amountEuros = parseFloat(this.querySelector("#viewExpenseAmount")?.value);
    const date = this.querySelector("#viewExpenseDate")?.value ?? "";
    const notes = (this.querySelector("#viewExpenseNotes")?.value ?? "").trim();
    const rentalIds = this.querySelector("#viewExpenseRentalCheckboxes")?.selectedIds ?? [];
    const errors = validateExpenseForm(name, amountEuros, date, rentalIds);
    if (errors.length) {
      this._viewErrors = errors;
      return;
    }
    this._viewErrors = [];
    const saveBtn = this.querySelector("#viewExpenseSaveBtn");
    const lb = coreui.LoadingButton.getInstance(saveBtn) ?? new coreui.LoadingButton(saveBtn, { disabledOnLoading: true });
    this._viewSaving = true;
    lb.start();
    try {
      await window.api.updateExpense(expenseId, {
        RentalIds: rentalIds.join(","),
        Name: name,
        AmountEuros: amountEuros,
        Notes: notes,
        DateCreated: date,
      });
      await this.#reload();
      this._viewExpense = state.allExpenses.find((e) => e.Id === expenseId) ?? this._viewExpense;
      this._viewMode = "view";
      this._viewErrors = [];
      this._calcOpen = false;
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
    this._calcOpen = false;
    const modal = coreui.Modal.getOrCreateInstance(this.querySelector("#addExpenseModal"));
    modal.show();
    this.updateComplete.then(() => {
      this.querySelector("#addExpenseName").value = "";
      this.querySelector("#addExpenseAmount").value = "";
      this.querySelector("#addExpenseDate").value = todayStr();
      this.querySelector("#addExpenseNotes").value = "";
      const checkboxes = this.querySelector("#addExpenseRentalCheckboxes");
      checkboxes.rentals = state.allRentals;
      checkboxes.initialIds = [];
    });
  }

  async #submitAdd() {
    const name = this.querySelector("#addExpenseName").value.trim();
    const amountEuros = parseFloat(this.querySelector("#addExpenseAmount").value);
    const date = this.querySelector("#addExpenseDate").value;
    const notes = this.querySelector("#addExpenseNotes").value.trim();
    const rentalIds = this.querySelector("#addExpenseRentalCheckboxes").selectedIds;
    const errors = validateExpenseForm(name, amountEuros, date, rentalIds);
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

  // --- rendering ---

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

  #renderViewModal() {
    const e = this._viewExpense;
    const isEdit = this._viewMode === "edit";
    const rentalNames = e
      ? (e.RentalIds || []).map((id) => state.allRentals.find((r) => r.Id === id)?.Name ?? id).join(", ")
      : "";

    return html`
      <div class="modal fade" data-coreui-backdrop="static" data-coreui-keyboard="false" id="viewExpenseModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-receipt me-2"></i>${e?.Name ?? ""}</h5>
              <button type="button" class="btn-close" data-coreui-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              ${isEdit ? html`
                <input-autocomplete
                  id="viewExpenseName"
                  class="mb-3"
                  label=${t("expenses.field.name", "Name")}
                  placeholder=${t("expenses.field.name", "Name")}
                  icon="bi-tag"
                  .suggestions=${uniqueByField(state.allExpenses, "Name")}
                ></input-autocomplete>
              ` : html`
                <div class="form-floating mb-3">
                  <input type="text" id="viewExpenseName" class="form-control" readonly
                    placeholder=${t("expenses.field.name", "Name")} />
                  <label for="viewExpenseName"><i class="bi bi-tag me-1"></i>${t("expenses.field.name", "Name")}</label>
                </div>
              `}
              ${isEdit ? html`
                <div class="mb-3">
                  <span class="form-label fw-semibold small d-block"><i class="bi bi-house-door me-1"></i>${t("expenses.field.rentals", "Rentals")}</span>
                  <rental-checkboxes id="viewExpenseRentalCheckboxes"></rental-checkboxes>
                </div>
              ` : html`
                <div class="form-floating mb-3">
                  <input type="text" id="viewExpenseRentals" class="form-control" readonly
                    placeholder=${t("expenses.field.rentals", "Rentals")}
                    .value=${rentalNames} />
                  <label for="viewExpenseRentals"><i class="bi bi-house-door me-1"></i>${t("expenses.field.rentals", "Rentals")}</label>
                </div>
              `}
              ${isEdit ? html`
                <amount-calculator
                  id="viewExpenseAmount"
                  class="mb-3"
                  label=${t("expenses.field.amount", "Amount (€)")}
                  icon="bi-currency-euro"
                  @calcstatechange=${(ev) => { this._calcOpen = ev.detail.open; }}
                ></amount-calculator>
              ` : html`
                <div class="form-floating mb-3">
                  <input type="text" id="viewExpenseAmount" class="form-control" readonly
                    placeholder="0.00" />
                  <label for="viewExpenseAmount"><i class="bi bi-currency-euro me-1"></i>${t("expenses.field.amount", "Amount (€)")}</label>
                </div>
              `}
              ${isEdit ? html`
                <div class="mb-3">
                  <span class="form-label small fw-semibold d-block"><i class="bi bi-calendar-event me-1"></i>${t("expenses.field.date", "Date")}</span>
                  <date-picker-input id="viewExpenseDate"></date-picker-input>
                </div>
              ` : html`
                <div class="form-floating mb-3">
                  <input type="text" id="viewExpenseDateDisplay" class="form-control" readonly
                    placeholder=${t("expenses.field.date", "Date")}
                    .value=${e?.DateCreated ? formatDate(e.DateCreated) : ""} />
                  <label for="viewExpenseDateDisplay"><i class="bi bi-calendar-event me-1"></i>${t("expenses.field.date", "Date")}</label>
                </div>
              `}
              ${isEdit ? html`
                <input-autocomplete
                  id="viewExpenseNotes"
                  class="mb-3"
                  label=${t("expenses.field.notes", "Notes")}
                  placeholder=${t("expenses.field.notes", "Notes")}
                  .suggestions=${uniqueNotes(state.allExpenses)}
                ></input-autocomplete>
              ` : html`
                <div class="form-floating mb-3">
                  <input type="text" id="viewExpenseNotes" class="form-control" readonly
                    placeholder=${t("expenses.field.notes", "Notes")} />
                  <label for="viewExpenseNotes">${t("expenses.field.notes", "Notes")}</label>
                </div>
              `}
              ${isEdit ? this.#renderErrors(this._viewErrors) : ""}
            </div>
            <div class="modal-footer">
              ${isEdit ? html`
                <button class="btn btn-secondary" @click=${this.#cancelEdit}
                  ?disabled=${this._viewSaving}>${t("common.cancel", "Cancel")}</button>
                <button class="btn btn-success" id="viewExpenseSaveBtn" @click=${this.#submitViewEdit}
                  ?disabled=${this._calcOpen}>
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
      <div class="modal fade" data-coreui-backdrop="static" data-coreui-keyboard="false" id="addExpenseModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-receipt me-2"></i>${t("expenses.modal.add.title", "Add Expense")}</h5>
              <button type="button" class="btn-close" data-coreui-dismiss="modal" aria-label="Close"></button>
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
                <span class="form-label fw-semibold small d-block"><i class="bi bi-house-door me-1"></i>${t("expenses.field.rentals", "Rentals")}</span>
                <rental-checkboxes id="addExpenseRentalCheckboxes"></rental-checkboxes>
              </div>
              <amount-calculator
                id="addExpenseAmount"
                class="mb-3"
                label=${t("expenses.field.amount", "Amount (€)")}
                icon="bi-currency-euro"
                @calcstatechange=${(e) => { this._calcOpen = e.detail.open; }}
              ></amount-calculator>
              <div class="mb-3">
                <span class="form-label small fw-semibold d-block"><i class="bi bi-calendar-event me-1"></i>${t("expenses.field.date", "Date")}</span>
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
              <button class="btn btn-secondary" data-coreui-dismiss="modal"
                ?disabled=${this._addSaving || this._calcOpen}>${t("common.cancel", "Cancel")}</button>
              <button class="btn btn-success" id="addExpenseSaveBtn" @click=${this.#submitAdd}
                ?disabled=${this._calcOpen}>
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
                </tr>
              </thead>
              <tbody>
                ${expenses.map((expense) => html`
                  <tr style="cursor:pointer" @click=${() => this.#openViewModal(expense)}>
                    <td class="fw-semibold">${expense.Name}</td>
                    <td class="text-center">
                      ${formatRentalsLabel(expense.rentals, state.allRentals.length)}
                    </td>
                    <td class="text-center">${expense.DateCreated ? formatDate(expense.DateCreated) : ""}</td>
                    <td class="text-center">${parseFloat(expense.AmountEuros).toFixed(2)}€</td>
                  </tr>
                `)}
              </tbody>
              <tfoot class="fw-bold">
                <tr>
                  <td>${t("common.total", "Total")} (${expenses.length})</td>
                  <td class="text-center"></td>
                  <td class="text-center"></td>
                  <td class="text-center">${totalAmount.toFixed(2)}€</td>
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
      ${this.#renderViewModal()}
    `;
  }
}

customElements.define("expenses-tab", ExpensesTab);
