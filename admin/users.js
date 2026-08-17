import { auth, db } from "../firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import {
  openModal,
  closeModal
} from "../design-system.js";


const usersList = document.getElementById("usersList");
const userCount = document.getElementById("userCount");
const userSearch = document.getElementById("userSearch");
const userDetailsModal = document.getElementById("userDetailsModal");
const userDetailsContent = document.getElementById("userDetailsContent");
const userDetailsCloseBtn = document.getElementById("userDetailsCloseBtn");

let allUsers = [];


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
  "active", "isActive", "status", "disabled", "blocked",
  "createdAt", "created_at", "createdOn", "dateCreated"
]);

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

  const rows = [
    detailRow("Name", name),
    detailRow("Email", email),
    detailRow("Phone", phone),
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

  userDetailsContent.innerHTML = rows.join("");
}

usersList.addEventListener("click", async (e) => {
  const btn = e.target.closest(".view-details-btn");
  if (!btn) return;

  const uid = btn.dataset.uid;
  const cachedUser = allUsers.find(u => u.id === uid);
  if (!cachedUser) return;

  // Show cached data immediately so the modal opens without delay,
  // then refresh with the live Firestore document underneath it.
  renderUserDetails(cachedUser);
  openModal("userDetailsModal");

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

userDetailsCloseBtn.addEventListener("click", () => {
  closeModal("userDetailsModal");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && userDetailsModal.classList.contains("bf-open")) {
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
