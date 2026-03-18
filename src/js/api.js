const SCHEMA = {
  rentals: {
    sheet: "Rentals",
    columns: ["Id", "Name"],
  },
  customers: {
    sheet: "Customers",
    columns: [
      "Id",
      "FullName",
      "VatOrPassport",
      "PhoneNumber",
      "Rating",
      "Notes",
      "IgnoreMissingVat",
    ],
  },
  bookings: {
    sheet: "Bookings",
    columns: [
      "Id",
      "RentalId",
      "CustomerId",
      "ArrivalDate",
      "DepartureDate",
      "AmountEuros",
      "Notes",
      "OffRecord",
    ],
  },
  expenses: {
    sheet: "Expenses",
    columns: ["Id", "RentalIds", "Name", "AmountEuros", "Notes", "DateCreated"],
  },
};

function SheetDb(schemaDef) {
  return {
    append: (obj) => window.sheets.append(schemaDef.sheet, schemaDef.columns, obj),
    updateRow: (rowIndex, obj) =>
      window.sheets.updateRow(schemaDef.sheet, schemaDef.columns, rowIndex, obj),
    deleteRow: (rowIndex) => window.sheets.deleteRow(schemaDef.sheet, rowIndex),
    newId: () => window.sheets.newId(),
  };
}

window.api = {
  // --- Startup ---

  async loadAll() {
    const [rawRentals, rawCustomers, rawBookings, rawExpenses] = await window.sheets.batchGetAll([
      SCHEMA.rentals, SCHEMA.customers, SCHEMA.bookings, SCHEMA.expenses,
    ]);

    const rentals = rawRentals;
    const customers = rawCustomers.map(normalizeCustomer);
    const rentalMap = buildMap(rentals);
    const customerMap = buildMap(customers);

    window.state.allRentals = rentals;
    window.state.allCustomers = window.sortCustomers(customers);
    window.state.allBookings = rawBookings
      .map((row) => normalizeBooking(row, rentalMap, customerMap))
      .sort((bookingA, bookingB) => bookingB.ArrivalDate.localeCompare(bookingA.ArrivalDate));
    window.state.allExpenses = rawExpenses
      .map((row) => normalizeExpense(row, rentalMap))
      .sort((expenseA, expenseB) =>
        (expenseB.DateCreated || "").localeCompare(expenseA.DateCreated || ""),
      );
  },

  // --- Dashboard (sync — reads from state) ---

  computeDashboardSummaries() {
    const bookings = window.state.allBookings;
    const expenses = window.state.allExpenses;
    const rentals = window.state.allRentals;

    const yearSet = new Set();
    bookings.forEach((booking) => {
      if (booking.ArrivalDate) {
        yearSet.add(booking.ArrivalDate.substring(0, 4));
      }
    });
    expenses.forEach((expense) => {
      if (expense.Year) {
        yearSet.add(expense.Year);
      }
    });

    return Array.from(yearSet)
      .sort((yearA, yearB) => yearB.localeCompare(yearA))
      .map((year) => ({
        year,
        rentals: rentals.map((rental) => {
          const rentalBookings = bookings.filter(
            (booking) => booking.RentalId === rental.Id && booking.ArrivalDate.startsWith(year),
          );
          const rentalExpenses = expenses.filter(
            (expense) => expense.RentalIds.includes(rental.Id) && expense.Year === year,
          );
          const totalIncome = rentalBookings.reduce(
            (sum, booking) => sum + (parseFloat(booking.AmountEuros) || 0),
            0,
          );
          const totalExpenses = rentalExpenses.reduce(
            (sum, expense) =>
              sum + (parseFloat(expense.AmountEuros) || 0) / (expense.RentalIds.length || 1),
            0,
          );
          const totalDays = rentalBookings.reduce(
            (sum, booking) => sum + booking.DurationDays,
            0,
          );
          return {
            rentalId: rental.Id,
            rentalName: rental.Name,
            bookingCount: rentalBookings.length,
            totalDays,
            totalIncome: round2(totalIncome),
            totalExpenses: round2(totalExpenses),
            difference: round2(totalIncome - totalExpenses),
          };
        }),
      }));
  },

  // --- Rentals ---

  async addRental(rental) {
    const db = SheetDb(SCHEMA.rentals);
    await db.append({ Id: db.newId(), Name: rental.Name });
  },

  async updateRental(rentalId, rental) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.rentals.sheet, rentalId);
    await SheetDb(SCHEMA.rentals).updateRow(rowIndex, { Name: rental.Name });
  },

  async deleteRental(rentalId) {
    if (window.state.allBookings.some((booking) => booking.RentalId === rentalId)) {
      throw new Error("Cannot delete rental with existing bookings.");
    }

    if (window.state.allExpenses.some((expense) => expense.RentalIds.includes(rentalId))) {
      throw new Error("Cannot delete rental with existing expenses.");
    }

    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.rentals.sheet, rentalId);
    await SheetDb(SCHEMA.rentals).deleteRow(rowIndex);
  },

  // --- Customers ---

  async addCustomer(customer) {
    const db = SheetDb(SCHEMA.customers);
    await db.append({
      Id: db.newId(),
      FullName: customer.FullName,
      VatOrPassport: customer.VatOrPassport || "",
      PhoneNumber: String(customer.PhoneNumber || ""),
      Rating: customer.Rating ? String(customer.Rating) : "",
      Notes: customer.Notes || "",
      IgnoreMissingVat: customer.IgnoreMissingVat ? "1" : "",
    });
  },

  async updateCustomer(customerId, customer) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.customers.sheet, customerId);
    await SheetDb(SCHEMA.customers).updateRow(rowIndex, {
      FullName: customer.FullName,
      VatOrPassport: customer.VatOrPassport || "",
      PhoneNumber: String(customer.PhoneNumber || ""),
      Rating: customer.Rating ? String(customer.Rating) : "",
      Notes: customer.Notes || "",
      IgnoreMissingVat: customer.IgnoreMissingVat ? "1" : "",
    });
  },

  async deleteCustomer(customerId) {
    if (window.state.allBookings.some((booking) => booking.CustomerId === customerId)) {
      throw new Error("Cannot delete customer with existing bookings.");
    }

    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.customers.sheet, customerId);
    await SheetDb(SCHEMA.customers).deleteRow(rowIndex);
  },

  // --- Bookings ---

  async addBooking(booking) {
    const db = SheetDb(SCHEMA.bookings);
    await db.append({
      Id: db.newId(),
      RentalId: booking.RentalId,
      CustomerId: booking.CustomerId,
      ArrivalDate: booking.ArrivalDate,
      DepartureDate: booking.DepartureDate,
      AmountEuros: booking.AmountEuros,
      Notes: booking.Notes || "",
      OffRecord: booking.OffRecord ? "1" : "",
    });
  },

  async updateBooking(bookingId, booking) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.bookings.sheet, bookingId);
    await SheetDb(SCHEMA.bookings).updateRow(rowIndex, {
      RentalId: booking.RentalId,
      CustomerId: booking.CustomerId,
      ArrivalDate: booking.ArrivalDate,
      DepartureDate: booking.DepartureDate,
      AmountEuros: booking.AmountEuros,
      Notes: booking.Notes || "",
      OffRecord: booking.OffRecord ? "1" : "",
    });
  },

  async deleteBooking(bookingId) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.bookings.sheet, bookingId);
    await SheetDb(SCHEMA.bookings).deleteRow(rowIndex);
  },

  // --- Expenses ---

  async addExpense(expense) {
    const db = SheetDb(SCHEMA.expenses);
    await db.append({
      Id: db.newId(),
      RentalIds: expense.RentalIds || "",
      Name: expense.Name,
      AmountEuros: expense.AmountEuros,
      Notes: expense.Notes || "",
      DateCreated: expense.DateCreated || toDateString(new Date()),
    });
  },

  async updateExpense(expenseId, expense) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.expenses.sheet, expenseId);
    await SheetDb(SCHEMA.expenses).updateRow(rowIndex, {
      RentalIds: expense.RentalIds || "",
      Name: expense.Name,
      AmountEuros: expense.AmountEuros,
      Notes: expense.Notes || "",
      DateCreated: expense.DateCreated || "",
    });
  },

  async deleteExpense(expenseId) {
    const rowIndex = await window.sheets.getRowIndexById(SCHEMA.expenses.sheet, expenseId);
    await SheetDb(SCHEMA.expenses).deleteRow(rowIndex);
  },
};

