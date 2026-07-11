import { LitElement, html } from "../../lib/lit.min.js";
import { filterBar } from "./filterBar.js";
import "./monthPicker.js";
import "./rentalsMultiSelect.js";
import { state } from "../state.js";
import { subscribeLanguage, getLanguage, t } from "../translations.js";
import { todayStr } from "../utils.js";

const GANTT_CSS = `
.cal-gantt { overflow-x: auto; }
.cal-gantt-row { display: flex; align-items: stretch; min-width: max-content; }
.cal-gantt-label {
  width: 110px; min-width: 110px; font-size: 0.75rem; font-weight: 600;
  padding: 0.3rem 0.5rem; display: flex; align-items: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  border-bottom: 1px solid var(--cui-border-color); background: var(--cui-white);
  position: sticky; left: 0; z-index: 1;
}
.cal-gantt-cells { display: flex; }
.cal-gantt-hcell, .cal-gantt-cell {
  width: 28px; min-width: 28px; height: 32px;
  border-right: 1px solid var(--cui-border-color);
  border-bottom: 1px solid var(--cui-border-color);
  box-sizing: border-box;
}
.cal-gantt-hcell {
  height: 48px; display: flex; flex-direction: column;
  align-items: center; justify-content: flex-end; padding-bottom: 4px;
  font-size: 0.65rem; font-weight: 700; color: var(--cui-secondary-color); position: relative;
}
.cal-gantt-weekday { font-size: 0.55rem; font-weight: 400; opacity: 0.7; line-height: 1.2; }
.cal-gantt-month-label {
  font-size: 0.58rem; color: var(--cui-secondary-color);
  position: absolute; top: 2px; left: 0; right: 0; text-align: center;
}
.cal-gantt-occupied { cursor: pointer; opacity: 0.85; }
.cal-gantt-occupied:hover { opacity: 1; }
.cal-gantt-today { background: var(--cui-warning-bg-subtle) !important; }
.cal-gantt-sep { border-left: 2px solid var(--cui-secondary-color) !important; }
`;

const _ganttStyle = document.createElement("style");
_ganttStyle.textContent = GANTT_CSS;
document.head.appendChild(_ganttStyle);

class CalendarTab extends LitElement {
  static properties = {
    _year: { state: true },
    _month: { state: true },
    _rentals: { state: true },
    _rentalIds: { state: true },
  };

  #bookings = [];
  #dayBookings = {};

  constructor() {
    super();
    this._year = new Date().getFullYear();
    this._month = new Date().getMonth();
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
    new coreui.Modal(document.getElementById("calendarDayModal")).show();
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
    const calendarColors = ["var(--cui-primary)", "var(--cui-secondary)"];

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

    const weekdayFmt = new Intl.DateTimeFormat(getLanguage(), { weekday: "short" });
    const headerCells = dates.map((dateAsString) => {
      const [y, m, d] = dateAsString.split("-").map(Number);
      const dayNum = d;
      const weekday = weekdayFmt.format(new Date(y, m - 1, d));
      const todayCls = dateAsString === today ? " cal-gantt-today" : "";
      return html`<div class="cal-gantt-hcell${todayCls}">
        <span class="cal-gantt-weekday">${weekday}</span>
        <span>${dayNum}</span>
      </div>`;
    });

    const rows = filteredRentals.map((rental) => {
      const cells = dates.map((dateAsString) => {
        const booking = bookingMap[rental.Id]?.[dateAsString];
        const todayCls = dateAsString === today ? " cal-gantt-today" : "";
        if (booking) {
          const color = bookingColorMap[booking.Id] || "var(--cui-primary)";
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
          <div class="cal-gantt-label" style="border-left:3px solid var(--cui-success)">
            ${rental.Name}
          </div>
          <div class="cal-gantt-cells">${cells}</div>
        </div>
      `;
    });

    return html`
      ${filterBar(html`
        <div class="flex-shrink-0"><month-picker @change=${this.#onMonthPickerChange}></month-picker></div>
        <div class="flex-shrink-0"><rental-filter-dropdown
          .rentals=${state.allRentals}
          @change=${this.#onRentalChange}
        ></rental-filter-dropdown></div>
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
