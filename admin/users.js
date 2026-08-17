import { auth, db } from "../firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import {
  openModal,
  closeModal,
  showToast
} from "../design-system.js";


const usersList = document.getElementById("usersList");
const userCount = document.getElementById("userCount");
const userSearch = document.getElementById("userSearch");
const userDetailsModal = document.getElementById("userDetailsModal");
const userDetailsContent = document.getElementById("userDetailsContent");
const userDetailsCloseBtn = document.getElementById("userDetailsCloseBtn");
const orderDetailsModal = document.getElementById("orderDetailsModal");
const orderDetailsContent = document.getElementById("orderDetailsContent");
const orderDetailsCloseBtn = document.getElementById("orderDetailsCloseBtn");

let allUsers = [];
let currentDetailsUserId = null;
let currentOrdersState = { uid: null, status: "idle", orders: [] };


/* =========================
   LOAD USERS
========================= */

async function loadUsers() {

  try {

    const snapshot =
      await getDocs(
        collection(db, "users")
      );

    allUsers = [];

    snapshot.forEach(doc => {

      allUsers.push({
        id: doc.id,
        ...doc.data()
      });

    });

    userCount.textContent =
      `Total Users: ${allUsers.length}`;

    renderUsers(allUsers);

  } catch (error) {

    console.error(
      "Users loading error:",
      error
    );

    usersList.innerHTML = `
      <div class="bf-card" style="padding:20px;">
        ❌ Unable to load users.
      </div>
    `;

  }

}


/* =========================
   RENDER USERS
========================= */

function renderUsers(users) {

  if (!users.length) {

    usersList.innerHTML = `
      <div class="bf-card" style="padding:20px;">
        No users found.
      </div>
    `;

    return;
  }


  usersList.innerHTML = users.map(user => {

    const name =
      user.name ||
      user.fullName ||
      user.displayName ||
      "Unnamed User";

    const email =
      user.email ||
      "No email";

    const phone =
      user.phone ||
      user.mobile ||
      "No phone";

    return `

      <div
        class="bf-card"
        style="
          padding:18px;
          margin-bottom:12px;
        ">

        <div style="
          display:flex;
          justify-content:space-between;
          gap:15px;
          align-items:flex-start;
        ">

          <div>

            <div style="
              font-size:18px;
              font-weight:700;
              margin-bottom:6px;
            ">
              👤 ${escapeHtml(name)}
            </div>

            <div style="margin-bottom:4px;">
              📧 ${escapeHtml(email)}
            </div>

            <div style="margin-bottom:4px;">
              📱 ${escapeHtml(phone)}
            </div>

            <div style="
              font-size:12px;
              opacity:.65;
              word-break:break-all;
            ">
              UID: ${escapeHtml(user.id)}
            </div>

          </div>

          <span style="
            padding:5px 10px;
            border-radius:20px;
            background:#e8f5e9;
            font-size:12px;
          ">
            Active
          </span>

        </div>

        <div style="margin-top:14px;">
          <button
            type="button"
            class="bf-btn bf-btn-ghost bf-btn-sm view-details-btn"
            data-uid="${escapeHtml(user.id)}">
            View Details
          </button>
        </div>

      </div>

    `;

  }).join("");

}


/* =========================
   USER DETAILS MODAL
========================= */

// Field keys already shown as dedicated rows in the modal —
// excluded from the generic "other fields" list so nothing repeats.
const DETAILS_HANDLED_KEYS = new Set([
  "name", "fullName", "displayName",
  "email",
  "phone", "mobile",
  "address",
  "active", "isActive", "status", "disabled", "blocked",
  "createdAt", "created_at", "createdOn", "dateCreated"
]);

// Existing documents use different field names for the same thing
// (e.g. "name" vs "fullName", "phone" vs "mobile"). Editing must write
// back to whichever field the document already uses, instead of
// creating a duplicate new field.
function getNameField(user) {
  if (user.fullName !== undefined) return "fullName";
  if (user.displayName !== undefined) return "displayName";
  return "name";
}

function getPhoneField(user) {
  if (user.mobile !== undefined) return "mobile";
  return "phone";
}

// Keeps whichever status representation the document already uses
// (boolean "active" or string "status") in sync, so getAccountStatus()
// keeps reading it correctly after the edit.
function buildStatusUpdate(user, isActive) {
  if (typeof user.status === "string" && user.active === undefined) {
    return { status: isActive ? "active" : "inactive" };
  }
  return { active: isActive };
}

function formatFieldLabel(key) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, s => s.toUpperCase());
}

