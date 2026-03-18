import { LitElement, html } from "../../lib/lit.min.js";
import "../components/rentalFilterDropdown.js";
import { state } from "../state.js";
import { todayStr } from "../utils.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

class CalendarTab extends LitElement {
  static properties = {
    _years: { state: true },
    _year: { state: true },
    _month: { state: true },
    _rentals: { state: true },
    _rentalIds: { state: true },
  };

  #bookings = [];
  #dayBookings = {};

  constructor() {
    super();
    this._years = [];
    this._year = new Date().getFullYear();
    this._month = new Date().getMonth();
    this._rentals = [];
    this._rentalIds = null;
  }

  createRenderRoot() {
    return this;
  }

  load() {
    this._rentals = state.allRentals;
    const bookings = state.allBookings;
    state.calendarBookings = bookings;
    this.#bookings = bookings;
    this.#buildDayBookings(bookings);

    const yearSet = new Set();
    bookings.forEach((booking) => {
      if (booking.ArrivalDate) {
        yearSet.add(new Date(booking.ArrivalDate).getFullYear());
      }
    });

    let years = Array.from(yearSet).sort((yearA, yearB) => yearB - yearA);
    const thisYear = new Date().getFullYear();
    if (!years.length) {
      years = [thisYear];
    }

    this._years = years;
    this._year = years.includes(thisYear) ? thisYear : years[0];
    this._month = new Date().getMonth();
  }

