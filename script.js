/* script.js — Eden Creates
   - Hardcoded products (uses assets/images/1..4.png)
   - Render products on index & merch pages
   - Cart management in localStorage, top total UI
   - Toast on add
   - Checkout FormSubmit hidden fields population & local order save
   - Order lookup on order-status page
   - PWA install prompt wiring
*/

// ----------------- Config / Data -----------------
const PRODUCTS = [
  { id:1, name:"Morning Edition Journal", price:180, image:"assets/images/1.png", description:"Start the day with elegant intention — linen cover, gold foil edge." },
  { id:2, name:"Deadline Mug", price:120, image:"assets/images/2.png", description:"A calm cup for late nights and early headlines." },
  { id:3, name:"The Columnist Tote", price:250, image:"assets/images/3.png", description:"A roomy canvas tote with a subtle gold emblem." },
  { id:4, name:"Editor’s Notebook", price:300, image:"assets/images/4.png", description:"Soft pages and a sturdy spine for quick jottings." },
  { id:5, name:"Eden Candle — Amber", price:220, image:"assets/images/1.png", description:"Hand-poured soy with warm amber & vanilla." },
  { id:6, name:"The Dreamer’s Pen", price:90, image:"assets/images/2.png", description:"A smooth black-ink pen with gilded trim." },
  { id:7, name:"Shimmer Journal Set", price:200, image:"assets/images/3.png", description:"Three pocket journals with gilded edges." },
];

const CART_KEY = "eden_cart_v2";
const ORDERS_KEY = "eden_orders_v2";

// ----------------- Helpers -----------------
function $(q){ return document.querySelector(q); }
function $all(q){ return Array.from(document.querySelectorAll(q)); }
function formatCurrency(n){ return Number(n).toFixed(2); }
function readCart(){ try{ return JSON.parse(localStorage.getItem(CART_KEY)) || []; }catch(e){ return []; } }
function writeCart(c){ localStorage.setItem(CART_KEY, JSON.stringify(c)); updateCartUI(); }
function readOrders(){ try{ return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; }catch(e){ return []; } }
function writeOrders(arr){ localStorage.setItem(ORDERS_KEY, JSON.stringify(arr)); }

// ----------------- Rendering -----------------
function renderProducts(selector){
  const container = document.querySelector(selector);
  if(!container) return;
  container.innerHTML = PRODUCTS.map(p => `
    <div class="product-card" data-id="${p.id}">
      <img class="product-img" src="${p.image}" alt="${escapeHtml(p.name)}" onerror="this.src='assets/images/1.png'">
      <div>
        <div class="product-title">${escapeHtml(p.name)}</div>
        <div class="product-desc">${escapeHtml(p.description)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
          <div class="product-price">R ${formatCurrency(p.price)}</div>
          <button class="add-btn" data-id="${p.id}">add</button>
        </div>
      </div>
    </div>
  `).join("");
  // wire buttons
  container.querySelectorAll(".add-btn").forEach(b => b.addEventListener("click", ()=> addToCart(Number(b.dataset.id))));
}

// ----------------- Cart logic -----------------
function addToCart(id){
  const cart = readCart();
  const item = cart.find(i=>i.id===id);
  if(item) item.q += 1;
  else cart.push({ id, q: 1 });
  writeCart(cart);
  showToast("Added to cart");
}
function removeFromCart(id){
  let cart = readCart();
  cart = cart.filter(i=>i.id !== id);
  writeCart(cart);
  showToast("Removed");
}
function updateCartUI(){
  const cart = readCart();
  const total = cart.reduce((s,it)=>{
    const p = PRODUCTS.find(x=>x.id===it.id);
    return s + (p ? p.price * it.q : 0);
  },0);
  // update all top totals
  $all("#topTotal,#topTotal2,#topTotal3").forEach(el => {
    if(el) el.textContent = formatCurrency(total);
  });
  // update checkout summary if present
  const sumEl = $("#checkoutSummary");
  if(sumEl){
    if(cart.length === 0) { sumEl.innerHTML = "<div class='muted'>Your cart is empty.</div>"; $("#checkoutTotal").textContent = "0.00"; return; }
    sumEl.innerHTML = cart.map(it=>{
      const p = PRODUCTS.find(x=>x.id===it.id) || {};
      return `<div style="display:flex;justify-content:space-between;padding:6px 0">
                <div>${escapeHtml(p.name || 'Item')} × ${it.q}</div>
                <div>R ${formatCurrency((p.price||0) * it.q)}</div>
              </div>`;
    }).join("");
    $("#checkoutTotal").textContent = formatCurrency(total);
  }
}

