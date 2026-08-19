/* =========================================================
   BharatYatra — COMMON.JS
   Loaded on every page: mobile nav toggle, the login/user menu
   in the nav bar, local booking-record storage helpers, and the
   click handler for "quick route" cards (used on index.html and
   routes.html). Page-specific logic lives in <page-name>.js.
   ========================================================= */

// ---- Booking records: saved locally on this device so every booking
//      always has somewhere to live, even before the backend server is
//      configured. (Once server/config.js's apiBaseUrl is set up,
//      bookings are also saved to the real database — see
//      bySaveBooking() in db-client.js — for access from any device.)
const BY_BOOKINGS_KEY = "by_bookings";
const BY_PROMOS_KEY = "by_promos";

function byGetLocalBookings() {
  try {
    return JSON.parse(localStorage.getItem(BY_BOOKINGS_KEY) || "[]");
  } catch (err) {
    return [];
  }
}

function bySaveLocalBooking(booking) {
  const list = byGetLocalBookings();
  list.unshift(booking);
  localStorage.setItem(BY_BOOKINGS_KEY, JSON.stringify(list));
}

function byGetLocalPromos() {
  try {
    return JSON.parse(localStorage.getItem(BY_PROMOS_KEY) || "[]");
  } catch (err) {
    return [];
  }
}

function bySaveLocalPromos(promos) {
  localStorage.setItem(BY_PROMOS_KEY, JSON.stringify(promos || []));
}

// ---- Mobile nav toggle ----
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }
});

// ---- Nav login/user menu — backed by the real backend's auth ----
function renderNavAuth() {
  const slot = document.getElementById("navAuthSlot");
  if (!slot) return;

  function paint(user) {
    if (user) {
      const firstName = (user.name || user.displayName || user.email || "Account").split(" ")[0];
      slot.innerHTML = `
        <div class="nav-user">
          <button class="nav-user-btn" id="navUserBtn" type="button">👤 <span class="uname">${firstName}</span> ▾</button>
          <div class="nav-user-menu" id="navUserMenu">
            <a href="my-bookings.html">My bookings</a>
            <button type="button" id="logoutBtn">Log out</button>
          </div>
        </div>`;
      document.getElementById("navUserBtn").addEventListener("click", () => {
        document.getElementById("navUserMenu").classList.toggle("open");
      });
      document.getElementById("logoutBtn").addEventListener("click", () => {
        bySignOut().then(() => window.location.reload());
      });
      document.addEventListener("click", (e) => {
        const menu = document.getElementById("navUserMenu");
        const btn = document.getElementById("navUserBtn");
        if (menu && !menu.contains(e.target) && e.target !== btn) menu.classList.remove("open");
      });
    } else {
      slot.innerHTML = `<a href="login.html" class="btn ghost" style="padding:8px 16px; font-size:.85rem;">Login / Sign up</a>`;
    }
  }

  if (typeof byOnAuthChange === "function") {
    byOnAuthChange(paint);
  } else {
    paint(null);
  }
}
document.addEventListener("DOMContentLoaded", renderNavAuth);

// ---- quick-route cards on routes.html / index.html ----
function wireQuickRoutes() {
  document.querySelectorAll("[data-quick-route]").forEach((el) => {
    el.addEventListener("click", () => {
      const [from, to] = el.dataset.quickRoute.split("|");
      const today = new Date().toISOString().split("T")[0];
      const params = new URLSearchParams({ from, to, date: today });
      window.location.href = `booking.html?${params.toString()}`;
    });
  });
}
document.addEventListener("DOMContentLoaded", wireQuickRoutes);
