/* script.js - frontend for Stellies Dinner Packs
 * - Loads products & addresses from Google Apps Script Web App
 * - Manages cart, checkout flow, sends orders via POST to Apps Script
 * - Yoco placeholder ready (replace with your public key)
 */

/* ---------- CONFIG: paste your deployed Apps Script web app URL here ---------- */
const APPS_SCRIPT_URL = "PASTE_YOUR_APPS_SCRIPT_WEBAPP_URL_HERE"; // e.g. https://script.google.com/macros/s/AKfy.../exec
const YOCO_PUBLIC_KEY = "pk_test_your_public_key_here"; // replace when ready

/* ---------- State ---------- */
let products = []; // loaded from Google
let addresses = [];
let cart = [];     // { itemName, flavour, qty, price }

/* ---------- Utilities ---------- */
function formatR(v) { return Number(v).toFixed(2); }
function genOrderNumber() {
  // keep sequential-ish (timestamp) and short
  return "ORD-" + Date.now().toString().slice(-8);
}

/* ---------- Fetch products & addresses ---------- */
async function fetchProducts() {
  try {
    const res = await fetch(APPS_SCRIPT_URL + "?action=products");
    const json = await res.json();
    if (json.success) {
      products = json.products;
      return products;
    } else throw new Error(json.message || "Failed to load products");
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function fetchAddresses() {
  try {
    const res = await fetch(APPS_SCRIPT_URL + "?action=addresses");
    const json = await res.json();
    if (json.success) {
      addresses = json.addresses;
      return addresses;
    } else throw new Error(json.message || "Failed to load addresses");
  } catch (err) {
    console.error(err);
    throw err;
  }
}

/* ---------- Render product list (index.html) ---------- */
async function renderProducts() {
  const container = document.getElementById("productList");
  if (!container) return;
  container.innerHTML = "<div class='small'>Loading items…</div>";

  try {
    await fetchProducts();
    container.innerHTML = ""; // clear
    products.forEach((p, idx) => {
      const row = document.createElement("div");
      row.className = "product";
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" id="p${idx}" data-idx="${idx}" />
        </div>
        <div class="name">${p.item}</div>
        <div class="controls">
          ${p.hasFlavours ? `<select id="flavour-${idx}"><option value="">Choose</option>${p.flavours.map(f=>`<option>${f}</option>`).join('')}</select>` : `<span style="color:var(--muted); font-size:0.95rem">No flavour</span>`}
          <input id="qty-${idx}" type="number" min="1" value="1" style="width:70px" />
          <div style="min-width:70px; text-align:right;">R ${formatR(p.price)}</div>
        </div>
      `;
      container.appendChild(row);

      // event listeners
      const checkbox = row.querySelector(`#p${idx}`);
      const qtyInput = row.querySelector(`#qty-${idx}`);
      const flavourSelect = row.querySelector(`#flavour-${idx}`);

      checkbox.addEventListener("change", () => {
        const idx = Number(checkbox.dataset.idx);
        const product = products[idx];
        if (checkbox.checked) {
          const item = {
            itemName: product.item,
            flavour: flavourSelect ? flavourSelect.value : "",
            qty: Number(qtyInput.value) || 1,
            price: Number(product.price) || 0
          };
          cart.push(item);
        } else {
          // remove from cart
          cart = cart.filter(c => !(c.itemName === product.item));
        }
        saveCartToLocal();
        updateTotalUI();
      });

      qtyInput.addEventListener("input", () => {
        if (checkbox.checked) {
          const idxp = Number(checkbox.dataset.idx);
          const product = products[idxp];
          // update qty in cart
          cart = cart.map(c => {
            if (c.itemName === product.item) {
              return {...c, qty: Number(qtyInput.value) || 1};
            }
            return c;
          });
          saveCartToLocal();
          updateTotalUI();
        }
      });

      if (flavourSelect) {
        flavourSelect.addEventListener("change", () => {
          if (checkbox.checked) {
            const idxp = Number(checkbox.dataset.idx);
            const product = products[idxp];
            cart = cart.map(c => {
              if (c.itemName === product.item) {
                return {...c, flavour: flavourSelect.value};
              }
              return c;
            });
            saveCartToLocal();
          }
        });
      }
    });

    // Try to restore cart from localStorage (if user returned)
    restoreCartToUI();
    updateTotalUI();

  } catch (err) {
    container.innerHTML = "<div class='small' style='color:#c22'>Could not load products. Check your Apps Script URL and permissions.</div>";
  }
}

/* ---------- Local storage save/restore ---------- */
function saveCartToLocal() {
  localStorage.setItem("stellies_cart", JSON.stringify(cart));
}

function restoreCartToLocal() {
  const s = localStorage.getItem("stellies_cart");
  if (s) {
    try { cart = JSON.parse(s); } catch(e){ cart = []; }
  }
}

/* When reloading product UI, re-check checkboxes that are in cart */
function restoreCartToUI() {
  restoreCartToLocal();
  cart.forEach(item => {
    // find product index
    const idx = products.findIndex(p => p.item === item.itemName);
    if (idx >= 0) {
      const checkbox = document.getElementById(`p${idx}`);
      const qtyInput = document.getElementById(`qty-${idx}`);
      const flavourSelect = document.getElementById(`flavour-${idx}`);
      if (checkbox) checkbox.checked = true;
      if (qtyInput) qtyInput.value = item.qty;
      if (flavourSelect && item.flavour) flavourSelect.value = item.flavour;
    }
  });
}

/* ---------- Update totals ---------- */
function updateTotalUI() {
  const totalEl = document.getElementById("total");
  const sum = cart.reduce((acc,c)=> acc + (Number(c.price) * Number(c.qty)), 0);
  if (totalEl) totalEl.textContent = formatR(sum);
}

/* ---------- Handlers: finish button ---------- */
document.addEventListener("click", function(e){
  if (e.target && e.target.id === "finishBtn") {
    if (cart.length === 0) { alert("Please select at least one item."); return; }
    // generate orderNumber and save cart + subtotal
    const orderNumber = genOrderNumber();
    localStorage.setItem("orderNumber", orderNumber);
    localStorage.setItem("orderList", JSON.stringify(cart));
    const subtotal = cart.reduce((a,c)=> a + (c.price * c.qty), 0);
    localStorage.setItem("orderSubtotal", formatR(subtotal));
    // navigate to checkout
    window.location.href = "checkout.html";
  } else if (e.target && e.target.id === "refreshProducts") {
    renderProducts();
  } else if (e.target && e.target.id === "editButton") {
    // used in checkout page
    window.location.href = "index.html";
  }
});

/* ---------- Checkout page logic ---------- */
async function checkoutInit() {
  const orderNumber = localStorage.getItem("orderNumber") || genOrderNumber();
  const orderList = JSON.parse(localStorage.getItem("orderList") || "[]");
  const subtotal = Number(localStorage.getItem("orderSubtotal") || orderList.reduce((a,c)=> a + c.price*c.qty,0));

  // fill UI
  const orderNumEl = document.getElementById("orderNumber");
  if (orderNumEl) orderNumEl.textContent = orderNumber;
  const orderTable = document.getElementById("orderTable");
  if (orderTable) {
    orderTable.innerHTML = "";
    orderList.forEach(i => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${i.itemName}</td><td>${i.flavour || "-"}</td><td>${i.qty}</td><td>${formatR(i.price * i.qty)}</td>`;
      orderTable.appendChild(row);
    });
  }
  const orderSubtotalEl = document.getElementById("orderSubtotal");
  if (orderSubtotalEl) orderSubtotalEl.textContent = formatR(subtotal);

  // load addresses into select
  try {
    await fetchAddresses();
    const sel = document.getElementById("delivery");
    sel.innerHTML = "";
    addresses.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a;
      opt.textContent = a;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error("addresses load err", err);
  }

  // tip handling
  const tipInput = document.getElementById("tip");
  const finalTotalEl = document.getElementById("finalTotal");
  function updateFinal() {
    const tip = Number(tipInput.value || 0);
    finalTotalEl.textContent = formatR(subtotal + tip);
  }
  if (tipInput) tipInput.addEventListener("input", updateFinal);
  updateFinal();

  // Pay button (Yoco placeholder + post order)
  const payBtn = document.getElementById("payButton");
  if (payBtn) {
    payBtn.addEventListener("click", async () => {
      const name = (document.getElementById("name")||{}).value || "";
      const phone = (document.getElementById("phone")||{}).value || "";
      const delivery = (document.getElementById("delivery")||{}).value || "";
      const tip = Number((document.getElementById("tip")||{}).value || 0);
      const finalTotal = subtotal + tip;
      const orderNumberNow = orderNumber;

      if (!name || !phone || !delivery) { alert("Please fill name, phone and delivery address."); return; }

      // Save locally
      localStorage.setItem("customerName", name);
      localStorage.setItem("customerPhone", phone);
      localStorage.setItem("delivery", delivery);
      localStorage.setItem("tip", tip);
      localStorage.setItem("finalTotal", formatR(finalTotal));

      // Yoco placeholder: show popup (requires Yoco SDK and your public key)
      if (typeof window.YocoSDK === "undefined") {
        alert("Yoco SDK not loaded. Order will be saved without payment (testing mode).");
        // Save order to Google Sheet (no payment token)
        await postOrderToSheet({orderNumber: orderNumberNow, name, phone, delivery, tip, items: orderList, total: finalTotal, paymentToken: ""});
        window.location.href = "thankyou.html";
        return;
      }

      const yoco = new window.YocoSDK({ publicKey: YOCO_PUBLIC_KEY });

      yoco.showPopup({
        amountInCents: Math.round(finalTotal * 100),
        currency: "ZAR",
        name: "Stellies Dinner Order",
        description: `Order ${orderNumberNow}`,
        callback: async function(result) {
          if (result.error) {
            alert("Payment failed: " + result.error.message);
          } else {
            // result.id is the token
            const token = result.id || "";
            // Post to sheet with payment token
            await postOrderToSheet({orderNumber: orderNumberNow, name, phone, delivery, tip, items: orderList, total: finalTotal, paymentToken: token});
            window.location.href = "thankyou.html";
          }
        }
      });

    });
  }
}

/* ---------- Post order to Google Apps Script ---------- */
async function postOrderToSheet(payload) {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) {
      console.error("Order post error", json);
      alert("Could not save order to sheet: " + (json.message || "unknown"));
    } else {
      // Clear cart after successful save
      localStorage.removeItem("stellies_cart");
    }
    return json;
  } catch (err) {
    console.error("postOrderToSheet error", err);
    alert("Failed to send order to sheet. Check your Apps Script URL and deployment.");
    throw err;
  }
}

/* ---------- On page load ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  // if on index.html
  if (document.getElementById("productList")) {
    await renderProducts();
  }

  // if on checkout.html
  if (document.getElementById("orderTable")) {
    await checkoutInit();
    // wire up edit button
    const editBtn = document.getElementById("editButton");
    if (editBtn) editBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }
});
