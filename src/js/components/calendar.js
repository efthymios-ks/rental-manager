import { LitElement, html } from "../../lib/lit.min.js";
import { filterBar } from "./filterBar.js";
import "./monthPicker.js";
import "./rentalFilterDropdown.js";
import { state } from "../state.js";
import { subscribeLanguage, t } from "../translations.js";
import { computeCalendarYears, todayStr } from "../utils.js";

class CalendarTab extends LitElement {
  static properties = {
    _year: { state: true },
    _month: { state: true },
    _years: { state: true },
    _rentals: { state: true },
    _rentalIds: { state: true },
  };

  #bookings = [];
  #dayBookings = {};

  constructor() {
    super();
    this._year = new Date().getFullYear();
    this._month = new Date().getMonth();
    this._years = [];
    this._rentals = [];
    this._rentalIds = null;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsubLang = subscribeLanguage(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubLang?.();
  }

  load() {
    this._rentals = state.allRentals;
    const bookings = state.allBookings;
    state.calendarBookings = bookings;
    this.#bookings = bookings;
    this.#buildDayBookings(bookings);

    this._years = computeCalendarYears();
    this._rentalIds = state.sharedRentalIds;

    this.updateComplete.then(() => {
      this.querySelector("rental-filter-dropdown")?.setSelected(state.sharedRentalIds);
    });
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

  #onMonthPickerChange(event) {
    this._year = event.detail.year;
    this._month = event.detail.month;
  }

  #onRentalChange(event) {
    state.sharedRentalIds = event.target.selectedIds;
    this._rentalIds = state.sharedRentalIds;
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
    const days = new Date(this._year, this._month + 1, 0).getDate();
    const paddedMonth = String(this._month + 1).padStart(2, "0");
    const dates = [];
    for (let day = 1; day <= days; day++) {
      dates.push(`${this._year}-${paddedMonth}-${String(day).padStart(2, "0")}`);
    }
    return dates;
  }

  render() {
    const rentalIds = this._rentalIds ?? [];
    const dates = this.#getDates();
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

    const headerCells = dates.map((dateAsString) => {
      const dayNum = parseInt(dateAsString.substring(8));
      const todayCls = dateAsString === today ? " cal-gantt-today" : "";
      return html`<div class="cal-gantt-hcell${todayCls}">${dayNum}</div>`;
    });

    const rows = filteredRentals.map((rental) => {
      const cells = dates.map((dateAsString) => {
        const booking = bookingMap[rental.Id]?.[dateAsString];
        const todayCls = dateAsString === today ? " cal-gantt-today" : "";
        if (booking) {
          const color = bookingColorMap[booking.Id] || "var(--bs-primary)";
          return html`<div
            class="cal-gantt-cell cal-gantt-occupied"
            style="background:${color};"
            data-date="${dateAsString}"
            title="${booking.customer?.FullName ?? ""}"
          ></div>`;
        }

        return html`<div class="cal-gantt-cell${todayCls}"></div>`;
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
      ${filterBar(html`
        <rental-filter-dropdown
          .rentals=${state.allRentals}
          @change=${this.#onRentalChange}
        ></rental-filter-dropdown>
        <a
          href="#"
          class="text-decoration-none text-muted fs-5"
          @click=${(event) => { event.preventDefault(); this.#prev(); }}
        >&#8592;</a>
        <month-picker
          .years=${this._years}
          .year=${this._year}
          .month=${this._month}
          @change=${this.#onMonthPickerChange}
        ></month-picker>
        <a
          href="#"
          class="text-decoration-none text-muted fs-5"
          @click=${(event) => { event.preventDefault(); this.#next(); }}
        >&#8594;</a>
      `)}
      <div class="card">
        <div class="card-header"><i class="bi bi-calendar3 me-1"></i> ${t("calendar.title", "Calendar")}</div>
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
