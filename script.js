/* script.js
 - Uses your Apps Script endpoint (action=products / action=addresses / action=sponsors)
 - Multi-flavour support (select multiple flavours & qty per flavour)
 - Bulk discount logic per product (DiscountThreshold & DiscountPercent)
 - Sponsors column (up to 10 items)
 - Manages cart in localStorage
 - Posts orders to Apps Script
 - Yoco placeholder ready
*/

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwxP_vLG1PXl4l4_eKi_DTdK1duFwQiscXDDNqkFVcpdIuR_x212lHUp2rQJahWJKRS/exec";
const YOCO_PUBLIC_KEY = "pk_test_your_public_key_here"; // replace with your Yoco public key when ready

let products = [];
let addresses = [];
let sponsors = [];
let cart = []; // cart entries: { itemName, flavour, qty, price, discountThreshold, discountPercent }

/* ----- helpers ----- */
function formatR(v) { return Number(v || 0).toFixed(2); }
function saveCart() { localStorage.setItem("stellies_cart", JSON.stringify(cart)); }
function loadCart() { cart = JSON.parse(localStorage.getItem("stellies_cart") || "[]"); }
function genOrderNumber() {
  let count = Number(localStorage.getItem("stellies_order_count") || 0);
  count++; localStorage.setItem("stellies_order_count", count);
  return "SDP-" + String(count).padStart(4, "0");
}

/* ----- fetch data endpoints ----- */
async function fetchProducts() {
  const res = await fetch(APPS_SCRIPT_URL + "?action=products");
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Failed to load products");
  products = json.products;
  return products;
}
async function fetchAddresses() {
  const res = await fetch(APPS_SCRIPT_URL + "?action=addresses");
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Failed to load addresses");
  addresses = json.addresses;
  return addresses;
}
async function fetchSponsors() {
  const res = await fetch(APPS_SCRIPT_URL + "?action=sponsors");
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Failed to load sponsors");
  sponsors = json.sponsors;
  return sponsors;
}

/* ----- render sponsors in right column ----- */
async function renderSponsors() {
  const col = document.getElementById("sponsorCol");
  if (!col) return;
  try {
    await fetchSponsors();
    col.innerHTML = "";
    if (!sponsors || sponsors.length === 0) {
      col.innerHTML = `<div class="sponsor-box">Sponsored content area</div>`;
      return;
    }
    sponsors.forEach(s => {
      const box = document.createElement("div");
      box.className = "sponsor-box";
      if (s.image) {
        const img = document.createElement("img");
        img.src = s.image;
        img.alt = s.alt || s.title || "Sponsor";
        if (s.link) {
          const a = document.createElement("a");
          a.href = s.link;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.appendChild(img);
          box.appendChild(a);
        } else {
          box.appendChild(img);
        }
      } else {
        box.textContent = s.title || "Sponsored";
      }
      col.appendChild(box);
    });
    // fill empty slots up to 10 so layout stays stable
    for (let i = sponsors.length; i < 10; i++) {
      const empty = document.createElement("div");
      empty.className = "sponsor-box";
      empty.style.opacity = 0.35;
      empty.textContent = "Ad slot";
      col.appendChild(empty);
    }
  } catch (err) {
    col.innerHTML = `<div class="sponsor-box">Error loading sponsors</div>`;
    console.error(err);
  }
}

