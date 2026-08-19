/* =========================================================
   BharatYatra — API INIT (Backend wrapper)
   Minimal replacement for firebase-init.js that talks to the local
   Node/SQLite backend API. Provides the `by*` helpers used by the UI.
   ========================================================= */

let _byToken = localStorage.getItem('by_token') || null;
let _byUser = localStorage.getItem('by_user') ? JSON.parse(localStorage.getItem('by_user')) : null;
const _authListeners = [];

function _saveAuth(token, user) {
  _byToken = token;
  _byUser = user || null;
  if (token) localStorage.setItem('by_token', token); else localStorage.removeItem('by_token');
  if (user) localStorage.setItem('by_user', JSON.stringify(user)); else localStorage.removeItem('by_user');
  _authListeners.forEach((cb) => { try { cb(_byUser); } catch (e) {} });
}

function _authFetch(url, opts = {}) {
  opts.headers = opts.headers || {};
  if (_byToken) opts.headers['Authorization'] = `Bearer ${_byToken}`;
  if (!opts.headers['Content-Type'] && opts.body && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  return fetch(url, opts).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || res.statusText || 'Request failed');
    }
    return res.json().catch(() => ({}));
  });
}

// ---- Auth helpers ----
function byRequireAuth() {
  return _byToken ? Promise.resolve() : Promise.reject(new Error('Not authenticated'));
}

function bySignInWithEmail(email, password) {
  return _authFetch('/api/auth/login', { method: 'POST', body: { email, password } })
    .then((data) => {
      if (data && data.token) {
        _saveAuth(data.token, data.user || null);
        return data;
      }
      throw new Error('Login failed');
    });
}

function bySignUpWithEmail(name, email, password, phone) {
  return _authFetch('/api/auth/signup', { method: 'POST', body: { name, email, password, phone } })
    .then((data) => {
      if (data && data.token) {
        _saveAuth(data.token, data.user || null);
        return data;
      }
      throw new Error('Signup failed');
    });
}

function bySignInWithGoogle() {
  return Promise.reject(new Error('Google Sign-In not supported in local backend. Use email/password.'));
}

function bySignOut() {
  _saveAuth(null, null);
  return Promise.resolve();
}

function byCurrentUser() {
  return _byUser;
}

function byOnAuthChange(cb) {
  if (typeof cb === 'function') {
    _authListeners.push(cb);
    try { cb(_byUser); } catch (e) {}
  }
}

function byIsAdminEmail(email) {
  const list = (typeof BY_CONFIG !== 'undefined' && BY_CONFIG.adminEmails) || [];
  return !!email && list.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}

// ---- Bookings / Users API wrappers ----
function bySaveBooking(booking) {
  return byRequireAuth().then(() => _authFetch('/api/bookings', { method: 'POST', body: booking }));
}

function byGetAllBookings() {
  // Admin: GET /api/admin/bookings, else reject
  if (!_byToken) return Promise.reject(new Error('Not authenticated'));
  if (_byUser && _byUser.isAdmin) {
    return _authFetch('/api/admin/bookings');
  }
  // For non-admin, fetch user bookings
  return _authFetch('/api/bookings').then((rows) => rows);
}

function byDeleteBooking(bookingId) {
  return byRequireAuth().then(() => _authFetch(`/api/admin/bookings/${bookingId}`, { method: 'DELETE' }));
}

function bySetBookingStatus(bookingId, status) {
  return byRequireAuth().then(() => _authFetch(`/api/admin/bookings/${bookingId}/status`, { method: 'PATCH', body: { status } }));
}

function byGetAllUsers() {
  return byRequireAuth().then(() => {
    if (!_byUser || !_byUser.isAdmin) return Promise.reject(new Error('Admin required'));
    return _authFetch('/api/admin/users');
  });
}

// Export small helpers for pages that still rely on localStorage backups
if (typeof window !== 'undefined') {
  window.byRequireAuth = byRequireAuth;
  window.bySignInWithEmail = bySignInWithEmail;
  window.bySignUpWithEmail = bySignUpWithEmail;
  window.bySignInWithGoogle = bySignInWithGoogle;
  window.bySignOut = bySignOut;
  window.byCurrentUser = byCurrentUser;
  window.byOnAuthChange = byOnAuthChange;
  window.bySaveBooking = bySaveBooking;
  window.byGetAllBookings = byGetAllBookings;
  window.byDeleteBooking = byDeleteBooking;
  window.bySetBookingStatus = bySetBookingStatus;
  window.byGetAllUsers = byGetAllUsers;
  window.byIsAdminEmail = byIsAdminEmail;
}

console.log('api-init.js loaded — using backend API for auth/bookings');
