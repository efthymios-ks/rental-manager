
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

export function uniqueByField(items, fieldName) {
  const set = new Set();
  items.forEach((item) => {
    if (item[fieldName]) set.add(item[fieldName]);
  });
  return Array.from(set).sort((valueA, valueB) => valueA.localeCompare(valueB));
}

export function uniqueNotes(items) {
  return uniqueByField(items, "Notes");
}

export function formatRentalsLabel(rentals, totalRentalCount) {
  const count = rentals.length;
  const t = window.t || ((key, fallback) => fallback);
  if (count === 0) return t("filter.rentals.none", "No Rentals");
  if (count === totalRentalCount) return t("filter.rentals.all", "All Rentals");
  if (count <= 2) {
    return rentals
      .map((rental) => rental.Name)
      .sort((nameA, nameB) => nameA.localeCompare(nameB))
      .join(", ");
  }

  return t("filter.rentals.n", `${count} Rentals`, { n: count });
}

export function initFixedStrategyDropdown(hostElement) {
  const toggle = hostElement.querySelector('[data-coreui-toggle="dropdown"]');
  if (toggle && typeof coreui !== "undefined") {
    coreui.Dropdown.getOrCreateInstance(toggle, {
      popperConfig: (defaultConfig) => ({ ...defaultConfig, strategy: "fixed" }),
    });
  }
}

export function computeSharedYears() {
  const currentYear = new Date().getFullYear();
  let minYear = currentYear;

  window.state.allBookings.forEach((booking) => {
    if (booking.ArrivalDate) {
      const year = parseInt(booking.ArrivalDate.substring(0, 4), 10);
      if (year && year < minYear) minYear = year;
    }
  });
  window.state.allExpenses.forEach((expense) => {
    if (expense.Year) {
      const year = parseInt(expense.Year, 10);
      if (year && year < minYear) minYear = year;
    }
  });

  const years = [];
  for (let y = currentYear; y >= minYear; y--) {
    years.push(String(y));
  }
  return years;
}

export function defaultSharedYears() {
  return [String(new Date().getFullYear())];
}

export function computeCalendarYears() {
  const years = computeSharedYears().map(Number);
  const nextYear = new Date().getFullYear() + 1;
  if (!years.includes(nextYear)) {
    years.unshift(nextYear);
  }
  return years;
}

export function getCheckedIds(containerId) {
  return Array.prototype.map.call(
    document.querySelectorAll(`#${containerId} input[type=checkbox]:checked`),
    (checkbox) => checkbox.value,
  );
}