function formatDateValue(value) {
  // Firestore Timestamp objects expose toDate()
  if (value && typeof value.toDate === "function") {
    return value.toDate().toLocaleString();
  }
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  return String(value);
}

function getAccountStatus(user) {
  if (typeof user.active === "boolean") {
    return user.active ? "Active" : "Inactive";
  }

  if (typeof user.status === "string" && user.status.trim() !== "") {
    const normalized = user.status.trim().toLowerCase();
    if (normalized === "active") return "Active";
    if (normalized === "inactive") return "Inactive";
    return user.status; // some other explicit status value — show as-is
  }

  if (typeof user.isActive === "boolean") return user.isActive ? "Active" : "Inactive";
  if (typeof user.disabled === "boolean") return user.disabled ? "Disabled" : "Active";
  if (typeof user.blocked === "boolean") return user.blocked ? "Blocked" : "Active";

  return "Not available";
}

function getCreatedDate(user) {
  const value = user.createdAt || user.created_at || user.createdOn || user.dateCreated;
  if (!value) return "Not available";
  try {
    return formatDateValue(value);
  } catch {
    return "Not available";
  }
}

function detailRow(label, value) {
  return `
    <div style="
      display:flex;
      justify-content:space-between;
      gap:12px;
      padding:10px 0;
      border-bottom:1px solid var(--line, #eee);
    ">
      <span style="font-weight:600;color:var(--ink-soft, #555);">${escapeHtml(label)}</span>
      <span style="text-align:right;word-break:break-word;">${escapeHtml(value)}</span>
    </div>
  `;
}

function renderUserDetails(user) {
  const name = user.name || user.fullName || user.displayName || "Not available";
  const email = user.email || "Not available";
  const phone = user.phone || user.mobile || "Not available";
  const address = user.address || "Not available";

  const rows = [
    detailRow("Name", name),
    detailRow("Email", email),
    detailRow("Phone", phone),
    detailRow("Address", address),
    detailRow("UID", user.id),
    detailRow("Account status", getAccountStatus(user)),
    detailRow("User document ID", user.id),
    detailRow("Created date", getCreatedDate(user)),
  ];

  // Any other existing Firestore fields not already shown above.
  Object.keys(user)
    .filter(key => key !== "id" && !DETAILS_HANDLED_KEYS.has(key))
    .forEach(key => {
      const raw = user[key];
      const value = (raw === null || raw === undefined || raw === "")
        ? "Not available"
        : (typeof raw === "object" ? JSON.stringify(raw) : String(raw));
      rows.push(detailRow(formatFieldLabel(key), value));
    });

  userDetailsContent.innerHTML = `
    ${rows.join("")}
    <div style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
      <button type="button" class="bf-btn bf-btn-secondary bf-btn-sm edit-user-btn">
        ✏️ Edit User
      </button>
      <button type="button" class="bf-btn bf-btn-danger bf-btn-sm delete-user-btn">
        🗑️ Delete User
      </button>
    </div>

    <div style="margin-top:24px;">
      <h3 style="font-size:15px;margin:0 0 10px;">📦 Orders</h3>
      <div id="userOrdersList">
        ${renderOrdersSectionHTML(user.id)}
      </div>
    </div>
  `;
}

/* =========================
   USER ORDERS SECTION
========================= */

function getOrderStatusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("cancel")) return "bf-status-danger";
  if (s.includes("deliver")) return "bf-status-success";
  if (s.includes("ship") || s.includes("out for delivery")) return "bf-status-progress";
  if (s.includes("confirm") || s.includes("pack")) return "bf-status-warning";
  return "bf-status-pending"; // Pending / Ordered / anything else
}

function renderOrderRow(order) {
  const shortId = String(order.id).slice(0, 8).toUpperCase();
  const amount = order.total ?? order.totalPrice ?? "Not available";

  const productName = Array.isArray(order.products) && order.products.length
    ? order.products.map(p => p.productName || "Product").join(", ")
    : "Not available";

  const status = order.status || "Not available";
  const date = getCreatedDate(order);

  return `
    <div class="bf-card" style="padding:14px; margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
        <span style="font-weight:700; font-size:13px;">#${escapeHtml(shortId)}</span>
        <span class="bf-status-pill ${getOrderStatusClass(status)}">${escapeHtml(status)}</span>
      </div>
      <p style="margin:8px 0 4px; font-size:14px;">${escapeHtml(productName)}</p>
      <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--ink-soft, #555);">
        <span>${amount === "Not available" ? "Not available" : "₹" + escapeHtml(String(amount))}</span>
        <span>${escapeHtml(date)}</span>
      </div>
      <div style="margin-top:10px;">
        <button
          type="button"
          class="bf-btn bf-btn-ghost bf-btn-sm view-order-btn"
          data-order-id="${escapeHtml(order.id)}">
          View Order
        </button>
      </div>
    </div>
  `;
}

