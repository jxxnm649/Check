/* ============================================================
   Bestify Admin Panel
   Firebase Auth Guard + Dashboard Metrics
   ============================================================ */

import { auth, db } from "../firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import { showToast } from "../design-system.js";


/* ---------- Element refs ---------- */

const initialLoadingState = document.getElementById("initialLoadingState");
const authRequiredState   = document.getElementById("authRequiredState");
const accessDeniedState   = document.getElementById("accessDeniedState");
const errorState          = document.getElementById("errorState");
const errorStateText      = document.getElementById("errorStateText");
const errorRetryBtn       = document.getElementById("errorRetryBtn");

const adminShell = document.getElementById("adminShell");
const adminNav   = document.getElementById("adminNav");

const userName  = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userAvatar = document.getElementById("userAvatar");

const hamburgerBtn  = document.getElementById("hamburgerBtn");
const drawerOverlay = document.getElementById("drawerOverlay");

const profileBtn = document.getElementById("profileBtn");
const profileMenu = document.getElementById("profileMenu");

const logoutBtn = document.getElementById("logoutBtn");


/* ---------- Dashboard metric refs ---------- */

const usersCount = document.getElementById("usersCount");
const vendorsCount = document.getElementById("vendorsCount");
const ordersCount = document.getElementById("ordersCount");
const revenueTotal = document.getElementById("revenueTotal");


/* ---------- Navigation ---------- */

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "📊", permission: null, active: true },
  { id: "users", label: "Users", icon: "👥", permission: "users" },
  { id: "vendors", label: "Vendors", icon: "🏬", permission: "vendors" },
  { id: "products", label: "Products", icon: "📦", permission: "products" },
  { id: "orders", label: "Orders", icon: "🧾", permission: "orders" },
  { id: "payments", label: "Payments", icon: "💳", permission: "payments" },
  { id: "refunds", label: "Refunds", icon: "↩️", permission: "refunds" },
  { id: "wallets", label: "Wallets", icon: "👛", permission: "wallets" },
  { id: "commissions", label: "Commissions", icon: "🧮", permission: "commissions" },
  { id: "cashback", label: "Cashback", icon: "💸", permission: "cashback" },
  { id: "referrals", label: "Referrals", icon: "🔗", permission: "referrals" },
  { id: "repairs", label: "Repairs", icon: "🔧", permission: "repairs" },
  { id: "chats", label: "Chats", icon: "💬", permission: "chats" },
  { id: "notifications", label: "Notifications", icon: "🔔", permission: "notifications" },
  { id: "reports", label: "Reports", icon: "📈", permission: "reports" },
  { id: "audit-log", label: "Audit Log", icon: "🗂️", permission: "auditLog" },
  { id: "settings", label: "Settings", icon: "⚙️", permission: "settings" }
];


/* ---------- State helpers ---------- */

function hideAllStates() {
  [
    initialLoadingState,
    authRequiredState,
    accessDeniedState,
    errorState,
    adminShell
  ].forEach(el => {
    if (el) el.classList.add("bf-hidden");
  });
}


function showAuthRequired() {
  hideAllStates();
  authRequiredState.classList.remove("bf-hidden");
}


function showAccessDenied() {
  hideAllStates();
  accessDeniedState.classList.remove("bf-hidden");
}


function showError(message) {
  hideAllStates();

  errorStateText.textContent =
    message || "Please try again.";

  errorState.classList.remove("bf-hidden");
}


function showShell() {
  hideAllStates();
  adminShell.classList.remove("bf-hidden");
}


/* ---------- Navigation rendering ---------- */

function renderNav(claims) {

  const hasGranularPermissions =
    claims &&
    claims.permissions &&
    typeof claims.permissions === "object";

  adminNav.innerHTML = NAV_ITEMS.map(item => {

    const allowed =
      item.permission === null
        ? true
        : hasGranularPermissions
          ? claims.permissions[item.permission] === true
          : true;

    if (!allowed) return "";

    const activeClass =
      item.active
        ? "bf-admin-nav-active"
        : "";

    return `
      <button
        type="button"
        class="bf-admin-nav-item ${activeClass}"
        data-nav="${item.id}">

        <span class="bf-admin-nav-icon">
          ${item.icon}
        </span>

        <span>
          ${item.label}
        </span>

        ${
          item.active
            ? ""
            : `<span class="bf-admin-nav-soon">Soon</span>`
        }

      </button>
    `;

  }).join("");
}


