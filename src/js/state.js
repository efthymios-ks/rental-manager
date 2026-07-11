export const state = {
  allRentals: [],
  allCustomers: [],
  allBookings: [],
  allExpenses: [],
  allDashboardSummaries: [],
  currentTab: "dashboard",
  sharedYears: [String(new Date().getFullYear())],
  sharedRentalIds: null,
  calendarBookings: [],
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),
  exportBookings: [],
  _bookingsTabInitialized: false,
  _expensesTabInitialized: false,
  _filteredBookings: [],
  _filteredExpenses: [],
  _filteredCustomers: [],
};

window.state = state;
