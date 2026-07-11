const SHEETS_BASE = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.dataSource.id}`;

const SCHEMA = {
  rentals: {
    sheet: "Rentals",
    columns: ["Id", "Name", "Address", "PropertyRegistryNumber", "FloorArea", "ElectricitySupplyNumber", "WaterSupplyNumber", "InternetPhoneNumber", "ExtraInfoJson"],
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

let _sheetIdMap = {};
let _columnIndexMap = {};

// ── Public: metadata init ──────────────────────────────────────────────────

async function init() {
  const resp = await sheetsRequest(`${SHEETS_BASE}?fields=sheets.properties`);
  resp.sheets.forEach((sheet) => {
    _sheetIdMap[sheet.properties.title] = sheet.properties.sheetId;
  });
}

// ── Public: bulk read ──────────────────────────────────────────────────────

async function getAllData() {
  const schemaList = [SCHEMA.rentals, SCHEMA.customers, SCHEMA.bookings, SCHEMA.expenses];
  const ranges = schemaList.map(({ sheet }) => `${sheet}!A1:Z1001`);
  const query = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const response = await sheetsRequest(
    `${SHEETS_BASE}/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&${query}`,
  );

  _columnIndexMap = validateAndMapHeaders(schemaList, response.valueRanges);

  const [rawRentals, rawCustomers, rawBookings, rawExpenses] = response.valueRanges.map(
    (valueRange, i) => extractRows(schemaList[i], valueRange),
  );

  return {
    rentals: rawRentals.map(decodeRental),
    customers: rawCustomers.map(decodeCustomer),
    bookings: rawBookings.map(decodeBooking),
    expenses: rawExpenses.map(decodeExpense),
  };
}

// ── Public: entity CRUD ────────────────────────────────────────────────────

async function addRental(rental) {
  await append(SCHEMA.rentals, { Id: newId(), ...encodeRental(rental) });
}

async function updateRental(rentalId, rental) {
  const rowIndex = await getRowIndexById(SCHEMA.rentals.sheet, rentalId);
  await updateRow(SCHEMA.rentals, rowIndex, encodeRental(rental));
}

async function deleteRental(rentalId) {
  const rowIndex = await getRowIndexById(SCHEMA.rentals.sheet, rentalId);
  await deleteRow(SCHEMA.rentals.sheet, rowIndex);
}

async function addCustomer(customer) {
  await append(SCHEMA.customers, { Id: newId(), ...encodeCustomer(customer) });
}

async function updateCustomer(customerId, customer) {
  const rowIndex = await getRowIndexById(SCHEMA.customers.sheet, customerId);
  await updateRow(SCHEMA.customers, rowIndex, encodeCustomer(customer));
}

async function deleteCustomer(customerId) {
  const rowIndex = await getRowIndexById(SCHEMA.customers.sheet, customerId);
  await deleteRow(SCHEMA.customers.sheet, rowIndex);
}

async function addBooking(booking) {
  await append(SCHEMA.bookings, { Id: newId(), ...encodeBooking(booking) });
}

async function updateBooking(bookingId, booking) {
  const rowIndex = await getRowIndexById(SCHEMA.bookings.sheet, bookingId);
  await updateRow(SCHEMA.bookings, rowIndex, encodeBooking(booking));
}

async function deleteBooking(bookingId) {
  const rowIndex = await getRowIndexById(SCHEMA.bookings.sheet, bookingId);
  await deleteRow(SCHEMA.bookings.sheet, rowIndex);
}

async function addExpense(expense) {
  await append(SCHEMA.expenses, { Id: newId(), ...encodeExpense(expense) });
}

async function updateExpense(expenseId, expense) {
  const rowIndex = await getRowIndexById(SCHEMA.expenses.sheet, expenseId);
  await updateRow(SCHEMA.expenses, rowIndex, encodeExpense(expense));
}

async function deleteExpense(expenseId) {
  const rowIndex = await getRowIndexById(SCHEMA.expenses.sheet, expenseId);
  await deleteRow(SCHEMA.expenses.sheet, rowIndex);
}

// ── Encoders (domain → storage row) ────────────────────────────────────────

function encodeRental(rental) {
  return {
    Name: rental.Name,
    Address: rental.Address || "",
    PropertyRegistryNumber: rental.PropertyRegistryNumber || "",
    FloorArea: rental.FloorArea || "",
    ElectricitySupplyNumber: rental.ElectricitySupplyNumber || "",
    WaterSupplyNumber: rental.WaterSupplyNumber || "",
    InternetPhoneNumber: rental.InternetPhoneNumber || "",
    ExtraInfoJson: rental.ExtraInfoJson?.length ? JSON.stringify([...rental.ExtraInfoJson].sort((a, b) => a.key.localeCompare(b.key))) : "",
  };
}

function encodeCustomer(customer) {
  return {
    FullName: customer.FullName,
    VatOrPassport: customer.VatOrPassport || "",
    PhoneNumber: String(customer.PhoneNumber || ""),
    Rating: customer.Rating ? String(customer.Rating) : "",
    Notes: customer.Notes || "",
    IgnoreMissingVat: customer.IgnoreMissingVat ? "1" : "",
  };
}

function encodeBooking(booking) {
  return {
    RentalId: booking.RentalId,
    CustomerId: booking.CustomerId,
    ArrivalDate: booking.ArrivalDate,
    DepartureDate: booking.DepartureDate,
    AmountEuros: booking.AmountEuros,
    Notes: booking.Notes || "",
    OffRecord: booking.OffRecord ? "1" : "",
  };
}

function encodeExpense(expense) {
  const rentalIds = Array.isArray(expense.RentalIds)
    ? expense.RentalIds.join(",")
    : expense.RentalIds || "";
  return {
    RentalIds: rentalIds,
    Name: expense.Name,
    AmountEuros: expense.AmountEuros,
    Notes: expense.Notes || "",
    DateCreated: expense.DateCreated || toDateString(new Date()),
  };
}

// ── Decoders (storage row → domain) ────────────────────────────────────────

function decodeRental(row) {
  return {
    ...row,
    ExtraInfoJson: row.ExtraInfoJson ? JSON.parse(row.ExtraInfoJson) : [],
  };
}

function decodeCustomer(row) {
  return {
    ...row,
    VatOrPassport: row.VatOrPassport || null,
    Rating: parseInt(row.Rating) || 0,
    Notes: row.Notes || "",
    PhoneNumber: String(row.PhoneNumber || ""),
    IgnoreMissingVat: !!row.IgnoreMissingVat,
  };
}

function decodeBooking(row) {
  return {
    ...row,
    ArrivalDate: toDateString(row.ArrivalDate),
    DepartureDate: toDateString(row.DepartureDate),
    Notes: row.Notes || "",
    OffRecord: row.OffRecord === "1",
  };
}

function decodeExpense(row) {
  return {
    ...row,
    RentalIds: row.RentalIds ? String(row.RentalIds).split(",").filter(Boolean) : [],
    Notes: row.Notes || "",
    DateCreated: toDateString(row.DateCreated),
  };
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

// ── Row-level helpers (private) ────────────────────────────────────────────

function extractRows({ sheet, columns }, valueRange) {
  const allRows = valueRange.values || [];
  const rows = [];
  for (let r = 1; r < allRows.length; r++) {
    const row = allRows[r];
    if (!row[0]) { continue; }
    const obj = {};
    columns.forEach((col) => {
      const idx = _columnIndexMap[sheet][col];
      obj[col] = row[idx] !== undefined ? row[idx] : "";
    });
    rows.push(obj);
  }
  return rows;
}

function validateAndMapHeaders(schemaList, valueRanges) {
  const issues = [];
  const newMap = {};

  schemaList.forEach(({ sheet }) => {
    if (!(_sheetIdMap[sheet] !== undefined)) {
      issues.push({ issue: "Sheet missing from spreadsheet", sheet, column: "—" });
    }
  });

  schemaList.forEach(({ sheet, columns }, i) => {
    const headers = valueRanges[i].values?.[0] || [];
    newMap[sheet] = {};

    columns.forEach((col) => {
      const idx = headers.indexOf(col);
      if (idx === -1) {
        issues.push({ issue: "Column missing from sheet", sheet, column: col });
      } else {
        newMap[sheet][col] = idx;
      }
    });

    headers.forEach((header) => {
      if (!columns.includes(header)) {
        issues.push({ issue: "Column missing from schema", sheet, column: header });
      }
    });
  });

  if (issues.length > 0) {
    console.table(issues);
    sessionStorage.setItem("schemaIssues", JSON.stringify(issues));
    window.location.href = "500.html";
    throw new Error("Schema validation failed — redirecting.");
  }

  return newMap;
}

async function append({ sheet, columns }, obj) {
  const colMap = _columnIndexMap[sheet];
  const maxIdx = Math.max(...columns.map((c) => colMap[c]));
  const values = new Array(maxIdx + 1).fill("");
  columns.forEach((col) => { values[colMap[col]] = obj[col] !== undefined ? obj[col] : ""; });
  await sheetsRequest(
    `${SHEETS_BASE}/values/${encodeURIComponent(sheet)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: [values] }) },
  );
}

