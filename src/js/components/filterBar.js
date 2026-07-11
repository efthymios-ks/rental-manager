import { html } from "../../lib/lit.min.js";

const _style = document.createElement("style");
_style.textContent = `@media (max-width: 767.98px) { .tab-filter-sticky { top: 56px; } }`;
document.head.appendChild(_style);

export const filterBar = (contents) => html`
  <div class="sticky-top tab-filter-sticky bg-white shadow-sm rounded-3 mb-3 px-3 py-2">
    <div class="d-flex flex-wrap gap-2 align-items-center">
      ${contents}
    </div>
  </div>
`;
