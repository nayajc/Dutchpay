// Firebase 설정 및 초기화
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCfHxGdqI7moXfxKNKEIdL7TohUWCcypBA",
  authDomain: "kkdutchpay.firebaseapp.com",
  databaseURL: "https://kkdutchpay-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kkdutchpay",
  storageBucket: "kkdutchpay.firebasestorage.app",
  messagingSenderId: "674132184092",
  appId: "1:674132184092:web:0eefa16ca7396024e723d9",
  measurementId: "G-DW4DNDD6P9"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };
