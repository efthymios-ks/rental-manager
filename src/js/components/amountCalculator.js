import { LitElement, html } from "../../lib/lit.min.js";

const _style = document.createElement("style");
_style.textContent = `
  amount-calculator { display: block; }

  .amount-calc-inline-panel {
    margin-top: -1px;
    border: 1px solid var(--cui-border-color);
    border-top: none;
    border-radius: 0 0 var(--cui-border-radius, 0.375rem) var(--cui-border-radius, 0.375rem);
    padding: 0.75rem;
    background: var(--cui-secondary-bg);
  }

  .amount-calc-panel {
    display: grid;
    grid-template-columns: 11rem 9rem;
    gap: 0.75rem;
  }

  .calc-tape {
    font-size: 0.75rem;
    font-family: var(--cui-font-monospace, monospace);
    color: var(--cui-secondary-color);
    border-left: 1px solid var(--cui-border-color);
    padding-left: 0.5rem;
    height: 8.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 0.15rem;
  }

  .calc-tape-total {
    border-top: 1px solid var(--cui-border-color);
    padding-top: 0.15rem;
    color: var(--cui-body-color);
  }

  .calc-operand {
    font-size: 1rem;
  }
`;
document.head.appendChild(_style);

let _calcUidCounter = 0;

class AmountCalculator extends LitElement {
  static properties = {
    label: { type: String },
    icon: { type: String },
    _value: { state: true },
    _open: { state: true },
    _steps: { state: true },
    _operand: { state: true },
  };

  #base = 0;
  #inputId = `calc-amount-${++_calcUidCounter}`;

  constructor() {
    super();
    this.label = "";
    this.icon = "";
    this._value = "";
    this._open = false;
    this._steps = [];
    this._operand = "";
  }

  createRenderRoot() {
    return this;
  }

  get value() {
    return this._value;
  }

  set value(v) {
    this._value = v != null ? String(v) : "";
  }

  updated(changedProperties) {
    if (changedProperties.has("_open")) {
      this.dispatchEvent(new CustomEvent("calcstatechange", { detail: { open: this._open }, bubbles: true, composed: true }));
      if (this._open) {
        this.querySelector(".calc-operand")?.focus();
      } else {
        this.querySelector(".calc-amount")?.focus();
      }
    }
  }

  #fmt(v) {
    return (Math.round(v * 100) / 100).toFixed(2);
  }

  #parseVal(str) {
    return parseFloat(String(str).replace(",", ".")) || 0;
  }

  #total() {
    return this._steps.reduce((t, s) => t + s.sign * s.op, this.#base);
  }

  #toggle() {
    if (this._open) {
      this.#cancel();
    } else {
      this.#base = this.#parseVal(this._value);
      this._steps = [];
      this._operand = "";
      this._open = true;
    }
  }

  #apply(sign) {
    const op = this.#parseVal(this._operand);
    if (!op) return;
    this._steps = [...this._steps, { sign, op }];
    this._operand = "";
  }

  #save() {
    if (this._operand) this.#apply(1);
    this._value = this.#fmt(this.#total());
    this._open = false;
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }

  #cancel() {
    this._open = false;
  }

  #renderTape() {
    const rows = [html`<div class="text-end">${this.#fmt(this.#base)}</div>`];
    for (const s of this._steps) {
      rows.push(html`<div class="text-end">${s.sign > 0 ? "+" : "−"} ${this.#fmt(s.op)}</div>`);
    }
    rows.push(html`<div class="text-end fw-semibold calc-tape-total">${this.#fmt(this.#total())}</div>`);
    return rows;
  }

  render() {
    return html`
      <div class="input-group">
        <div class="form-floating flex-grow-1">
          <input
            type="text"
            id=${this.#inputId}
            class="form-control calc-amount"
            inputmode="decimal"
            placeholder="0.00"
            .value=${this._value}
            @input=${(e) => { const v = e.target.value.replace(",", "."); if (v !== e.target.value) e.target.value = v; this._value = v; }}
            ?readonly=${this._open}
          />
          <label for=${this.#inputId}>
            ${this.icon ? html`<i class="bi ${this.icon} me-1"></i>` : ""}${this.label}
          </label>
        </div>

        <button
          type="button"
          class="btn btn-outline-secondary"
          @click=${this.#toggle}
          aria-label="Calculator"
        >
          <i class="bi bi-calculator"></i>
        </button>
      </div>

      ${this._open ? html`
        <div class="amount-calc-inline-panel">
          <div class="amount-calc-panel">
            <div class="d-flex flex-column gap-2">
              <input
                type="text"
                inputmode="decimal"
                class="form-control form-control-sm calc-operand"
                placeholder="0.00"
                .value=${this._operand}
                @input=${(e) => { const v = e.target.value.replace(",", "."); if (v !== e.target.value) e.target.value = v; this._operand = v; }}
                @keydown=${(e) => { if (e.key === "Enter") { e.preventDefault(); this.#apply(1); } }}
              />
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-outline-success flex-fill" @click=${() => this.#apply(1)}>
                  <i class="bi bi-plus-lg"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger flex-fill" @click=${() => this.#apply(-1)}>
                  <i class="bi bi-dash-lg"></i>
                </button>
              </div>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-outline-secondary flex-fill" @click=${this.#cancel}>
                  <i class="bi bi-x-lg"></i>
                </button>
                <button type="button" class="btn btn-sm btn-primary flex-fill" @click=${this.#save}>
                  <i class="bi bi-check-lg"></i>
                </button>
              </div>
            </div>

            <div class="calc-tape">
              ${this.#renderTape()}
            </div>
          </div>
        </div>
      ` : ""}
    `;
  }
}

customElements.define("amount-calculator", AmountCalculator);
