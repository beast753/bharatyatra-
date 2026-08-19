/* =========================================================
   BharatYatra — SITE CONFIGURATION
   Fill in your own real values below.
   ========================================================= */
const BY_CONFIG = {

  // ---- 1. Supabase (Settings -> API) ----
  // Use the browser-safe anon key only. Do not put a service_role key here.
  supabase: {
    url: "https://dcdiwwfbyetsfquhfzkr.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZGl3d2ZieWV0c2ZxdWhmemtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MzczNjcsImV4cCI6MjEwMjIxMzM2N30.GvVIn7Z01LWJSWxEmxTXq-Sr5hPUqK2ND1iwcW4B0RA"
  },

  // ---- 2. Your own UPI / GPay ID (for the scan-to-pay QR code) ----
  // This is the ID shown when you open GPay/PhonePe → "Your UPI ID"
  // e.g. "yourname@okhdfcbank" or "9876543210@okicici"
  upiId: "9833715418@fampay",
  payeeName: "",

  // ---- 3. Razorpay key (for real card / netbanking checkout) ----
  // Sign up free at https://dashboard.razorpay.com/ → Settings → API Keys
  // Start with the TEST key (starts with rzp_test_) — switch to the LIVE
  // key only after Razorpay approves your business KYC.
  razorpayKeyId: "rzp_test_PASTE_YOUR_KEY_ID",

  // ---- 4. Admin panel access ----
  // Any email listed here can access the admin page UI.
  // IMPORTANT: this is only a frontend gate. The backend also enforces
  // admin access for sensitive API routes via ADMIN_EMAILS in server/.env
  // — the two lists should match.
  adminEmails: ["b9148820@gmail.com"]
};
