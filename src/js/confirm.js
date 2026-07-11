import { t } from "./translations.js";

export function showConfirm(title, message, confirmLabel, confirmClass, onConfirm) {
  document.getElementById("confirmModalTitle").textContent = title;
  document.getElementById("confirmModalBody").textContent = message;
  const actionButton = document.getElementById("confirmModalActionBtn");
  const cancelButton = document.querySelector("#confirmModal .btn-secondary");
  actionButton.textContent = confirmLabel;
  actionButton.className = `btn btn-sm ${confirmClass}`;
  actionButton.disabled = false;
  if (cancelButton) {
    cancelButton.textContent = t("common.cancel", "Cancel");
    cancelButton.disabled = false;
  }

  actionButton.onclick = () => {
    const lb = coreui.LoadingButton.getInstance(actionButton) ?? new coreui.LoadingButton(actionButton, { disabledOnLoading: true });
    lb.start();
    if (cancelButton) cancelButton.disabled = true;

    onConfirm(() => {
      lb.stop();
      coreui.Modal.getInstance(document.getElementById("confirmModal")).hide();
      if (cancelButton) cancelButton.disabled = false;
    });
  };

  new coreui.Modal(document.getElementById("confirmModal")).show();
}