// Renders whatever the current known state is for this user's orders —
// idle/loading placeholder, error message, empty state, or the list.
function renderOrdersSectionHTML(uid) {
  if (currentOrdersState.uid !== uid || currentOrdersState.status === "loading") {
    return `<p class="bf-state-text">Loading orders...</p>`;
  }

  if (currentOrdersState.status === "error") {
    return `<p class="bf-state-text">⚠️ Unable to load orders. Please try again.</p>`;
  }

  if (!currentOrdersState.orders.length) {
    return `<p class="bf-state-text">No orders found</p>`;
  }

  return currentOrdersState.orders.map(renderOrderRow).join("");
}

function updateOrdersContainer() {
  const container = document.getElementById("userOrdersList");
  if (container) container.innerHTML = renderOrdersSectionHTML(currentDetailsUserId);
}

// Fields already shown as dedicated rows below — everything else on
// the order document is auto-listed so nothing genuinely present
// gets hidden, without inventing rows for fields that don't exist.
const ORDER_HANDLED_KEYS = new Set([
  "userId", "mobile", "phone", "address", "products",
  "total", "totalPrice", "status",
  "createdAt", "updatedAt", "modifiedAt", "cancelledAt"
]);

function renderOrderDetails(order) {
  const rows = [
    detailRow("Order ID", order.id),
    detailRow("Customer/User ID", order.userId || "Not available"),
  ];

  if (Array.isArray(order.products) && order.products.length) {
    order.products.forEach((product, index) => {
      const suffix = order.products.length > 1 ? ` (Item ${index + 1})` : "";
      rows.push(detailRow(`Product name${suffix}`, product.productName || "Not available"));
      rows.push(detailRow(`Quantity${suffix}`, product.qty !== undefined ? String(product.qty) : "Not available"));
      rows.push(detailRow(`Price${suffix}`, product.price !== undefined ? `₹${product.price}` : "Not available"));
    });
  } else {
    rows.push(detailRow("Product name", "Not available"));
    rows.push(detailRow("Quantity", "Not available"));
    rows.push(detailRow("Price", "Not available"));
  }

  const total = order.total ?? order.totalPrice;
  rows.push(detailRow("Total amount", total !== undefined ? `₹${total}` : "Not available"));
  rows.push(detailRow("Order status", order.status || "Not available"));
  rows.push(detailRow("Payment status", "Not available")); // no such field exists on order documents
  rows.push(detailRow("Delivery address", order.address || "Not available"));
  rows.push(detailRow("Phone", order.mobile || order.phone || "Not available"));
  rows.push(detailRow("Created date", getCreatedDate(order)));

  const updatedValue = order.updatedAt || order.modifiedAt || order.cancelledAt;
  rows.push(detailRow("Updated date", updatedValue ? formatDateValue(updatedValue) : "Not available"));

  // Any other existing fields on this order document (e.g. paymentMethod, paymentId, customerName).
  Object.keys(order)
    .filter(key => key !== "id" && !ORDER_HANDLED_KEYS.has(key))
    .forEach(key => {
      const raw = order[key];
      let value;
      if (raw === null || raw === undefined || raw === "") value = "Not available";
      else if (raw && typeof raw.toDate === "function") value = formatDateValue(raw);
      else if (typeof raw === "object") value = JSON.stringify(raw);
      else value = String(raw);
      rows.push(detailRow(formatFieldLabel(key), value));
    });

  orderDetailsContent.innerHTML = rows.join("");
}

// Fetches orders for this user from Firestore. Matches the "userId"
// field, which is what order documents actually use (confirmed in
// checkout.js / orders.js / admin.js) — not "uid" or "customerId".
async function loadUserOrders(uid) {
  currentOrdersState = { uid, status: "loading", orders: [] };
  updateOrdersContainer();

  try {
    const q = query(collection(db, "orders"), where("userId", "==", uid));
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    if (currentDetailsUserId === uid) {
      currentOrdersState = { uid, status: "loaded", orders };
      updateOrdersContainer();
    }
  } catch (error) {
    console.error("User orders fetch error:", error);
    if (currentDetailsUserId === uid) {
      currentOrdersState = { uid, status: "error", orders: [] };
      updateOrdersContainer();
    }
  }
}

