import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const productDiv = document.getElementById("product");

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

let currentUser = null;
let currentQty = 1;
let currentProduct = null;
let isWishlisted = false;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  checkWishlistStatus();
});

loadProduct();

async function checkWishlistStatus() {
  if (!currentUser || !productId) return;
  try {
    const wSnap = await getDoc(doc(db, "users", currentUser.uid, "wishlist", productId));
    isWishlisted = wSnap.exists();
    const heartBtn = document.getElementById("wishlistHeart");
    if (heartBtn) heartBtn.classList.toggle("active", isWishlisted);
  } catch (e) { /* ignore */ }
}

async function loadProduct() {

  try {

    const productRef = doc(db, "products", productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
      productDiv.innerHTML = "<h2 style='padding:20px;'>Product Not Found</h2>";
      return;
    }

    const product = productSnap.data();
    currentProduct = product;

    const hasStock = typeof product.stock === "number";
    const outOfStock = hasStock && product.stock === 0;
    const lowStock = hasStock && product.stock > 0 && product.stock <= 5;

    const mrp = Number(product.mrp) || 0;
    const price = Number(product.price) || 0;
    const hasDiscount = mrp > price;
    const pct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;

    const priceHTML = hasDiscount
      ? `<div class="pd-price-row">
           <span class="price">₹${price}</span>
           <span class="mrp-strike">₹${mrp}</span>
           <span class="off-badge">Save ₹${mrp - price}</span>
         </div>`
      : `<div class="pd-price-row"><span class="price">₹${price}</span></div>`;

    productDiv.innerHTML = `
<div class="pd-wrap">

  <div class="pd-gallery">
    <div class="pd-image-wrap">
      ${hasDiscount ? `<span class="pd-discount-badge">${pct}% OFF</span>` : ""}
      <button id="wishlistHeart" class="pd-heart-btn" aria-label="Wishlist">♡</button>
      <img class="pd-image" src="${product.image}" alt="${product.productName}">
    </div>
  </div>

  <div class="pd-content">

    <p class="pd-category">${product.category}</p>
    <h1>${product.productName}</h1>

    ${priceHTML}
    <p class="pd-tax-note">Inclusive of all taxes</p>

    <div class="pd-stock-row">
      ${hasStock
        ? `<span class="stock-badge ${outOfStock ? "out" : lowStock ? "low" : "in"}">
             ${outOfStock ? "Out of Stock" : lowStock ? `Only ${product.stock} left` : "In Stock"}
           </span>`
        : `<span class="stock-badge in">In Stock</span>`}
    </div>

    <hr class="pd-divider">

    <p class="pd-description">${product.description}</p>

    <hr class="pd-divider">

    <div class="pd-qty-row">
      <p class="pd-qty-label">Quantity</p>
      <div class="pd-qty-stepper">
        <button id="qtyMinus" type="button">−</button>
        <span id="qtyValue">1</span>
        <button id="qtyPlus" type="button">+</button>
      </div>
    </div>

    <div class="pd-trust-row">
      <div class="pd-trust-item"><span>🛡️</span><p>1 Year Warranty</p></div>
      <div class="pd-trust-item"><span>↩️</span><p>7-Day Returns</p></div>
      <div class="pd-trust-item"><span>🚚</span><p>Fast Delivery</p></div>
    </div>

  </div>

</div>

<div id="relatedSection"></div>

<div class="pd-sticky-actions">
  <button class="pd-buy-btn" id="buyNowBtn" ${outOfStock ? "disabled" : ""}>
    Buy Now
  </button>
  <button class="pd-add-btn" id="addToCartBtn" ${outOfStock ? "disabled" : ""}>
    ${outOfStock ? "Out of Stock" : "Add to Cart"}
  </button>
</div>
`;

    document.getElementById("qtyMinus").addEventListener("click", () => {
      currentQty = Math.max(1, currentQty - 1);
      document.getElementById("qtyValue").textContent = currentQty;
    });
    document.getElementById("qtyPlus").addEventListener("click", () => {
      const maxQty = hasStock ? product.stock : 9;
      currentQty = Math.min(maxQty || 9, currentQty + 1);
      document.getElementById("qtyValue").textContent = currentQty;
    });
    document.getElementById("addToCartBtn").addEventListener("click", addToCart);
    document.getElementById("buyNowBtn").addEventListener("click", buyNow);
    document.getElementById("wishlistHeart").addEventListener("click", toggleWishlist);

    checkWishlistStatus();
    loadRelatedProducts(product.category);

  } catch (error) {

    alert(error.message);
    console.log(error);

  }

}

async function loadRelatedProducts(category) {
  const section = document.getElementById("relatedSection");
  if (!section) return;

  try {
    const q = query(
      collection(db, "products"),
      where("category", "==", category),
      limit(8)
    );
    const snap = await getDocs(q);

    const related = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => p.id !== productId)
      .slice(0, 4);

    if (related.length === 0) {
      section.innerHTML = "";
      return;
    }

    section.innerHTML = `
      <div class="pd-related">
        <h2 class="pd-related-title">You may also like</h2>
        <div class="pd-related-grid">
          ${related.map((p) => {
            const rMrp = Number(p.mrp) || 0;
            const rPrice = Number(p.price) || 0;
            const rHasDiscount = rMrp > rPrice;
            return `
              <a class="pd-related-card" href="product.html?id=${p.id}">
                <div class="pd-related-img">
                  <img src="${p.image}" alt="${p.productName}">
                </div>
                <p class="pd-related-name">${p.productName}</p>
                <p class="pd-related-price">
                  ₹${rPrice}
                  ${rHasDiscount ? `<span class="pd-related-mrp">₹${rMrp}</span>` : ""}
                </p>
              </a>
            `;
          }).join("")}
        </div>
      </div>
    `;
  } catch (error) {
    console.log(error);
    section.innerHTML = "";
  }
}

async function toggleWishlist() {

  if (!currentUser) {
    alert("Please Login First");
    window.location.href = "login.html";
    return;
  }

  const heartBtn = document.getElementById("wishlistHeart");

  try {
    if (isWishlisted) {
      await deleteDoc(doc(db, "users", currentUser.uid, "wishlist", productId));
      isWishlisted = false;
    } else {
      await setDoc(doc(db, "users", currentUser.uid, "wishlist", productId), currentProduct);
      isWishlisted = true;
    }
    heartBtn.classList.toggle("active", isWishlisted);
  } catch (error) {
    alert(error.message);
    console.log(error);
  }

}

async function addToCart() {

  if (!currentUser) {
    alert("Please Login First");
    window.location.href = "login.html";
    return;
  }

  try {

    const productRef = doc(db, "products", productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
      alert("Product Not Found");
      return;
    }

    const cartRef = doc(db, "users", currentUser.uid, "cart", productId);
    const cartSnap = await getDoc(cartRef);
    const existingQty = cartSnap.exists() ? (cartSnap.data().qty || 1) : 0;

    await setDoc(cartRef, { ...productSnap.data(), qty: existingQty + currentQty });

    alert("Added To Cart ✅");

  } catch (error) {

    alert(error.message);
    console.log(error);

  }

}

function buyNow() {
  window.location.href = `checkout.html?productId=${productId}&qty=${currentQty}`;
}