  #buildDayBookings(bookings) {
    this.#dayBookings = {};
    bookings.forEach((booking) => {
      if (!booking.ArrivalDate || !booking.DepartureDate) {
        return;
      }

      let current = new Date(booking.ArrivalDate);
      const end = new Date(booking.DepartureDate);

      while (current < end) {
        const dateKey = current.toISOString().substring(0, 10);
        if (!this.#dayBookings[dateKey]) {
          this.#dayBookings[dateKey] = [];
        }

        this.#dayBookings[dateKey].push(booking);
        current.setDate(current.getDate() + 1);
      }
    });
  }

  #prev() {
    let month = this._month - 1;
    let year = this._year;
    if (month < 0) {
      month = 11;
      year--;
    }

    this._month = month;
    this._year = year;
  }

  #next() {
    let month = this._month + 1;
    let year = this._year;
    if (month > 11) {
      month = 0;
      year++;
    }

    this._month = month;
    this._year = year;
  }

  #onYearChange(event) {
    this._year = parseInt(event.target.value);
  }

  #onRentalChange(event) {
    this._rentalIds = event.target.selectedIds;
  }

  #handleCalendarClick(event) {
    const cell = event.target.closest("[data-date]");
    if (cell) {
      this.#openDayModal(cell.dataset.date);
    }
  }

  #openDayModal(dateString) {
    const dayBookings = this.#dayBookings[dateString] || [];
    const [year, month, day] = dateString.split("-");
    const dateLabel = new Date(year, month - 1, day).toLocaleDateString("el-GR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    document.getElementById("calendarDayModalTitle").textContent = dateLabel;

    const items = dayBookings.map((booking) => {
      const amountHtml = booking.AmountEuros ? ` · ${booking.AmountEuros}€` : "";
      return [
        `<li class="list-group-item">`,
        `<div class="fw-semibold">${booking.rental?.Name || booking.RentalId}</div>`,
        `<div class="small text-muted">${booking.customer?.FullName || "—"}</div>`,
        `<div class="small text-muted">${booking.ArrivalDate} → ${booking.DepartureDate}${amountHtml}</div>`,
        `</li>`,
      ].join("");
    });
    document.getElementById("calendarDayModalBody").innerHTML =
      `<ul class="list-group list-group-flush">${items.join("")}</ul>`;
    new bootstrap.Modal(document.getElementById("calendarDayModal")).show();
  }

  #getDates() {
    const dates = [];
    const addMonth = (year, month) => {
      const days = new Date(year, month + 1, 0).getDate();
      const paddedMonth = String(month + 1).padStart(2, "0");
      for (let day = 1; day <= days; day++) {
        dates.push(`${year}-${paddedMonth}-${String(day).padStart(2, "0")}`);
      }
    };

    addMonth(this._year, this._month);
    let nextMonth = this._month + 1;
    let nextYear = this._year;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear++;
    }

    addMonth(nextYear, nextMonth);
    return dates;
  }

  render() {
    const rentalIds = this._rentalIds ?? [];
    const dates = this.#getDates();
    const separatorIndex = new Date(this._year, this._month + 1, 0).getDate();
    const today = todayStr();
    const calendarColors = ["var(--bs-primary)", "var(--bs-secondary)"];

    const bookingMap = {};
    const bookingColorMap = {};
    const colorCounters = {};
    this.#bookings.forEach((booking) => {
      if (!booking.ArrivalDate || !booking.DepartureDate) {
        return;
      }

      if (rentalIds.length > 0 && !rentalIds.includes(booking.RentalId)) {
        return;
      }

      if (!bookingMap[booking.RentalId]) {
        bookingMap[booking.RentalId] = {};
      }

      if (colorCounters[booking.RentalId] === undefined) {
        colorCounters[booking.RentalId] = 0;
      }

      bookingColorMap[booking.Id] = calendarColors[colorCounters[booking.RentalId] % 2];
      colorCounters[booking.RentalId]++;

      let current = new Date(booking.ArrivalDate);
      const end = new Date(booking.DepartureDate);
      while (current < end) {
        bookingMap[booking.RentalId][current.toISOString().substring(0, 10)] = booking;
        current.setDate(current.getDate() + 1);
      }
    });

    const filteredRentals =
      rentalIds.length > 0
        ? this._rentals.filter((rental) => rentalIds.includes(rental.Id))
        : this._rentals;

    let nextMonth = this._month + 1;
    let nextYear = this._year;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear++;
    }

    const monthLabel = `${MONTH_NAMES[this._month]} ${this._year} - ${MONTH_NAMES[nextMonth]} ${nextYear}`;
    const headerCells = dates.map((dateAsString, dateIndex) => {
      const dayNum = parseInt(dateAsString.substring(8));
      const monthIndex = parseInt(dateAsString.substring(5, 7)) - 1;
      const sep = dateIndex === separatorIndex ? " cal-gantt-sep" : "";
      const todayCls = dateAsString === today ? " cal-gantt-today" : "";
      const monthLbl =
        dayNum === 1 || dateIndex === 0
          ? html`<div class="cal-gantt-month-label">${MONTH_NAMES[monthIndex].substring(0, 3)}</div>`
          : "";
      return html`<div class="cal-gantt-hcell${sep}${todayCls}">${monthLbl}${dayNum}</div>`;
    });

    const rows = filteredRentals.map((rental) => {
      const cells = dates.map((dateAsString, dateIndex) => {
        const booking = bookingMap[rental.Id]?.[dateAsString];
        const sep = dateIndex === separatorIndex ? " cal-gantt-sep" : "";
        const todayCls = dateAsString === today ? " cal-gantt-today" : "";
        if (booking) {
          const color = bookingColorMap[booking.Id] || "var(--bs-primary)";
          return html`<div
            class="cal-gantt-cell cal-gantt-occupied${sep}"
            style="background:${color};"
            data-date="${dateAsString}"
            title="${booking.customer?.FullName ?? ""}"
          ></div>`;
        }

        return html`<div class="cal-gantt-cell${sep}${todayCls}"></div>`;
      });
      return html`
        <div class="cal-gantt-row">
          <div class="cal-gantt-label" style="border-left:3px solid var(--bs-success)">
            ${rental.Name}
          </div>
          <div class="cal-gantt-cells">${cells}</div>
        </div>
      `;
    });

    return html`
      <div class="card mb-3">
        <div class="card-header"><i class="bi bi-calendar3 me-1"></i> Calendar</div>
        <div class="card-body border-bottom py-3">
          <div class="d-flex flex-wrap gap-2 justify-content-center align-items-center">
            <a
              href="#"
              class="text-decoration-none text-muted"
              @click=${(event) => {
                event.preventDefault();
                this.#prev();
              }}
            >&#8592;</a>
            <span class="fw-semibold small text-nowrap">${monthLabel}</span>
            <a
              href="#"
              class="text-decoration-none text-muted"
              @click=${(event) => {
                event.preventDefault();
                this.#next();
              }}
            >&#8594;</a>
            <select
              class="form-select form-select-sm"
              style="max-width:90px"
              @change=${this.#onYearChange}
            >
              ${this._years.map(
                (year) => html`
                  <option value="${year}" .selected=${year === this._year}>${year}</option>
                `,
              )}
            </select>
            <rental-filter-dropdown
              .rentals=${this._rentals}
              @change=${this.#onRentalChange}
            ></rental-filter-dropdown>
          </div>
        </div>
        <div class="card-body p-3" @click=${this.#handleCalendarClick}>
          <div class="cal-gantt">
            <div class="cal-gantt-row cal-gantt-header">
              <div class="cal-gantt-label"></div>
              <div class="cal-gantt-cells">${headerCells}</div>
            </div>
            ${rows}
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("calendar-tab", CalendarTab);