function renderEditUserForm(user) {
  const name = user.name || user.fullName || user.displayName || "";
  const phone = user.phone || user.mobile || "";
  const address = user.address || "";
  const isActiveNow = getAccountStatus(user) !== "Inactive";

  userDetailsContent.innerHTML = `
    <form id="editUserForm">

      <div class="bf-field">
        <label class="bf-label">Name</label>
        <input type="text" class="bf-input" id="editName" value="${escapeHtml(name)}" required>
      </div>

      <div class="bf-field">
        <label class="bf-label">Email (read-only)</label>
        <input type="email" class="bf-input" value="${escapeHtml(user.email || "")}" readonly disabled>
      </div>

      <div class="bf-field">
        <label class="bf-label">Phone</label>
        <input type="text" class="bf-input" id="editPhone" value="${escapeHtml(phone)}">
      </div>

      <div class="bf-field">
        <label class="bf-label">Address</label>
        <textarea class="bf-textarea" id="editAddress">${escapeHtml(address)}</textarea>
      </div>

      <div class="bf-field">
        <label class="bf-label">Account Status</label>
        <select class="bf-select" id="editStatus">
          <option value="active" ${isActiveNow ? "selected" : ""}>Active</option>
          <option value="inactive" ${!isActiveNow ? "selected" : ""}>Inactive</option>
        </select>
      </div>

      <div class="bf-field">
        <label class="bf-label">UID (read-only)</label>
        <input type="text" class="bf-input" value="${escapeHtml(user.id)}" readonly disabled>
      </div>

      <div style="display:flex; gap:10px; margin-top:16px;">
        <button type="submit" class="bf-btn bf-btn-primary" id="saveUserBtn">Save Changes</button>
        <button type="button" class="bf-btn bf-btn-ghost cancel-edit-btn">Cancel</button>
      </div>

    </form>
  `;
}

async function saveUserChanges(uid) {
  const user = allUsers.find(u => u.id === uid);
  if (!user) return;

  const saveBtn = document.getElementById("saveUserBtn");
  const newName = document.getElementById("editName").value.trim();
  const newPhone = document.getElementById("editPhone").value.trim();
  const newAddress = document.getElementById("editAddress").value.trim();
  const isActive = document.getElementById("editStatus").value === "active";

  if (!newName) {
    showToast("Name cannot be empty", "danger");
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const updatePayload = {
      [getNameField(user)]: newName,
      [getPhoneField(user)]: newPhone,
      address: newAddress,
      ...buildStatusUpdate(user, isActive)
    };

    await updateDoc(doc(db, "users", uid), updatePayload);

    const updatedUser = { ...user, ...updatePayload };
    const index = allUsers.findIndex(u => u.id === uid);
    if (index !== -1) allUsers[index] = updatedUser;

    showToast("User updated successfully", "success");
    renderUserDetails(updatedUser);

    // Refresh the list behind the modal, respecting any active search filter.
    userSearch.dispatchEvent(new Event("input"));

  } catch (error) {
    console.error("Update user error:", error);
    showToast(error.message || "Failed to update user. Please try again.", "danger");
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Changes";
  }
}

function renderDeleteConfirm(user) {
  const name = user.name || user.fullName || user.displayName || "Unnamed User";
  const email = user.email || "No email";

  userDetailsContent.innerHTML = `
    <div class="bf-state bf-state-error" style="padding:8px 0 16px;">
      <div class="bf-state-icon">⚠️</div>
      <p class="bf-state-title">Are you sure you want to delete this user?</p>
      <p class="bf-state-text">
        <strong>${escapeHtml(name)}</strong><br>
        ${escapeHtml(email)}
      </p>
      <p class="bf-state-text" style="font-size:12px;">
        This will permanently delete the Firestore user document. This action cannot be undone.
      </p>
    </div>

    <div style="display:flex; gap:10px; flex-wrap:wrap;">
      <button type="button" class="bf-btn bf-btn-danger bf-btn-sm confirm-delete-btn">
        🗑️ Delete User
      </button>
      <button type="button" class="bf-btn bf-btn-ghost bf-btn-sm cancel-delete-btn">
        Cancel
      </button>
    </div>
  `;
}

