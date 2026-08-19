/* =========================================================
   BharatYatra — CONTACT.JS
   Contact form submit handler for contact.html.
   ========================================================= */
document.getElementById("contactForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const name = document.getElementById("contactName").value.trim();
  const email = document.getElementById("contactEmail").value.trim();
  const subject = document.getElementById("contactSubject").value;
  const pnr = document.getElementById("contactPnr").value.trim();
  const message = document.getElementById("contactMessage").value.trim();
  const alertBox = document.getElementById("contactAlert");
  const successBox = document.getElementById("contactSuccess");
  if (!name || !email || !message) {
    alertBox.classList.remove("hidden");
    successBox.classList.add("hidden");
    return;
  }
  alertBox.classList.add("hidden");
  try {
    const key = "by_contact_messages";
    const messages = JSON.parse(localStorage.getItem(key) || "[]");
    messages.unshift({ name, email, subject, pnr: pnr || null, message, sentAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(messages));
  } catch (err) { /* The confirmation can still be shown if storage is unavailable. */ }
  document.getElementById("contactNameOut").textContent = name;
  successBox.classList.remove("hidden");
  this.reset();
});
