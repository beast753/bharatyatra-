/* =========================================================
   BharatYatra — INDEX.JS
   Homepage-only logic: city dropdowns, swap button, date
   default, search form submit, and the trending routes cards.
   ========================================================= */

// ---- City list used by the search form ----
const CITIES = [
  "Delhi", "Mumbai", "Bengaluru", "Pune", "Hyderabad", "Chennai",
  "Jaipur", "Ahmedabad", "Kolkata", "Lucknow", "Indore", "Goa",
  "Chandigarh", "Nagpur", "Surat", "Kochi", "Agra", "Dehradun", "Haridwar", "Rishikesh", "Amritsar", "Udaipur", "Jodhpur", "Kota", "Manali", "Shimla", "Varanasi", "Kanpur", "Prayagraj", "Jammu", "Nashik", "Shirdi", "Lonavala", "Aurangabad", "Solapur", "Vadodara", "Bhopal", "Ujjain", "Jabalpur", "Raipur", "Mysuru", "Coimbatore", "Mangaluru", "Puducherry", "Madurai", "Vijayawada", "Visakhapatnam", "Tirupati", "Munnar", "Thiruvananthapuram", "Kozhikode", "Ooty", "Rameswaram", "Siliguri", "Durgapur", "Bhubaneswar", "Puri", "Cuttack", "Patna", "Gaya", "Ranchi", "Jamshedpur", "Guwahati", "Shillong", "Tezpur", "Darjeeling"
];
const RECENT_SEARCHES_KEY = "by_recent_searches";

function setSearchRoute(from, to) {
  const fromInput = document.getElementById("fromCity");
  const toInput = document.getElementById("toCity");
  if (!fromInput || !toInput) return;
  fromInput.value = from;
  toInput.value = to;
  fromInput.focus();
}

function dateForOffset(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().split("T")[0];
}

function nextWeekendDate() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const daysUntilSaturday = (6 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilSaturday);
  return date.toISOString().split("T")[0];
}

function getRecentSearches() {
  try { return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]"); }
  catch (err) { return []; }
}

function saveRecentSearch(from, to) {
  const searches = getRecentSearches().filter((search) => search.from !== from || search.to !== to);
  searches.unshift({ from, to });
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches.slice(0, 3)));
}

function renderRecentSearches() {
  const group = document.getElementById("recentSearches");
  const actions = document.getElementById("recentSearchActions");
  if (!group || !actions) return;
  const searches = getRecentSearches();
  if (!searches.length) return;
  actions.replaceChildren();
  searches.forEach(({ from, to }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shortcut-btn";
    button.textContent = `${from} → ${to}`;
    button.addEventListener("click", () => setSearchRoute(from, to));
    actions.appendChild(button);
  });
  group.classList.remove("hidden");
}

// ---- Populate the From/To city dropdowns ----
function populateCityInputs() {
  document.querySelectorAll("[data-city-select]").forEach((sel) => {
    if (sel.dataset.filled) return;
    CITIES.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
    sel.dataset.filled = "1";
  });
}
document.addEventListener("DOMContentLoaded", populateCityInputs);
document.addEventListener("DOMContentLoaded", renderRecentSearches);

// ---- Swap From/To ----
function wireSwapButton() {
  const swapBtn = document.querySelector(".swap-btn");
  if (!swapBtn) return;
  swapBtn.addEventListener("click", () => {
    const from = document.getElementById("fromCity");
    const to = document.getElementById("toCity");
    if (from && to) {
      const tmp = from.value;
      from.value = to.value;
      to.value = tmp;
    }
  });
}
document.addEventListener("DOMContentLoaded", wireSwapButton);

// ---- Default date = today, min = today ----
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    const today = new Date().toISOString().split("T")[0];
    input.min = today;
    if (!input.value) input.value = today;
  });
});

// ---- Homepage date and route shortcuts ----
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-date-offset]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("travelDate").value = dateForOffset(Number(button.dataset.dateOffset));
    });
  });
  const weekendButton = document.querySelector("[data-weekend]");
  if (weekendButton) weekendButton.addEventListener("click", () => {
    document.getElementById("travelDate").value = nextWeekendDate();
  });
  document.querySelectorAll("[data-search-route]").forEach((button) => {
    button.addEventListener("click", () => {
      const [from, to] = button.dataset.searchRoute.split("|");
      setSearchRoute(from, to);
    });
  });
});

// ---- Search form submit -> go to booking.html?from=..&to=..&date=.. ----
function wireSearchForm() {
  const form = document.getElementById("searchForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const from = document.getElementById("fromCity").value.trim();
    const to = document.getElementById("toCity").value.trim();
    const date = document.getElementById("travelDate").value;

    if (!from || !to) {
      alert("Please choose both a departure and destination city.");
      return;
    }
    if (from.toLowerCase() === to.toLowerCase()) {
      alert("Departure and destination cities can't be the same.");
      return;
    }
    saveRecentSearch(from, to);
    const params = new URLSearchParams({ from, to, date });
    window.location.href = `booking.html?${params.toString()}`;
  });
}
document.addEventListener("DOMContentLoaded", wireSearchForm);

// ---- Trending routes cards ----
// Runs immediately (not on DOMContentLoaded): this script tag sits at the
// bottom of the page, after the #quickRoutes div, so the element already
// exists. This also has to finish BEFORE common.js's DOMContentLoaded
// listener (wireQuickRoutes) fires, so the cards it wires up already exist.
(function renderTrendingRoutes() {
  const quickRoutesEl = document.getElementById("quickRoutes");
  if (!quickRoutesEl) return;
  const quickRoutePairs = [
    ["Delhi", "Jaipur"], ["Mumbai", "Pune"], ["Bengaluru", "Chennai"], ["Hyderabad", "Goa"],
    ["Kolkata", "Darjeeling"], ["Ahmedabad", "Udaipur"], ["Bhopal", "Indore"], ["Lucknow", "Varanasi"],
    ["Chandigarh", "Amritsar"], ["Jaipur", "Jaisalmer"], ["Mysuru", "Ooty"], ["Nagpur", "Pune"],
    ["Kochi", "Munnar"], ["Pune", "Nashik"], ["Vadodara", "Surat"], ["Srinagar", "Gulmarg"],
    ["Visakhapatnam", "Vijayawada"], ["Patna", "Bodh Gaya"], ["Vijayawada", "Tirupati"], ["Guwahati", "Shillong"],
    ["Rishikesh", "Haridwar"], ["Nagpur", "Hyderabad"], ["Surat", "Ahmedabad"], ["Jaipur", "Pushkar"]
  ];
  quickRoutePairs.forEach(([from, to]) => {
    const div = document.createElement("div");
    div.className = "route-card";
    div.style.cursor = "pointer";
    div.setAttribute("data-quick-route", `${from}|${to}`);
    div.innerHTML = `
      <div class="route-line">${from} <span class="arrow">&#8594;</span> ${to}</div>
      <div class="meta">Daily departures · AC &amp; Non-AC</div>
      <div class="price">From ₹${450 + Math.floor(Math.random() * 400)}</div>
      <span class="book-link">Search buses</span>
    `;
    quickRoutesEl.appendChild(div);
  });
})();