/* ============================================================
   DASHBOARD DATA
   ============================================================ */

async function loadDashboardMetrics() {

  try {

    /* ---------- USERS ---------- */

    const usersSnapshot =
      await getDocs(collection(db, "users"));

    usersCount.textContent =
      usersSnapshot.size;


    /* ---------- ORDERS ---------- */

    const ordersSnapshot =
      await getDocs(collection(db, "orders"));

    ordersCount.textContent =
      ordersSnapshot.size;


    /* ---------- VENDORS ---------- */

    /*
      Currently there is no "vendors" collection
      in your Firestore database.
    */

    vendorsCount.textContent = "0";


    /* ---------- REVENUE ---------- */

    let revenue = 0;

    ordersSnapshot.forEach(orderDoc => {

      const orderData = orderDoc.data();

      /*
        Your order structure:

        products: [
          {
            price: "string"
          }
        ]

        status: "Delivered"
      */

      if (
        String(orderData.status || "")
          .toLowerCase() === "delivered"
      ) {

        const products =
          Array.isArray(orderData.products)
            ? orderData.products
            : [];


        products.forEach(product => {

          const price =
            Number(
              String(product.price || "0")
                .replace(/[₹,\s]/g, "")
            );

          if (!Number.isNaN(price)) {
            revenue += price;
          }

        });

      }

    });


    revenueTotal.textContent =
      "₹" + revenue.toLocaleString("en-IN");


    console.log("Dashboard loaded:", {
      users: usersSnapshot.size,
      vendors: 0,
      orders: ordersSnapshot.size,
      revenue: revenue
    });


  } catch (error) {

    console.error(
      "Dashboard metrics error:",
      error
    );

    usersCount.textContent = "—";
    vendorsCount.textContent = "—";
    ordersCount.textContent = "—";
    revenueTotal.textContent = "—";

    showToast(
      "Unable to load dashboard data",
      "danger"
    );

  }

}


/* ---------- Drawer ---------- */

function openDrawer() {

  adminShell.classList.add(
    "bf-admin-drawer-open"
  );

  hamburgerBtn.setAttribute(
    "aria-expanded",
    "true"
  );
}


function closeDrawer() {

  adminShell.classList.remove(
    "bf-admin-drawer-open"
  );

  hamburgerBtn.setAttribute(
    "aria-expanded",
    "false"
  );
}


hamburgerBtn.addEventListener(
  "click",
  () => {

    const isOpen =
      adminShell.classList.contains(
        "bf-admin-drawer-open"
      );

    if (isOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }

  }
);


drawerOverlay.addEventListener(
  "click",
  closeDrawer
);


window.addEventListener(
  "resize",
  () => {

    if (window.innerWidth >= 1024) {
      closeDrawer();
    }

  }
);


/* ---------- Profile menu ---------- */

profileBtn.addEventListener(
  "click",
  (e) => {

    e.stopPropagation();

    const isOpen =
      !profileMenu.classList.contains(
        "bf-hidden"
      );

    profileMenu.classList.toggle(
      "bf-hidden",
      isOpen
    );

    profileBtn.setAttribute(
      "aria-expanded",
      String(!isOpen)
    );

  }
);


document.addEventListener(
  "click",
  (e) => {

    if (
      !profileMenu.contains(e.target) &&
      e.target !== profileBtn
    ) {

      profileMenu.classList.add(
        "bf-hidden"
      );

      profileBtn.setAttribute(
        "aria-expanded",
        "false"
      );

    }

  }
);


/* ---------- Logout ---------- */

logoutBtn.addEventListener(
  "click",
  async () => {

    logoutBtn.disabled = true;

    try {

      await signOut(auth);

      showToast(
        "Logged out successfully",
        "success"
      );

      window.location.href =
        "../login.html";

    } catch (error) {

      logoutBtn.disabled = false;

      showToast(
        error.message || "Logout failed",
        "danger"
      );

    }

  }
);


/* ---------- Navigation ---------- */
adminNav.addEventListener(
  "click",
  (e) => {

    const btn =
      e.target.closest(".bf-admin-nav-item");

    if (!btn) return;

    const navId = btn.dataset.nav;

    // Users
    if (navId === "users") {
      window.location.href = "users.html";
      return;
    }

    // Other sections
    if (navId !== "dashboard") {
      showToast(
        "This section is coming soon",
        "info"
      );
    }

    closeDrawer();
  }
);
