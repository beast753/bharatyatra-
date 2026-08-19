/* =========================================================
   BharatYatra — ROUTES.JS
   Builds the full list of popular route cards for routes.html.
   Runs immediately (not on DOMContentLoaded): this script tag
   sits at the bottom of the page, after the #allRoutes div, so
   it already exists. It also needs to finish BEFORE common.js's
   DOMContentLoaded listener (wireQuickRoutes) fires, so the
   cards it wires up click handlers onto already exist.
   ========================================================= */
(function renderAllRoutes() {
  const allRoutesEl = document.getElementById("allRoutes");
  const searchInput = document.getElementById("routeSearch");
  if (!allRoutesEl) return;
  const allPairs = [
    ["Delhi", "Jaipur"], ["Delhi", "Chandigarh"], ["Delhi", "Lucknow"],
    ["Mumbai", "Pune"], ["Mumbai", "Goa"], ["Mumbai", "Ahmedabad"],
    ["Mumbai", "Ratnagiri"], ["Ratnagiri", "Mumbai"], ["Mumbai", "Oni"], ["Oni", "Mumbai"],
    ["Mumbai", "Nashik"], ["Nashik", "Mumbai"], ["Pune", "Kolhapur"], ["Kolhapur", "Pune"],
    ["Mumbai", "Aurangabad"], ["Aurangabad", "Mumbai"], ["Pune", "Shirdi"], ["Shirdi", "Pune"],
    ["Bengaluru", "Chennai"], ["Bengaluru", "Hyderabad"], ["Bengaluru", "Goa"],
    ["Hyderabad", "Chennai"], ["Pune", "Goa"], ["Kolkata", "Lucknow"],
    ["Ahmedabad", "Surat"], ["Indore", "Mumbai"], ["Chennai", "Kochi"],
    ["Nagpur", "Hyderabad"],
    ["Delhi", "Agra"], ["Delhi", "Dehradun"], ["Delhi", "Haridwar"], ["Delhi", "Rishikesh"], ["Delhi", "Amritsar"],
    ["Jaipur", "Udaipur"], ["Jaipur", "Jodhpur"], ["Jaipur", "Kota"], ["Chandigarh", "Manali"], ["Chandigarh", "Shimla"],
    ["Lucknow", "Varanasi"], ["Lucknow", "Kanpur"], ["Varanasi", "Prayagraj"], ["Amritsar", "Jammu"],
    ["Mumbai", "Shirdi"], ["Mumbai", "Lonavala"], ["Pune", "Nashik"], ["Pune", "Aurangabad"], ["Pune", "Solapur"],
    ["Ahmedabad", "Udaipur"], ["Ahmedabad", "Vadodara"], ["Surat", "Vadodara"], ["Indore", "Bhopal"], ["Indore", "Ujjain"],
    ["Bhopal", "Jabalpur"], ["Nagpur", "Pune"], ["Nagpur", "Raipur"], ["Raipur", "Bilaspur"],
    ["Bengaluru", "Mysuru"], ["Bengaluru", "Coimbatore"], ["Bengaluru", "Mangaluru"], ["Chennai", "Puducherry"],
    ["Chennai", "Madurai"], ["Chennai", "Coimbatore"], ["Hyderabad", "Vijayawada"], ["Hyderabad", "Visakhapatnam"],
    ["Hyderabad", "Tirupati"], ["Kochi", "Munnar"], ["Kochi", "Thiruvananthapuram"], ["Kozhikode", "Bengaluru"],
    ["Mysuru", "Ooty"], ["Madurai", "Rameswaram"], ["Kolkata", "Siliguri"], ["Kolkata", "Durgapur"],
    ["Kolkata", "Bhubaneswar"], ["Bhubaneswar", "Puri"], ["Bhubaneswar", "Cuttack"], ["Patna", "Gaya"],
    ["Patna", "Ranchi"], ["Ranchi", "Jamshedpur"], ["Guwahati", "Shillong"], ["Guwahati", "Tezpur"], ["Siliguri", "Darjeeling"]
  ];

  function render(list) {
    allRoutesEl.innerHTML = "";
    if (list.length === 0) {
      allRoutesEl.innerHTML = `<p class="no-routes">No routes match your search. Try another city name.</p>`;
      return;
    }
    list.forEach(([from, to]) => {
      const div = document.createElement("div");
      div.className = "route-card";
      div.style.cursor = "pointer";
      div.setAttribute("data-quick-route", `${from}|${to}`);
      div.innerHTML = `
        <div class="route-line">${from} <span class="arrow">&#8594;</span> ${to}</div>
        <div class="meta">Daily departures · AC &amp; Non-AC</div>
        <div class="price">From ₹${400 + Math.floor(Math.random() * 500)}</div>
        <span class="book-link">Search buses</span>
      `;
      allRoutesEl.appendChild(div);
    });
  }

  function getFilteredRoutes() {
    const query = searchInput?.value.trim().toLowerCase() || "";
    if (!query) return allPairs;
    return allPairs.filter(([from, to]) => {
      const combined = `${from} ${to}`.toLowerCase();
      return from.toLowerCase().includes(query)
        || to.toLowerCase().includes(query)
        || combined.includes(query);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => render(getFilteredRoutes()));
  }

  render(allPairs);
})();