// Normalize helpers

function normalizeCustomer(row) {
  return {
    ...row,
    VatOrPassport: row.VatOrPassport || null,
    Rating: parseInt(row.Rating) || 0,
    Notes: row.Notes || "",
    PhoneNumber: String(row.PhoneNumber || ""),
    IgnoreMissingVat: !!row.IgnoreMissingVat,
  };
}

function normalizeBooking(row, rentalMap, customerMap) {
  const arrivalDate = toDateString(row.ArrivalDate);
  const departureDate = toDateString(row.DepartureDate);
  return {
    ...row,
    ArrivalDate: arrivalDate,
    DepartureDate: departureDate,
    DurationDays: calcDurationDays(arrivalDate, departureDate),
    Notes: row.Notes || "",
    OffRecord: row.OffRecord === "1",
    rental: rentalMap[row.RentalId] || null,
    customer: customerMap[row.CustomerId] || null,
  };
}

function normalizeExpense(row, rentalMap) {
  const rentalIds = row.RentalIds ? String(row.RentalIds).split(",").filter(Boolean) : [];
  const dateCreated = toDateString(row.DateCreated);
  return {
    ...row,
    RentalIds: rentalIds,
    rentals: rentalIds.map((rentalId) => rentalMap[rentalId] || null).filter(Boolean),
    Notes: row.Notes || "",
    DateCreated: dateCreated,
    Year: dateCreated ? dateCreated.substring(0, 4) : "",
  };
}

// Utilities

function buildMap(items) {
  const map = {};
  items.forEach((item) => {
    map[item.Id] = item;
  });
  return map;
}

function round2(number) {
  return Math.round(number * 100) / 100;
}

function toDateString(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.substring(0, 10);
  }

  if (typeof value === "number") {
    // Google Sheets date serial: days since Dec 30, 1899
    const date = new Date((value - 25569) * 86400000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }

  return "";
}

function calcDurationDays(arrivalDate, departureDate) {
  if (!arrivalDate || !departureDate) {
    return 0;
  }

  return Math.max(
    0,
    Math.round((new Date(departureDate) - new Date(arrivalDate)) / 86400000),
  );
}
