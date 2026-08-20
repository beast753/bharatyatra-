/* =========================================================
   BharatYatra — CHARTER.JS
   Handles the private/charter bus hire request form on
   charter.html: validation, a reference ID, saving the request
   (locally + to Firestore if configured), and the confirmation
   card.
   ========================================================= */

const BY_CHARTER_KEY = "by_charter_requests";

// Fixed per-bus, per-day fares. AC types cost more than Non-AC, and
// bigger/sleeper coaches cost more than seaters — same spirit as the
// bus type pricing on the regular booking page.
const CHARTER_FARE_PER_BUS_PER_DAY = {
  "Mini bus (up to 20 seats)": 6000,
  "Non-AC Seater": 8000,
  "AC Seater": 12000,
  "AC Sleeper": 16000,
  "Volvo Multi-Axle": 20000
};

const CHARTER_BUS_CAPACITY = {
  "Mini bus (up to 20 seats)": 20,
  "Non-AC Seater": 40,
  "AC Seater": 40,
  "AC Sleeper": 30,
  "Volvo Multi-Axle": 50
};

function getRequiredBusCount(passengers, busType) {
  const capacity = CHARTER_BUS_CAPACITY[busType] || 40;
  return Math.max(1, Math.ceil(Number(passengers || 0) / capacity));
}

function updateBusRecommendation() {
  const passengers = Number(document.getElementById("charterPassengers").value || 0);
  const busType = document.getElementById("charterBusType").value;
  const capacity = CHARTER_BUS_CAPACITY[busType] || 40;
  const summary = document.getElementById("charterBusSummary");
  const hint = document.getElementById("charterCapacityHint");
  hint.textContent = `Capacity: up to ${capacity} passengers per bus.`;
  summary.innerHTML = passengers
    ? `<strong>${getRequiredBusCount(passengers, busType)} bus${getRequiredBusCount(passengers, busType) > 1 ? "es" : ""}</strong>&nbsp; needed for ${passengers} passenger${passengers > 1 ? "s" : ""}.`
    : "Enter passengers to see the number of buses needed.";
}

function charterTripDays(dateStr, returnDateStr) {
  if (!returnDateStr) return 1;
  const start = new Date(dateStr + "T00:00:00");
  const end = new Date(returnDateStr + "T00:00:00");
  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 1;
}

function calculateCharterFare(busType, busCount, days) {
  const perDay = CHARTER_FARE_PER_BUS_PER_DAY[busType] || CHARTER_FARE_PER_BUS_PER_DAY["Non-AC Seater"];
  return { perDay, total: perDay * busCount * days };
}

function byGetLocalCharterRequests() {
  try {
    return JSON.parse(localStorage.getItem(BY_CHARTER_KEY) || "[]");
  } catch (err) {
    return [];
  }
}

function bySaveLocalCharterRequest(request) {
  const list = byGetLocalCharterRequests();
  list.unshift(request);
  localStorage.setItem(BY_CHARTER_KEY, JSON.stringify(list));
}

document.getElementById("charterForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("charterName").value.trim();
  const phone = document.getElementById("charterPhone").value.trim();
  const email = document.getElementById("charterEmail").value.trim();
  const from = document.getElementById("charterFrom").value.trim();
  const to = document.getElementById("charterTo").value.trim();
  const date = document.getElementById("charterDate").value;
  const returnDate = document.getElementById("charterReturnDate").value;
  const passengers = document.getElementById("charterPassengers").value;
  const busType = document.getElementById("charterBusType").value;
  const busCount = getRequiredBusCount(passengers, busType);

  if (!name || !phone || !email || !from || !to || !date || !passengers || !busCount) {
    alert("Please fill in all the required fields.");
    return;
  }

  const days = charterTripDays(date, returnDate);
  const fare = calculateCharterFare(busType, busCount, days);

  const ref = "CH" + Date.now().toString().slice(-8);
  const request = {
    ref, name, phone, email, purpose: "Charter bus booking", from, to, date, returnDate,
    passengers: Number(passengers), busCount, busType, notes: "",
    farePerDay: fare.perDay, fareTotal: fare.total,
    requestedAt: new Date().toISOString()
  };

  // Always saved on this device, same pattern as regular bookings.
  bySaveLocalCharterRequest(request);

  // Also saved to Firestore if configured, so your team can see it
  // from the admin dashboard on any device.
  if (byFirebaseReady && typeof bySaveCharterRequest === "function") {
    bySaveCharterRequest(request).catch((err) => console.error("Could not save charter request to the database:", err));
  }

  document.getElementById("ccRef").textContent = ref;
  document.getElementById("ccName").textContent = name;
  document.getElementById("ccRoute").textContent = `${from} → ${to}`;
  document.getElementById("ccDate").textContent = new Date(date + "T00:00:00").toDateString() + (returnDate ? ` – ${new Date(returnDate + "T00:00:00").toDateString()}` : "");
  document.getElementById("ccPax").textContent = passengers;
  document.getElementById("ccBusType").textContent = busType;

  document.getElementById("fareBusType").textContent = `${busType} × ${busCount} bus${busCount > 1 ? "es" : ""}`;
  document.getElementById("fareRate").textContent = `₹${fare.perDay}`;
  document.getElementById("fareBusCount").textContent = busCount;
  document.getElementById("fareDays").textContent = `${days} day${days > 1 ? "s" : ""}`;
  document.getElementById("fareTotal").textContent = `₹${fare.total}`;

  document.getElementById("charterForm").classList.add("hidden");
  document.getElementById("charterConfirmation").classList.remove("hidden");
  document.getElementById("charterConfirmation").scrollIntoView({ behavior: "smooth" });

  wireCharterPayment(ref, fare.total);
});

