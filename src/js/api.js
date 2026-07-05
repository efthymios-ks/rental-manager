window.api = {
  // --- Startup ---

  async loadAll() {
    const { rentals, customers, bookings, expenses } = await window.sheets.getAllData();

    const rentalMap = buildMap(rentals);
    const customerMap = buildMap(customers);

    window.state.allRentals = rentals;
    window.state.allCustomers = window.sortCustomers(customers);
    window.state.allBookings = bookings
      .map((booking) => wireBooking(booking, rentalMap, customerMap))
      .sort((bookingA, bookingB) => bookingB.ArrivalDate.localeCompare(bookingA.ArrivalDate));
    window.state.allExpenses = expenses
      .map((expense) => wireExpense(expense, rentalMap))
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

  addRental(rental) {
    return window.sheets.addRental(rental);
  },

  updateRental(rentalId, rental) {
    return window.sheets.updateRental(rentalId, rental);
  },

  async deleteRental(rentalId) {
    if (window.state.allBookings.some((booking) => booking.RentalId === rentalId)) {
      throw new Error("Cannot delete rental with existing bookings.");
    }

    if (window.state.allExpenses.some((expense) => expense.RentalIds.includes(rentalId))) {
      throw new Error("Cannot delete rental with existing expenses.");
    }

    await window.sheets.deleteRental(rentalId);
  },

  // --- Customers ---

  addCustomer(customer) {
    return window.sheets.addCustomer(customer);
  },

  updateCustomer(customerId, customer) {
    return window.sheets.updateCustomer(customerId, customer);
  },

  async deleteCustomer(customerId) {
    if (window.state.allBookings.some((booking) => booking.CustomerId === customerId)) {
      throw new Error("Cannot delete customer with existing bookings.");
    }

    await window.sheets.deleteCustomer(customerId);
  },

  // --- Bookings ---

  addBooking(booking) {
    return window.sheets.addBooking(booking);
  },

  updateBooking(bookingId, booking) {
    return window.sheets.updateBooking(bookingId, booking);
  },

  deleteBooking(bookingId) {
    return window.sheets.deleteBooking(bookingId);
  },

  // --- Expenses ---

  addExpense(expense) {
    return window.sheets.addExpense(expense);
  },

  updateExpense(expenseId, expense) {
    return window.sheets.updateExpense(expenseId, expense);
  },

  deleteExpense(expenseId) {
    return window.sheets.deleteExpense(expenseId);
  },
};

// Relation wiring (private)

function wireBooking(booking, rentalMap, customerMap) {
  return {
    ...booking,
    DurationDays: calcDurationDays(booking.ArrivalDate, booking.DepartureDate),
    rental: rentalMap[booking.RentalId] || null,
    customer: customerMap[booking.CustomerId] || null,
  };
}

function wireExpense(expense, rentalMap) {
  return {
    ...expense,
    rentals: expense.RentalIds.map((rentalId) => rentalMap[rentalId] || null).filter(Boolean),
    Year: expense.DateCreated ? expense.DateCreated.substring(0, 4) : "",
  };
}

function buildMap(items) {
  const map = {};
  items.forEach((item) => {
    map[item.Id] = item;
  });
  return map;
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

function round2(number) {
  return Math.round(number * 100) / 100;
}
