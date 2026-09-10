// ==================================================================
// 🔧 FIREBASE SETUP — REQUIRED BEFORE THIS SITE GOES LIVE
// ------------------------------------------------------------------
// This file is what makes bookings from ANY visitor (on any phone,
// any browser) show up instantly in Dr. Emad's dashboard. Before this,
// bookings were saved with localStorage, which is private to a single
// browser on a single device — that's why only bookings made from the
// SAME computer/browser as the dashboard were visible.
//
// Steps (free, ~5 minutes):
// 1. Go to https://console.firebase.google.com and create a new project.
// 2. In the project, click the "</>" (Web) icon to register a web app.
//    Copy the "firebaseConfig" object it gives you and paste it below,
//    replacing the placeholder values.
// 3. In the left sidebar go to "Build > Firestore Database" → Create
//    database → start in "Production mode".
// 4. In "Build > Authentication" → Sign-in method → enable
//    "Email/Password". Then go to the "Users" tab and add ONE user —
//    this is the doctor's admin login (e.g. dr.emad@clinic.com + a
//    strong password). This is what protects the dashboard.
// 5. In Firestore → Rules, paste the rules below (also included in
//    the project as firestore.rules) and click "Publish":
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /bookings/{bookingId} {
//          allow create: if true;                 // anyone can submit a booking
//          allow read, update, delete: if request.auth != null; // only logged-in admin
//        }
//      }
//    }
//
// That's it — once the config below is filled in, index.html (public
// booking form) and dashboard.html (admin panel) both talk to the same
// live database automatically.
// ==================================================================

const firebaseConfig = {
  apiKey: "AIzaSyCLhMf0o3dsDN3fj3B-3pMjPE_pa9C45dk",
  authDomain: "dr-emad-clinic.firebaseapp.com",
  projectId: "dr-emad-clinic",
  storageBucket: "dr-emad-clinic.firebasestorage.app",
  messagingSenderId: "242810670520",
  appId: "1:242810670520:web:540072f74b1de20fd8134d"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const bookingsCollection = db.collection('bookings');