async function deleteUser(uid) {
  const confirmBtn = document.querySelector(".confirm-delete-btn");
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Deleting...";
  }

  try {
    await deleteDoc(doc(db, "users", uid));

    allUsers = allUsers.filter(u => u.id !== uid);
    currentDetailsUserId = null;
    currentOrdersState = { uid: null, status: "idle", orders: [] };

    showToast("User deleted successfully", "success");
    closeModal("userDetailsModal");

    userCount.textContent = `Total Users: ${allUsers.length}`;
    userSearch.dispatchEvent(new Event("input"));

  } catch (error) {
    console.error("Delete user error:", error);
    showToast(error.message || "Failed to delete user. Please try again.", "danger");

    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "🗑️ Delete User";
    }
  }
}

usersList.addEventListener("click", async (e) => {
  const btn = e.target.closest(".view-details-btn");
  if (!btn) return;

  const uid = btn.dataset.uid;
  const cachedUser = allUsers.find(u => u.id === uid);
  if (!cachedUser) return;

  currentDetailsUserId = uid;

  // Show cached data immediately so the modal opens without delay,
  // then refresh with the live Firestore document underneath it.
  renderUserDetails(cachedUser);
  openModal("userDetailsModal");
  loadUserOrders(uid);

  try {
    const userSnap = await getDoc(doc(db, "users", uid));

    if (userSnap.exists()) {
      const freshUser = { id: userSnap.id, ...userSnap.data() };

      const index = allUsers.findIndex(u => u.id === uid);
      if (index !== -1) allUsers[index] = freshUser;

      renderUserDetails(freshUser);
    }
  } catch (error) {
    console.error("User details fetch error:", error);
    // Keep showing the already-rendered cached data — no UI break.
  }
});

userDetailsContent.addEventListener("click", (e) => {
  if (e.target.closest(".edit-user-btn")) {
    const user = allUsers.find(u => u.id === currentDetailsUserId);
    if (user) renderEditUserForm(user);
    return;
  }

  if (e.target.closest(".cancel-edit-btn")) {
    const user = allUsers.find(u => u.id === currentDetailsUserId);
    if (user) renderUserDetails(user);
    return;
  }

  if (e.target.closest(".delete-user-btn")) {
    const user = allUsers.find(u => u.id === currentDetailsUserId);
    if (user) renderDeleteConfirm(user);
    return;
  }

  if (e.target.closest(".cancel-delete-btn")) {
    const user = allUsers.find(u => u.id === currentDetailsUserId);
    if (user) renderUserDetails(user);
    return;
  }

  if (e.target.closest(".confirm-delete-btn")) {
    if (currentDetailsUserId) deleteUser(currentDetailsUserId);
    return;
  }

  const viewOrderBtn = e.target.closest(".view-order-btn");
  if (viewOrderBtn) {
    const orderId = viewOrderBtn.dataset.orderId;
    const order = currentOrdersState.orders.find(o => o.id === orderId);
    if (order) {
      renderOrderDetails(order);
      openModal("orderDetailsModal");
    }
    return;
  }
});

userDetailsContent.addEventListener("submit", (e) => {
  if (!e.target.closest("#editUserForm")) return;
  e.preventDefault();
  if (currentDetailsUserId) saveUserChanges(currentDetailsUserId);
});

userDetailsCloseBtn.addEventListener("click", () => {
  closeModal("userDetailsModal");
});

orderDetailsCloseBtn.addEventListener("click", () => {
  closeModal("orderDetailsModal");
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  if (orderDetailsModal.classList.contains("bf-open")) {
    closeModal("orderDetailsModal");
    return;
  }

  if (userDetailsModal.classList.contains("bf-open")) {
    closeModal("userDetailsModal");
  }
});


/* =========================
   SEARCH
========================= */

userSearch.addEventListener(
  "input",
  () => {

    const search =
      userSearch.value
        .trim()
        .toLowerCase();


    if (!search) {

      renderUsers(allUsers);
      return;

    }


    const filtered =
      allUsers.filter(user => {

        const text = `
          ${user.name || ""}
          ${user.fullName || ""}
          ${user.displayName || ""}
          ${user.email || ""}
          ${user.phone || ""}
          ${user.mobile || ""}
          ${user.id || ""}
        `.toLowerCase();

        return text.includes(search);

      });


    renderUsers(filtered);

  }
);


/* =========================
   HTML SAFETY
========================= */

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* =========================
   ADMIN AUTH CHECK
========================= */

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {

      window.location.href =
        "../login.html";

      return;

    }


    try {

      const tokenResult =
        await user.getIdTokenResult(true);

      if (tokenResult.claims.admin !== true) {

        window.location.href =
          "index.html";

        return;

      }


      await loadUsers();

    } catch (error) {

      console.error(error);

      window.location.href =
        "index.html";

    }

  }
);
