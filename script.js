// 🌿 Eden Creates — Script.js
document.addEventListener("DOMContentLoaded", () => {
  setupHeaderFooter();
  loadProducts();
  setupCart();
});

// ✅ Shared header & footer injection
function setupHeaderFooter() {
  const headerHTML = `
    <header class="site-header">
      <div class="header-content">
        <img src="assets/images/1.png" alt="Eden Creates Logo" class="logo">
        <h1 class="brand-title">Eden Creates</h1>
        <p class="tagline">Where simple things bloom beautifully</p>
        <nav class="nav">
          <a href="index.html">Home</a>
          <a href="merch.html">Merch</a>
          <a href="checkout.html">Checkout</a>
          <a href="order-status.html">Track Order</a>
        </nav>
      </div>
    </header>
  `;

  const footerHTML = `
    <footer class="site-footer">
      <p>© 2025 Eden Creates • Crafted with joy and grace 🌷</p>
      <button class="install-btn">Install App</button>
    </footer>
  `;

  const header = document.querySelector("header");
  const footer = document.querySelector("footer");
  if (header) header.outerHTML = headerHTML;
  if (footer) footer.outerHTML = footerHTML;
}

// ✅ Product loading
function loadProducts() {
  const productGrid = document.querySelector(".products");
  if (!productGrid) return;

  productGrid.innerHTML = `
    <div class="loading">
      <div class="loader"></div>
      <p>Loading Eden treasures...</p>
    </div>
  `;

  fetch("data/products.json")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch products.");
      return res.json();
    })
    .then((products) => {
      productGrid.innerHTML = products
        .map(
          (p) => `
        <div class="product-card">
          <img src="${p.image}" alt="${p.name}" class="product-img" onerror="this.src='assets/images/1.png'">
          <div class="product-info">
            <h3>${p.name}</h3>
            <p>${p.description}</p>
            <span class="product-price">R${p.price.toFixed(2)}</span>
            <button class="add-btn" onclick="addToCart(${p.id})">Add to Cart</button>
          </div>
        </div>
      `
        )
        .join("");
    })
    .catch((err) => {
      console.error(err);
      productGrid.innerHTML = `
        <div class="error">
          <p>⚠️ Couldn’t load products right now.</p>
          <p>Please refresh or check back later.</p>
        </div>
      `;
    });
}

// ✅ Cart management
function setupCart() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  localStorage.setItem("cart", JSON.stringify(cart));
}

function addToCart(id) {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const existing = cart.find((item) => item.id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id, quantity: 1 });
  }
  localStorage.setItem("cart", JSON.stringify(cart));
  showToast("Added to cart 🛍️");
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "stellies-toast show";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

// ✅ Checkout form handling
function submitOrder(e) {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const name = document.getElementById("name").value;
  const address = document.getElementById("address").value;
  const notes = document.getElementById("notes").value;

  if (!email || !name || !address) {
    alert("Please fill in your email, name and address.");
    return;
  }

  localStorage.setItem(
    "order",
    JSON.stringify({ email, name, address, notes, date: new Date().toISOString() })
  );

  window.location.href = "thank-you.html";
}

// ✅ Order tracking (view order status page)
function loadOrderStatus() {
  const container = document.querySelector(".order-status");
  if (!container) return;

  const order = JSON.parse(localStorage.getItem("order"));
  if (!order) {
    container.innerHTML = "<p>No orders found.</p>";
    return;
  }

  container.innerHTML = `
    <h2>Your Latest Order</h2>
    <p><strong>Name:</strong> ${order.name}</p>
    <p><strong>Email:</strong> ${order.email}</p>
    <p><strong>Address:</strong> ${order.address}</p>
    <p><strong>Notes:</strong> ${order.notes || "None"}</p>
    <p><em>Placed on ${new Date(order.date).toLocaleString()}</em></p>
  `;
}
