/* =========================================================
   BharatYatra — BOOKING.JS
   Bus generation (mock data), seat map, passenger form, the
   review/receipt summary, payment (UPI/Razorpay), and the
   post-payment e-ticket — all for booking.html.
   ========================================================= */

// ---- Mock bus data ----
const OPERATORS = [
  "Shatabdi Travels", "VRL Logistics", "Orange Tours", "SRS Travels",
  "Neeta Volvo", "Patel Roadways", "Kaveri Yatra", "Himalayan Express",
  "Royal Bengal Coach", "GreenLine Express", "Maharaja Roadways", "Panther Travels",
  "Sahara Lines", "Crown Comfort", "Amber Routes", "Metro Glide",
  "Galaxy Trails", "Crystal Carriages", "Express Pearl", "Imperial Transit"
];

const BUS_TYPES = ["AC Sleeper", "Non-AC Seater", "AC Seater/Sleeper", "Volvo Multi-Axle"];

function journeyPoints(city, type) {
  const prefix = city || "Central";
  return type === "boarding"
    ? [`${prefix} Main Bus Stand`, `${prefix} Railway Station`, `${prefix} City Centre`]
    : [`${prefix} Main Bus Stand`, `${prefix} Airport Road`, `${prefix} City Centre`];
}

// deterministic-ish pseudo random generator so the same route always
// shows the same results in a demo (nice for a viva/demo walkthrough)
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) || 1;
}

// Demo baseline: generated deterministically from the bus ID, so every
// visitor sees the same realistically occupied seats for that bus. Actual
// customer reservations are added separately from Supabase below.
function initialUnavailableSeats(bus) {
  const totalSeats = 36;
  const random = seededRandom(hashString(`${bus.id}-initial-seat-inventory`));
  const seats = Array.from({ length: totalSeats }, (_, index) => index + 1);
  for (let i = seats.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [seats[i], seats[j]] = [seats[j], seats[i]];
  }
  const bookedCount = Math.max(0, totalSeats - (bus.seatsLeft || totalSeats));
  return seats.slice(0, bookedCount);
}

const PROMO_CODES = {
  BYSAVE50: { label: "₹50 off", type: "flat", amount: 50 },
  BYSAVE10: { label: "10% off", type: "percent", amount: 10 },
  BYFEST20: { label: "20% off", type: "percent", amount: 20 }
};

function loadLocalPromoCodes() {
  if (typeof byGetLocalPromos !== "function") return;
  const localPromos = byGetLocalPromos();
  localPromos.forEach((promo) => {
    if (!promo || !promo.code) return;
    PROMO_CODES[promo.code] = {
      label: promo.label || `${promo.discount || promo.amount}% off`,
      type: promo.type || "percent",
      amount: Number(promo.amount != null ? promo.amount : promo.discount || 0)
    };
  });
}

loadLocalPromoCodes();

// Build a list of mock buses for a given from/to/date
function generateBuses(from, to, date) {
  const rand = seededRandom(hashString(`${from}-${to}-${date}`));
  const count = 5 + Math.floor(rand() * 4); // 5-8 buses
  const buses = [];
  for (let i = 0; i < count; i++) {
    const operator = OPERATORS[Math.floor(rand() * OPERATORS.length)];
    const type = BUS_TYPES[Math.floor(rand() * BUS_TYPES.length)];
    const depHour = Math.floor(rand() * 24);
    const depMin = rand() > 0.5 ? 30 : 0;
    const duration = 4 + Math.floor(rand() * 10); // 4-13 hrs
    const arrHour = (depHour + duration) % 24;
    const fare = 450 + Math.floor(rand() * 1400);
    const seatsLeft = 2 + Math.floor(rand() * 30);
    const rating = (3 + rand() * 2).toFixed(1);
    buses.push({
      id: `${from}-${to}-${date}-${i}`.replace(/\s+/g, ""),
      operator, type,
      dep: `${String(depHour).padStart(2, "0")}:${String(depMin).padStart(2, "0")}`,
      arr: `${String(arrHour).padStart(2, "0")}:${depMin ? "30" : "00"}`,
      duration: `${duration}h`,
      fare, seatsLeft, rating,
      from, to, date
    });
  }
  return buses.sort((a, b) => a.dep.localeCompare(b.dep));
}

