/* =========================================================
   BharatYatra — MY-BOOKINGS.JS
   Lists every booking saved on this device (see common.js's
   byGetLocalBookings) and shows a printable e-ticket for each,
   for my-bookings.html.
   ========================================================= */

function initMyBookingsPage() {
  const listEl = document.getElementById("bookingsList");
  if (!listEl) return; // not on this page

  const emptyEl = document.getElementById("bookingsEmpty");
  const searchInput = document.getElementById("bookingsSearch");
  let selectedBooking = null;
  let allBookings = [];
  const renderBookings = (bookings) => {
    allBookings = bookings;
    listEl.innerHTML = "";
    const query = (searchInput ? searchInput.value : "").trim().toLowerCase();
    const visibleBookings = bookings.filter((b) => !query || [b.from, b.to, b.operator, b.pnr, b.status]
      .some((value) => String(value || "").toLowerCase().includes(query)));
    if (visibleBookings.length === 0) {
      if (emptyEl) emptyEl.classList.remove("hidden");
      if (emptyEl && query) emptyEl.textContent = "No bookings match that search. Try a route, operator, or PNR.";
      return;
    }
    if (emptyEl) emptyEl.classList.add("hidden");

    visibleBookings.forEach((b) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="tags" style="margin-bottom:8px;">
        <span class="pill">${b.operator}</span>
        <span class="pill mono">PNR ${b.pnr}</span>
        <span class="status-badge ${b.status === "cancelled" ? "cancelled" : "confirmed"}">${b.status || "confirmed"}</span>
      </div>
      <h3>${b.from} → ${b.to}</h3>
      <p style="font-size:.9rem; color:var(--ink-soft); line-height:1.6;">
        Journey: ${new Date(b.date + "T00:00:00").toDateString()} · ${b.dep}<br>
        Passenger: ${b.passengerName} (${b.passengerPhone})<br>
        Seat(s): ${b.seats.join(", ")} · ₹${b.total} paid via ${b.paymentMethod}<br>
        Booked on: ${new Date(b.bookedAt).toLocaleString("en-IN")}
      </p>
      <button class="btn mt-30 view-receipt-btn" type="button">View e-ticket</button>
    `;
    card.querySelector(".view-receipt-btn").addEventListener("click", () => showReceipt(b));
      listEl.appendChild(card);
    });
  };
  if (searchInput) searchInput.addEventListener("input", () => renderBookings(allBookings));

  // Supabase is the source of truth. Keep the local copy as an offline
  // fallback so a ticket remains visible when the network is unavailable.
  if (typeof byGetMyBookings === "function" && byCurrentUser()) {
    byGetMyBookings().then(renderBookings).catch(() => renderBookings(byGetLocalBookings()));
  } else {
    renderBookings(byGetLocalBookings());
  }

  function showReceipt(b) {
    selectedBooking = b;
    document.getElementById("rName").textContent = b.passengerName;
    document.getElementById("rPnr").textContent = b.pnr;
    document.getElementById("rRoute").textContent = `${b.from} → ${b.to}`;
    document.getElementById("rDate").textContent = new Date(b.date + "T00:00:00").toDateString();
    document.getElementById("rBus").textContent = `${b.operator} (${b.busType})`;
    document.getElementById("rDep").textContent = `${b.dep} (${b.duration} journey)`;
    document.getElementById("rBoarding").textContent = b.boardingPoint || `${b.from} Main Bus Stand`;
    document.getElementById("rDropping").textContent = b.droppingPoint || `${b.to} Main Bus Stand`;
    document.getElementById("rSeats").textContent = b.seats.join(", ");
    document.getElementById("rMethod").textContent = b.paymentMethod;
    document.getElementById("rTotal").textContent = `₹${b.total}`;
    document.getElementById("rBookedAt").textContent = new Date(b.bookedAt).toLocaleString("en-IN");

    const qrBox = document.getElementById("rQr");
    qrBox.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(qrBox, {
        text: `BharatYatra|PNR:${b.pnr}|${b.from}-${b.to}|${b.date}|Seats:${b.seats.join(",")}`,
        width: 120, height: 120, colorDark: "#1C2A4D", colorLight: "#ffffff"
      });
    }

    const view = document.getElementById("receiptView");
    view.classList.remove("hidden");
    view.scrollIntoView({ behavior: "smooth" });
  }

  document.getElementById("downloadPdfBtn").addEventListener("click", () => {
    if (!selectedBooking || !window.jspdf) return alert("PDF generation is not available. Please use Print instead.");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const b = selectedBooking;
    pdf.setFontSize(22); pdf.text("BharatYatra e-Ticket", 20, 24);
    pdf.setFontSize(12);
    [
      `PNR: ${b.pnr}`, `Passenger: ${b.passengerName}`, `Route: ${b.from} to ${b.to}`,
      `Journey date: ${b.date}`, `Bus: ${b.operator} (${b.busType})`, `Departure: ${b.dep}`,
      `Boarding: ${b.boardingPoint || `${b.from} Main Bus Stand`}`,
      `Dropping: ${b.droppingPoint || `${b.to} Main Bus Stand`}`,
      `Seats: ${(b.seats || []).join(", ")}`, `Amount paid: INR ${b.total}`, `Status: ${b.status || "confirmed"}`
    ].forEach((line, index) => pdf.text(line, 20, 42 + index * 11));
    pdf.save(`BharatYatra-${b.pnr}.pdf`);
  });

  document.getElementById("cancelBookingBtn").addEventListener("click", () => {
    if (!selectedBooking || selectedBooking.status === "cancelled") return;
    if (!confirm("Cancel this booking and request a refund?")) return;
    byRequestBookingCancellation(selectedBooking.id).then(() => {
      alert("Cancellation submitted. Your refund status is now Requested.");
      window.location.reload();
    }).catch((err) => alert(`Could not cancel booking: ${err.message}`));
  });

  document.getElementById("reviewForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const message = document.getElementById("reviewMessage");
    if (!selectedBooking) return;
    bySaveReview({ bookingId: selectedBooking.id, rating: Number(document.getElementById("reviewRating").value), comment: document.getElementById("reviewComment").value.trim() })
      .then(() => { message.textContent = "Thank you for your review."; message.classList.remove("hidden"); event.target.reset(); })
      .catch((err) => { message.textContent = err.message.includes("duplicate") ? "You have already reviewed this trip." : `Could not save review: ${err.message}`; message.classList.remove("hidden"); });
  });

  const printBtn = document.getElementById("printReceiptBtn");
  if (printBtn) printBtn.addEventListener("click", () => window.print());
  const closeBtn = document.getElementById("closeReceiptBtn");
  if (closeBtn) closeBtn.addEventListener("click", () => document.getElementById("receiptView").classList.add("hidden"));
}
document.addEventListener("DOMContentLoaded", initMyBookingsPage);
