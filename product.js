import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
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
let selectedSize = null;
let selectedColour = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateCartBadge();
});

loadProduct();

async function updateCartBadge() {
  const badge = document.getElementById("pdCartBadge");
  if (!badge || !currentUser) return;
  try {
    const snap = await getDocs(collection(db, "users", currentUser.uid, "cart"));
    const count = snap.docs.reduce((sum, d) => sum + (d.data().qty || 1), 0);
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  } catch (e) { /* ignore */ }
}

function deliveryEstimateText() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  const options = { weekday: "short", day: "numeric", month: "short" };
  return d.toLocaleDateString("en-IN", options);
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

    const images = (product.images && product.images.length) ? product.images : [product.image];

    productDiv.innerHTML = `
<div class="pd-wrap">

  <p class="pd-breadcrumb">
    <a href="home.html">Home</a> &gt;
    <span>${product.category}</span> &gt;
    <span class="pd-breadcrumb-current">${product.productName}</span>
  </p>

  <div class="pd-gallery">
    <div class="pd-image-wrap">
      ${hasDiscount ? `<span class="pd-discount-badge">${pct}% OFF</span>` : ""}
      <img class="pd-image" id="pdMainImage" src="${images[0]}" alt="${product.productName}">
    </div>

    ${images.length > 1 ? `
    <div class="pd-thumb-row" id="pdThumbRow">
      ${images.map((img, i) => `
        <button type="button" class="pd-thumb${i === 0 ? " selected" : ""}" data-src="${img}">
          <img src="${img}" alt="${product.productName} ${i + 1}">
        </button>
      `).join("")}
    </div>` : ""}
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
      ${!outOfStock ? `<p class="pd-delivery-note">🚚 Free delivery by <b>${deliveryEstimateText()}</b></p>` : ""}
    </div>

    ${(product.sizes && product.sizes.length) ? `
    <div class="pd-variant-row">
      <p class="pd-variant-label">Size</p>
      <div class="pd-variant-options" id="sizeOptions">
        ${product.sizes.map((s, i) => `<button type="button" class="pd-variant-chip${i === 0 ? " selected" : ""}" data-size="${s}">${s}</button>`).join("")}
      </div>
    </div>` : ""}

    ${(product.colours && product.colours.length) ? `
    <div class="pd-variant-row">
      <p class="pd-variant-label">Colour</p>
      <div class="pd-variant-options" id="colourOptions">
        ${product.colours.map((c, i) => `<button type="button" class="pd-variant-chip${i === 0 ? " selected" : ""}" data-colour="${c}">${c}</button>`).join("")}
      </div>
    </div>` : ""}

    <hr class="pd-divider">

    <div class="pd-qty-row">
      <p class="pd-qty-label">Quantity</p>
      <div class="pd-qty-stepper">
        <button id="qtyMinus" type="button">−</button>
        <span id="qtyValue">1</span>
        <button id="qtyPlus" type="button">+</button>
      </div>
    </div>

    <div class="pd-actions">
      <button class="pd-buy-btn" id="buyNowBtn" ${outOfStock ? "disabled" : ""}>
        Buy Now
      </button>
      <button class="pd-add-btn" id="addToCartBtn" ${outOfStock ? "disabled" : ""}>
        ${outOfStock ? "Out of Stock" : "Add to Cart"}
      </button>
    </div>

    <div class="pd-trust-row">
      <div class="pd-trust-item"><span>🛡️</span><p>1 Year Warranty</p></div>
      <div class="pd-trust-item"><span>↩️</span><p>7-Day Returns</p></div>
      <div class="pd-trust-item"><span>🚚</span><p>Fast Delivery</p></div>
    </div>

    <hr class="pd-divider">

    <p class="pd-description">${product.description}</p>

  </div>

</div>

<div id="relatedSection"></div>
`;

    if (images.length > 1) {
      document.getElementById("pdThumbRow").addEventListener("click", (e) => {
        const btn = e.target.closest(".pd-thumb");
        if (!btn) return;
        document.getElementById("pdMainImage").src = btn.dataset.src;
        document.querySelectorAll(".pd-thumb").forEach(t => t.classList.remove("selected"));
        btn.classList.add("selected");
      });
    }

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

    if (product.sizes && product.sizes.length) {
      selectedSize = product.sizes[0];
      document.getElementById("sizeOptions").addEventListener("click", (e) => {
        const btn = e.target.closest(".pd-variant-chip");
        if (!btn) return;
        selectedSize = btn.dataset.size;
        document.querySelectorAll("#sizeOptions .pd-variant-chip").forEach(c => c.classList.remove("selected"));
        btn.classList.add("selected");
      });
    }

    if (product.colours && product.colours.length) {
      selectedColour = product.colours[0];
      document.getElementById("colourOptions").addEventListener("click", (e) => {
        const btn = e.target.closest(".pd-variant-chip");
        if (!btn) return;
        selectedColour = btn.dataset.colour;
        document.querySelectorAll("#colourOptions .pd-variant-chip").forEach(c => c.classList.remove("selected"));
        btn.classList.add("selected");
      });
    }

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

    await setDoc(cartRef, {
      ...productSnap.data(),
      qty: existingQty + currentQty,
      ...(selectedSize ? { selectedSize } : {}),
      ...(selectedColour ? { selectedColour } : {})
    });

    updateCartBadge();
    alert("Added To Cart ✅");

  } catch (error) {

    alert(error.message);
    console.log(error);

  }

}

function buyNow() {
  let url = `checkout.html?productId=${productId}&qty=${currentQty}`;
  if (selectedSize) url += `&size=${encodeURIComponent(selectedSize)}`;
  if (selectedColour) url += `&colour=${encodeURIComponent(selectedColour)}`;
  window.location.href = url;
}
