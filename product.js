import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const productDiv = document.getElementById("product");

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

loadProduct();

async function loadProduct() {

  try {

    const productRef = doc(db, "products", productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
      productDiv.innerHTML = "<h2>Product Not Found</h2>";
      return;
    }

    const product = productSnap.data();
    const hasStock = typeof product.stock === "number";
    const outOfStock = hasStock && product.stock === 0;
    const lowStock = hasStock && product.stock > 0 && product.stock <= 5;

    const mrp = Number(product.mrp) || 0;
    const price = Number(product.price) || 0;
    const priceHTML = mrp > price
      ? `<div class="pd-price-block">
           <span class="mrp-strike">₹${mrp}</span>
           <span class="price">₹${price}</span>
         </div>
         <div class="saved-text">You saved ₹${mrp - price}</div>`
      : `<div class="price">₹${price}</div>`;

    productDiv.innerHTML = `
<div class="pd-wrap">

  <div class="pd-image-wrap">
    <img class="pd-image" src="${product.image}" alt="${product.productName}">
  </div>

  <div class="pd-content">

    <h1>${product.productName}</h1>

    <p class="pd-category"><b>Category:</b> ${product.category}</p>

    ${priceHTML}

    ${hasStock ? `<span class="stock-badge ${outOfStock ? "out" : lowStock ? "low" : "in"}">
      ${outOfStock ? "Out of Stock" : lowStock ? `Only ${product.stock} left` : "In Stock"}
    </span>` : ""}

    <p class="pd-description">${product.description}</p>

    <div class="pd-actions">
      <button onclick="addToCart()" ${outOfStock ? "disabled" : ""}>
        ${outOfStock ? "Out of Stock" : "Add To Cart"}
      </button>

      <button class="order-btn" onclick="buyNow()" ${outOfStock ? "disabled" : ""}>
        Buy Now
      </button>
    </div>

  </div>

</div>
`;

  } catch (error) {

    alert(error.message);
    console.log(error);

  }

}

window.addToCart = async function () {

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
    const qty = cartSnap.exists() ? (cartSnap.data().qty || 1) + 1 : 1;

    await setDoc(cartRef, { ...productSnap.data(), qty });

    alert("Added To Cart ✅");

  } catch (error) {

    alert(error.message);
    console.log(error);

  }

};

window.buyNow = function () {

  window.location.href = `checkout.html?productId=${productId}`;

};