/* ----- render products (index) ----- */
async function renderProducts() {
  const container = document.getElementById("productList");
  if (!container) return;
  container.innerHTML = "<div class='small'>Loading items…</div>";
  try {
    await fetchProducts();
    container.innerHTML = "";
    products.forEach((p, idx) => {
      // product card
      const card = document.createElement("div");
      card.className = "product-row";
      card.id = `product-${idx}`;
      // left area with checkbox for non-flavoured product
      let leftHTML = `
        <div class="prod-left">
          <div class="checkbox-w">
            ${p.hasFlavours ? '' : `<input type="checkbox" id="pcheck-${idx}" data-idx="${idx}" />`}
          </div>
          <div>
            <div class="item-name">${p.item}</div>
            <div class="item-meta">${p.category || ""}</div>
            <div class="small" id="summary-${idx}"></div>
          </div>
        </div>
      `;

      // right area: price, controls and toggle for flavours
      let rightHTML = `
        <div class="prod-right">
          <div class="price">R ${formatR(p.price)}</div>
          <div class="controls">
            ${p.hasFlavours ? `<button class="btn ghost" id="toggle-${idx}" data-idx="${idx}">Choose flavours</button>` : `<input id="qty-${idx}" class="qty" type="number" min="1" value="1" />`}
          </div>
        </div>
      `;

      card.innerHTML = leftHTML + rightHTML;

      // flavour list (hidden by default)
      if (p.hasFlavours && p.flavours && p.flavours.length) {
        const flvContainer = document.createElement("div");
        flvContainer.className = "flavour-list";
        flvContainer.id = `flavours-${idx}`;
        p.flavours.forEach((f, fi) => {
          const fr = document.createElement("div");
          fr.className = "flavour-row";
          fr.innerHTML = `
            <input class="flv-checkbox" type="checkbox" id="f-${idx}-${fi}" data-idx="${idx}" data-fi="${fi}" />
            <label for="f-${idx}-${fi}" style="flex:1">${f}</label>
            <input class="flv-qty" id="fq-${idx}-${fi}" type="number" min="0" value="0" />
          `;
          flvContainer.appendChild(fr);

          // events for flavour checkbox & qty
          const flvCheckbox = fr.querySelector(`#f-${idx}-${fi}`);
          const flvQty = fr.querySelector(`#fq-${idx}-${fi}`);

          flvCheckbox.addEventListener("change", () => {
            const qty = Number(flvQty.value || 0);
            const flavourName = p.flavours[fi];
            if (flvCheckbox.checked) {
              // if qty is zero, set to 1 by default
              const useQty = qty > 0 ? qty : 1;
              // add to cart
              cart = cart.filter(c => !(c.itemName === p.item && c.flavour === flavourName));
              cart.push({
                itemName: p.item,
                flavour: flavourName,
                qty: useQty,
                price: Number(p.price) || 0,
                discountThreshold: Number(p.discountThreshold || 0),
                discountPercent: Number(p.discountPercent || 0)
              });
              flvQty.value = useQty;
            } else {
              // remove from cart
              cart = cart.filter(c => !(c.itemName === p.item && c.flavour === flavourName));
            }
            saveCart(); updateTotalUI(); updateSummary(idx);
          });

          flvQty.addEventListener("input", () => {
            const flavourName = p.flavours[fi];
            const existing = cart.find(c => c.itemName === p.item && c.flavour === flavourName);
            const newQty = Math.max(0, Number(flvQty.value || 0));
            if (existing) {
              if (newQty <= 0) {
                // uncheck and remove
                fr.querySelector('.flv-checkbox').checked = false;
                cart = cart.filter(c => !(c.itemName === p.item && c.flavour === flavourName));
              } else {
                existing.qty = newQty;
              }
            } else {
              if (newQty > 0) {
                fr.querySelector('.flv-checkbox').checked = true;
                cart.push({
                  itemName: p.item,
                  flavour: flavourName,
                  qty: newQty,
                  price: Number(p.price) || 0,
                  discountThreshold: Number(p.discountThreshold || 0),
                  discountPercent: Number(p.discountPercent || 0)
                });
              }
            }
            saveCart(); updateTotalUI(); updateSummary(idx);
          });
        });
        card.appendChild(flvContainer);
      }

      container.appendChild(card);

      // events for product-level checkbox (non-flavour) and toggle
      if (!p.hasFlavours) {
        const pcheck = card.querySelector(`#pcheck-${idx}`);
        const qtyInput = card.querySelector(`#qty-${idx}`);
        pcheck.addEventListener("change", () => {
          if (pcheck.checked) {
            // add or replace
            cart = cart.filter(c => c.itemName !== p.item);
            cart.push({
              itemName: p.item,
              flavour: "",
              qty: Number(qtyInput.value) || 1,
              price: Number(p.price) || 0,
              discountThreshold: Number(p.discountThreshold || 0),
              discountPercent: Number(p.discountPercent || 0)
            });
          } else {
            cart = cart.filter(c => c.itemName !== p.item);
          }
          saveCart(); updateTotalUI(); updateSummary(idx);
        });
        qtyInput.addEventListener("input", () => {
          cart = cart.map(c => c.itemName === p.item ? {...c, qty: Number(qtyInput.value) || 1} : c);
          saveCart(); updateTotalUI(); updateSummary(idx);
        });
      } else {
        // toggle flavours visibility
        const toggle = card.querySelector(`#toggle-${idx}`);
        const flvList = card.querySelector(`#flavours-${idx}`);
        toggle.addEventListener("click", () => {
          if (!flvList) return;
          const shown = flvList.style.display === "block";
          flvList.style.display = shown ? "none" : "block";
        });
      }

      // update summary if cart restored
      updateSummary(idx);
    });

    // restore cart UI from localStorage
    restoreCartUI();
    updateTotalUI();
  } catch (err) {
    container.innerHTML = `<div class="small" style="color:#c22">Could not load products. Check Apps Script URL and deployment.</div>`;
    console.error(err);
  }
}

