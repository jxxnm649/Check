import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const ordersDiv = document.getElementById("orders");

const STATUS_OPTIONS = [
  "Pending", "Confirmed", "Packed", "Shipped",
  "Out for Delivery", "Delivered", "Cancelled"
];

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {

    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists() || userDoc.data().isAdmin !== true) {
      alert("Access Denied ❌");
      window.location.href = "home.html";
      return;
    }

    loadOrders();

  } catch (error) {
    alert(error.message);
    console.log(error);
  }

});

async function loadOrders() {

  ordersDiv.innerHTML = "<h2>Loading...</h2>";

  try {

    let querySnapshot;

    try {
      querySnapshot = await getDocs(
        query(collection(db, "orders"), orderBy("createdAt", "desc"))
      );
    } catch {
      querySnapshot = await getDocs(collection(db, "orders"));
    }

    if (querySnapshot.empty) {
      ordersDiv.innerHTML = "<h2>No Orders Found 📦</h2>";
      return;
    }

    ordersDiv.innerHTML = querySnapshot.docs.map((docSnap) => {

      const order = docSnap.data();

      const optionsHTML = STATUS_OPTIONS.map((s) =>
        `<option value="${s}" ${order.status === s ? "selected" : ""}>${s}</option>`
      ).join("");

      return `
        <div class="admin-order-card">

          <div class="order-head">
            <span class="order-id-tag">#${docSnap.id.slice(0, 8).toUpperCase()}</span>
          </div>

          <h2>${order.customerName || "Customer"}</h2>
          <p><b>Mobile:</b> ${order.mobile || ""}</p>
          <p><b>Address:</b> ${order.address || ""}</p>
          <p><b>Payment:</b> ${order.paymentMethod === "cod" ? "Cash on Delivery" : "Paid Online"}</p>
          <p><b>Total:</b> ₹${order.total ?? 0}</p>

          <label class="admin-select-label">Status</label>
          <select id="status-${docSnap.id}">
            ${optionsHTML}
          </select>

          <button data-id="${docSnap.id}" class="update-status-btn">
            Update Status
          </button>

        </div>
      `;

    }).join("");

  } catch (error) {

    alert(error.message);
    console.log(error);

  }

}

ordersDiv.addEventListener("click", async (e) => {

  const btn = e.target.closest(".update-status-btn");
  if (!btn) return;

  const id = btn.dataset.id;
  const status = document.getElementById(`status-${id}`).value;

  btn.disabled = true;
  btn.textContent = "Updating...";

  try {

    await updateDoc(doc(db, "orders", id), { status });
    alert("Status Updated ✅");
    loadOrders();

  } catch (error) {

    alert(error.message);
    btn.disabled = false;
    btn.textContent = "Update Status";

  }

});
