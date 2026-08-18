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
let orderSearchTerm = "";
let orderStatusFilter = "All Status";


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

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
        <input
          type="search"
          id="orderSearchInput"
          class="bf-input"
          placeholder="Search orders..."
          value="${escapeHtml(orderSearchTerm)}"
          style="flex:1; min-width:160px;">

        <select id="orderStatusFilterSelect" class="bf-select" style="max-width:170px;">
          <option value="All Status" ${orderStatusFilter === "All Status" ? "selected" : ""}>All Status</option>
          ${ORDER_STATUS_OPTIONS.map(opt =>
            `<option value="${opt}" ${orderStatusFilter === opt ? "selected" : ""}>${opt}</option>`
          ).join("")}
        </select>
      </div>

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

// Filters the already-loaded orders in memory — no new Firestore query.
function getFilteredOrders() {
  let list = currentOrdersState.orders;

  if (orderStatusFilter !== "All Status") {
    list = list.filter(o => o.status === orderStatusFilter);
  }

  const term = orderSearchTerm.trim().toLowerCase();
  if (term) {
    list = list.filter(o => {
      const productNames = Array.isArray(o.products)
        ? o.products.map(p => p.productName || "").join(" ")
        : "";
      const searchable = `
        ${o.id || ""}
        ${productNames}
        ${o.customerName || ""}
        ${o.mobile || o.phone || ""}
      `.toLowerCase();
      return searchable.includes(term);
    });
  }

  return list;
}

// Renders whatever the current known state is for this user's orders —
// idle/loading placeholder, error message, empty state, or the
// (search/filter-applied) list.
function renderOrdersSectionHTML(uid) {
  if (currentOrdersState.uid !== uid || currentOrdersState.status === "loading") {
    return `<p class="bf-state-text">Loading orders...</p>`;
  }

  if (currentOrdersState.status === "error") {
    return `<p class="bf-state-text">⚠️ Unable to load orders. Please try again.</p>`;
  }

  const filtered = getFilteredOrders();

  if (!filtered.length) {
    return `<p class="bf-state-text">No orders found</p>`;
  }

  return filtered.map(renderOrderRow).join("");
}

function updateOrdersContainer() {
  const container = document.getElementById("userOrdersList");
  if (container) container.innerHTML = renderOrdersSectionHTML(currentDetailsUserId);
}

const ORDER_STATUS_OPTIONS = ["Pending", "Confirmed", "Packed", "Shipped", "Delivered", "Cancelled"];
const PAYMENT_STATUS_OPTIONS = ["Pending", "Paid", "Failed", "Refunded"];

// Fields already shown as dedicated rows below — everything else on
// the order document is auto-listed so nothing genuinely present
// gets hidden, without inventing rows for fields that don't exist.
const ORDER_HANDLED_KEYS = new Set([
  "userId", "mobile", "phone", "address", "products",
  "total", "totalPrice", "status", "paymentStatus",
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
  rows.push(detailRow("Payment status", order.paymentStatus || "Not available"));
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

  orderDetailsContent.innerHTML = `
    ${rows.join("")}
    <div class="bf-field" style="margin-top:16px;">
      <label class="bf-label">Update Order Status</label>
      <select class="bf-select" id="orderStatusSelect">
        ${ORDER_STATUS_OPTIONS.map(opt =>
          `<option value="${opt}" ${order.status === opt ? "selected" : ""}>${opt}</option>`
        ).join("")}
      </select>
    </div>
    <div style="margin-top:10px;">
      <button
        type="button"
        class="bf-btn bf-btn-primary bf-btn-sm"
        id="saveOrderStatusBtn"
        data-order-id="${escapeHtml(order.id)}">
        Save Status
      </button>
    </div>

    <div class="bf-field" style="margin-top:16px;">
      <label class="bf-label">Update Payment Status</label>
      <select class="bf-select" id="paymentStatusSelect">
        ${PAYMENT_STATUS_OPTIONS.map(opt =>
          `<option value="${opt}" ${(order.paymentStatus || PAYMENT_STATUS_OPTIONS[0]) === opt ? "selected" : ""}>${opt}</option>`
        ).join("")}
      </select>
    </div>
    <div style="margin-top:10px;">
      <button
        type="button"
        class="bf-btn bf-btn-primary bf-btn-sm"
        id="savePaymentStatusBtn"
        data-order-id="${escapeHtml(order.id)}">
        Save Payment Status
      </button>
    </div>
  `;
}

// Updates the "status" field — confirmed as the actual field name
// used on order documents (checkout.js writes it, orders.js and the
// existing admin.js orders page both read/update it the same way).
async function saveOrderStatus(orderId) {
  const select = document.getElementById("orderStatusSelect");
  const saveBtn = document.getElementById("saveOrderStatusBtn");
  if (!select || !saveBtn) return;

  const newStatus = select.value;

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    await updateDoc(doc(db, "orders", orderId), { status: newStatus });

    // Keep the cached order data in sync so both the modal and the
    // list behind it reflect the new status immediately.
    const orderIndex = currentOrdersState.orders.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
      currentOrdersState.orders[orderIndex] = {
        ...currentOrdersState.orders[orderIndex],
        status: newStatus
      };
    }

    showToast("Order status updated successfully", "success");

    const updatedOrder = currentOrdersState.orders[orderIndex];
    if (updatedOrder) renderOrderDetails(updatedOrder);

    updateOrdersContainer();

  } catch (error) {
    console.error("Order status update error:", error);
    showToast(error.message || "Failed to update order status. Please try again.", "danger");
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Status";
  }
}

// Order documents have no existing payment-status field (only
// "paymentMethod" and, for online payments, "paymentId" — neither
// represents a Pending/Paid/Failed/Refunded state). Per the task,
// a new "paymentStatus" field is added, following the same naming
// convention as the existing "status"/"paymentMethod"/"paymentId" fields.
async function savePaymentStatus(orderId) {
  const select = document.getElementById("paymentStatusSelect");
  const saveBtn = document.getElementById("savePaymentStatusBtn");
  if (!select || !saveBtn) return;

  const newPaymentStatus = select.value;

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    await updateDoc(doc(db, "orders", orderId), { paymentStatus: newPaymentStatus });

    const orderIndex = currentOrdersState.orders.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
      currentOrdersState.orders[orderIndex] = {
        ...currentOrdersState.orders[orderIndex],
        paymentStatus: newPaymentStatus
      };
    }

    showToast("Payment status updated successfully", "success");

    const updatedOrder = currentOrdersState.orders[orderIndex];
    if (updatedOrder) renderOrderDetails(updatedOrder);

    updateOrdersContainer();

  } catch (error) {
    console.error("Payment status update error:", error);
    showToast(error.message || "Failed to update payment status. Please try again.", "danger");
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Payment Status";
  }
}

// Fetches orders for this user from Firestore. Matches the "userId"
// field, which is what order documen
