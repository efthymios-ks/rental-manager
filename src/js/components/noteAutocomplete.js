import { LitElement, html } from "../../lib/lit.min.js";

class NoteAutocomplete extends LitElement {
  static properties = {
    suggestions: {},
    label: {},
    placeholder: {},
    icon: {},
    plain: { type: Boolean },
    _value: { state: true },
    _open: { state: true },
    _filtered: { state: true },
  };

  constructor() {
    super();
    this.suggestions = [];
    this.label = "Notes";
    this.placeholder = "Notes";
    this.icon = "bi-chat-left-text";
    this.plain = false;
    this._value = "";
    this._open = false;
    this._filtered = [];
  }

  createRenderRoot() {
    return this;
  }

  get value() {
    return this._value;
  }

  set value(v) {
    this._value = v ?? "";
  }

  #onFocus() {
    const q = this._value.trim().toLowerCase();
    this._filtered = q
      ? this.suggestions.filter((n) => n.toLowerCase().includes(q))
      : [...this.suggestions];
    this._open = this._filtered.length > 0;
  }

  #onInput(e) {
    this._value = e.target.value;
    const q = this._value.trim().toLowerCase();
    this._filtered = q
      ? this.suggestions.filter((n) => n.toLowerCase().includes(q))
      : [...this.suggestions];
    this._open = this._filtered.length > 0;
  }

  #onBlur() {
    setTimeout(() => { this._open = false; }, 200);
  }

  #select(note) {
    this._value = note;
    this._open = false;
    this.dispatchEvent(new Event("input", { bubbles: true }));
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  updated() {
    const dropdown = this.querySelector(".note-ac-dropdown");
    const input = this.querySelector("input");
    if (dropdown && input) {
      const rect = input.getBoundingClientRect();
      dropdown.style.position = "fixed";
      dropdown.style.top = `${rect.bottom}px`;
      dropdown.style.left = `${rect.left}px`;
      dropdown.style.width = `${rect.width}px`;
      dropdown.style.right = "auto";
      dropdown.style.maxWidth = "none";
    }
  }

  render() {
    const open = this._open && this._filtered.length > 0;
    const sizeClass = this.plain ? " form-control-sm" : "";
    const inputEl = html`
      <input
        type="text"
        class="form-control${sizeClass}${open ? " note-ac-open" : ""}"
        placeholder=${this.placeholder}
        autocomplete="off"
        .value=${this._value}
        @focus=${this.#onFocus}
        @input=${this.#onInput}
        @blur=${this.#onBlur}
      />
    `;
    return html`
      <div style="position:relative">
        ${this.plain ? inputEl : html`
          <div class="form-floating">
            ${inputEl}
            <label><i class="bi ${this.icon} me-1"></i>${this.label}</label>
          </div>
        `}
        ${open ? html`
          <div class="note-ac-dropdown">
            ${this._filtered.map((note) => html`
              <div
                class="note-ac-item"
                @touchstart=${(e) => { e.preventDefault(); this.#select(note); }}
                @mousedown=${(e) => { e.preventDefault(); this.#select(note); }}
              >${note}</div>
            `)}
          </div>
        ` : ""}
      </div>
    `;
  }
}

customElements.define("note-autocomplete", NoteAutocomplete);
