import { LitElement, html } from "../../lib/lit.min.js";

class InputAutocomplete extends LitElement {
  static properties = {
    suggestions: {},
    label: {},
    placeholder: {},
    icon: {},
    plain: { type: Boolean },
  };

  #autocomplete = null;
  #value = "";
  #justSelected = false;

  constructor() {
    super();
    this.suggestions = [];
    this.label = "Notes";
    this.placeholder = "Notes";
    this.icon = "bi-chat-left-text";
    this.plain = false;
  }

  createRenderRoot() {
    return this;
  }

  get value() {
    return this.#value;
  }

  set value(v) {
    this.#value = v ?? "";
    if (this.#autocomplete) {
      this.#autocomplete.update({ value: this.#value });
      const input = this.querySelector("input.autocomplete-input");
      if (input) input.value = this.#value;
    }
  }

  firstUpdated() {
    const el = this.querySelector(".na-ac");
    this.#autocomplete = new coreui.Autocomplete(el, {
      options: this.suggestions,
      search: "global",
      placeholder: this.placeholder,
      cleaner: true,
      highlightOptionsOnSearch: true,
    });

    if (this.#value) {
      this.#autocomplete.update({ value: this.#value });
      const input = this.querySelector("input.autocomplete-input");
      if (input) input.value = this.#value;
    }

    el.addEventListener("input.coreui.autocomplete", (e) => {
      if (this.#justSelected) { this.#justSelected = false; return; }
      this.#value = e.value ?? "";
      this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    });

    el.addEventListener("changed.coreui.autocomplete", (e) => {
      const v = e.value;
      this.#value = typeof v === "string" ? v : (v?.label ?? v?.value ?? "");
      this.#justSelected = true;
      this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    });
  }

  updated(changedProperties) {
    if (!this.#autocomplete) return;
    if (changedProperties.has("suggestions")) {
      this.#autocomplete.update({ options: this.suggestions });
    }
    if (changedProperties.has("placeholder")) {
      this.#autocomplete.update({ placeholder: this.placeholder });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#autocomplete?.dispose();
    this.#autocomplete = null;
  }

  render() {
    if (this.plain) {
      return html`<div class="na-ac autocomplete-sm"></div>`;
    }
    return html`
      <label class="form-label small mb-1">
        <i class="bi ${this.icon} me-1"></i>${this.label}
      </label>
      <div class="na-ac"></div>
    `;
  }
}

customElements.define("input-autocomplete", InputAutocomplete);