// ----------------- Checkout & FormSubmit integration -----------------
function prepareCheckoutForm(){
  const form = $("#orderForm");
  if(!form) return;
  // create order snapshot
  const cart = readCart();
  const items = cart.map(it => {
    const p = PRODUCTS.find(x=>x.id===it.id);
    return { id:it.id, name: p?.name || "", price: p?.price || 0, qty: it.q };
  });
  const total = items.reduce((s,i) => s + i.price * i.qty, 0);
  const orderNumber = "EC-" + Date.now().toString().slice(-6);
  // fill hidden inputs
  const numEl = $("#orderNumberInput");
  const totalEl = $("#orderTotalInput");
  const orderEl = $("#orderInput");
  if(numEl) numEl.value = orderNumber;
  if(totalEl) totalEl.value = formatCurrency(total);
  if(orderEl) orderEl.value = JSON.stringify({ orderNumber, items, total });

  // on submit, save local copy for order-status lookup
  form.addEventListener("submit", function(){
    const orderObj = {
      orderNumber,
      items,
      total,
      name: $("#custName")?.value || "",
      email: $("#custEmail")?.value || "",
      address: $("#custAddress")?.value || "",
      notes: $("#custNotes")?.value || "",
      created: new Date().toISOString(),
      status: "Pending"
    };
    const orders = readOrders();
    orders.push(orderObj);
    writeOrders(orders);
    // clear cart (FormSubmit will redirect so this is safe)
    localStorage.removeItem(CART_KEY);
  }, { once: true });
}

// ----------------- Order lookup -----------------
function lookupLocalOrder(value){
  const orders = readOrders();
  const v = (value||"").toString().trim().toLowerCase();
  if(!v) return null;
  return orders.find(o => (o.orderNumber && o.orderNumber.toLowerCase() === v) || (o.email && o.email.toLowerCase() === v)) || null;
}

// ----------------- Small UI helpers -----------------
function escapeHtml(s){ if(s==null) return ""; return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function showToast(msg, time=1600){
  const t = document.createElement("div");
  t.className = "toast show";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=> t.classList.remove("show"), time-300);
  setTimeout(()=> t.remove(), time);
}

// ----------------- PWA install wiring -----------------
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // show any install buttons
  $all('#installTop,#installTop2,#installTop3,#installBottom,#installBottom2,#installBottom3').forEach(b => { if(b) b.style.display = 'inline-block'; });
});
function setupInstallButtons(){
  $all('#installTop,#installTop2,#installTop3,#installBottom,#installBottom2,#installBottom3').forEach(btn=>{
    if(!btn) return;
    btn.addEventListener('click', async ()=>{
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      btn.style.display = 'none';
    });
  });
}

// ----------------- Page initializers -----------------
document.addEventListener('DOMContentLoaded', ()=>{
  // render where applicable
  renderProducts("#products");
  renderProducts("#productsList");

  // wire UI
  updateCartUI();
  setupInstallButtons();

  // prepare checkout hidden fields (if on checkout)
  if($("#orderForm")){
    prepareCheckoutForm();
  }

  // order-status page form
  const lookupForm = $("#lookupForm");
  if(lookupForm){
    lookupForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      const v = $("#lookupValue").value;
      const result = lookupLocalOrder(v);
      const out = $("#lookupResult");
      out.style.display = 'block';
      if(!result) out.innerHTML = "<div class='muted'>No local order found. Check your confirmation email.</div>";
      else {
        out.innerHTML = `<h3>Order ${escapeHtml(result.orderNumber)}</h3>
        <div><strong>Name:</strong> ${escapeHtml(result.name)}</div>
        <div><strong>Email:</strong> ${escapeHtml(result.email)}</div>
        <div><strong>Address:</strong> ${escapeHtml(result.address)}</div>
        <div><strong>Items:</strong><ul>${result.items.map(i=>`<li>${escapeHtml(i.name)} × ${i.qty} — R${formatCurrency(i.price * i.qty)}</li>`).join("")}</ul></div>
        <div><strong>Total:</strong> R${formatCurrency(result.total)}</div>
        <div><strong>Status:</strong> ${escapeHtml(result.status)}</div>`;
      }
    });

    const showLatest = $("#showLatest");
    if(showLatest){
      showLatest.addEventListener("click", ()=>{
        const orders = readOrders();
        const out = $("#lookupResult");
        out.style.display = 'block';
        if(!orders.length){ out.innerHTML = "<div class='muted'>No local orders saved.</div>"; return; }
        const latest = orders[orders.length-1];
        out.innerHTML = `<h3>Order ${escapeHtml(latest.orderNumber)}</h3>
          <div><strong>Name:</strong> ${escapeHtml(latest.name)}</div>
          <div><strong>Email:</strong> ${escapeHtml(latest.email)}</div>
          <div><strong>Total:</strong> R${formatCurrency(latest.total)}</div>
          <div><strong>Status:</strong> ${escapeHtml(latest.status)}</div>`;
      });
    }
  }

  // wire quick top nav totals if any nav add/remove actions needed
  // (already updated via updateCartUI)
});
