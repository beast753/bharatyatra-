/* =========================================================
   BharatYatra — ADMIN.JS
   Gated admin login and the full dashboard: stats, searchable/
   sortable bookings with cancel + export, and a registered-users
   list — for admin.html.
   ========================================================= */

function initAdminPage() {
  const loginForm = document.getElementById("adminLoginForm");
  if (!loginForm) return; // not on this page

  const loginBox = document.getElementById("adminLoginBox");
  const notAdminBox = document.getElementById("notAdminBox");
  const dashboard = document.getElementById("adminDashboard");
  const alertBox = document.getElementById("adminAlert");

  let allBookings = [];
  let allUsers = [];
  let allCharterRequests = [];

  function showState(state) {
    loginBox.classList.toggle("hidden", state !== "login");
    notAdminBox.classList.toggle("hidden", state !== "blocked");
    dashboard.classList.toggle("hidden", state !== "dashboard");
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;

    bySignInWithEmail(email, password).catch((err) => {
      alertBox.textContent = err.message;
      alertBox.classList.remove("hidden");
    });
  });

  document.getElementById("notAdminSignOutBtn").addEventListener("click", () => {
    bySignOut().then(() => showState("login"));
  });
  document.getElementById("adminSignOutBtn").addEventListener("click", () => {
    bySignOut().then(() => showState("login"));
  });

  byOnAuthChange((user) => {
    if (!user) { showState("login"); return; }
    if (!byIsAdminEmail(user.email)) { showState("blocked"); return; }
    showState("dashboard");
    document.getElementById("adminWelcome").textContent = `Welcome, ${user.email}`;
    loadAdminBookings();
    loadAdminUsers();
    loadAdminCharterRequests();
  });

  // ---- Tabs ----
  document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      document.getElementById("adminTabBookings").classList.toggle("hidden", tab !== "bookings");
      document.getElementById("adminTabUsers").classList.toggle("hidden", tab !== "users");
      document.getElementById("adminTabCharter").classList.toggle("hidden", tab !== "charter");
      document.getElementById("adminTabOperations").classList.toggle("hidden", tab !== "operations");
    });
  });

  // ---- Stats ----
  function renderStats(bookings) {
    const statsEl = document.getElementById("adminStats");
    const activeBookings = bookings.filter((b) => b.status !== "cancelled");
    const totalRevenue = activeBookings.reduce((sum, b) => sum + (b.total || 0), 0);
    statsEl.innerHTML = `
      <div class="card"><h3>${activeBookings.length}</h3><p>Active bookings</p></div>
      <div class="card"><h3>₹${totalRevenue.toLocaleString("en-IN")}</h3><p>Total revenue</p></div>
      <div class="card"><h3>${new Set(bookings.map(b => b.uid).filter(Boolean)).size}</h3><p>Unique customers</p></div>
    `;
  }

  // ---- Bookings ----
  function loadAdminBookings() {
    byGetAllBookings().then((bookings) => {
      allBookings = bookings;
      renderStats(allBookings);
      renderBookings();
    }).catch((err) => {
      document.getElementById("adminBookingsList").innerHTML = `<div class="alert">Couldn't load bookings: ${err.message}</div>`;
    });
  }

  function renderBookings() {
    const listEl = document.getElementById("adminBookingsList");
    const emptyEl = document.getElementById("adminBookingsEmpty");
    const query = document.getElementById("bookingSearch").value.trim().toLowerCase();
    const sortBy = document.getElementById("bookingSort").value;

    let rows = allBookings.filter((b) => {
      if (!query) return true;
      return [b.pnr, b.passengerName, b.from, b.to].some((f) => (f || "").toLowerCase().includes(query));
    });

    rows = rows.slice().sort((a, b) => {
      const aTime = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : (a.bookedAt ? new Date(a.bookedAt).getTime() : 0);
      const bTime = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : (b.bookedAt ? new Date(b.bookedAt).getTime() : 0);
      if (sortBy === "newest") return bTime - aTime;
      if (sortBy === "oldest") return aTime - bTime;
      if (sortBy === "amount-high") return (b.total || 0) - (a.total || 0);
      if (sortBy === "amount-low") return (a.total || 0) - (b.total || 0);
      return 0;
    });

    listEl.innerHTML = "";
    if (rows.length === 0) {
      emptyEl.textContent = allBookings.length === 0 ? "No bookings in the database yet." : "No bookings match your search.";
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");

    rows.forEach((b) => {
      const bookedAt = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : (b.bookedAt ? new Date(b.bookedAt) : null);
      const isCancelled = b.status === "cancelled";
      const row = document.createElement("div");
      row.className = "card";
      row.style.marginBottom = "12px";
      row.innerHTML = `
        <div class="tags" style="margin-bottom:8px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span class="pill">${b.operator || "—"}</span>
          <span class="pill mono">PNR ${b.pnr || "—"}</span>
          <span class="status-badge ${isCancelled ? "cancelled" : "confirmed"}">${isCancelled ? "Cancelled" : "Confirmed"}</span>
        </div>
        <h3>${b.from || "?"} → ${b.to || "?"}</h3>
        <p style="font-size:.9rem; color:var(--ink-soft); line-height:1.6;">
          Passenger: ${b.passengerName || "—"} (${b.passengerPhone || "—"})<br>
          Journey: ${b.date || "—"} · Seat(s): ${(b.seats || []).join(", ")}<br>
          Bus ID: <span class="mono">${b.busId || "Not recorded for this older booking"}</span><br>
          Amount: ₹${b.total || 0} via ${b.paymentMethod || "—"}<br>
          Booked: ${bookedAt ? bookedAt.toLocaleString("en-IN") : "—"}
        </p>
        <div class="admin-row-actions">
          ${isCancelled
            ? `<button type="button" class="btn ghost" data-action="restore" data-id="${b.id}">Mark as confirmed</button>`
            : `<button type="button" class="btn ghost" data-action="cancel" data-id="${b.id}">Cancel booking</button>`}
          <button type="button" class="btn ghost" data-action="delete" data-id="${b.id}" style="border-color:var(--rust); color:var(--rust);">Delete permanently</button>
        </div>
      `;
      listEl.appendChild(row);
    });

    listEl.querySelectorAll("[data-action='cancel']").forEach((btn) => {
      btn.addEventListener("click", () => {
        bySetBookingStatus(btn.dataset.id, "cancelled").then(loadAdminBookings);
      });
    });
    listEl.querySelectorAll("[data-action='restore']").forEach((btn) => {
      btn.addEventListener("click", () => {
        bySetBookingStatus(btn.dataset.id, "confirmed").then(loadAdminBookings);
      });
    });
    listEl.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!confirm("Permanently delete this booking? This can't be undone.")) return;
        byDeleteBooking(btn.dataset.id).then(loadAdminBookings);
      });
    });
  }

  document.getElementById("bookingSearch").addEventListener("input", renderBookings);
  document.getElementById("bookingSort").addEventListener("change", renderBookings);

  // ---- CSV export ----
  document.getElementById("exportCsvBtn").addEventListener("click", () => {
    const header = ["PNR", "Passenger", "Phone", "From", "To", "Journey Date", "Operator", "Seats", "Amount", "Payment Method", "Status", "Booked At"];
    const rows = allBookings.map((b) => {
      const bookedAt = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : (b.bookedAt ? new Date(b.bookedAt) : null);
      return [
        b.pnr, b.passengerName, b.passengerPhone, b.from, b.to, b.date, b.operator,
        (b.seats || []).join(" "), b.total, b.paymentMethod, b.status || "confirmed",
        bookedAt ? bookedAt.toISOString() : ""
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bharatyatra-bookings-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ---- Registered users ----
  function loadAdminUsers() {
    byGetAllUsers().then((users) => {
      allUsers = users;
      renderUsers();
    }).catch((err) => {
      document.getElementById("adminUsersList").innerHTML = `<div class="alert">Couldn't load users: ${err.message}</div>`;
    });
  }

  function renderUsers() {
    const listEl = document.getElementById("adminUsersList");
    const emptyEl = document.getElementById("adminUsersEmpty");
    const query = document.getElementById("userSearch").value.trim().toLowerCase();

    const rows = allUsers.filter((u) => {
      if (!query) return true;
      return [u.name, u.email, u.phone].some((f) => (f || "").toLowerCase().includes(query));
    });

    listEl.innerHTML = "";
    if (rows.length === 0) {
      emptyEl.textContent = allUsers.length === 0 ? "No registered users yet." : "No users match your search.";
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");

    rows.forEach((u) => {
      const bookingCount = allBookings.filter((b) => b.uid === u.id).length;
      const joined = u.createdAt && u.createdAt.toDate ? u.createdAt.toDate() : null;
      const row = document.createElement("div");
      row.className = "card";
      row.style.marginBottom = "12px";
      row.innerHTML = `
        <h3>${u.name || "—"}</h3>
        <p style="font-size:.9rem; color:var(--ink-soft); line-height:1.6;">
          Email: ${u.email || "—"} · Phone: ${u.phone || "—"}<br>
          Bookings made: ${bookingCount}<br>
          Joined: ${joined ? joined.toLocaleString("en-IN") : "—"}
        </p>
      `;
      listEl.appendChild(row);
    });
  }

  document.getElementById("userSearch").addEventListener("input", renderUsers);

  document.getElementById("seatLookupBtn").addEventListener("click", () => {
    const busId = document.getElementById("seatLookupBusId").value.trim();
    const result = document.getElementById("seatLookupResult");
    if (!busId) return;
    result.classList.remove("hidden");
    result.textContent = "Loading seat inventory...";
    byGetSeatInventory(busId).then((inventory) => {
      const seats = inventory.booked_seats || [];
      result.innerHTML = `<p style="margin:14px 0 8px;"><strong>${seats.length}</strong> booked seat(s)${inventory.updated_at ? ` · last updated ${new Date(inventory.updated_at).toLocaleString("en-IN")}` : ""}</p>` +
        (seats.length ? seats.map((seat) => `<span class="seat-number">${seat}</span>`).join("") : "<p>No seats are booked for this bus yet.</p>");
    }).catch((err) => { result.textContent = `Could not load seats: ${err.message}`; });
  });

  // ---- Charter requests ----
  // Charter requests are stored in Supabase so the admin dashboard can show
  // requests made from any device, rather than only this browser's storage.
  function loadAdminCharterRequests() {
    byGetAllCharterRequests().then((requests) => {
      allCharterRequests = requests;
      renderCharterStats();
      renderCharterRequests();
    }).catch((err) => {
      const listEl = document.getElementById("adminCharterList");
      listEl.innerHTML = `<div class="alert">Couldn't load charter requests: ${err.message}</div>`;
    });
  }

  function renderCharterStats() {
    const statsEl = document.getElementById("charterStats");
    const paidRequests = allCharterRequests.filter((r) => r.payment);
    const totalCollected = paidRequests.reduce((sum, r) => sum + (r.payment.amount || 0), 0);
    statsEl.innerHTML = `
      <div class="card"><h3>${allCharterRequests.length}</h3><p>Charter requests</p></div>
      <div class="card"><h3>${paidRequests.length}</h3><p>Paid</p></div>
      <div class="card"><h3>₹${totalCollected.toLocaleString("en-IN")}</h3><p>Total collected</p></div>
    `;
  }

  function renderCharterRequests() {
    const listEl = document.getElementById("adminCharterList");
    const emptyEl = document.getElementById("adminCharterEmpty");
    const query = document.getElementById("charterSearch").value.trim().toLowerCase();

    const rows = allCharterRequests.filter((r) => {
      if (!query) return true;
      return [r.ref, r.name, r.from, r.to, r.phone, r.email].some((f) => (f || "").toLowerCase().includes(query));
    });

    listEl.innerHTML = "";
    if (rows.length === 0) {
      emptyEl.textContent = allCharterRequests.length === 0 ? "No charter requests yet." : "No requests match your search.";
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");

    rows.forEach((r) => {
      const requestedAt = r.requestedAt ? new Date(r.requestedAt) : null;
      const paid = !!r.payment;
      const row = document.createElement("div");
      row.className = "card";
      row.style.marginBottom = "12px";
      row.innerHTML = `
        <div class="tags" style="margin-bottom:8px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span class="pill mono">Ref ${r.ref || "—"}</span>
          <span class="pill">${r.busType || "—"} × ${r.busCount || 1}</span>
          <span class="status-badge ${paid ? "confirmed" : "cancelled"}">${paid ? "Paid" : "Payment pending"}</span>
        </div>
        <h3>${r.from || "?"} → ${r.to || "?"}</h3>
        <p style="font-size:.9rem; color:var(--ink-soft); line-height:1.6;">
          Requested by: ${r.name || "—"} (${r.phone || "—"}, ${r.email || "—"})<br>
          Purpose: ${r.purpose || "—"} · Passengers: ${r.passengers || "—"}<br>
          Journey: ${r.date || "—"}${r.returnDate ? ` – ${r.returnDate}` : ""}<br>
          Estimated fare: ₹${r.fareTotal || 0}<br>
          ${paid
            ? `Paid: ₹${r.payment.amount} via UPI/Card/Net banking · Payment ID ${r.payment.paymentId} on ${new Date(r.payment.paidAt).toLocaleString("en-IN")}`
            : `Payment: not made yet`}<br>
          Requested: ${requestedAt ? requestedAt.toLocaleString("en-IN") : "—"}
          ${r.notes ? `<br>Notes: ${r.notes}` : ""}
        </p>
        <div class="admin-row-actions">
          <button type="button" class="btn ghost" data-action="delete-charter" data-ref="${r.ref}" style="border-color:var(--rust); color:var(--rust);">Delete permanently</button>
        </div>
      `;
      listEl.appendChild(row);
    });

    listEl.querySelectorAll("[data-action='delete-charter']").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!confirm("Permanently delete this charter request? This can't be undone.")) return;
        const ref = btn.dataset.ref;
        byDeleteCharterRequest(ref)
          .then(loadAdminCharterRequests)
          .catch((err) => alert(`Couldn't delete charter request: ${err.message}`));
      });
    });
  }

  document.getElementById("charterSearch").addEventListener("input", renderCharterRequests);

  document.getElementById("exportCharterCsvBtn").addEventListener("click", () => {
    const header = ["Reference", "Name", "Phone", "Email", "Purpose", "From", "To", "Journey Date", "Return Date", "Passengers", "Bus Type", "Bus Count", "Estimated Fare", "Paid Amount", "Payment ID", "Requested At"];
    const rows = allCharterRequests.map((r) => [
      r.ref, r.name, r.phone, r.email, r.purpose, r.from, r.to, r.date, r.returnDate,
      r.passengers, r.busType, r.busCount, r.fareTotal,
      r.payment ? r.payment.amount : "", r.payment ? r.payment.paymentId : "",
      r.requestedAt
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bharatyatra-charter-requests-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
document.addEventListener("DOMContentLoaded", initAdminPage);