// A different photo per operator, using your own uploaded photos.
// HOW TO USE:
// 1. Create a folder called "buses" inside your "assets" folder
//    (so the path is: assets/buses/)
// 2. Put your photo files in there, e.g. assets/buses/shatabdi-ext.jpg
// 3. Add one line below per operator, matching the operator name
//    EXACTLY as spelled in the OPERATORS list near the top of this file.
// Any operator not listed here just falls back to the default photo
// below, so nothing breaks while you're still adding photos.
const BUS_PHOTOS = {
  "Shatabdi Travels":   { exterior: "assets/buses/payal-ext.jpg",         interior: "assets/buses/shatabdi-int.jpg" },
  "VRL Logistics":       { exterior: "assets/buses/nuego-ext.jpg",         interior: "assets/buses/interior-brown-cream.jpg" },
  "Orange Tours":        { exterior: "assets/buses/glider-ext.jpg",        interior: "assets/buses/interior-cream-red.jpg" },
  "SRS Travels":         { exterior: "assets/buses/vennela-ext.jpg",       interior: "assets/buses/interior-pink-curtain.jpg" },
  "Neeta Volvo":         { exterior: "assets/buses/volvo-render-ext.jpg",  interior: "assets/buses/interior-sleeper-blue.jpg" },
  "Patel Roadways":      { exterior: "assets/buses/payal-ext.jpg",         interior: "assets/buses/interior-brown-cream.jpg" },
  "Kaveri Yatra":        { exterior: "assets/buses/nuego-ext.jpg",         interior: "assets/buses/interior-cream-red.jpg" },
  "Himalayan Express":   { exterior: "assets/buses/glider-ext.jpg",        interior: "assets/buses/interior-pink-curtain.jpg" },
  "Royal Bengal Coach":  { exterior: "assets/buses/vennela-ext.jpg",       interior: "assets/buses/interior-sleeper-blue.jpg" },
  "GreenLine Express":   { exterior: "assets/buses/volvo-render-ext.jpg",  interior: "assets/buses/shatabdi-int.jpg" },
  "Maharaja Roadways":   { exterior: "assets/buses/payal-ext.jpg",         interior: "assets/buses/interior-cream-red.jpg" },
  "Panther Travels":     { exterior: "assets/buses/nuego-ext.jpg",         interior: "assets/buses/interior-pink-curtain.jpg" },
  "Sahara Lines":        { exterior: "assets/buses/glider-ext.jpg",        interior: "assets/buses/interior-sleeper-blue.jpg" },
  "Crown Comfort":       { exterior: "assets/buses/vennela-ext.jpg",       interior: "assets/buses/interior-brown-cream.jpg" },
  "Amber Routes":        { exterior: "assets/buses/volvo-render-ext.jpg",  interior: "assets/buses/interior-cream-red.jpg" },
  "Metro Glide":         { exterior: "assets/buses/payal-ext.jpg",         interior: "assets/buses/interior-pink-curtain.jpg" },
  "Galaxy Trails":       { exterior: "assets/buses/nuego-ext.jpg",         interior: "assets/buses/interior-sleeper-blue.jpg" },
  "Crystal Carriages":   { exterior: "assets/buses/glider-ext.jpg",        interior: "assets/buses/shatabdi-int.jpg" },
  "Express Pearl":       { exterior: "assets/buses/vennela-ext.jpg",       interior: "assets/buses/interior-cream-red.jpg" },
  "Imperial Transit":    { exterior: "assets/buses/volvo-render-ext.jpg",  interior: "assets/buses/interior-brown-cream.jpg" }
};

// Used automatically if a specific operator's photo file above is missing
// (e.g. you haven't uploaded it yet) so the page never shows a broken image.
const DEFAULT_BUS_PHOTOS = {
  exterior: "assets/home-exterior.jpg",
  interior: "assets/home-interior.jpg"
};

function busImagesFor(bus) {
  return BUS_PHOTOS[bus.operator] || DEFAULT_BUS_PHOTOS;
}

// Amenities shown on the bus detail gallery, based on bus type
function featuresForBus(bus) {
  const common = ["📶 WiFi onboard", "🔌 Charging point", "📍 Live tracking", "🎥 CCTV onboard", "💧 Water bottle"];
  const acExtra = ["❄️ Air conditioned", "🛏️ Blanket & pillow", "💡 Reading light"];
  const nonAcExtra = ["🌬️ Fan cooling", "💡 Reading light"];
  return bus.type.includes("AC") ? [...acExtra, ...common] : [...nonAcExtra, ...common];
}

/* =========================================================
   BOOKING PAGE LOGIC
   ========================================================= */