/* =========================================================
   Charter payment — the amount is fixed automatically from the
   bus type, number of buses, and trip length picked in the form.
   ========================================================= */
function wireCharterPayment(charterRef, amount) {
  const proceedBtn = document.getElementById("charterProceedPayBtn");
  const payTabsWrap = document.getElementById("charterPayTabsWrap");
  const amountDisplay = document.getElementById("charterPayAmountDisplay");
  const payNowAmount = document.getElementById("charterPayNowAmount");
  const payNowBtn = document.getElementById("charterPayNowBtn");
  const processingBox = document.getElementById("charterProcessingBox");
  const successBox = document.getElementById("charterPaymentSuccess");
  const paidAmountEl = document.getElementById("charterPaidAmount");
  const paymentIdEl = document.getElementById("charterPaymentId");

  // Step 1: reveal the payment tabs for the pre-calculated amount
  proceedBtn.addEventListener("click", () => {
    amountDisplay.textContent = `₹${amount}`;
    payNowAmount.textContent = `₹${amount}`;
    payTabsWrap.classList.remove("hidden");
    proceedBtn.disabled = true;

    // Render a UPI-style QR code encoding the fixed amount
    const qrEl = document.getElementById("charterQrcodeCanvas");
    qrEl.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(qrEl, {
        text: `upi://pay?pa=bharatyatra@upi&pn=BharatYatra&am=${amount}&cu=INR&tn=Charter%20payment%20${charterRef}`,
        width: 160,
        height: 160
      });
    }

    payTabsWrap.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // Tab switching (UPI / Card / Net banking)
  document.querySelectorAll(".charter-pay-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".charter-pay-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll("#charterPayTabsWrap .pay-panel").forEach((p) => p.classList.remove("active"));
      const panelMap = { upi: "charterPayPanelUpi", card: "charterPayPanelCard", netbanking: "charterPayPanelNetbanking" };
      document.getElementById(panelMap[btn.dataset.pay]).classList.add("active");
    });
  });

  // Step 2: mock "Pay now" — simulates processing, then confirms
  payNowBtn.addEventListener("click", () => {
    payTabsWrap.classList.add("hidden");
    processingBox.classList.remove("hidden");

    setTimeout(() => {
      processingBox.classList.add("hidden");
      const paymentId = "PAY" + Date.now().toString().slice(-10);

      const payment = {
        charterRef, amount, paymentId,
        paidAt: new Date().toISOString()
      };

      // Save locally, same pattern as the charter request itself
      try {
        const key = "by_charter_payments";
        const list = JSON.parse(localStorage.getItem(key) || "[]");
        list.unshift(payment);
        localStorage.setItem(key, JSON.stringify(list));
      } catch (err) { /* ignore storage errors */ }

      // Save to Firestore too, if the project's configured for it
      if (typeof byFirebaseReady !== "undefined" && byFirebaseReady && typeof bySaveCharterPayment === "function") {
        bySaveCharterPayment(payment).catch((err) => console.error("Could not save charter payment to the database:", err));
      }

      paidAmountEl.textContent = `₹${amount}`;
      paymentIdEl.textContent = paymentId;
      successBox.classList.remove("hidden");
      successBox.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 1500);
  });
}

// default min date = today
document.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("charterDate").min = today;
  document.getElementById("charterReturnDate").min = today;
  document.getElementById("charterPassengers").addEventListener("input", updateBusRecommendation);
  document.getElementById("charterBusType").addEventListener("change", updateBusRecommendation);
  updateBusRecommendation();
});
