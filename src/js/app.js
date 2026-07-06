import { state } from "./state.js";
import "./translations.js";
import "./components/appHeader.js";
import "./components/calendar.js";
import "./components/loadingOverlay.js";
import "./tabs/bookings.js";
import "./tabs/customers.js";
import "./tabs/dashboard.js";
import "./tabs/expenses.js";
import "./tabs/export.js";
import "./tabs/rentals.js";
import { sortCustomers } from "./utils.js";

window.sortCustomers = sortCustomers;

function setLoading(visible, text = "") {
  visible ? window.loadingModal.show(text) : window.loadingModal.hide();
}

async function onAuthReady() {
  setLoading(true);
  try {
    await window.sheets.init();
    await window.api.loadAll();
  } catch (error) {
    window.loadingModal.showError(error.message);
    return;
  }
  setLoading(false);
  showTab("dashboard");
}

function showTab(tabName) {
  state.currentTab = tabName;
  const tabNames = ["dashboard", "calendar", "bookings", "expenses", "customers", "rentals", "export"];

  tabNames.forEach((currentTabName) => {
    document.getElementById(`tab-${currentTabName}`).classList.toggle("d-none", currentTabName !== tabName);
  });

  document.querySelectorAll("[data-tab]").forEach((link) => {
    link.dataset.tab === tabName
      ? link.setAttribute("data-selected", "")
      : link.removeAttribute("data-selected");
  });

  document.getElementById(`tab-${tabName}`).load();
}


function refreshCurrentTab() {
  showTab(state.currentTab);
}

window.onAuthReady = onAuthReady;
window.showTab = showTab;
window.refreshCurrentTab = refreshCurrentTab;
window.setLoading = setLoading;

window.onload = () => {
  window.auth.login(onAuthReady);
};