function initBookingPage() {
  const resultsEl = document.getElementById("busResults");
  if (!resultsEl) return; // not on booking page

  const customQrUpload = document.getElementById("customQrUpload");
  if (customQrUpload) customQrUpload.addEventListener("change", () => {
    const file = customQrUpload.files && customQrUpload.files[0];
    const preview = document.getElementById("customQrPreview");
    if (!file || !preview) return;
    preview.src = URL.createObjectURL(file);
    preview.classList.remove("hidden");
  });

  const params = new URLSearchParams(window.location.search);
  const from = params.get("from") || "Delhi";
  const to = params.get("to") || "Jaipur";
  const date = params.get("date") || new Date().toISOString().split("T")[0];

  document.getElementById("routeLabel").textContent = `${from} → ${to}`;
  document.getElementById("dateLabel").textContent = new Date(date + "T00:00:00")
    .toDateString();

  // Wire booking page date input so users can change the travel date here
  const dateInput = document.getElementById("travelDateBooking");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.min = today;
    dateInput.value = date;
    dateInput.addEventListener("change", () => {
      const newDate = dateInput.value || today;
      // update header label and regenerate bus results for new date
      document.getElementById("dateLabel").textContent = new Date(newDate + "T00:00:00").toDateString();
      buses = generateBuses(from, to, newDate);
      renderSortedBuses();
      // update URL query param without reloading
      try {
        const params2 = new URLSearchParams(window.location.search);
        params2.set('date', newDate);
        const newUrl = window.location.pathname + '?' + params2.toString();
        window.history.replaceState({}, '', newUrl);
      } catch (e) { /* ignore */ }
    });
  }

  let buses = generateBuses(from, to, date);
  const sortSelect = document.getElementById("sortBuses");
  const busTypeFilter = document.getElementById("busTypeFilter");
  const departureFilter = document.getElementById("departureFilter");

  function render(list) {
    resultsEl.innerHTML = "";
    if (list.length === 0) {
      resultsEl.innerHTML = `<p class="alert">No buses found for this route on this date. Try another date.</p>`;
      return;
    }
    list.forEach((bus) => {
      const card = document.createElement("div");
      card.className = "bus-card";
      card.innerHTML = `
        <div>
          <div class="operator-tag">${bus.type}</div>
          <h3>${bus.operator}</h3>
          <div class="tags">
            <span class="pill">★ ${bus.rating}</span>
            <span class="pill">${bus.type.includes("AC") ? "Charging point" : "Fan cooled"}</span>
            <span class="pill">Live tracking</span>
          </div>
        </div>
        <div class="times">
          <span>${bus.dep}</span>
          <span class="dur">${bus.duration}<br>&#8594;</span>
          <span>${bus.arr}</span>
        </div>
        <div class="fare">
          <div class="amount">₹${bus.fare}</div>
          <div class="seats-left">${bus.seatsLeft} seats left</div>
          <button class="btn mt-30 select-bus-btn" data-bus-id="${bus.id}">Select seats</button>
        </div>
      `;
      resultsEl.appendChild(card);
    });

    // wire the newly created buttons
    resultsEl.querySelectorAll(".select-bus-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const bus = list.find((b) => b.id === btn.dataset.busId);
        openSeatMap(bus);
      });
    });
  }

  const searchInput = document.getElementById("searchBuses");
  let searchTerm = "";

  function getFilteredBuses() {
    const query = searchTerm.toLowerCase();
    return buses.filter((bus) => {
      const matchesSearch = !query || [bus.operator, bus.type, bus.dep, bus.arr, bus.from, bus.to]
        .some((field) => (field || "").toLowerCase().includes(query));
      const matchesType = !busTypeFilter || busTypeFilter.value === "all" || bus.type.includes(busTypeFilter.value);
      const hour = Number(bus.dep.split(":")[0]);
      const matchesTime = !departureFilter || departureFilter.value === "all"
        || (departureFilter.value === "morning" && hour >= 6 && hour < 12)
        || (departureFilter.value === "afternoon" && hour >= 12 && hour < 18)
        || (departureFilter.value === "night" && (hour < 6 || hour >= 18));
      return matchesSearch && matchesType && matchesTime;
    });
  }

  function renderSortedBuses() {
    const val = sortSelect ? sortSelect.value : "departure";
    const sorted = [...getFilteredBuses()];
    if (val === "price") sorted.sort((a, b) => a.fare - b.fare);
    else if (val === "duration") sorted.sort((a, b) => parseInt(a.duration) - parseInt(b.duration));
    else if (val === "departure") sorted.sort((a, b) => a.dep.localeCompare(b.dep));
    else if (val === "rating") sorted.sort((a, b) => b.rating - a.rating);
    render(sorted);
  }

  render(getFilteredBuses());

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchTerm = searchInput.value.trim();
      renderSortedBuses();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      renderSortedBuses();
    });
  }
  [busTypeFilter, departureFilter].filter(Boolean).forEach((filter) => filter.addEventListener("change", renderSortedBuses));

  // ---- Seat map + passenger form + payment ----
  const seatSection = document.getElementById("seatSection");
  const seatGrid = document.getElementById("seatGrid");
  const summaryPanel = document.getElementById("summaryPanel");
  const passengerForm = document.getElementById("passengerForm");
  const summarySection = document.getElementById("summarySection");
  const paymentSection = document.getElementById("paymentSection");
  let selectedSeats = [];
  let currentBus = null;
  let appliedPromo = null;

  function calculateTotals() {
    const seatsTotal = selectedSeats.length * currentBus.fare;
    let discount = 0;
    if (appliedPromo) {
      if (appliedPromo.type === "flat") {
        discount = appliedPromo.amount;
      } else if (appliedPromo.type === "percent") {
        discount = Math.round(seatsTotal * appliedPromo.amount / 100);
      }
    }
    if (discount > seatsTotal) discount = seatsTotal;
    return { seatsTotal, discount, finalTotal: seatsTotal - discount };
  }

  function updatePromoMessage(message, isError = false) {
    const promoMessage = document.getElementById("promoMessage");
    if (!promoMessage) return;
    promoMessage.textContent = message;
    promoMessage.style.color = isError ? "var(--rust)" : "var(--teal)";
  }

  function openSeatMap(bus) {
    currentBus = bus;
    selectedSeats = [];
    const boardingSelect = document.getElementById("boardingPoint");
    const droppingSelect = document.getElementById("droppingPoint");
    if (boardingSelect) boardingSelect.innerHTML = journeyPoints(bus.from, "boarding").map((point) => `<option value="${point}">${point}</option>`).join("");
    if (droppingSelect) droppingSelect.innerHTML = journeyPoints(bus.to, "dropping").map((point) => `<option value="${point}">${point}</option>`).join("");
    seatSection.classList.remove("hidden");
    passengerForm.classList.add("hidden");
    summarySection.classList.add("hidden");
    paymentSection.classList.add("hidden");

    document.getElementById("galleryTitle").textContent = `${bus.operator} — ${bus.type}`;
    const featureList = document.getElementById("featureList");
    featureList.innerHTML = "";
    featuresForBus(bus).forEach((f) => {
      const span = document.createElement("span");
      span.className = "pill";
      span.textContent = f;
      featureList.appendChild(span);
    });

    // Swap the gallery photos to this specific bus's operator photos
    const images = busImagesFor(bus);
    const exteriorImg = document.getElementById("busExteriorImg");
    const interiorImg = document.getElementById("busInteriorImg");
    if (exteriorImg) {
      exteriorImg.src = images.exterior;
      exteriorImg.alt = `${bus.operator} — exterior view`;
    }
    if (interiorImg) {
      interiorImg.src = images.interior;
      interiorImg.alt = `${bus.operator} — interior / cabin view`;
    }

    seatSection.scrollIntoView({ behavior: "smooth", block: "start" });

    const renderSeatMap = (takenSeats) => {
      const bookedSeats = new Set([...initialUnavailableSeats(bus), ...takenSeats.map(Number)]);
      seatGrid.innerHTML = "";
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 5; col++) {
          if (col === 2) {
            const gap = document.createElement("div");
            gap.className = "seat aisle";
            seatGrid.appendChild(gap);
            continue;
          }
          const seatNum = row * 4 + (col < 2 ? col : col - 1) + 1;
          const seatEl = document.createElement("button");
          seatEl.type = "button";
          seatEl.className = "seat" + (bookedSeats.has(seatNum) ? " booked" : "");
          seatEl.textContent = seatNum;
          seatEl.dataset.seat = seatNum;
          if (!bookedSeats.has(seatNum)) seatEl.addEventListener("click", () => toggleSeat(seatEl, seatNum));
          seatGrid.appendChild(seatEl);
        }
      }
      updateSummary();
    };

    if (typeof byGetBookedSeats === "function") {
      byGetBookedSeats(bus.id).then(renderSeatMap).catch(() => renderSeatMap([]));
    } else {
      renderSeatMap([]);
    }
  }

  function toggleSeat(seatEl, seatNum) {
    if (selectedSeats.includes(seatNum)) {
      selectedSeats = selectedSeats.filter((s) => s !== seatNum);
      seatEl.classList.remove("selected");
    } else {
      if (selectedSeats.length >= 6) {
        alert("You can book a maximum of 6 seats at a time.");
        return;
      }
      selectedSeats.push(seatNum);
      seatEl.classList.add("selected");
    }
    updateSummary();
  }

  function updateSummary() {
    if (!currentBus) return;
    const totals = calculateTotals();
    summaryPanel.innerHTML = `
      <h3>Fare summary</h3>
      <div class="row"><span>Operator</span><span>${currentBus.operator}</span></div>
      <div class="row"><span>Route</span><span>${currentBus.from} → ${currentBus.to}</span></div>
      <div class="row"><span>Seats</span><span>${selectedSeats.length ? selectedSeats.join(", ") : "—"}</span></div>
      <div class="row"><span>Fare / seat</span><span>₹${currentBus.fare}</span></div>
      <div class="row total"><span>Total</span><span>₹${totals.seatsTotal}</span></div>
      ${appliedPromo ? `<div class="row"><span>Promo (${appliedPromo.code})</span><span>-₹${totals.discount}</span></div>
      <div class="row total"><span>Payable</span><span>₹${totals.finalTotal}</span></div>` : ""}
    `;
    document.getElementById("proceedBtn").disabled = selectedSeats.length === 0;
  }

  const applyPromoBtn = document.getElementById("applyPromoBtn");
  if (applyPromoBtn) {
    applyPromoBtn.addEventListener("click", () => {
      const codeInput = document.getElementById("promoCode");
      if (!codeInput) return;
      const code = codeInput.value.trim().toUpperCase();
      if (!code) {
        appliedPromo = null;
        updatePromoMessage("Promo code cleared.");
        updateSummary();
        return;
      }
      const promo = PROMO_CODES[code];
      if (!promo) {
        appliedPromo = null;
        updatePromoMessage("Invalid promo code. Please try another code.", true);
        updateSummary();
        return;
      }
      appliedPromo = { ...promo, code };
      updatePromoMessage(`Promo applied: ${promo.label}`);
      updateSummary();
    });
  }

  document.getElementById("proceedBtn").addEventListener("click", () => {
    if (selectedSeats.length === 0) {
      alert("Please select at least one available seat first.");
      return;
    }
    passengerForm.classList.remove("hidden");
    passengerForm.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  let passengerInfo = null;

  const bookingFormEl = document.getElementById("bookingForm");
  if (bookingFormEl) {
    bookingFormEl.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("passengerName").value.trim();
      const phone = document.getElementById("passengerPhone").value.trim();
      const age = document.getElementById("passengerAge").value.trim();
      const gender = document.getElementById("passengerGender").value;
      const boardingPoint = document.getElementById("boardingPoint").value;
      const droppingPoint = document.getElementById("droppingPoint").value;
      if (!name || !phone) {
        alert("Please enter passenger name and phone number.");
        return;
      }
      passengerInfo = { name, phone, age, gender, boardingPoint, droppingPoint };

      const totals = calculateTotals();

      // Fill in the receipt with everything booked so far
      const sumName = document.getElementById("sumName");
      const sumPhone = document.getElementById("sumPhone");
      const sumAge = document.getElementById("sumAge");
      const sumGender = document.getElementById("sumGender");
      const sumRoute = document.getElementById("sumRoute");
      const sumDate = document.getElementById("sumDate");
      const sumBus = document.getElementById("sumBus");
      const sumRating = document.getElementById("sumRating");
      const sumDep = document.getElementById("sumDep");
      const sumArr = document.getElementById("sumArr");
      const sumSeats = document.getElementById("sumSeats");
      const sumFare = document.getElementById("sumFare");
      const sumTotal = document.getElementById("sumTotal");
      if (sumName) sumName.textContent = passengerInfo.name;
      if (sumPhone) sumPhone.textContent = passengerInfo.phone;
      if (sumAge) sumAge.textContent = age || "—";
      if (sumGender) sumGender.textContent = gender;
      if (sumRoute) sumRoute.textContent = `${currentBus.from} → ${currentBus.to}`;
      if (sumDate) sumDate.textContent = new Date(currentBus.date + "T00:00:00").toDateString();
      if (sumBus) sumBus.textContent = `${currentBus.operator} (${currentBus.type})`;
      if (sumRating) sumRating.textContent = `★ ${currentBus.rating}`;
      if (sumDep) sumDep.textContent = `${currentBus.dep} · ${currentBus.duration} journey`;
      if (sumArr) sumArr.textContent = currentBus.arr;
      if (sumSeats) sumSeats.textContent = selectedSeats.join(", ");
      if (sumFare) sumFare.textContent = `₹${currentBus.fare}`;
      if (sumTotal) sumTotal.textContent = `₹${totals.finalTotal}`;

      const sumFeatures = document.getElementById("sumFeatures");
      if (sumFeatures) {
        sumFeatures.innerHTML = "";
        featuresForBus(currentBus).forEach((f) => {
          const span = document.createElement("span");
          span.className = "pill";
          span.textContent = f;
          sumFeatures.appendChild(span);
        });
      }

      passengerForm.classList.add("hidden");
      summarySection.classList.remove("hidden");
      summarySection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  document.getElementById("editDetailsBtn").addEventListener("click", () => {
    summarySection.classList.add("hidden");
    passengerForm.classList.remove("hidden");
    passengerForm.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("confirmSummaryBtn").addEventListener("click", () => {
    const totals = calculateTotals();
    document.getElementById("payAmount").textContent = `₹${totals.finalTotal}`;
    document.getElementById("payNowAmount").textContent = `₹${totals.finalTotal}`;
    updatePayNowLabel();

    summarySection.classList.add("hidden");
    paymentSection.classList.remove("hidden");
    refreshPaymentAuthGate();
    paymentSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---- Payment: real login gate (Firebase) ----
  function refreshPaymentAuthGate() {
    const gate = document.getElementById("paymentAuthGate");
    const tabsWrap = document.getElementById("paymentTabsWrap");
    const user = byCurrentUser();
    if (user) {
      gate.classList.add("hidden");
      tabsWrap.classList.remove("hidden");
      generatePaymentQr();
    } else {
      gate.classList.remove("hidden");
      tabsWrap.classList.add("hidden");
    }
  }

  document.getElementById("quickLoginBtn").addEventListener("click", () => {
    const email = document.getElementById("quickEmail").value.trim();
    const password = document.getElementById("quickPassword").value;
    if (!email || !password) {
      alert("Enter your email and password, or sign in with Google below.");
      return;
    }
    bySignInWithEmail(email, password)
      .then(() => { renderNavAuth(); refreshPaymentAuthGate(); })
      .catch((err) => alert(err.message));
  });

  const quickGoogleBtn = document.getElementById("quickGoogleBtn");
  if (quickGoogleBtn) {
    quickGoogleBtn.addEventListener("click", () => {
      bySignInWithGoogle()
        .then(() => { renderNavAuth(); refreshPaymentAuthGate(); })
        .catch((err) => alert(err.message));
    });
  }

  function updatePayNowLabel() {
    const activeBtn = document.querySelector(".pay-tab-btn.active");
    if (!activeBtn) return;
    const payNowBtn = document.getElementById("payNowBtn");
    const amountSpan = document.getElementById("payNowAmount").outerHTML;
    payNowBtn.innerHTML = activeBtn.dataset.pay === "upi"
      ? `I've paid ${amountSpan}`
      : `Continue to secure checkout · ${amountSpan}`;
  }

  // ---- Payment tabs ----
  document.querySelectorAll(".pay-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pay-tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".pay-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(
        "payPanel" + btn.dataset.pay.charAt(0).toUpperCase() + btn.dataset.pay.slice(1)
      ).classList.add("active");
      updatePayNowLabel();
    });
  });

  // ---- Generate real scan-to-pay UPI/GPay QR code from config.js ----
  function generatePaymentQr() {
    const qrBox = document.getElementById("qrcodeCanvas");
    if (!qrBox || typeof QRCode === "undefined" || !currentBus) return;
    qrBox.innerHTML = "";
    const totals = calculateTotals();
    const upiConfigured = typeof BY_CONFIG !== "undefined" && BY_CONFIG.upiId && !BY_CONFIG.upiId.startsWith("PASTE_");
    if (!upiConfigured) {
      qrBox.innerHTML = `<p style="font-size:.85rem; color:var(--rust); max-width:220px;">Add your real UPI ID in <code>config.js</code> to activate this QR code.</p>`;
      return;
    }
    const payeeName = encodeURIComponent(BY_CONFIG.payeeName || "BharatYatra");
    const upiString = `upi://pay?pa=${BY_CONFIG.upiId}&pn=${payeeName}&am=${totals.finalTotal}&cu=INR&tn=${encodeURIComponent("BusTicket-" + currentBus.from + "-" + currentBus.to)}`;
    new QRCode(qrBox, { text: upiString, width: 160, height: 160, colorDark: "#1C2A4D", colorLight: "#ffffff" });
    // Diagnostic: show the exact UPI URI and allow copying for testing
    try { console.log("UPI URI:", upiString); } catch (e) {}
    const upiInfo = document.createElement("div");
    upiInfo.style = "margin-top:8px; font-size:.85rem; max-width:220px; word-break:break-word; color:var(--text);";
    upiInfo.innerHTML = `<div style=\"margin-bottom:6px;\"><strong>Payee:</strong> ${BY_CONFIG.payeeName || "BharatYatra"} (${BY_CONFIG.upiId})</div>` +
      `<div style=\"margin-bottom:6px;\"><strong>Amount:</strong> ₹${totals.finalTotal}</div>` +
      `<div style=\"font-size:.8rem; color:var(--muted); margin-bottom:6px;\">${upiString}</div>` +
      `<button type=\"button\" id=\"copyUpiBtn\" style=\"font-size:.8rem;padding:6px 8px;\">Copy UPI URI</button>`;
    qrBox.appendChild(upiInfo);
    const copyBtn = document.getElementById("copyUpiBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(upiString).then(() => alert("UPI URI copied to clipboard"));
        } else {
          const ta = document.createElement("textarea"); ta.value = upiString; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); alert("UPI URI copied to clipboard"); } catch (e) { alert("Copy failed — see console for UPI URI"); } ta.remove();
        }
      });
    }
  }

  function showProcessing() {
    document.getElementById("payNowBtn").classList.add("hidden");
    document.getElementById("processingBox").classList.remove("hidden");
  }

  // ---- Pay Now ----
  document.getElementById("payNowBtn").addEventListener("click", () => {
    const activeTab = document.querySelector(".pay-tab-btn.active").dataset.pay;
    const totals = calculateTotals();

    if (activeTab === "upi") {
      // A static site can't detect an incoming UPI payment on its own —
      // there's no backend to receive the bank's confirmation. After the
      // payer scans and pays in their UPI app, they confirm here.
      const upiConfigured = typeof BY_CONFIG !== "undefined" && BY_CONFIG.upiId && !BY_CONFIG.upiId.startsWith("PASTE_");
      if (!upiConfigured) {
        alert("Add your real UPI ID in config.js first so payers have something to pay.");
        return;
      }
      const ok = confirm(`Confirm you have paid ₹${totals.finalTotal} via UPI/GPay to ${BY_CONFIG.payeeName || "BharatYatra"}?`);
      if (!ok) return;
      showProcessing();
      setTimeout(() => completeBooking("UPI / GPay", "upi-" + Date.now()), 1200);
      return;
    }

    // Card / Net banking → real Razorpay Checkout widget
    if (typeof Razorpay === "undefined" || !BY_CONFIG.razorpayKeyId || BY_CONFIG.razorpayKeyId.includes("PASTE")) {
      alert("Add your Razorpay key in config.js to enable card / net banking checkout.");
      return;
    }
    const options = {
      key: BY_CONFIG.razorpayKeyId,
      amount: totals.finalTotal * 100, // Razorpay expects paise
      currency: "INR",
      name: "BharatYatra",
      description: `${currentBus.from} → ${currentBus.to} · ${selectedSeats.length} seat(s)`,
      prefill: { name: passengerInfo.name, contact: passengerInfo.phone },
      theme: { color: "#D6483A" },
      handler: function (response) {
        showProcessing();
        setTimeout(() => completeBooking(
          activeTab === "netbanking" ? "Net Banking" : "Card",
          response.razorpay_payment_id
        ), 800);
      }
    };
    if (activeTab === "netbanking") {
      options.method = { netbanking: true, card: false, upi: false, wallet: false, emi: false, paylater: false };
    }
    new Razorpay(options).open();
  });

  async function completeBooking(methodLabel, paymentId) {
    try {
      await byReserveSeats(currentBus.id, selectedSeats);
    } catch (err) {
      document.getElementById("processingBox").classList.add("hidden");
      document.getElementById("payNowBtn").classList.remove("hidden");
      alert(`Those seats are no longer available. Please choose different seats. (${err.message})`);
      openSeatMap(currentBus);
      return;
    }

    const pnr = "BY" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const totals = calculateTotals();

    // Every booking's full receipt data — who booked it, what they booked,
    // and when — is saved so it can be looked up again later.
    const bookingRecord = {
      pnr, passengerName: passengerInfo.name, passengerPhone: passengerInfo.phone,
      from: currentBus.from, to: currentBus.to, date: currentBus.date,
      operator: currentBus.operator, busType: currentBus.type, dep: currentBus.dep,
      duration: currentBus.duration, busId: currentBus.id, seats: selectedSeats, fare: currentBus.fare,
      boardingPoint: passengerInfo.boardingPoint, droppingPoint: passengerInfo.droppingPoint,
      total: totals.finalTotal, discount: totals.discount,
      promoCode: appliedPromo ? appliedPromo.code : null,
      paymentMethod: methodLabel, paymentId: paymentId || null,
      bookedAt: new Date().toISOString()
    };

    // Always saved on this device, so "My bookings" works even without
    // a Firebase project configured.
    bySaveLocalBooking(bookingRecord);

    // Also saved to the real database (Firestore) if configured, so the
    // same booking is reachable from any device the passenger logs in on.
    if (byFirebaseReady && typeof bySaveBooking === "function") {
      try {
        await bySaveBooking(bookingRecord);
      } catch (err) {
        console.error("Could not save booking to the database:", err);
        alert("Your seats were reserved, but we could not save the ticket. Please contact support with payment ID " + paymentId + ".");
      }
    }

    const confirmName = document.getElementById("confirmName");
    const confirmPnr = document.getElementById("confirmPnr");
    const confirmRoute = document.getElementById("confirmRoute");
    const confirmDate = document.getElementById("confirmDate");
    const confirmDep = document.getElementById("confirmDep");
    const confirmSeats = document.getElementById("confirmSeats");
    const confirmBus = document.getElementById("confirmBus");
    const confirmMethod = document.getElementById("confirmMethod");
    const confirmTotal = document.getElementById("confirmTotal");
    const confirmPromo = document.getElementById("confirmPromo");
    const confirmDiscount = document.getElementById("confirmDiscount");
    const ticketQrBox = document.getElementById("ticketQr");

    if (confirmName) confirmName.textContent = passengerInfo.name;
    if (confirmPnr) confirmPnr.textContent = pnr;
    if (confirmRoute) confirmRoute.textContent = `${currentBus.from} → ${currentBus.to}`;
    if (confirmDate) confirmDate.textContent = new Date(currentBus.date + "T00:00:00").toDateString();
    const confirmBookedAt = document.getElementById("confirmBookedAt");
    if (confirmBookedAt) confirmBookedAt.textContent = new Date(bookingRecord.bookedAt).toLocaleString("en-IN");
    if (confirmDep) confirmDep.textContent = `${currentBus.dep} (${currentBus.duration} journey)`;
    if (confirmSeats) confirmSeats.textContent = selectedSeats.join(", ");
    if (confirmBus) confirmBus.textContent = `${currentBus.operator} (${currentBus.type})`;
    if (confirmMethod) confirmMethod.textContent = methodLabel;
    if (confirmPromo) confirmPromo.textContent = appliedPromo ? appliedPromo.code : "—";
    if (confirmDiscount) confirmDiscount.textContent = `₹${totals.discount}`;
    if (confirmTotal) confirmTotal.textContent = `₹${totals.finalTotal}`;
    ticketQrBox.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(ticketQrBox, {
        text: `BharatYatra|PNR:${pnr}|${currentBus.from}-${currentBus.to}|${currentBus.date}|Seats:${selectedSeats.join(",")}`,
        width: 120, height: 120, colorDark: "#1C2A4D", colorLight: "#ffffff"
      });
    }

    document.getElementById("bookingFlow").classList.add("hidden");
    document.getElementById("confirmation").classList.remove("hidden");
    document.getElementById("confirmation").scrollIntoView({ behavior: "smooth" });

    // reset pay button/spinner for a possible future booking in this session
    document.getElementById("payNowBtn").classList.remove("hidden");
    document.getElementById("processingBox").classList.add("hidden");
  }

  const printBtn = document.getElementById("printTicketBtn");
  if (printBtn) printBtn.addEventListener("click", () => window.print());
}
document.addEventListener("DOMContentLoaded", initBookingPage);
