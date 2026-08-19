/* =========================================================
   BharatYatra — LOGIN.JS
   Login/signup tab switching and Firebase auth form wiring
   for login.html.
   ========================================================= */
const tabLoginBtn = document.getElementById("tabLoginBtn");
const tabSignupBtn = document.getElementById("tabSignupBtn");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const authAlert = document.getElementById("authAlert");

function showTab(which) {
  const isLogin = which === "login";
  tabLoginBtn.classList.toggle("active", isLogin);
  tabSignupBtn.classList.toggle("active", !isLogin);
  loginForm.classList.toggle("active", isLogin);
  signupForm.classList.toggle("active", !isLogin);
  authAlert.classList.add("hidden");
}
tabLoginBtn.addEventListener("click", () => showTab("login"));
tabSignupBtn.addEventListener("click", () => showTab("signup"));
document.getElementById("goSignup").addEventListener("click", (e) => { e.preventDefault(); showTab("signup"); });
document.getElementById("goLogin").addEventListener("click", (e) => { e.preventDefault(); showTab("login"); });

function redirectAfterAuth() {
  const params = new URLSearchParams(window.location.search);
  window.location.href = params.get("redirect") || "index.html";
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  bySignInWithEmail(email, password)
    .then(redirectAfterAuth)
    .catch((err) => {
      authAlert.textContent = err.message;
      authAlert.classList.remove("hidden");
    });
});

signupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const phone = document.getElementById("signupPhone").value.trim();
  const password = document.getElementById("signupPassword").value;
  bySignUpWithEmail(name, email, password, phone)
    .then((result) => {
      if (result && result.needsEmailConfirmation) {
        authAlert.classList.remove("hidden");
        authAlert.style.background = "#e3f3ee";
        authAlert.style.borderColor = "var(--teal)";
        authAlert.style.color = "#0f5132";
        authAlert.textContent = "Account created! Check your email for a confirmation link, then log in.";
        showTab("login");
        return;
      }
      redirectAfterAuth();
    })
    .catch((err) => {
      authAlert.textContent = err.message;
      authAlert.classList.remove("hidden");
    });
});

// Google sign-in isn't available with the custom PostgreSQL backend,
// so the button was removed from login.html — this only wires it up
// if a future version of the page brings it back.
const googleBtn = document.getElementById("googleBtn");
if (googleBtn) {
  googleBtn.addEventListener("click", () => {
    bySignInWithGoogle()
      .then(redirectAfterAuth)
      .catch((err) => {
        authAlert.textContent = err.message;
        authAlert.classList.remove("hidden");
      });
  });
}
