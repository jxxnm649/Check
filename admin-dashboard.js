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

const ovTotalEl = document.getElementById("ov-total");
const ovPendingEl = document.getElementById("ov-pending");
const ovConfirmedEl = document.getElementById("ov-confirmed");
const ovPackedEl = document.getElementById("ov-packed");
const ovShippedEl = document.getElementById("ov-shipped");
const ovDeliveredEl = document.getElementById("ov-delivered");
const ovCancelledEl = document.getElementById("ov-cancelled");
const orderOverviewGrid = document.getElementById("orderOverviewGrid");
const orderOverviewError = document.getElementById("orderOverviewError");

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

  // Orders + Order Overview
  // Status field confirmed as "status" on order documents
  // (same field checkout.js writes and admin.js/users.js already use).
  try {

    const ordersSnap = await getDocs(collection(db, "orders"));
    ordersEl.innerText = ordersSnap.size;

    let revenue = 0;
    const statusCounts = {
      Pending: 0,
      Confirmed: 0,
      Packed: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0
    };

    ordersSnap.forEach((docSnap) => {
      const order = docSnap.data();

      revenue += Number(order.total || 0);

      if (Object.prototype.hasOwnProperty.call(statusCounts, order.status)) {
        statusCounts[order.status]++;
      }
    });

    revenueEl.innerText = "₹" + revenue;
    pendingEl.innerText = statusCounts.Pending;
    deliveredEl.innerText = statusCounts.Delivered;

    ovTotalEl.innerText = ordersSnap.size;
    ovPendingEl.innerText = statusCounts.Pending;
    ovConfirmedEl.innerText = statusCounts.Confirmed;
    ovPackedEl.innerText = statusCounts.Packed;
    ovShippedEl.innerText = statusCounts.Shipped;
    ovDeliveredEl.innerText = statusCounts.Delivered;
    ovCancelledEl.innerText = statusCounts.Cancelled;

  } catch (error) {
    console.error("Order statistics load error:", error);

    if (orderOverviewGrid) orderOverviewGrid.style.display = "none";

    if (orderOverviewError) {
      orderOverviewError.textContent = "⚠️ Unable to load order statistics. Please try again.";
      orderOverviewError.style.display = "block";
    }
  }

}
