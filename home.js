import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const welcome = document.getElementById("welcome");
const productContainer = document.getElementById("productContainer");
const featuredContainer = document.getElementById("featuredContainer");
const featuredTitle = document.getElementById("featuredTitle");
const categoryBar = document.getElementById("categoryBar");
const searchInput = document.getElementById("searchInput");
const bannerTrack = document.getElementById("bannerTrack");
const bannerDots = document.getElementById("bannerDots");

let allProducts = [];
let activeCategory = "All";

// User Details
onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {

    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {

      const data = docSnap.data();

      welcome.innerHTML = `👋 Welcome <b>${data.name}</b>`;

    } else {

      welcome.innerHTML = `👋 Welcome <b>${user.email}</b>`;

    }

  } catch (error) {

    console.log(error);

    welcome.innerHTML = `👋 Welcome <b>${user.email}</b>`;

  }

});

// ---------- Banner Slider ----------
const banners = [
  { cls: "b1", title: "Bestify Days 🎉", text: "Fresh drops added every week" },
  { cls: "b2", title: "Up to 40% Off", text: "On our top rated picks" },
  { cls: "b3", title: "Free Delivery", text: "On your first order today" }
];

function renderBanner() {
  bannerTrack.innerHTML = banners.map(b => `
    <div class="banner-slide ${b.cls}">
      <h3>${b.title}</h3>
      <p>${b.text}</p>
    </div>
  `).join("");

  bannerDots.innerHTML = banners.map((_, i) =>
    `<span data-i="${i}" class="${i === 0 ? "active" : ""}"></span>`
  ).join("");
}

let bannerIndex = 0;
function goToBanner(i) {
  bannerIndex = i;
  bannerTrack.style.transform = `translateX(-${i * 100}%)`;
  [...bannerDots.children].forEach((dot, idx) =>
    dot.classList.toggle("active", idx === i)
  );
}

function startBannerAuto() {
  setInterval(() => {
    goToBanner((bannerIndex + 1) % banners.length);
  }, 4000);
}

renderBanner();
goToBanner(0);
startBannerAuto();

bannerDots.addEventListener("click", (e) => {
  if (e.target.dataset.i !== undefined) {
    goToBanner(Number(e.target.dataset.i));
  }
});

