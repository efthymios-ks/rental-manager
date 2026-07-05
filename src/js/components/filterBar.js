import { html } from "../../lib/lit.min.js";

export const filterBar = (contents) => html`
  <div class="sticky-top tab-filter-sticky bg-white shadow-sm rounded-3 mb-3 px-3 py-2">
    <div class="d-flex flex-nowrap gap-2 align-items-center overflow-x-auto">
      ${contents}
    </div>
  </div>
`;