async function updateRow({ sheet, columns }, rowIndex, partialObj) {
  const colMap = _columnIndexMap[sheet];
  const data = Object.entries(partialObj)
    .filter(([key]) => columns.includes(key))
    .map(([key, value]) => ({
      range: `${sheet}!${String.fromCharCode(65 + colMap[key])}${rowIndex}`,
      values: [[value !== undefined && value !== null ? value : ""]],
    }));
  if (!data.length) { return; }
  await sheetsRequest(`${SHEETS_BASE}/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  });
}

async function deleteRow(sheetName, rowIndex) {
  const sheetId = _sheetIdMap[sheetName];
  await sheetsRequest(`${SHEETS_BASE}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    }),
  });
}

async function getRowIndexById(sheetName, idValue) {
  const resp = await sheetsRequest(
    `${SHEETS_BASE}/values/${encodeURIComponent(`${sheetName}!A:A`)}`,
  );
  const rows = resp.values || [];
  const dataIndex = rows.slice(1).findIndex((row) => row[0] === idValue);
  if (dataIndex < 0) {
    throw new Error(`Id "${idValue}" not found in ${sheetName}`);
  }

  return dataIndex + 2;
}

function newId() {
  return crypto.randomUUID();
}

async function sheetsRequest(url, options = {}) {
  const token = window.auth.getAccessToken();
  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(
      (errData.error && errData.error.message) || `HTTP ${resp.status}`,
    );
  }

  return resp.json();
}

window.sheets = {
  init,
  getAllData,
  addRental, updateRental, deleteRental,
  addCustomer, updateCustomer, deleteCustomer,
  addBooking, updateBooking, deleteBooking,
  addExpense, updateExpense, deleteExpense,
};