// ---------- Skeleton ----------
function renderSkeletons(container, count = 4) {
  container.innerHTML = Array.from({ length: count }).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton-line w60"></div>
        <div class="skeleton-line w40"></div>
      </div>
    </div>
  `).join("");
}

// ---------- Price / MRP helper ----------
function priceBlockHTML(p) {
  const mrp = Number(p.mrp) || 0;
  const price = Number(p.price) || 0;
  if (mrp > price) {
    const pct = Math.round(((mrp - price) / mrp) * 100);
    return `
      <div class="price-block">
        <span class="price">₹${price}</span>
        <span class="mrp-strike">₹${mrp}</span>
        <span class="off-badge">${pct}% off</span>
      </div>
    `;
  }
  return `<div class="price-block"><span class="price">₹${price}</span></div>`;
}

// ---------- Product card ----------
function productCardHTML(p) {
  const hasStock = typeof p.stock === "number";
  const outOfStock = hasStock && p.stock === 0;
  const lowStock = hasStock && p.stock > 0 && p.stock <= 5;

  return `
    <div class="product-card" data-id="${p.id}">
      <img src="${p.image}" alt="${p.productName}">
      <div class="product-info">
        <h3>${p.productName}</h3>
        <p>${p.description}</p>
        ${priceBlockHTML(p)}
        ${hasStock ? `<span class="stock-badge ${outOfStock ? "out" : lowStock ? "low" : "in"}">
          ${outOfStock ? "Out of Stock" : lowStock ? `Only ${p.stock} left` : "In Stock"}
        </span>` : ""}
        <div class="product-card-actions">
          <button class="buy-btn" data-id="${p.id}" ${outOfStock ? "disabled" : ""}>
            ${outOfStock ? "Out of Stock" : "Add to Cart"}
          </button>
          <button class="order-btn" data-id="${p.id}" ${outOfStock ? "disabled" : ""}>
            Order
          </button>
        </div>
      </div>
    </div>
  `;
}

// ---------- Add to cart (from card) ----------
async function handleAddToCart(id) {

  const user = auth.currentUser;

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {

    const productRef = doc(db, "products", id);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) return;

    const cartRef = doc(db, "users", user.uid, "cart", id);
    const cartSnap = await getDoc(cartRef);
    const qty = cartSnap.exists() ? (cartSnap.data().qty || 1) + 1 : 1;

    await setDoc(cartRef, { ...productSnap.data(), qty });

    alert("Added to Cart ✅");

  } catch (error) {
    console.log(error);
    alert(error.message);
  }

}

function attachCardEvents(container) {
  container.addEventListener("click", (e) => {

    const buyBtn = e.target.closest(".buy-btn");
    if (buyBtn) {
      e.stopPropagation();
      handleAddToCart(buyBtn.dataset.id);
      return;
    }

    const orderBtn = e.target.closest(".order-btn");
    if (orderBtn) {
      e.stopPropagation();
      window.location.href = `checkout.html?productId=${orderBtn.dataset.id}`;
      return;
    }

    const card = e.target.closest(".product-card");
    if (card) {
      window.location.href = `product.html?id=${card.dataset.id}`;
    }

  });
}

attachCardEvents(productContainer);
attachCardEvents(featuredContainer);

// ---------- Category chips ----------
function renderCategories(products) {
  const categories = ["All", ...new Set(products.map(p => p.category).filter(Boolean))];

  categoryBar.innerHTML = categories.map(c => `
    <div class="category-chip ${c === activeCategory ? "active" : ""}" data-cat="${c}">
      ${c}
    </div>
  `).join("");
}

categoryBar.addEventListener("click", (e) => {
  const chip = e.target.closest(".category-chip");
  if (!chip) return;
  activeCategory = chip.dataset.cat;
  renderCategories(allProducts);
  applyFilters();
});

// ---------- Search ----------
searchInput.addEventListener("input", applyFilters);

function applyFilters() {
  const term = searchInput.value.trim().toLowerCase();

  const filtered = allProducts.filter(p => {
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    const matchesSearch = !term
      || (p.productName || "").toLowerCase().includes(term)
      || (p.description || "").toLowerCase().includes(term)
      || (p.category || "").toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });

  // Hide Best Sellers while actively searching, to avoid confusing "search not working"
  if (featuredTitle && featuredContainer) {
    const show = !term && featured_cache.length > 0;
    featuredTitle.style.display = show ? "block" : "none";
    featuredContainer.style.display = show ? "grid" : "none";
  }

  if (filtered.length === 0) {
    productContainer.innerHTML = `<p class="no-results">No products found 😔</p>`;
    return;
  }

  productContainer.innerHTML = filtered.map(productCardHTML).join("");
}

let featured_cache = [];

// ---------- Load Products ----------
async function loadProducts() {

  renderSkeletons(productContainer, 4);

  try {

    const snapshot = await getDocs(collection(db, "products"));

    console.log("Products Found :", snapshot.size);

    if (snapshot.empty) {
      productContainer.innerHTML = `<p class="no-results">No Products Found</p>`;
      return;
    }

    allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    renderCategories(allProducts);

    // Featured / Best Sellers: top 4 products
    featured_cache = allProducts.slice(0, 4);
    if (featured_cache.length > 0) {
      featuredTitle.style.display = "block";
      featuredContainer.innerHTML = featured_cache.map(productCardHTML).join("");
    }

    applyFilters();

  } catch (error) {

    console.log(error);

    productContainer.innerHTML = `<p class="no-results">Error loading products</p>`;

  }

}

loadProducts();
