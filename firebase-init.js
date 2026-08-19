/* =========================================================
   BharatYatra — Firebase bootstrap
   Reads BY_CONFIG.firebase (set in config.js) and turns it into
   real Firebase Auth + Firestore. If you haven't pasted in your
   own Firebase project values yet, every by___ helper below just
   fails gracefully so the rest of the site still works.
   ========================================================= */

let byFirebaseReady = false;
let byAuth = null;
let byDb = null;

(function byInitFirebase() {
  const cfg = typeof BY_CONFIG !== "undefined" ? BY_CONFIG.firebase : null;
  const looksConfigured = cfg && cfg.apiKey && !cfg.apiKey.startsWith("PASTE_");

  if (!looksConfigured || typeof firebase === "undefined") {
    byFirebaseReady = false;
    return;
  }

  try {
    firebase.initializeApp(cfg);
    byAuth = firebase.auth();
    byDb = firebase.firestore();
    byFirebaseReady = true;
  } catch (err) {
    console.error("Firebase failed to initialize:", err);
    byFirebaseReady = false;
  }
})();

function byRequireAuth() {
  if (!byFirebaseReady) {
    return Promise.reject(new Error("Sign-in isn't set up yet — add your Firebase project keys to config.js."));
  }
  return Promise.resolve();
}

function bySignInWithEmail(email, password) {
  return byRequireAuth().then(() => byAuth.signInWithEmailAndPassword(email, password));
}

function bySignUpWithEmail(name, email, password, phone) {
  return byRequireAuth()
    .then(() => byAuth.createUserWithEmailAndPassword(email, password))
    .then((cred) => {
      return cred.user.updateProfile({ displayName: name }).then(() => {
        if (byDb) {
          return byDb.collection("users").doc(cred.user.uid).set({
            name, email, phone,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      }).then(() => cred);
    });
}

function bySignInWithGoogle() {
  return byRequireAuth().then(() => {
    const provider = new firebase.auth.GoogleAuthProvider();
    return byAuth.signInWithPopup(provider);
  });
}

function bySignOut() {
  if (!byFirebaseReady) return Promise.resolve();
  return byAuth.signOut();
}

function byCurrentUser() {
  return byFirebaseReady ? byAuth.currentUser : null;
}

function byOnAuthChange(callback) {
  if (!byFirebaseReady) {
    callback(null);
    return;
  }
  byAuth.onAuthStateChanged(callback);
}

function bySaveBooking(booking) {
  if (!byFirebaseReady || !byDb) {
    return Promise.reject(new Error("Database isn't set up yet — add your Firebase project keys to config.js."));
  }
  const user = byCurrentUser();
  return byDb.collection("bookings").add({
    ...booking,
    uid: user ? user.uid : null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function byIsAdminEmail(email) {
  const list = (typeof BY_CONFIG !== "undefined" && BY_CONFIG.adminEmails) || [];
  return !!email && list.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}

function byGetAllBookings(limit = 500) {
  if (!byFirebaseReady || !byDb) {
    return Promise.reject(new Error("Database isn't set up yet — add your Firebase project keys to config.js."));
  }
  return byDb.collection("bookings").orderBy("createdAt", "desc").limit(limit).get()
    .then((snap) => snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
}

function byDeleteBooking(bookingId) {
  if (!byFirebaseReady || !byDb) {
    return Promise.reject(new Error("Database isn't set up yet — add your Firebase project keys to config.js."));
  }
  return byDb.collection("bookings").doc(bookingId).delete();
}

function bySetBookingStatus(bookingId, status) {
  if (!byFirebaseReady || !byDb) {
    return Promise.reject(new Error("Database isn't set up yet — add your Firebase project keys to config.js."));
  }
  return byDb.collection("bookings").doc(bookingId).update({ status });
}

function byGetAllUsers(limit = 500) {
  if (!byFirebaseReady || !byDb) {
    return Promise.reject(new Error("Database isn't set up yet — add your Firebase project keys to config.js."));
  }
  return byDb.collection("users").orderBy("createdAt", "desc").limit(limit).get()
    .then((snap) => snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
}

function bySaveCharterRequest(request) {
  if (!byFirebaseReady || !byDb) {
    return Promise.reject(new Error("Database isn't set up yet — add your Firebase project keys to config.js."));
  }
  const user = byCurrentUser();
  return byDb.collection("charterRequests").add({
    ...request,
    uid: user ? user.uid : null,
    status: "pending",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function byGetAllCharterRequests(limit = 500) {
  if (!byFirebaseReady || !byDb) {
    return Promise.reject(new Error("Database isn't set up yet — add your Firebase project keys to config.js."));
  }
  return byDb.collection("charterRequests").orderBy("createdAt", "desc").limit(limit).get()
    .then((snap) => snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
}

function bySetCharterRequestStatus(requestId, status) {
  if (!byFirebaseReady || !byDb) {
    return Promise.reject(new Error("Database isn't set up yet — add your Firebase project keys to config.js."));
  }
  return byDb.collection("charterRequests").doc(requestId).update({ status });
}
