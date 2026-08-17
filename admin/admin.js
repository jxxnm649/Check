/* ============================================================
   Bestify Admin Panel — Foundation (Step 1)
   Auth guard + shell only. No real data queries here yet —
   metric cards stay as skeletons until a later step wires them
   to Firestore/Cloud Functions.

   Reuses the existing single Firebase instance from ../firebase.js
   (does not re-initialize Firebase) and the shared design-system.js
   helpers for toasts.
   ============================================================ */

import { auth } from "../firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { showToast } from "../design-system.js";

/* ---------- Element refs ---------- */
const initialLoadingState = document.getElementById("initialLoadingState");
const authRequiredState   = document.getElementById("authRequiredState");
const accessDeniedState   = document.getElementById("accessDeniedState");
const errorState          = document.getElementById("errorState");
const errorStateText      = document.getElementById("errorStateText");
const errorRetryBtn       = document.getElementById("errorRetryBtn");

const adminShell   = document.getElementById("adminShell");
const adminNav     = document.getElementById("adminNav");
const userName     = document.getElementById("userName");
const userEmail    = document.getElementById("userEmail");
const userAvatar   = document.getElementById("userAvatar");

const hamburgerBtn   = document.getElementById("hamburgerBtn");
const drawerOverlay  = document.getElementById("drawerOverlay");
const profileBtn     = document.getElementById("profileBtn");
const profileMenu    = document.getElementById("profileMenu");
const logoutBtn      = document.getElementById("logoutBtn");

/* ---------- Navigation foundation ----------
   Placeholders only for Step 1 — no target pages are built yet,
   so items are inert. `permission` keys are read from the user's
   token claims (claims.permissions), so unauthorized sections stay
   out of the UI once granular permissions exist. Until then, any
   admin (claims.admin === true) sees the full placeholder list. */
const NAV_ITEMS = [
  { id: "dashboard",     label: "Dashboard",     icon: "📊", permission: null, active: true },
  { id: "users",         label: "Users",         icon: "👥", permission: "users" },
  { id: "vendors",       label: "Vendors",       icon: "🏬", permission: "vendors" },
  { id: "products",      label: "Products",      icon: "📦", permission: "products" },
  { id: "orders",        label: "Orders",        icon: "🧾", permission: "orders" },
  { id: "payments",      label: "Payments",      icon: "💳", permission: "payments" },
  { id: "refunds",       label: "Refunds",       icon: "↩️", permission: "refunds" },
  { id: "wallets",       label: "Wallets",       icon: "👛", permission: "wallets" },
  { id: "commissions",   label: "Commissions",   icon: "🧮", permission: "commissions" },
  { id: "cashback",      label: "Cashback",      icon: "💸", permission: "cashback" },
  { id: "referrals",     label: "Referrals",     icon: "🔗", permission: "referrals" },
  { id: "repairs",       label: "Repairs",       icon: "🔧", permission: "repairs" },
  { id: "chats",         label: "Chats",         icon: "💬", permission: "chats" },
  { id: "notifications", label: "Notifications", icon: "🔔", permission: "notifications" },
  { id: "reports",       label: "Reports",       icon: "📈", permission: "reports" },
  { id: "audit-log",     label: "Audit Log",     icon: "🗂️", permission: "auditLog" },
  { id: "settings",      label: "Settings",      icon: "⚙️", permission: "settings" },
];

/* ---------- State helpers ---------- */
function hideAllStates() {
  [initialLoadingState, authRequiredState, accessDeniedState, errorState, adminShell]
    .forEach(el => el.classList.add("bf-hidden"));
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
  errorStateText.textContent = message || "Please try again.";
  errorState.classList.remove("bf-hidden");
}

function showShell() {
  hideAllStates();
  adminShell.classList.remove("bf-hidden");
}

