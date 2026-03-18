import { LitElement, html } from "../../lib/lit.min.js";

class LoadMoreButton extends LitElement {
  static properties = {
    hasMore: { type: Boolean },
    loading: { type: Boolean },
  };

  constructor() {
    super();
    this.hasMore = false;
    this.loading = false;
  }

  createRenderRoot() {
    return this;
  }

  #handleClick() {
    this.dispatchEvent(new CustomEvent("load-more", { bubbles: true, composed: true }));
  }

  render() {
    if (!this.hasMore) {
      return "";
    }

    return html`
      <div class="text-center py-3">
        <button
          class="btn btn-outline-secondary btn-sm"
          @click=${this.#handleClick}
          ?disabled=${this.loading}
        >
          ${this.loading
            ? html`<span class="spinner-border spinner-border-sm me-1"></span>Loading…`
            : html`<i class="bi bi-arrow-down-circle me-1"></i>Load more`}
        </button>
      </div>
    `;
  }
}

customElements.define("load-more-button", LoadMoreButton);
