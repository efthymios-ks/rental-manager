let _modal = null;

function getModal() {
  if (!_modal) {
    _modal = new coreui.Modal(document.getElementById("loadingModal"));
  }
  return _modal;
}

window.loadingModal = {
  show(text = "") {
    document.getElementById("loadingSpinnerSection").classList.remove("d-none");
    document.getElementById("loadingErrorSection").classList.add("d-none");
    document.getElementById("loadingText").textContent = text;
    getModal().show();
  },

  hide() {
    const el = document.getElementById("loadingModal");
    if (el.classList.contains("show")) {
      getModal().hide();
    } else {
      el.addEventListener("shown.coreui.modal", () => getModal().hide(), { once: true });
    }
  },

  showError(message) {
    document.getElementById("loadingSpinnerSection").classList.add("d-none");
    document.getElementById("loadingErrorMessage").textContent = message;
    document.getElementById("loadingErrorSection").classList.remove("d-none");
  },
};
