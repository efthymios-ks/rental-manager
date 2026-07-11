import { LitElement, html, nothing } from "../../lib/lit.min.js";
import "./languagePicker.js";

const TABS = [
  { name: "dashboard", label: "Dashboard", icon: "bi-speedometer2" },
  { name: "calendar", label: "Calendar", icon: "bi-calendar3" },
  { name: "bookings", label: "Bookings", icon: "bi-calendar-check" },
  { name: "expenses", label: "Expenses", icon: "bi-receipt" },
  { name: "customers", label: "Customers", icon: "bi-people" },
  { name: "rentals", label: "Rentals", icon: "bi-house-door" },
  { name: "export", label: "Export", icon: "bi-download" },
];

const navItem = (tab, { dismiss = false } = {}) => html`
  <a href="#" class="nav-link rounded px-3" data-tab="${tab.name}"
    data-coreui-dismiss=${dismiss ? "offcanvas" : nothing}
    @click=${(e) => { e.preventDefault(); window.showTab(tab.name); }}>
    <i class="bi ${tab.icon} me-2"></i><span data-translations-key="sidebar.tab.${tab.name}">${tab.label}</span>
  </a>
`;

class AppHeader extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <!-- Desktop Sidebar -->
      <nav class="d-none d-md-flex flex-column bg-success flex-shrink-0 position-sticky top-0 vh-100 overflow-auto navbar-dark" style="width: 220px">
        <div class="px-3 py-3 fw-bold text-white border-bottom border-white border-opacity-25 small">
          <img src="favicon.svg" width="20" height="20" alt="" style="vertical-align:-3px" class="me-1">Rental Manager
        </div>
        <div class="navbar-nav flex-column p-2 flex-grow-1 gap-1">
          ${TABS.map((tab) => navItem(tab))}
        </div>
        <div class="p-2 border-top border-white border-opacity-25">
          <language-picker></language-picker>
        </div>
      </nav>

      <!-- Mobile Offcanvas -->
      <div class="offcanvas offcanvas-start bg-success d-flex flex-column" tabindex="-1" id="mobileOffcanvas">
        <div class="offcanvas-header border-bottom border-white border-opacity-25">
          <h6 class="offcanvas-title fw-bold text-white"><img src="favicon.svg" width="20" height="20" alt="" style="vertical-align:-3px" class="me-1">Rental Manager</h6>
          <button type="button" class="btn-close btn-close-white" data-coreui-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body p-2 navbar-dark flex-grow-1">
          <nav class="navbar-nav flex-column gap-1">
            ${TABS.map((tab) => navItem(tab, { dismiss: true }))}
          </nav>
        </div>
        <div class="p-2 border-top border-white border-opacity-25">
          <language-picker></language-picker>
        </div>
      </div>

      <!-- Mobile Top Navbar -->
      <nav class="navbar navbar-dark bg-success d-md-none position-fixed top-0 start-0 end-0" style="z-index: 1030">
        <div class="container-fluid">
          <span class="navbar-brand fw-bold"><img src="favicon.svg" width="20" height="20" alt="" style="vertical-align:-3px" class="me-1">Rental Manager</span>
          <button class="navbar-toggler border-0" type="button"
            data-coreui-toggle="offcanvas" data-coreui-target="#mobileOffcanvas">
            <span class="navbar-toggler-icon"></span>
          </button>
        </div>
      </nav>
    `;
  }
}

customElements.define("app-header", AppHeader);