/* update small summary string under product (how many flavours selected / qty) */
function updateSummary(idx) {
  const p = products[idx];
  const summaryEl = document.getElementById(`summary-${idx}`);
  if (!summaryEl) return;
  // gather cart entries for this product
  const entries = cart.filter(c => c.itemName === p.item);
  if (!entries || entries.length === 0) {
    summaryEl.textContent = "";
    return;
  }
  // if flavours exist show count of flavours selected and total qty
  if (p.hasFlavours) {
    const totalQty = entries.reduce((a,b) => a + (b.qty||0), 0);
    summaryEl.textContent = `${entries.length} flavour(s) • ${totalQty} total`;
  } else {
    summaryEl.textContent = `${entries[0].qty} selected`;
  }
}

/* restore cart UI on page load */
function restoreCartUI() {
  loadCart();
  // for each cart item, check matching UI control
  cart.forEach(item => {
    const idx = products.findIndex(p => p.item === item.itemName);
    if (idx < 0) return;
    if (item.flavour) {
      // find flavour index
      const p = products[idx];
      const fi = (p.flavours || []).findIndex(f => f === item.flavour);
      if (fi >= 0) {
        const cb = document.getElementById(`f-${idx}-${fi}`);
        const q = document.getElementById(`fq-${idx}-${fi}`);
        if (cb) cb.checked = true;
        if (q) q.value = item.qty;
      }
    } else {
      const cb = document.getElementById(`pcheck-${idx}`);
      const q = document.getElementById(`qty-${idx}`);
      if (cb) cb.checked = true;
      if (q) q.value = item.qty;
    }
    updateSummary(idx);
  });
}

/* ----- calculate totals with discounts ----- */
function calculateGrandTotal() {
  // group cart entries by product
  const groups = {};
  cart.forEach(c => {
    if (!groups[c.itemName]) groups[c.itemName] = { unitPrice: c.price, totalQty: 0, discountThreshold: c.discountThreshold || 0, discountPercent: c.discountPercent || 0, entries: [] };
    groups[c.itemName].totalQty += Number(c.qty || 0);
    groups[c.itemName].entries.push(c);
  });

  let grandTotal = 0;
  // compute each product subtotal and apply discount if eligible
  Object.keys(groups).forEach(name => {
    const g = groups[name];
    const subtotal = g.unitPrice * g.totalQty;
    let productTotal = subtotal;
    if (g.discountThreshold && g.totalQty >= g.discountThreshold) {
      productTotal = subtotal * (1 - (g.discountPercent || 0) / 100);
    }
    grandTotal += productTotal;
  });

  return Number(grandTotal);
}

function updateTotalUI() {
  const totalEl = document.getElementById("total");
  const total = calculateGrandTotal();
  if (totalEl) totalEl.textContent = formatR(total);
}

/* ----- finish button: go to checkout ----- */
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "finishBtn") {
    loadCart();
    if (cart.length === 0) { alert("Please select at least one item."); return; }
    const orderNumber = genOrderNumber();
    localStorage.setItem("orderNumber", orderNumber);
    localStorage.setItem("orderList", JSON.stringify(cart));
    localStorage.setItem("orderSubtotal", formatR(calculateGrandTotal()));
    window.location.href = "checkout.html";
  } else if (e.target && e.target.id === "refreshProducts") {
    renderProducts();
  } else if (e.target && e.target.id === "viewOrder") {
    window.location.href = "checkout.html";
  } else if (e.target && e.target.id === "editButton") {
    window.location.href = "index.html";
  }
});

/* ----- POST order to Apps Script (checkout page) ----- */
async function postOrder(payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "Failed to save order");
  // clear cart
  localStorage.removeItem("stellies_cart");
  return json;
}

