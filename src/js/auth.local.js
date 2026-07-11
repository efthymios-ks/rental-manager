// Local dev mock — bypasses Google OAuth
window.auth = {
  login(onReady) {
    window.loadingModal = { show() {}, hide() {}, showError(msg) { alert("[local] " + msg); } };
    document.getElementById("authOverlay").classList.replace("d-flex", "d-none");
    document.getElementById("mainContent").classList.remove("d-none");
    onReady();
  },
  logout() { window.location.reload(); },
  getUser() { return { name: "Local Dev", email: "dev@local" }; },
  getAccessToken() { return null; },
};
