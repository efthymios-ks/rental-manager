import { LitElement, html } from "../../lib/lit.min.js";
import { subscribeLanguage, t } from "../translations.js";

const DEFAULT_AIRBNB_FEE = 0.1922; // 15.5% × 1.24 (host-only + ΦΠΑ 24%)
const DEFAULT_BOOKING_FEE = 0.186; // 15% × 1.24 (from 1/12/2026, no VIES)
const DEFAULT_BOOKING_BANK_FEE = 0.016;
const PRO_VAT = 0.13;
// Municipalities may raise the τέλος παρεπιδημούντων from 0.5% to 0.75% (ν. 5143/2024, άρθρο 30)
const DEFAULT_PRO_MUNICIPAL = 0.005;
// From 60 nights the stay is a long-term rental: no ΤΑΚΚ and no Μητρώο ΒΜ (AADE FAQ 2 and 24)
const LONG_STAY_NIGHTS = 60;
// April to October as 0-based month indexes
const HIGH_SEASON_MONTHS = [3, 4, 5, 6, 7, 8, 9];
const ENV_FEE_RATES = {
  apartment: { high: 8, low: 2 },
  house: { high: 15, low: 4 },
};

/**
 * Tells whether a date falls in the ΤΑΚΚ high season.
 * @param {Date} date The date to check.
 * @returns {boolean} True for April to October.
 */
function isHighSeason(date) {
  return HIGH_SEASON_MONTHS.includes(date.getMonth());
}

/**
 * Counts how many nights of a stay fall in the ΤΑΚΚ high and low seasons.
 * Each night is judged by its own date, because AADE charges the fee per daily use.
 * @param {string} arrivalIso Arrival date as YYYY-MM-DD.
 * @param {number} nights Number of nights.
 * @returns {{high: number, low: number}} Nights per season.
 */
function splitNightsBySeason(arrivalIso, nights) {
  let high = 0;
  let low = 0;
  // Noon keeps daylight saving changes from shifting the date while stepping day by day
  const night = new Date(`${arrivalIso}T12:00:00`);
  for (let index = 0; index < nights; index++) {
    if (isHighSeason(night)) {
      high++;
    } else {
      low++;
    }

    night.setDate(night.getDate() + 1);
  }

  return { high, low };
}

class CalculatorTab extends LitElement {
  static properties = {
    _taxStatus: { state: true },
    _platform: { state: true },
    _nights: { state: true },
    _arrival: { state: true },
    _propertyType: { state: true },
    _envFeePerNight: { state: true },
    _envFeeHigh: { state: true },
    _envFeeLow: { state: true },
    _envFeeAsExtra: { state: true },
    _pricePerNight: { state: true },
    _extras: { state: true },
    _discounts: { state: true },
    _airbnbFee: { state: true },
    _bookingFee: { state: true },
    _bookingBankFee: { state: true },
    _proMunicipal: { state: true },
    _showAdvanced: { state: true },
    _explainMode: { state: true },
  };

  constructor() {
    super();
    this._taxStatus = "individual";
    this._platform = "booking";
    this._nights = 1;
    this._arrival = "";
    this.#applyPropertyType("apartment");
    this._envFeeAsExtra = true;
    this._pricePerNight = 80;
    this._extras = 0;
    this._discounts = 0;
    this._airbnbFee = DEFAULT_AIRBNB_FEE;
    this._bookingFee = DEFAULT_BOOKING_FEE;
    this._bookingBankFee = DEFAULT_BOOKING_BANK_FEE;
    this._proMunicipal = DEFAULT_PRO_MUNICIPAL;
    this._showAdvanced = false;
    this._explainMode = false;
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
    this.querySelectorAll("[data-tooltip-text]").forEach((el) => {
      coreui.Tooltip.getInstance(el)?.dispose();
    });
  }

  updated(changed) {
    super.updated?.(changed);
    this.querySelectorAll("[data-tooltip-text]").forEach((el) => {
      const content = el.getAttribute("data-tooltip-text") || "";
      const existing = coreui.Tooltip.getInstance(el);
      if (existing) existing.dispose();
      coreui.Tooltip.getOrCreateInstance(el, {
        title: content,
        trigger: "hover focus click",
        container: "body",
        customClass: "calc-tooltip",
      });
    });
  }