/* ----- checkout page init ----- */
async function checkoutInit() {
  loadCart();
  const orderNumber = localStorage.getItem("orderNumber") || genOrderNumber();
  const orderList = JSON.parse(localStorage.getItem("orderList") || "[]");
  // compute subtotal using discount-aware function
  const subtotal = Number(localStorage.getItem("orderSubtotal") || calculateGrandTotal());

  // populate UI
  document.getElementById("orderNumber").textContent = orderNumber;
  const orderTable = document.getElementById("orderTable");
  if (orderTable) {
    orderTable.innerHTML = "";
    orderList.forEach(i => {
      const tr = document.createElement("tr");
      const lineTotal = Number(i.price) * Number(i.qty);
      tr.innerHTML = `<td>${i.itemName}</td><td>${i.flavour || "-"}</td><td>${i.qty}</td><td>R ${formatR(lineTotal)}</td>`;
      orderTable.appendChild(tr);
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

  // handle tip and final total
  const tipInput = document.getElementById("tip");
  const finalTotalEl = document.getElementById("finalTotal");
  function updateFinal() {
    const tip = Number(tipInput.value || 0);
    // Recalculate final by reusing calculateGrandTotal (in case user edited anything)
    const recalculated = calculateGrandTotal();
    finalTotalEl.textContent = formatR(recalculated + tip);
  }
  if (tipInput) tipInput.addEventListener("input", updateFinal);
  updateFinal();

  // pay button logic
  const payBtn = document.getElementById("payButton");
  if (!payBtn) return;
  payBtn.addEventListener("click", async () => {
    const name = (document.getElementById("name")||{}).value.trim();
    const phone = (document.getElementById("phone")||{}).value.trim();
    const email = (document.getElementById("email")||{}).value.trim();
    const delivery = (document.getElementById("delivery")||{}).value;
    const tip = Number((document.getElementById("tip")||{}).value || 0);
    const notes = (document.getElementById("notes")||{}).value || "";
    // final total uses calculateGrandTotal to include discounts
    const finalTotal = calculateGrandTotal() + tip;
    const orderNumberNow = orderNumber;
    const orderListNow = JSON.parse(localStorage.getItem("orderList") || "[]");

    if (!name || !phone || !delivery) { alert("Please fill name, phone and delivery address."); return; }

    localStorage.setItem("customerName", name);
    localStorage.setItem("customerPhone", phone);
    localStorage.setItem("delivery", delivery);
    localStorage.setItem("tip", tip);
    localStorage.setItem("finalTotal", formatR(finalTotal));

    // If Yoco not configured, skip payment (testing)
    if (typeof window.YocoSDK === "undefined" || YOCO_PUBLIC_KEY === "pk_test_your_public_key_here") {
      try {
        await postOrder({
          orderNumber: orderNumberNow,
          name, phone, email, delivery, tip, notes,
          items: orderListNow,
          total: finalTotal,
          paymentToken: ""
        });
        window.location.href = "thankyou.html";
      } catch (err) {
        alert("Failed to save order: " + err.message);
      }
      return;
    }

    // Yoco payment flow
    const yoco = new window.YocoSDK({ publicKey: YOCO_PUBLIC_KEY });
    yoco.showPopup({
      amountInCents: Math.round(finalTotal * 100),
      currency: "ZAR",
      name: "Stellies Dinner Packs Order",
      description: `Order ${orderNumberNow}`,
      callback: async function(result) {
        if (result.error) {
          alert("Payment failed: " + result.error.message);
        } else {
          const token = result.id || "";
          try {
            await postOrder({
              orderNumber: orderNumberNow,
              name, phone, email, delivery, tip, notes,
              items: orderListNow,
              total: finalTotal,
              paymentToken: token
            });
            window.location.href = "thankyou.html";
          } catch (err) {
            alert("Failed to save order after payment: " + err.message);
          }
        }
      }
    });
  });
}

/* ---------- init ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  // index page
  if (document.getElementById("productList")) {
    loadCart();
    await renderProducts();
    renderSponsors();
  }
  // checkout page
  if (document.getElementById("orderTable")) {
    await checkoutInit();
    const editBtn = document.getElementById("editButton");
    if (editBtn) editBtn.addEventListener("click", () => window.location.href = "index.html");
  }
});
