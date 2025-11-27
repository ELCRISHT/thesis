import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDAkWmcEYhwIrrKA0K5Pfam9Jaa_IWpZXg",
  authDomain: "dp-intelligrade.firebaseapp.com",
  databaseURL: "https://dp-intelligrade-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "dp-intelligrade",
  storageBucket: "dp-intelligrade.firebasestorage.app",
  messagingSenderId: "420592976258",
  appId: "1:420592976258:web:69ac0000ebf13973cdcf9b",
  measurementId: "G-8K24KV5Q3Z"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
