/* =========================================================
   BharatYatra — database client (Supabase edition)
   Talks directly to Supabase (hosted Postgres + auth), safely
   from the browser, using Row Level Security — no custom
   backend server needed. Every function here has the exact
   same name and shape as before, so booking.js, charter.js,
   admin.js, login.js, and common.js all work unchanged.

   Requires the Supabase JS SDK loaded before this file:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>

   And BY_CONFIG.supabase.url / BY_CONFIG.supabase.anonKey set in
   config.js (from your Supabase project's Settings → API page).
   ========================================================= */

const SB_URL = (typeof BY_CONFIG !== "undefined" && BY_CONFIG.supabase && BY_CONFIG.supabase.url) || null;
const SB_ANON_KEY = (typeof BY_CONFIG !== "undefined" && BY_CONFIG.supabase && BY_CONFIG.supabase.anonKey) || null;

// Kept as "byFirebaseReady" purely so every other file that already
// checks this variable name doesn't need editing — it means "the
// database is configured and reachable", nothing Firebase-specific.
let byFirebaseReady = !!(SB_URL && SB_ANON_KEY && !SB_URL.includes("PASTE") && !SB_ANON_KEY.includes("PASTE"));

let sb = null;
if (byFirebaseReady && typeof supabase !== "undefined") {
  sb = supabase.createClient(SB_URL, SB_ANON_KEY);
} else {
  byFirebaseReady = false;
}

let byCurrentUserObj = null;
let byAuthListeners = [];

function byNotifyAuthListeners() {
  byAuthListeners.forEach((cb) => cb(byCurrentUserObj));
}

function byRequireReady() {
  if (!byFirebaseReady || !sb) {
    return Promise.reject(new Error("The database isn't set up yet — add your Supabase project URL and anon key in config.js."));
  }
  return Promise.resolve();
}

function byMapUser(sessionUser, profile) {
  if (!sessionUser) return null;
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    name: (profile && profile.name) || (sessionUser.user_metadata && sessionUser.user_metadata.name) || sessionUser.email,
    phone: (profile && profile.phone) || (sessionUser.user_metadata && sessionUser.user_metadata.phone) || null
  };
}

function byLoadProfileAndSetUser(sessionUser) {
  if (!sessionUser) {
    byCurrentUserObj = null;
    byNotifyAuthListeners();
    return Promise.resolve();
  }
  return sb.from("profiles").select("*").eq("id", sessionUser.id).maybeSingle()
    .then(({ data: profile }) => {
      byCurrentUserObj = byMapUser(sessionUser, profile);
      byNotifyAuthListeners();
    });
}

if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    byLoadProfileAndSetUser(session ? session.user : null);
  });
  sb.auth.getSession().then(({ data }) => {
    byLoadProfileAndSetUser(data.session ? data.session.user : null);
  });
}

// ---- auth ----
function bySignInWithEmail(email, password) {
  return byRequireReady().then(() =>
    sb.auth.signInWithPassword({ email, password }).then(({ data, error }) => {
      if (error) throw new Error(error.message);
      return byLoadProfileAndSetUser(data.user).then(() => ({ user: byCurrentUserObj }));
    })
  );
}

function bySignUpWithEmail(name, email, password, phone) {
  return byRequireReady().then(() =>
    sb.auth.signUp({ email, password, options: { data: { name, phone } } }).then(({ data, error }) => {
      if (error) throw new Error(error.message);
      // The profile row is created automatically by a database trigger
      // (see supabase/schema.sql) the moment the account exists — so
      // this works whether or not your Supabase project requires email
      // confirmation before a session becomes active.
      if (!data.session) {
        // Account created, but needs email confirmation before login
        // works — there's no active session yet, so don't pretend
        // there's a logged-in user.
        return { user: null, needsEmailConfirmation: true };
      }
      return byLoadProfileAndSetUser(data.user).then(() => ({ user: byCurrentUserObj }));
    })
  );
}

function bySignInWithGoogle() {
  return byRequireReady().then(() => {
    // Redirects away from the page — only works if Google is enabled
    // as a provider in your Supabase project's Authentication settings.
    return sb.auth.signInWithOAuth({ provider: "google" }).then(({ error }) => {
      if (error) throw new Error(error.message);
    });
  });
}

function bySignOut() {
  if (!sb) {
    byCurrentUserObj = null;
    byNotifyAuthListeners();
    return Promise.resolve();
  }
  return sb.auth.signOut().then(() => {
    byCurrentUserObj = null;
    byNotifyAuthListeners();
  });
}

function byCurrentUser() {
  return byCurrentUserObj;
}

function byOnAuthChange(callback) {
  byAuthListeners.push(callback);
  callback(byCurrentUserObj); // fire immediately with whatever we currently know
}

function byIsAdminEmail(email) {
  const list = (typeof BY_CONFIG !== "undefined" && BY_CONFIG.adminEmails) || [];
  return !!email && list.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}

// ---- bookings ----
function bySaveBooking(booking) {
  return byRequireReady().then(() => {
    const user = byCurrentUser();
    if (!user) throw new Error("Please sign in before completing your booking.");
    return sb.from("bookings").insert({
      pnr: booking.pnr,
      user_id: user ? user.id : null,
      passenger_name: booking.passengerName,
      passenger_phone: booking.passengerPhone,
      from_city: booking.from,
      to_city: booking.to,
      journey_date: booking.date,
      operator: booking.operator,
      bus_type: booking.busType,
      departure: booking.dep,
      duration: booking.duration,
      bus_id: booking.busId,
      boarding_point: booking.boardingPoint,
      dropping_point: booking.droppingPoint,
      seats: booking.seats,
      fare_per_seat: booking.fare,
      total: booking.total,
      discount: booking.discount || 0,
      promo_code: booking.promoCode || null,
      payment_method: booking.paymentMethod,
      payment_id: booking.paymentId,
      booked_at: booking.bookedAt || new Date().toISOString()
    }).then(({ error }) => { if (error) throw new Error(error.message); });
  });
}

function byMapBookingRow(row) {
  return {
    id: row.id, pnr: row.pnr, passengerName: row.passenger_name, passengerPhone: row.passenger_phone,
    from: row.from_city, to: row.to_city, date: row.journey_date, operator: row.operator, boardingPoint: row.boarding_point, droppingPoint: row.dropping_point,
    busType: row.bus_type, dep: row.departure, duration: row.duration, seats: row.seats,
    fare: row.fare_per_seat, total: row.total, discount: row.discount, promoCode: row.promo_code, busId: row.bus_id,
    paymentMethod: row.payment_method, paymentId: row.payment_id, status: row.status, refundStatus: row.refund_status, cancelledAt: row.cancelled_at, bookedAt: row.booked_at,
    uid: row.user_id
  };
}

function byGetAllBookings(limit = 500) {
  return byRequireReady().then(() =>
    sb.from("bookings").select("*").order("booked_at", { ascending: false }).limit(limit)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data.map(byMapBookingRow);
      })
  );
}

function byGetMyBookings(limit = 500) {
  return byRequireReady().then(() => {
    const user = byCurrentUser();
    if (!user) throw new Error("Please sign in to view your bookings.");
    return sb.from("bookings").select("*").eq("user_id", user.id)
      .order("booked_at", { ascending: false }).limit(limit)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data.map(byMapBookingRow);
      });
  });
}

function byDeleteBooking(bookingId) {
  return byRequireReady().then(() =>
    sb.from("bookings").delete().eq("id", bookingId).then(({ error }) => { if (error) throw new Error(error.message); })
  );
}

function bySetBookingStatus(bookingId, status) {
  return byRequireReady().then(() =>
    sb.from("bookings").update({ status }).eq("id", bookingId).then(({ error }) => { if (error) throw new Error(error.message); })
  );
}

function byRequestBookingCancellation(bookingId) {
  return byRequireReady().then(() => sb.rpc("request_booking_cancellation", { p_booking_id: bookingId })
    .then(({ error }) => { if (error) throw new Error(error.message); }));
}

function bySaveReview(review) {
  return byRequireReady().then(() => {
    const user = byCurrentUser();
    if (!user) throw new Error("Please sign in to leave a review.");
    return sb.from("bus_reviews").insert({ booking_id: review.bookingId, user_id: user.id, rating: review.rating, comment: review.comment || null })
      .then(({ error }) => { if (error) throw new Error(error.message); });
  });
}

