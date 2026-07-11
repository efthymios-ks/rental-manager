// Local dev mock — in-memory data, persisted to sessionStorage within the tab session.
// All writes are lost when the tab is closed.

const SESSION_KEY = "rental_manager_local_data";

const SAMPLE_DATA = {
  rentals: [
    { Id: "r1", Name: "Apartment A", PropertyRegistryNumber: "REG-001", FloorArea: "75", ElectricitySupplyNumber: "EL-001" },
    { Id: "r2", Name: "Villa B",     PropertyRegistryNumber: "REG-002", FloorArea: "120", ElectricitySupplyNumber: "EL-002" },
  ],
  customers: [
    { Id: "c1", FullName: "John Smith",        VatOrPassport: "AB123456", PhoneNumber: "+30 210 1234567", Rating: 5, Notes: "Great guest",  IgnoreMissingVat: false },
    { Id: "c2", FullName: "Maria Papadopoulou", VatOrPassport: null,       PhoneNumber: "+30 697 9876543", Rating: 4, Notes: "",             IgnoreMissingVat: false },
    { Id: "c3", FullName: "Klaus Weber",        VatOrPassport: "DE987654", PhoneNumber: "+49 30 55512345", Rating: 3, Notes: "Late checkout", IgnoreMissingVat: false },
  ],
  bookings: [
    { Id: "b1", RentalId: "r1", CustomerId: "c1", ArrivalDate: "2025-07-01", DepartureDate: "2025-07-14", AmountEuros: "1400", Notes: "",             OffRecord: false },
    { Id: "b2", RentalId: "r2", CustomerId: "c2", ArrivalDate: "2025-08-05", DepartureDate: "2025-08-12", AmountEuros: "980",  Notes: "Paid in cash", OffRecord: false },
    { Id: "b3", RentalId: "r1", CustomerId: "c3", ArrivalDate: "2026-06-20", DepartureDate: "2026-06-27", AmountEuros: "700",  Notes: "",             OffRecord: false },
    { Id: "b4", RentalId: "r2", CustomerId: "c1", ArrivalDate: "2026-07-10", DepartureDate: "2026-07-20", AmountEuros: "1500", Notes: "",             OffRecord: true  },
  ],
  expenses: [
    { Id: "e1", RentalIds: ["r1"],      Name: "Cleaning service", AmountEuros: "200", Notes: "",       DateCreated: "2025-07-15" },
    { Id: "e2", RentalIds: ["r1","r2"], Name: "Insurance",        AmountEuros: "600", Notes: "Annual", DateCreated: "2025-01-01" },
    { Id: "e3", RentalIds: ["r2"],      Name: "Plumbing repair",  AmountEuros: "350", Notes: "",       DateCreated: "2026-03-10" },
  ],
};

let _data = null;

function _load() {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return structuredClone(SAMPLE_DATA);
}

function _save() {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(_data));
  } catch {}
}

// ── Public API (same contract as sheets.js) ───────────────────────────────────

async function init() {
  _data = _load();
}

async function getAllData() {
  return structuredClone(_data);
}

function newId() { return crypto.randomUUID(); }

async function addRental(rental) {
  _data.rentals.push({ Id: newId(), Name: rental.Name, PropertyRegistryNumber: rental.PropertyRegistryNumber || "", FloorArea: rental.FloorArea || "", ElectricitySupplyNumber: rental.ElectricitySupplyNumber || "" });
  _save();
}
async function updateRental(id, rental) {
  const i = _data.rentals.findIndex(r => r.Id === id);
  if (i >= 0) _data.rentals[i] = { Id: id, ...rental };
  _save();
}
async function deleteRental(id) {
  _data.rentals = _data.rentals.filter(r => r.Id !== id);
  _save();
}

async function addCustomer(customer) {
  _data.customers.push({ Id: newId(), FullName: customer.FullName, VatOrPassport: customer.VatOrPassport || null, PhoneNumber: String(customer.PhoneNumber || ""), Rating: customer.Rating || 0, Notes: customer.Notes || "", IgnoreMissingVat: !!customer.IgnoreMissingVat });
  _save();
}
async function updateCustomer(id, customer) {
  const i = _data.customers.findIndex(c => c.Id === id);
  if (i >= 0) _data.customers[i] = { Id: id, ...customer };
  _save();
}
async function deleteCustomer(id) {
  _data.customers = _data.customers.filter(c => c.Id !== id);
  _save();
}

async function addBooking(booking) {
  _data.bookings.push({ Id: newId(), RentalId: booking.RentalId, CustomerId: booking.CustomerId, ArrivalDate: booking.ArrivalDate, DepartureDate: booking.DepartureDate, AmountEuros: booking.AmountEuros, Notes: booking.Notes || "", OffRecord: !!booking.OffRecord });
  _save();
}
async function updateBooking(id, booking) {
  const i = _data.bookings.findIndex(b => b.Id === id);
  if (i >= 0) _data.bookings[i] = { Id: id, ...booking };
  _save();
}
async function deleteBooking(id) {
  _data.bookings = _data.bookings.filter(b => b.Id !== id);
  _save();
}

function parseRentalIds(raw) {
  if (Array.isArray(raw)) return raw;
  return raw ? String(raw).split(",").filter(Boolean) : [];
}

async function addExpense(expense) {
  _data.expenses.push({ Id: newId(), RentalIds: parseRentalIds(expense.RentalIds), Name: expense.Name, AmountEuros: expense.AmountEuros, Notes: expense.Notes || "", DateCreated: expense.DateCreated || new Date().toISOString().substring(0, 10) });
  _save();
}
async function updateExpense(id, expense) {
  const i = _data.expenses.findIndex(e => e.Id === id);
  if (i >= 0) _data.expenses[i] = { Id: id, ...expense, RentalIds: parseRentalIds(expense.RentalIds) };
  _save();
}
async function deleteExpense(id) {
  _data.expenses = _data.expenses.filter(e => e.Id !== id);
  _save();
}

window.sheets = {
  init,
  getAllData,
  addRental, updateRental, deleteRental,
  addCustomer, updateCustomer, deleteCustomer,
  addBooking, updateBooking, deleteBooking,
  addExpense, updateExpense, deleteExpense,
};
