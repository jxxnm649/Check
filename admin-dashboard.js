import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
const usersEl = document.getElementById("users");
const productsEl = document.getElementById("products");
const ordersEl = document.getElementById("orders");
const revenueEl = document.getElementById("revenue");
const pendingEl = document.getElementById("pending");
const deliveredEl = document.getElementById("delivered");

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const userDoc = await getDoc(doc(db, "users", user.uid));

  if (!userDoc.exists() || userDoc.data().isAdmin !== true) {
    alert("Access Denied ❌");
    window.location.href = "home.html";
    return;
  }

  loadDashboard();

});

async function loadDashboard() {

  // Users
  const usersSnap = await getDocs(collection(db, "users"));
  usersEl.innerText = usersSnap.size;

  // Products
  const productsSnap = await getDocs(collection(db, "products"));
  productsEl.innerText = productsSnap.size;

  // Orders
  const ordersSnap = await getDocs(collection(db, "orders"));
  ordersEl.innerText = ordersSnap.size;

  let revenue = 0;
  let pending = 0;
  let delivered = 0;

  ordersSnap.forEach((docSnap) => {

    const order = docSnap.data();

    revenue += Number(order.total || 0);

    if (order.status === "Pending") {
      pending++;
    }

    if (order.status === "Delivered") {
      delivered++;
    }

  });

  revenueEl.innerText = "₹" + revenue;
  pendingEl.innerText = pending;
  deliveredEl.innerText = delivered;

}