// ---- users (admin only — reads the profiles table) ----
function byGetAllUsers(limit = 500) {
  return byRequireReady().then(() =>
    sb.from("profiles").select("*").order("created_at", { ascending: false }).limit(limit)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data.map((r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, createdAt: r.created_at }));
      })
  );
}

// ---- charter requests + payments ----
function bySaveCharterRequest(request) {
  return byRequireReady().then(() => {
    const user = byCurrentUser();
    return sb.from("charter_requests").upsert({
      ref: request.ref,
      user_id: user ? user.id : null,
      name: request.name, phone: request.phone, email: request.email, purpose: request.purpose,
      from_city: request.from, to_city: request.to, journey_date: request.date,
      return_date: request.returnDate || null, passengers: request.passengers,
      bus_count: request.busCount || 1, bus_type: request.busType, notes: request.notes || null,
      fare_per_day: request.farePerDay, fare_total: request.fareTotal,
      requested_at: request.requestedAt || new Date().toISOString()
    }).then(({ error }) => { if (error) throw new Error(error.message); });
  });
}

function bySaveCharterPayment(payment) {
  return byRequireReady().then(() =>
    sb.from("charter_payments").insert({
      charter_ref: payment.charterRef,
      amount: payment.amount,
      payment_id: payment.paymentId,
      paid_at: payment.paidAt || new Date().toISOString()
    }).then(({ error }) => { if (error) throw new Error(error.message); })
  );
}

function byGetAllCharterRequests(limit = 500) {
  return byRequireReady().then(() =>
    sb.from("charter_requests")
      .select("*, charter_payments(amount, payment_id, paid_at)")
      .order("requested_at", { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data.map((r) => {
          const payments = (r.charter_payments || []).slice().sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at));
          const latest = payments[0];
          return {
            ref: r.ref, name: r.name, phone: r.phone, email: r.email, purpose: r.purpose,
            from: r.from_city, to: r.to_city, date: r.journey_date, returnDate: r.return_date,
            passengers: r.passengers, busCount: r.bus_count, busType: r.bus_type, notes: r.notes,
            farePerDay: r.fare_per_day, fareTotal: r.fare_total, requestedAt: r.requested_at,
            payment: latest ? { amount: latest.amount, paymentId: latest.payment_id, paidAt: latest.paid_at } : null
          };
        });
      })
  );
}

function byGetMyCharterRequests(limit = 500) {
  return byRequireReady().then(() => {
    const user = byCurrentUser();
    if (!user) throw new Error("Please sign in to view your charter requests.");
    return sb.from("charter_requests")
      .select("*, charter_payments(amount, payment_id, paid_at)")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data.map((r) => {
          const payments = (r.charter_payments || []).slice().sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at));
          const latest = payments[0];
          return {
            ref: r.ref, name: r.name, phone: r.phone, email: r.email, purpose: r.purpose,
            from: r.from_city, to: r.to_city, date: r.journey_date, returnDate: r.return_date,
            passengers: r.passengers, busCount: r.bus_count, busType: r.bus_type, notes: r.notes,
            farePerDay: r.fare_per_day, fareTotal: r.fare_total, requestedAt: r.requested_at,
            payment: latest ? { amount: latest.amount, paymentId: latest.payment_id, paidAt: latest.paid_at } : null
          };
        });
      });
  });
}

function byDeleteCharterRequest(ref) {
  return byRequireReady().then(() =>
    sb.from("charter_requests").delete().eq("ref", ref).then(({ error }) => { if (error) throw new Error(error.message); })
  );
}

// ---- real seat inventory ----
function byGetBookedSeats(busId) {
  if (!sb) return Promise.resolve([]);
  return sb.from("bus_seats").select("booked_seats").eq("bus_id", busId).maybeSingle()
    .then(({ data }) => (data && data.booked_seats) || [])
    .catch(() => []);
}

function byGetSeatInventory(busId) {
  return byRequireReady().then(() =>
    sb.from("bus_seats").select("bus_id, booked_seats, updated_at").eq("bus_id", busId).maybeSingle()
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data || { bus_id: busId, booked_seats: [], updated_at: null };
      })
  );
}

function byReserveSeats(busId, seatNumbers) {
  return byRequireReady().then(() =>
    sb.rpc("reserve_seats", { p_bus_id: busId, p_seats: seatNumbers }).then(({ error }) => {
      if (error) throw new Error(error.message);
    })
  );
}