/* ---------- Nav rendering (permission-aware) ---------- */
function renderNav(claims) {
  const hasGranularPermissions = claims && claims.permissions && typeof claims.permissions === "object";

  adminNav.innerHTML = NAV_ITEMS.map(item => {
    const allowed = item.permission === null
      ? true
      : hasGranularPermissions
        ? claims.permissions[item.permission] === true
        : true; // no granular permissions defined yet -> any admin sees placeholders

    if (!allowed) return "";

    const activeClass = item.active ? "bf-admin-nav-active" : "";

    return `
      <button type="button" class="bf-admin-nav-item ${activeClass}" data-nav="${item.id}">
        <span class="bf-admin-nav-icon">${item.icon}</span>
        <span>${item.label}</span>
        ${item.active ? "" : `<span class="bf-admin-nav-soon">Soon</span>`}
      </button>
    `;
  }).join("");
}

/* ---------- Drawer (mobile) ---------- */
function openDrawer() {
  adminShell.classList.add("bf-admin-drawer-open");
  hamburgerBtn.setAttribute("aria-expanded", "true");
}
function closeDrawer() {
  adminShell.classList.remove("bf-admin-drawer-open");
  hamburgerBtn.setAttribute("aria-expanded", "false");
}
hamburgerBtn.addEventListener("click", () => {
  const isOpen = adminShell.classList.contains("bf-admin-drawer-open");
  if (isOpen) closeDrawer(); else openDrawer();
});
drawerOverlay.addEventListener("click", closeDrawer);

/* Close drawer automatically if resized to desktop */
window.addEventListener("resize", () => {
  if (window.innerWidth >= 1024) closeDrawer();
});

/* ---------- Profile menu ---------- */
profileBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = !profileMenu.classList.contains("bf-hidden");
  profileMenu.classList.toggle("bf-hidden", isOpen);
  profileBtn.setAttribute("aria-expanded", String(!isOpen));
});
document.addEventListener("click", (e) => {
  if (!profileMenu.contains(e.target) && e.target !== profileBtn) {
    profileMenu.classList.add("bf-hidden");
    profileBtn.setAttribute("aria-expanded", "false");
  }
});

/* ---------- Logout (reuses existing Firebase Auth signOut) ---------- */
logoutBtn.addEventListener("click", async () => {
  logoutBtn.disabled = true;
  try {
    await signOut(auth);
    showToast("Logged out successfully", "success");
    window.location.href = "../login.html";
  } catch (error) {
    logoutBtn.disabled = false;
    showToast(error.message || "Logout failed", "danger");
  }
});

/* ---------- Nav item clicks (placeholders for Step 1) ---------- */
adminNav.addEventListener("click", (e) => {
  const btn = e.target.closest(".bf-admin-nav-item");
  if (!btn) return;
  if (btn.dataset.nav !== "dashboard") {
    showToast("This section is coming soon", "info");
  }
  closeDrawer();
});

/* ---------- Auth guard ----------
   UI-level check only, using Firebase Auth ID token custom claims.
   This does NOT replace server-side enforcement: actual data reads
   must remain protected by Firestore Security Rules / Cloud
   Functions regardless of what this guard decides. */
errorRetryBtn.addEventListener("click", () => {
  window.location.reload();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showAuthRequired();
    return;
  }

  try {
    // Force refresh so a just-granted claim isn't served from a stale cached token.
    const tokenResult = await user.getIdTokenResult(true);
    const claims = tokenResult.claims || {};

    if (claims.admin !== true) {
      showAccessDenied();
      return;
    }

    // Populate header identity from the authenticated user only —
    // never from anything client-writable.
    const displayName = user.displayName || (user.email ? user.email.split("@")[0] : "Admin");
    userName.textContent = displayName;
    userEmail.textContent = user.email || "";
    userAvatar.textContent = displayName.charAt(0).toUpperCase();

    renderNav(claims);
    showShell();

  } catch (error) {
    console.error(error);
    showError("We couldn't verify your admin access. Please try again.");
  }
});
  
