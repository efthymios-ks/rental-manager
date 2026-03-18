const saveButtonToCancelButtonMap = {
  addBookingSaveBtn: "addBookingCancelBtn",
  editBookingSaveBtn: "editBookingCancelBtn",
  addExpenseSaveBtn: "addExpenseCancelBtn",
  editExpenseSaveBtn: "editExpenseCancelBtn",
  addCustomerSaveBtn: "addCustomerCancelBtn",
  editCustomerSaveBtn: "editCustomerCancelBtn",
  addRentalSaveBtn: "addRentalCancelBtn",
  editRentalSaveBtn: "editRentalCancelBtn",
};

export function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(dateString) {
  if (!dateString) {
    return "—";
  }

  const dateParts = dateString.split("-");
  return dateParts.length !== 3 ? dateString : `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
}

export function normalizeSearch(value) {
  return String(value == null ? "" : value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function sortCustomers(customers) {
  return customers.slice().sort((customerA, customerB) => {
    const nameComparison = normalizeSearch(customerA.FullName).localeCompare(
      normalizeSearch(customerB.FullName),
    );
    if (nameComparison !== 0) {
      return nameComparison;
    }

    return normalizeSearch(customerA.PhoneNumber).localeCompare(
      normalizeSearch(customerB.PhoneNumber),
    );
  });
}

export function ratingToRowClass(rating) {
  if (rating === 1) return "list-group-item-success";
  if (rating === -1) return "list-group-item-danger";
  return "";
}

export function escHtml(value) {
  if (!value) {
    return "";
  }

  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escAttr(value) {
  if (!value) {
    return "";
  }

  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function updateDurationField(arrivalFieldId, departureFieldId, durationFieldId) {
  const arrivalValue = document.getElementById(arrivalFieldId).value;
  const departureValue = document.getElementById(departureFieldId).value;
  if (arrivalValue && departureValue) {
    const dayDifference = Math.round(
      (new Date(departureValue) - new Date(arrivalValue)) / 86400000,
    );
    document.getElementById(durationFieldId).value =
      dayDifference > 0 ? `${dayDifference} day${dayDifference !== 1 ? "s" : ""}` : "—";
  } else {
    document.getElementById(durationFieldId).value = "";
  }
}

export function setBtnLoading(buttonId) {
  const button = document.getElementById(buttonId);
  button.disabled = true;
  button.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span>Saving…`;
  const cancelButtonId = saveButtonToCancelButtonMap[buttonId];
  if (cancelButtonId) {
    document.getElementById(cancelButtonId).disabled = true;
  }
}

export function resetBtn(buttonId, label) {
  const button = document.getElementById(buttonId);
  button.disabled = false;
  button.innerHTML = `<i class="bi bi-check-lg me-1"></i>${label}`;
  const cancelButtonId = saveButtonToCancelButtonMap[buttonId];
  if (cancelButtonId) {
    document.getElementById(cancelButtonId).disabled = false;
  }
}

export function showErrors(containerId, errors) {
  const container = document.getElementById(containerId);
  const items = errors
    .map((errorMessage) => `<div><i class="bi bi-exclamation-circle me-1"></i>${escHtml(errorMessage)}</div>`)
    .join("");
  container.innerHTML = `<div class="alert alert-danger py-2 mb-2">${items}</div>`;
  container.classList.remove("d-none");
}

export function clearErrors(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = "";
    container.classList.add("d-none");
  }
}

export function showSpinner(spinnerId) {
  const element = document.getElementById(spinnerId);
  if (element) {
    element.classList.remove("d-none");
  }
}

export function hideSpinnerReveal(spinnerId, controlsId) {
  const spinnerElement = document.getElementById(spinnerId);
  if (spinnerElement) {
    spinnerElement.classList.add("d-none");
  }

  if (controlsId) {
    const controlsElement = document.getElementById(controlsId);
    if (controlsElement) {
      controlsElement.classList.remove("d-none");
    }
  }
}

export function getCheckedIds(containerId) {
  return Array.prototype.map.call(
    document.querySelectorAll(`#${containerId} input[type=checkbox]:checked`),
    (checkbox) => checkbox.value,
  );
}
