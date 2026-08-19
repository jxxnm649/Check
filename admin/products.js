import { auth, db } from "../firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import {
  openModal,
  closeModal,
  showToast
} from "../design-system.js";


const form = document.getElementById("productForm");
const productsList = document.getElementById("productsList");
const productCount = document.getElementById("productCount");
const productSearch = document.getElementById("productSearch");
const productStatusFilter = document.getElementById("productStatusFilter");

const imageFile = document.getElementById("imageFile");
const previewRow = document.getElementById("previewRow");

const addProductBtn = document.getElementById("addProductBtn");
const productFormModal = document.getElementById("productFormModal");
const productFormCloseBtn = document.getElementById("productFormCloseBtn");
const productFormTitle = document.getElementById("productFormTitle");
const productFormSubmitBtn = document.getElementById("productFormSubmitBtn");

let editMode = false;
let editProductId = null;
let existingImages = [];
let allProducts = [];


/* =========================
   IMAGE PREVIEW
========================= */

imageFile.value = "";

imageFile.addEventListener("change", () => {

  const files = Array.from(imageFile.files);

  if (files.length === 0) {
    renderPreview();
    return;
  }

  previewRow.innerHTML = "";
  files.forEach((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.width = 90;
    img.style.borderRadius = "10px";
    previewRow.appendChild(img);
  });

});

function renderPreview() {
  previewRow.innerHTML = "";
  existingImages.forEach((url) => {
    const img = document.createElement("img");
    img.src = url;
    img.width = 90;
    img.style.borderRadius = "10px";
    previewRow.appendChild(img);
  });
}


/* =========================
   MODAL OPEN / CLOSE
========================= */

function resetForm() {
  form.reset();
  document.getElementById("status").value = "Active";
  previewRow.innerHTML = "";
  existingImages = [];
  imageFile.value = "";
  editMode = false;
  editProductId = null;
  productFormTitle.textContent = "Add Product";
  productFormSubmitBtn.textContent = "Save Product";
}

if (addProductBtn) {
  addProductBtn.addEventListener("click", () => {
    resetForm();
    openModal("productFormModal");
  });
}

if (productFormCloseBtn) {
  productFormCloseBtn.addEventListener("click", () => {
    closeModal("productFormModal");
  });
}


/* =========================
   IMAGE UPLOAD (Cloudinary)
========================= */

async function uploadImages() {

  const files = Array.from(imageFile.files);

  if (files.length === 0) {

    if (editMode && existingImages.length > 0) {
      return existingImages;
    }

    showToast("Select at least one image", "danger");
    return null;

  }

  const uploadedUrls = [];

  for (const file of files) {

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "Bestifyimg");

    const response = await fetch(
      "https://api.cloudinary.com/v1_1/rgksliph/image/upload",
      {
        method: "POST",
        body: formData
      }
    );

    const data = await response.json();
    uploadedUrls.push(data.secure_url);

  }

  return uploadedUrls;

}


/* =========================
   SUBMIT (ADD / UPDATE)
========================= */

form.addEventListener("submit", async (e) => {

  e.preventDefault();

  productFormSubmitBtn.disabled = true;
  productFormSubmitBtn.textContent = editMode ? "Updating..." : "Saving...";

  try {

    const imageUrls = await uploadImages();

    if (!imageUrls || imageUrls.length === 0) {
      productFormSubmitBtn.disabled = false;
      productFormSubmitBtn.textContent = editMode ? "Update Product" : "Save Product";
      return;
    }

    const productData = {
      image: imageUrls[0],
      images: imageUrls,
      productName: document.getElementById("productName").value.trim(),
      category: document.getElementById("category").value.trim(),
      mrp: document.getElementById("mrp").value ? Number(document.getElementById("mrp").value) : 0,
      price: Number(document.getElementById("price").value),
      stock: Number(document.getElementById("stock").value),
      description: document.getElementById("description").value.trim(),
      sizes: document.getElementById("sizes").value
        ? document.getElementById("sizes").value.split(",").map(s => s.trim()).filter(Boolean)
        : [],
      colours: document.getElementById("colours").value
        ? document.getElementById("colours").value.split(",").map(s => s.trim()).filter(Boolean)
        : [],
      status: document.getElementById("status").value
    };

    if (editMode) {

      await updateDoc(doc(db, "products", editProductId), productData);
      showToast("Product updated", "success");

    } else {

      await addDoc(collection(db, "products"), productData);
      showToast("Product added", "success");

    }

    closeModal("productFormModal");
    resetForm();
    loadProducts();

  } catch (error) {

    console.error("Product save error:", error);
    showToast(error.message || "Failed to save product.", "danger");

  } finally {

    productFormSubmitBtn.disabled = false;
    productFormSubmitBtn.textContent = editMode ? "Update Product" : "Save Product";

  }

});


/* =========================
   LOAD & RENDER PRODUCTS
========================= */

async function loadProducts() {

  try {

    const snapshot = await getDocs(collection(db, "products"));

    allProducts = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    renderProductList();

  } catch (error) {

    console.error("Products loading error:", error);

    productsList.innerHTML = `
      <div class="bf-card" style="padding:20px;">
        ❌ Unable to load products.
      </div>
    `;

  }

}

function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

