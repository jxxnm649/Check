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

const usersList = document.getElementById("usersList");

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

  loadUsers();

});

function formatDate(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

async function loadUsers() {

  usersList.innerHTML = "<h2>Loading...</h2>";

  try {

    const snapshot = await getDocs(collection(db, "users"));

    if (snapshot.empty) {
      usersList.innerHTML = "<h2>No Users Found</h2>";
      return;
    }

    usersList.innerHTML = snapshot.docs.map((docSnap) => {

      const u = docSnap.data();

      return `
        <div class="user-row">
          <div class="user-info">
            <h3>${u.name || "Unnamed"}</h3>
            <p>${u.email || ""}</p>
            <p class="user-joined">Joined: ${formatDate(u.createdAt)}</p>
          </div>
          ${u.isAdmin
            ? `<span class="badge badge-admin">Admin</span>`
            : `<span class="badge badge-user">Customer</span>`}
        </div>
      `;

    }).join("");

  } catch (error) {
    usersList.innerHTML = `<p class="no-results">Error loading users</p>`;
    console.log(error);
  }

}
