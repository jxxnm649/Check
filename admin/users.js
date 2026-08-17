import { auth, db } from "../firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";


const usersList = document.getElementById("usersList");
const userCount = document.getElementById("userCount");
const userSearch = document.getElementById("userSearch");

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

      </div>

    `;

  }).join("");

}


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