function getFilteredProducts() {

  const term = productSearch.value.trim().toLowerCase();
  const statusFilter = productStatusFilter.value;

  return allProducts.filter((product) => {

    const name = (product.productName || "").toLowerCase();
    const category = (product.category || "").toLowerCase();
    const status = product.status === "Inactive" ? "Inactive" : "Active";

    const matchesTerm = !term || name.includes(term) || category.includes(term);
    const matchesStatus = statusFilter === "All" || status === statusFilter;

    return matchesTerm && matchesStatus;

  });

}

function renderProductList() {

  const filtered = getFilteredProducts();

  productCount.textContent = `Total Products: ${allProducts.length}`;

  if (!filtered.length) {
    productsList.innerHTML = `
      <div class="bf-card" style="padding:20px;">
        No products found.
      </div>
    `;
    return;
  }

  productsList.innerHTML = filtered.map((product) => {

    const status = product.status === "Inactive" ? "Inactive" : "Active";
    const stock = product.stock ?? 0;

    const stockLabel =
      stock === 0 ? "Out of Stock" :
      stock <= 5 ? `${stock} left` :
      `${stock} in stock`;

    const stockClass =
      stock === 0 ? "bf-status-danger" :
      stock <= 5 ? "bf-status-warning" :
      "bf-status-success";

    const priceHtml =
      Number(product.mrp) > Number(product.price)
        ? `<span style="text-decoration:line-through;opacity:.55;font-size:12px;">₹${escapeHtml(String(product.mrp))}</span> <strong>₹${escapeHtml(String(product.price))}</strong>`
        : `<strong>₹${escapeHtml(String(product.price))}</strong>`;

    return `
      <div class="bf-card" style="padding:14px; display:flex; flex-direction:column; gap:8px;">

        <img
          src="${escapeHtml(product.image || "")}"
          alt="${escapeHtml(product.productName || "")}"
          style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:10px;">

        <div style="font-weight:700; font-size:15px;">
          ${escapeHtml(product.productName || "Unnamed product")}
        </div>

        <div style="font-size:12px; opacity:.7;">
          ${escapeHtml(product.category || "Uncategorized")}
        </div>

        <div style="font-size:14px;">
          ${priceHtml}
        </div>

        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <span class="bf-status-pill ${stockClass}">${escapeHtml(stockLabel)}</span>
          <span class="bf-status-pill ${status === "Active" ? "bf-status-success" : "bf-status-pending"}">${status}</span>
        </div>

        <div style="display:flex; gap:8px; margin-top:6px;">
          <button
            type="button"
            class="bf-btn bf-btn-ghost bf-btn-sm edit-product-btn"
            data-id="${escapeHtml(product.id)}"
            style="flex:1;">
            ✏️ Edit
          </button>

          <button
            type="button"
            class="bf-btn bf-btn-ghost bf-btn-sm delete-product-btn"
            data-id="${escapeHtml(product.id)}"
            data-name="${escapeHtml(product.productName || "this product")}"
            style="flex:1; color:#c62828;">
            🗑️ Delete
          </button>
        </div>

      </div>
    `;

  }).join("");

}

if (productSearch) {
  productSearch.addEventListener("input", renderProductList);
}

if (productStatusFilter) {
  productStatusFilter.addEventListener("change", renderProductList);
}


/* =========================
   EDIT / DELETE
========================= */

async function editProduct(id) {

  try {

    const productRef = doc(db, "products", id);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
      showToast("Product not found", "danger");
      return;
    }

    const product = productSnap.data();

    existingImages = product.images && product.images.length
      ? product.images
      : (product.image ? [product.image] : []);

    imageFile.value = "";
    renderPreview();

    document.getElementById("productName").value = product.productName || "";
    document.getElementById("category").value = product.category || "";
    document.getElementById("mrp").value = product.mrp || "";
    document.getElementById("price").value = product.price || "";
    document.getElementById("stock").value = product.stock ?? 0;
    document.getElementById("description").value = product.description || "";
    document.getElementById("sizes").value = (product.sizes || []).join(", ");
    document.getElementById("colours").value = (product.colours || []).join(", ");
    document.getElementById("status").value = product.status === "Inactive" ? "Inactive" : "Active";

    editMode = true;
    editProductId = id;

    productFormTitle.textContent = "Edit Product";
    productFormSubmitBtn.textContent = "Update Product";

    openModal("productFormModal");

  } catch (error) {

    console.error("Edit product error:", error);
    showToast(error.message || "Failed to load product.", "danger");

  }

}

async function deleteProduct(id, name) {

  const ok = window.confirm(`Delete "${name}"? This cannot be undone.`);
  if (!ok) return;

  try {

    await deleteDoc(doc(db, "products", id));

    allProducts = allProducts.filter(p => p.id !== id);
    renderProductList();

    showToast("Product deleted", "success");

  } catch (error) {

    console.error("Delete product error:", error);
    showToast(error.message || "Failed to delete product.", "danger");

  }

}

if (productsList) {
  productsList.addEventListener("click", (e) => {

    const editBtn = e.target.closest(".edit-product-btn");
    if (editBtn) {
      editProduct(editBtn.dataset.id);
      return;
    }

    const deleteBtn = e.target.closest(".delete-product-btn");
    if (deleteBtn) {
      deleteProduct(deleteBtn.dataset.id, deleteBtn.dataset.name);
    }

  });
}


/* =========================
   APP INIT (ADMIN CHECK)
========================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {

    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists() || userDoc.data().isAdmin !== true) {
      alert("Access Denied ❌");
      window.location.href = "home.html";
      return;
    }

  } catch (error) {
    console.error("Admin check error:", error);
    window.location.href = "home.html";
    return;
  }

  loadProducts();

});