  load() {
    // Start with a default target of 100 € "net in pocket"
    this.#onNetTargetChange("100");
  }

  #onNightsChange(value) {
    const n = parseInt(value, 10);
    this._nights = isNaN(n) || n < 1 ? 1 : n;
  }

  /**
   * Resets the ΤΑΚΚ rates to the defaults of a property type.
   * Without an arrival date the single rate follows today's season, so November defaults to the low rate.
   * @param {string} propertyType Either "apartment" or "house".
   */
  #applyPropertyType(propertyType) {
    const rates = ENV_FEE_RATES[propertyType] ?? ENV_FEE_RATES.apartment;
    this._propertyType = propertyType;
    this._envFeeHigh = rates.high;
    this._envFeeLow = rates.low;
    this._envFeePerNight = isHighSeason(new Date()) ? rates.high : rates.low;
  }

  /**
   * Computes the ΤΑΚΚ of the stay.
   * @param {number} nights Number of nights.
   * @returns {{total: number, high: number, low: number, longStay: boolean, bySeason: boolean}} Total fee and nights per season.
   */
  #envFee(nights) {
    if (nights >= LONG_STAY_NIGHTS) {
      return { total: 0, high: 0, low: 0, longStay: true, bySeason: false };
    }

    if (!this._arrival) {
      const total = nights * (parseFloat(this._envFeePerNight) || 0);
      return { total, high: 0, low: 0, longStay: false, bySeason: false };
    }

    const { high, low } = splitNightsBySeason(this._arrival, nights);
    const total = high * (parseFloat(this._envFeeHigh) || 0) + low * (parseFloat(this._envFeeLow) || 0);
    return { total, high, low, longStay: false, bySeason: true };
  }

  /**
   * @returns {number} Factor that turns the declared rent into the price with VAT and municipal tax.
   */
  #proGrossFactor() {
    return (1 + PRO_VAT) * (1 + (parseFloat(this._proMunicipal) || 0));
  }

  #onNetTargetChange(value) {
    const target = parseFloat(value);
    if (isNaN(target) || target < 0) return;

    const nights = Math.max(1, parseInt(this._nights, 10) || 1);
    const extras = parseFloat(this._extras) || 0;
    const discounts = parseFloat(this._discounts) || 0;
    const isPro = this._taxStatus === "professional";
    const isBooking = this._platform === "booking";
    const inside = this.#isInsideEffective();
    const fee = isBooking ? this._bookingFee : this._airbnbFee;
    const bank = isBooking ? this._bookingBankFee : 0;
    // VAT is charged on rent + municipal tax, so everything above the declared rent is tax
    const proDeduct = isPro ? 1 - 1 / this.#proGrossFactor() : 0;

    const denom = 1 - fee - bank - proDeduct;
    if (denom <= 0) return;

    const envFeeTotal = this.#envFee(nights).total;
    const offset = inside
      ? envFeeTotal * (1 - proDeduct)
      : envFeeTotal * bank;
    const listingAmount = (target + offset) / denom;
    const price = (listingAmount - extras + discounts) / nights;
    if (price < 0 || !isFinite(price)) return;
    this._pricePerNight = Math.round(price * 100) / 100;
  }

  #isAsExtraEffective() {
    // Airbnb is locked to extra=true (TAKK auto-charged as separate line);
    // Booking honors the user toggle.
    return this._platform === "airbnb" ? true : this._envFeeAsExtra;
  }

  #isInsideEffective() {
    return !this.#isAsExtraEffective();
  }

  #compute() {
    const nights = Math.max(1, parseInt(this._nights, 10) || 1);
    const price = parseFloat(this._pricePerNight) || 0;
    const extras = parseFloat(this._extras) || 0;
    const discounts = parseFloat(this._discounts) || 0;
    const envFee = this.#envFee(nights);
    const envFeeTotal = envFee.total;
    const inside = this.#isInsideEffective();

    const listingAmount = nights * price + extras - discounts;

    const isPro = this._taxStatus === "professional";
    // ΤΑΚΚ inside the price is remitted, so it is neither income nor part of the VAT base (AADE FAQ 21 and 25)
    const rentAmount = inside ? listingAmount - envFeeTotal : listingAmount;
    const declaration = isPro ? rentAmount / this.#proGrossFactor() : rentAmount;
    const proMunicipal = isPro ? declaration * this._proMunicipal : 0;
    // VAT base includes the municipal tax, as in the AADE FAQ 27 example
    const proVat = isPro ? (declaration + proMunicipal) * PRO_VAT : 0;

    let commission = 0;
    let bankFee = 0;
    if (this._platform === "airbnb") {
      commission = listingAmount * this._airbnbFee;
    } else {
      commission = listingAmount * this._bookingFee;
      const bankBase = inside ? listingAmount : listingAmount + envFeeTotal;
      bankFee = bankBase * this._bookingBankFee;
    }

    const guestPays = inside ? listingAmount : listingAmount + envFeeTotal;
    const payout = guestPays - commission - bankFee;
    const afterEnvFee = payout - envFeeTotal;
    const netFinal = afterEnvFee - proVat - proMunicipal;

    return {
      listingAmount,
      declaration,
      envFee,
      envFeeTotal,
      proVat,
      proMunicipal,
      commission,
      bankFee,
      guestPays,
      payout,
      netFinal,
      effectiveFee: listingAmount > 0 ? (commission + bankFee) / listingAmount : 0,
    };
  }

  render() {
    const c = this.#compute();
    const fmt = (n) =>
      n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
    const fmtPct = (n) =>
      (n * 100).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
    const formatRatePercent = (rate) =>
      `${(rate * 100).toLocaleString("el-GR", { maximumFractionDigits: 2 })}%`;
    const formatFactor = (factor) => factor.toLocaleString("el-GR", { maximumFractionDigits: 4 });

    const isPro = this._taxStatus === "professional";
    const isBooking = this._platform === "booking";
    const inside = this.#isInsideEffective();
    const municipalRate = parseFloat(this._proMunicipal) || 0;
    const rentFormula = `${fmt(parseFloat(this._pricePerNight) || 0)} × ${this._nights} + ${fmt(parseFloat(this._extras) || 0)} − ${fmt(parseFloat(this._discounts) || 0)}${inside ? ` − ${fmt(c.envFeeTotal)}` : ""}`;
    let declarationWordFormula;
    if (isPro) {
      declarationWordFormula = inside
        ? t("calculator.formula.declarationProInside", "(Price × Nights + Extras − Discounts − Environmental Fee) / ((1 + VAT) × (1 + Municipal))")
        : t("calculator.formula.declarationPro", "(Price × Nights + Extras − Discounts) / ((1 + VAT) × (1 + Municipal))");
    } else {
      declarationWordFormula = inside
        ? t("calculator.formula.declarationInside", "Price × Nights + Extras − Discounts − Environmental Fee")
        : t("calculator.formula.declaration", "Price × Nights + Extras − Discounts");
    }

    let envFeeWordFormula = t("calculator.formula.envFeeTotal", "Nights × Environmental Fee per Night");
    let envFeeNumberFormula = `${this._nights} × ${fmt(parseFloat(this._envFeePerNight) || 0)} = ${fmt(c.envFeeTotal)}`;
    if (c.envFee.longStay) {
      envFeeWordFormula = t("calculator.formula.envFeeLongStay", "60+ nights: long-term rental, no Environmental Fee");
      envFeeNumberFormula = `${this._nights} ≥ ${LONG_STAY_NIGHTS} → ${fmt(0)}`;
    } else if (c.envFee.bySeason) {
      envFeeWordFormula = t("calculator.formula.envFeeSeasons", "Apr–Oct nights × High rate + Nov–Mar nights × Low rate");
      envFeeNumberFormula = `${c.envFee.high} × ${fmt(parseFloat(this._envFeeHigh) || 0)} + ${c.envFee.low} × ${fmt(parseFloat(this._envFeeLow) || 0)} = ${fmt(c.envFeeTotal)}`;
    }

    return html`
      <!-- Tax Status -->
      <div class="card mb-3">
        <div class="card-header d-flex align-items-center">
          <i class="bi bi-person-badge me-1"></i>${t("calculator.taxStatus", "Tax Status")}
          <i class="bi bi-info-circle text-muted ms-1 small" style="cursor: help"
            data-tooltip-text=${t("calculator.taxStatusTooltip", "• Individual: natural person with 1-2 properties, no additional services\n• Professional: ≥3 properties, keeps books, or provides hotel-like services")}></i>
        </div>
        <div class="card-body">
          <div class="btn-group w-100" role="group">
            <input type="radio" class="btn-check" name="taxStatus" id="tsIndividual"
              .checked=${this._taxStatus === "individual"}
              @change=${() => (this._taxStatus = "individual")}>
            <label class="btn btn-outline-success" for="tsIndividual">
              ${t("calculator.individual", "Individual")}
            </label>
            <input type="radio" class="btn-check" name="taxStatus" id="tsProfessional"
              .checked=${this._taxStatus === "professional"}
              @change=${() => (this._taxStatus = "professional")}>
            <label class="btn btn-outline-success" for="tsProfessional">
              ${t("calculator.professional", "Professional")}
            </label>
          </div>
          ${isPro ? html`
            <div class="small text-muted mt-2">
              <i class="bi bi-info-circle me-1"></i>
              ${t("calculator.proNote", "Price includes 13% VAT and {municipal} municipal tax (remitted separately).", { municipal: formatRatePercent(municipalRate) })}
            </div>
          ` : ""}
        </div>
      </div>

      <!-- Platform -->
      <div class="card mb-3">
        <div class="card-header">
          <i class="bi bi-globe2 me-1"></i>${t("calculator.platform", "Platform")}
        </div>
        <div class="card-body">
          <div class="btn-group w-100" role="group">
            <input type="radio" class="btn-check" name="platform" id="pAirbnb"
              .checked=${this._platform === "airbnb"}
              @change=${() => (this._platform = "airbnb")}>
            <label class="btn btn-outline-danger" for="pAirbnb">Airbnb</label>
            <input type="radio" class="btn-check" name="platform" id="pBooking"
              .checked=${this._platform === "booking"}
              @change=${() => (this._platform = "booking")}>
            <label class="btn btn-outline-primary" for="pBooking">Booking.com</label>
          </div>
        </div>
      </div>

      <!-- Booking Parameters -->
      <div class="card mb-3">
        <div class="card-header">
          <i class="bi bi-sliders me-1"></i>${t("calculator.bookingParams", "Booking Parameters")}
        </div>
        <div class="card-body">
          <div class="row g-2">
            <div class="col-12 mb-3">
              <div class="form-text mt-0 mb-1">
                <i class="bi bi-calendar-event me-1"></i>${t("calculator.arrival", "Arrival (optional, splits the Env. Fee by season)")}
              </div>
              <div class="d-flex gap-2 align-items-center">
                <date-picker-input
                  id="calcArrival"
                  class="flex-grow-1"
                  .value=${this._arrival}
                  @change=${(event) => (this._arrival = event.target.value)}
                ></date-picker-input>
                ${this._arrival ? html`
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    aria-label=${t("calculator.clearArrival", "Clear arrival")}
                    @click=${() => (this._arrival = "")}
                  >
                    <i class="bi bi-x-lg"></i>
                  </button>
                ` : ""}
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-floating mb-3">
                <input type="number" class="form-control" id="calcNights" min="1" step="1"
                  .value=${String(this._nights)}
                  @input=${(e) => this.#onNightsChange(e.target.value)}
                  @blur=${(e) => (e.target.value = String(this._nights))}>
                <label for="calcNights">
                  <i class="bi bi-moon me-1"></i>${t("calculator.nights", "Nights")}
                </label>
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-floating mb-3">
                <select
                  class="form-select"
                  id="calcPropertyType"
                  @change=${(event) => this.#applyPropertyType(event.target.value)}
                >
                  <option
                    value="apartment"
                    ?selected=${this._propertyType === "apartment"}
                  >
                    ${t("calculator.propertyApartment", "Apartment / Room")}
                  </option>
                  <option
                    value="house"
                    ?selected=${this._propertyType === "house"}
                  >
                    ${t("calculator.propertyHouse", "Detached house >80m²")}
                  </option>
                </select>
                <label for="calcPropertyType">
                  <i class="bi bi-house me-1"></i>${t("calculator.propertyType", "Property Type")}
                </label>
              </div>
            </div>
            ${this._arrival ? html`
              <div class="col-6">
                <div class="form-floating mb-3">
                  <input
                    type="number"
                    class="form-control"
                    id="calcEnvFeeHigh"
                    min="0"
                    step="0.5"
                    .value=${String(this._envFeeHigh)}
                    @input=${(event) => (this._envFeeHigh = parseFloat(event.target.value) || 0)}
                  >
                  <label for="calcEnvFeeHigh">
                    <i class="bi bi-sun me-1"></i>${t("calculator.envFeeHigh", "Env. Fee Apr–Oct")}
                  </label>
                </div>
              </div>
              <div class="col-6">
                <div class="form-floating mb-3">
                  <input
                    type="number"
                    class="form-control"
                    id="calcEnvFeeLow"
                    min="0"
                    step="0.5"
                    .value=${String(this._envFeeLow)}
                    @input=${(event) => (this._envFeeLow = parseFloat(event.target.value) || 0)}
                  >
                  <label for="calcEnvFeeLow">
                    <i class="bi bi-snow me-1"></i>${t("calculator.envFeeLow", "Env. Fee Nov–Mar")}
                  </label>
                </div>
              </div>
            ` : html`
              <div class="col-md-6">
                <div class="form-floating mb-3">
                  <input type="number" class="form-control" id="calcEnvFee" min="0" step="0.5"
                    .value=${String(this._envFeePerNight)}
                    @input=${(e) => (this._envFeePerNight = parseFloat(e.target.value) || 0)}>
                  <label for="calcEnvFee">
                    <i class="bi bi-tree me-1"></i>${t("calculator.envFeePerNight", "Env. Fee per Night")}
                  </label>
                </div>
              </div>
            `}
            ${c.envFee.longStay ? html`
              <div class="col-12">
                <div class="alert alert-warning small py-2 mb-3">
                  <i class="bi bi-exclamation-triangle me-1"></i>${t("calculator.longStayNote", "60+ nights: long-term rental, no Env. Fee and no Short-Term Rental Registry.")}
                </div>
              </div>
            ` : ""}
            ${c.envFee.high > 0 && c.envFee.low > 0 ? html`
              <div class="col-12">
                <div class="small text-muted mb-3">
                  <i class="bi bi-info-circle me-1"></i>${t("calculator.seasonSplitNote", "The stay crosses seasons: the Env. Fee receipt is issued per month, so it goes into two monthly Env. Fee returns, each due by the end of the following month.")}
                </div>
              </div>
            ` : ""}
            <div class="col-12">
              <div class="form-check form-switch mb-3 d-flex align-items-center">
                <input class="form-check-input me-2 mt-0" type="checkbox" id="calcEnvFeeAsExtra"
                  .checked=${this.#isAsExtraEffective()}
                  ?disabled=${this._platform === "airbnb"}
                  @change=${(e) => (this._envFeeAsExtra = e.target.checked)}>
                <label class="form-check-label" for="calcEnvFeeAsExtra">
                  ${t("calculator.envFeeAsExtra", "Env. Fee as extra charge")}
                </label>
                <i class="bi bi-info-circle text-muted ms-2" style="cursor: help"
                  data-tooltip-text=${t("calculator.envFeePerNightTooltip", "• Apartment <80m² — High season (Apr-Oct): 8 €\n• Apartment <80m² — Low season (Nov-Mar): 2 €\n• House / ≥80m² / with pool — High season: 15 €\n• House / ≥80m² / with pool — Low season: 4 €")}></i>
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-floating mb-3">
                <input type="number" class="form-control" id="calcPrice" min="0" step="0.5"
                  .value=${String(this._pricePerNight)}
                  @input=${(e) => (this._pricePerNight = parseFloat(e.target.value) || 0)}>
                <label for="calcPrice">
                  <i class="bi bi-currency-euro me-1"></i>${t("calculator.pricePerNight", "Price per Night")}
                </label>
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-floating mb-3">
                <input type="number" class="form-control" id="calcExtras" min="0" step="0.5"
                  .value=${String(this._extras)}
                  @input=${(e) => (this._extras = parseFloat(e.target.value) || 0)}>
                <label for="calcExtras">
                  <i class="bi bi-plus-square me-1"></i>${t("calculator.extras", "Extras / Cleaning / Pet")}
                </label>
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-floating mb-3">
                <input type="number" class="form-control" id="calcDiscounts" min="0" step="0.5"
                  .value=${String(this._discounts)}
                  @input=${(e) => (this._discounts = parseFloat(e.target.value) || 0)}>
                <label for="calcDiscounts">
                  <i class="bi bi-tag me-1"></i>${t("calculator.discounts", "Discounts")}
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Platform Parameters (collapsible) -->
      <div class="card mb-3">
        <div class="card-header d-flex justify-content-between align-items-center"
          style="cursor:pointer"
          @click=${() => (this._showAdvanced = !this._showAdvanced)}>
          <span>
            <i class="bi bi-gear me-1"></i>${t("calculator.platformParams", "Platform Parameters")}
          </span>
          <i class="bi bi-chevron-${this._showAdvanced ? "up" : "down"}"></i>
        </div>
        ${this._showAdvanced ? html`
          <div class="card-body">
            ${!isBooking ? html`
              <div class="form-floating mb-3">
                <input type="number" class="form-control" id="calcAirbnbFee"
                  min="0" max="1" step="0.0001"
                  .value=${String(this._airbnbFee)}
                  @input=${(e) => (this._airbnbFee = parseFloat(e.target.value) || 0)}>
                <label for="calcAirbnbFee">
                  ${t("calculator.airbnbFee", "Airbnb Commission (host-only + VAT)")}
                </label>
              </div>
            ` : html`
              <div class="form-floating mb-3">
                <input type="number" class="form-control" id="calcBookingFee"
                  min="0" max="1" step="0.0001"
                  .value=${String(this._bookingFee)}
                  @input=${(e) => (this._bookingFee = parseFloat(e.target.value) || 0)}>
                <label for="calcBookingFee">
                  ${t("calculator.bookingFee", "Booking Commission (0.15 before 1/12/26, 0.186 after)")}
                </label>
              </div>
              <div class="mb-3">
                <div class="form-floating">
                  <input type="number" class="form-control" id="calcBankFee"
                    min="0" max="1" step="0.001"
                    aria-describedby="calcBankFeeHint"
                    .value=${String(this._bookingBankFee)}
                    @input=${(e) => (this._bookingBankFee = parseFloat(e.target.value) || 0)}>
                  <label for="calcBankFee">
                    ${t("calculator.bankFee", "Booking Bank Fees")}
                  </label>
                </div>
                <div class="form-text" id="calcBankFeeHint">
                  ${t("calculator.bankFeeHint", "Varies per account; 1.6% is an estimate. Check your Booking payouts.")}
                </div>
              </div>
            `}
            ${isPro ? html`
              <div class="form-floating mb-3">
                <input
                  type="number"
                  class="form-control"
                  id="calcProMunicipal"
                  min="0"
                  max="0.02"
                  step="0.0025"
                  .value=${String(this._proMunicipal)}
                  @input=${(event) => (this._proMunicipal = parseFloat(event.target.value) || 0)}
                >
                <label for="calcProMunicipal">
                  ${t("calculator.proMunicipalRate", "Municipal Tax Rate (0.005 or 0.0075)")}
                </label>
              </div>
            ` : ""}
          </div>
        ` : ""}
      </div>

      <!-- Results -->
      <div class="card">
        <div class="card-header bg-success text-white d-flex justify-content-between align-items-center">
          <span><i class="bi bi-calculator me-1"></i>${t("calculator.results", "Calculation")}</span>
          <div class="form-check form-switch m-0">
            <input class="form-check-input" type="checkbox" id="calcExplainToggle"
              .checked=${this._explainMode}
              @change=${(e) => (this._explainMode = e.target.checked)}>
            <label class="form-check-label small" for="calcExplainToggle">
              ${t("calculator.explain", "Explain")}
            </label>
          </div>
        </div>
        <div class="card-body">
          <div class="row g-2">
            ${this.#renderRow({
              label: t("calculator.guestPays", "Guest pays"),
              value: c.guestPays,
              fmt,
              bold: true,
              wordFormula: this.#isInsideEffective()
                ? t("calculator.formula.guestPaysInside", "Listing amount")
                : t("calculator.formula.guestPays", "Listing + Environmental Fee"),
              numberFormula: this.#isInsideEffective()
                ? `${fmt(c.listingAmount)} = ${fmt(c.guestPays)}`
                : `${fmt(c.listingAmount)} + ${fmt(c.envFeeTotal)} = ${fmt(c.guestPays)}`,
            })}

            <div class="col-12"><hr class="my-2"></div>

            ${this.#renderRow({
              label: t("calculator.commission", "Platform Commission"),
              value: c.commission,
              fmt,
              prefix: "− ",
              wordFormula: t("calculator.formula.commission", "(Price × Nights + Extras − Discounts) × Commission rate"),
              numberFormula: `${fmt(c.listingAmount)} × ${isBooking ? this._bookingFee : this._airbnbFee} = ${fmt(c.commission)}`,
            })}

            ${isBooking ? this.#renderRow({
              label: t("calculator.bankFees", "Bank Fees"),
              value: c.bankFee,
              fmt,
              prefix: "− ",
              wordFormula: this.#isInsideEffective()
                ? t("calculator.formula.bankFeeInside", "Listing × Bank fee rate")
                : t("calculator.formula.bankFee", "(Listing + Environmental Fee) × Bank fee rate"),
              numberFormula: this.#isInsideEffective()
                ? `${fmt(c.listingAmount)} × ${this._bookingBankFee} = ${fmt(c.bankFee)}`
                : `(${fmt(c.listingAmount)} + ${fmt(c.envFeeTotal)}) × ${this._bookingBankFee} = ${fmt(c.bankFee)}`,
            }) : ""}

            ${this.#renderRow({
              label: t("calculator.payout", "You get paid"),
              value: c.payout,
              fmt,
              bold: true,
              wordFormula: isBooking
                ? t("calculator.formula.payoutBooking", "Guest pays − Commission − Bank fees")
                : t("calculator.formula.payoutAirbnb", "Guest pays − Commission"),
              numberFormula: isBooking
                ? `${fmt(c.guestPays)} − ${fmt(c.commission)} − ${fmt(c.bankFee)} = ${fmt(c.payout)}`
                : `${fmt(c.guestPays)} − ${fmt(c.commission)} = ${fmt(c.payout)}`,
            })}

            <div class="col-12"><hr class="my-2"></div>

            ${this.#renderRow({
              label: t("calculator.declaration", "AADE Declaration"),
              value: c.declaration,
              fmt,
              wordFormula: declarationWordFormula,
              numberFormula: isPro
                ? `(${rentFormula}) / (1,13 × ${formatFactor(1 + municipalRate)}) = ${fmt(c.declaration)}`
                : `${rentFormula} = ${fmt(c.declaration)}`,
            })}

            ${isPro ? html`
              ${this.#renderRow({
                label: `${t("calculator.proMunicipal", "Municipal")} ${formatRatePercent(municipalRate)}`,
                value: c.proMunicipal,
                fmt,
                prefix: "− ",
                wordFormula: t("calculator.formula.proMunicipal", "Declaration × Municipal rate"),
                numberFormula: `${fmt(c.declaration)} × ${formatFactor(municipalRate)} = ${fmt(c.proMunicipal)}`,
              })}
              ${this.#renderRow({
                label: t("calculator.proVat", "VAT 13%"),
                value: c.proVat,
                fmt,
                prefix: "− ",
                wordFormula: t("calculator.formula.proVat", "(Declaration + Municipal) × 0.13"),
                numberFormula: `(${fmt(c.declaration)} + ${fmt(c.proMunicipal)}) × 0,13 = ${fmt(c.proVat)}`,
              })}
            ` : ""}

            ${this.#renderRow({
              label: t("calculator.envFeeTotal", "Environmental Fee"),
              value: c.envFeeTotal,
              fmt,
              prefix: "− ",
              wordFormula: envFeeWordFormula,
              numberFormula: envFeeNumberFormula,
            })}

            <div class="col-12"><hr class="my-2"></div>

            <div class="col-7 fw-bold d-flex align-items-center">
              ${t("calculator.netInPocket", "Net in pocket")}
            </div>
            <div class="col-5">
              <input type="text" inputmode="decimal"
                class="form-control form-control-sm text-end fw-bold text-success"
                .value=${+c.netFinal.toFixed(2)}
                @input=${(e) => { const v = e.target.value.replace(",", "."); if (v !== e.target.value) e.target.value = v; }}
                @change=${(e) => this.#onNetTargetChange(e.target.value)}
                @keydown=${(e) => { if (e.key === "Enter") e.target.blur(); }}>
            </div>
            ${this._explainMode ? html`
              <div class="col-12 small text-muted ps-3 pb-2 font-monospace" style="font-size:0.75rem">
                <div>${isPro
                  ? t("calculator.formula.netFinalPro", "You get paid − VAT − Municipal − Environmental Fee")
                  : t("calculator.formula.netFinal", "You get paid − Environmental Fee")}</div>
                <div>${isPro
                  ? `${fmt(c.payout)} − ${fmt(c.proVat)} − ${fmt(c.proMunicipal)} − ${fmt(c.envFeeTotal)} = ${fmt(c.netFinal)}`
                  : `${fmt(c.payout)} − ${fmt(c.envFeeTotal)} = ${fmt(c.netFinal)}`}</div>
              </div>
            ` : ""}

            <div class="col-12"><hr class="my-2"></div>

            <div class="col-7 small text-muted d-flex align-items-center">
              ${t("calculator.effFee", "Platform cost")}
              <i class="bi bi-info-circle ms-1" style="cursor: help"
                data-tooltip-text=${t("calculator.formula.effFee", "(Commission + Bank fees) / Listing amount")}></i>
            </div>
            <div class="col-5 text-end small text-muted">${fmtPct(c.effectiveFee)}</div>
          </div>
        </div>
      </div>
    `;
  }

  #renderRow({ label, value, fmt, bold, muted, indent, prefix = "", valueClass = "", wordFormula, numberFormula }) {
    const labelClasses = [
      "col-7",
      "d-flex",
      "align-items-center",
      bold ? "fw-semibold" : "",
      muted ? "small text-muted" : "",
      indent ? "ps-3" : "",
    ].filter(Boolean).join(" ");
    const valueClasses = [
      "col-5",
      "text-end",
      bold ? "fw-bold" : "",
      muted ? "small text-muted" : "",
      valueClass,
    ].filter(Boolean).join(" ");
    return html`
      <div class=${labelClasses}>${label}</div>
      <div class=${valueClasses}>${prefix}${fmt(value)}</div>
      ${this._explainMode && wordFormula ? html`
        <div class="col-12 small text-muted ps-3 pb-2 font-monospace" style="font-size:0.75rem">
          <div>${wordFormula}</div>
          ${numberFormula ? html`<div>${numberFormula}</div>` : ""}
        </div>
      ` : ""}
    `;
  }
}

customElements.define("calculator-tab", CalculatorTab);
