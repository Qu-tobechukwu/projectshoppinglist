// script.js — Eden Creates (copy/paste ready)

// ----------------------
// Hardcoded product list
// ----------------------
const PRODUCTS = [
  { id:1, name:"Golden Hour Mug", price:180, image:"assets/images/1.png", description:"a soft-matte ceramic mug with a gold lip — mornings feel richer." },
  { id:2, name:"Ink & Ivory Notebook", price:120, image:"assets/images/2.png", description:"linen-textured cover and smooth, lined pages." },
  { id:3, name:"The Thinker’s Tote", price:250, image:"assets/images/3.png", description:"oversized cotton tote with subtle gold emblem." },
  { id:4, name:"Sunday Sketch Scarf", price:300, image:"assets/images/4.png", description:"muted gray wrap threaded with antique gold." },
  { id:5, name:"Eden Candle", price:220, image:"assets/images/1.png", description:"hand-poured soy candle, warm amber & vanilla." },
  { id:6, name:"The Dreamer’s Pen", price:90, image:"assets/images/2.png", description:"smooth black ink pen with golden accents." },
  { id:7, name:"Shimmer Journal Set", price:200, image:"assets/images/3.png", description:"three pocket notebooks with gilded edges." },
];

// ----------------------
// Utilities & localStorage
// ----------------------
const CART_KEY = "eden_cart_v1";
const ORDERS_KEY = "eden_orders_v1";

function readCart(){ try{ return JSON.parse(localStorage.getItem(CART_KEY)) || []; }catch(e){ return []; } }
function writeCart(cart){ localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateCartUI(); }
function readOrders(){ try{ return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; }catch(e){ return []; } }
function writeOrders(arr){ localStorage.setItem(ORDERS_KEY, JSON.stringify(arr)); }

// ----------------------
// Render products
// ----------------------
function renderProducts(targetSelector = ".products"){
  const el = document.querySelector(targetSelector);
  if(!el) return;
  el.innerHTML = PRODUCTS.map(p => productCardHTML(p)).join("");
}
function productCardHTML(p){
  return `
    <div class="product-card" data-id="${p.id}">
      <img class="product-img" src="${p.image}" alt="${escapeHtml(p.name)}" onerror="this.src='assets/images/1.png'">
      <div>
        <div class="product-title">${escapeHtml(p.name)}</div>
        <div class="product-desc">${escapeHtml(p.description)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
          <div class="product-price">R ${Number(p.price).toFixed(2)}</div>
          <button class="add-btn" onclick="addToCart(${p.id})">add</button>
        </div>
      </div>
    </div>
  `;
}

// ----------------------
// Cart: add, remove, render
// ----------------------
function addToCart(id){
  const cart = readCart();
  const entry = cart.find(i=>i.id===id);
  if(entry) entry.q += 1;
  else cart.push({ id, q:1 });
  writeCart(cart);
  showToast("Added to cart");
}
function removeFromCart(id){
  let cart = readCart();
  cart = cart.filter(i=>i.id!==id);
  writeCart(cart);
  showToast("Removed");
}
function updateCartUI(){
  // update top total pills
  const cart = readCart();
  const total = cart.reduce((s,it)=>{
    const p = PRODUCTS.find(x=>x.id===it.id);
    return s + (p ? p.price * it.q : 0);
  },0);
  document.querySelectorAll("#topTotal, #topTotal2, #topTotal3").forEach(el=>{
    if(el) el.textContent = Number(total).toFixed(2);
  });

  // if checkout summary exists, render
  const sumEl = document.getElementById("checkoutSummary");
  if(sumEl){
    if(cart.length===0){ sumEl.innerHTML = "<div class='muted'>Your cart is empty.</div>"; document.getElementById("checkoutTotal").textContent="0.00"; return; }
    sumEl.innerHTML = cart.map(it=>{
      const p = PRODUCTS.find(x=>x.id===it.id);
      return `<div style="display:flex;justify-content:space-between;padding:6px 0">
                <div>${escapeHtml(p.name)} × ${it.q}</div>
                <div>R ${Number(p.price * it.q).toFixed(2)}</div>
              </div>`;
    }).join("");
    document.getElementById("checkoutTotal").textContent = Number(total).toFixed(2);
  }
}

// ----------------------
// Checkout: prepare form fields (FormSubmit)
// ----------------------
function prepareCheckoutForm(){
  const form = document.getElementById("orderForm");
  if(!form) return;
  // generate order number
  const orderNumber = "EC-" + Date.now().toString().slice(-6);
  document.getElementById("orderNumberInput").value = orderNumber;

  // compute items & total
  const cart = readCart();
  const items = cart.map(it=>{
    const p = PRODUCTS.find(x=>x.id===it.id);
    return { id: it.id, name: p.name, price: p.price, qty: it.q };
  });
  const total = items.reduce((s,i)=>s + i.price * i.qty, 0);

  document.getElementById("orderTotalInput").value = Number(total).toFixed(2);
  document.getElementById("orderInput").value = JSON.stringify({ orderNumber, items, total });

  // also save to local orders store when user submits (we do that in submit handler)
  form.addEventListener("submit", function(evt){
    // ensure hidden fields are up to date
    document.getElementById("orderNumberInput").value = orderNumber;
    document.getElementById("orderTotalInput").value = Number(total).toFixed(2);
    document.getElementById("orderInput").value = JSON.stringify({ orderNumber, items, total });

    // save a local copy for tracking (client side)
    const orderObj = {
      orderNumber,
      items,
      total,
      name: document.getElementById("custName").value || "",
      email: document.getElementById("custEmail").value || "",
      address: document.getElementById("custAddress").value || "",
      notes: document.getElementById("custNotes").value || "",
      created: new Date().toISOString(),
      status: "Pending"
    };
    const orders = readOrders();
    orders.push(orderObj);
    writeOrders(orders);
    // cart cleared after a small delay will be handled by redirect from FormSubmit (but clear here too)
    localStorage.removeItem(CART_KEY);
  });
}

// ----------------------
// Order status lookup (localStorage)
 // ----------------------
function lookupOrder(value){
  const orders = readOrders();
  const v = (value||"").toString().trim().toLowerCase();
  if(!v) return null;
  return orders.find(o =>
    (o.orderNumber && o.orderNumber.toString().toLowerCase() === v) ||
    (o.email && o.email.toString().toLowerCase() === v)
  ) || null;
}

// ----------------------
// small helpers
// ----------------------
function escapeHtml(s){ if(s==null) return ""; return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function showToast(msg, time=1700){
  const t = document.createElement("div");
  t.className = "toast show";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=> t.classList.remove("show"), time-300);
  setTimeout(()=> t.remove(), time);
}

// ----------------------
// PWA install prompt wiring
// ----------------------
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  // show install buttons
  document.querySelectorAll('#installTop,#installTop2,#installTop3,#installBottom,#installBottom2,#installBottom3').forEach(b=>{
    if(b) b.style.display = 'inline-block';
  });
});
function setupInstallButtons(){
  document.querySelectorAll('#installTop,#installTop2,#installTop3,#installBottom,#installBottom2,#installBottom3').forEach(btn=>{
    if(!btn) return;
    btn.addEventListener('click', async ()=>{
      if(!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      btn.style.display = 'none';
    });
  });
}

// ----------------------
// index / merch / checkout / order-status initializers
// ----------------------
document.addEventListener('DOMContentLoaded', ()=>{
  renderProducts("#products");
  renderProducts("#productsList");
  updateCartUI();
  prepareCheckoutForm();
  setupInstallButtons();

  // wire lookup form on order-status page
  const lookupForm = document.getElementById("lookupForm");
  if(lookupForm){
    lookupForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      const val = document.getElementById("lookupValue").value;
      const match = lookupOrder(val);
      const out = document.getElementById("lookupResult");
      out.style.display = 'block';
      if(!match) out.innerHTML = "<div class='muted'>No local order found. Check your email for confirmation.</div>";
      else {
        out.innerHTML = `<h3>Order ${escapeHtml(match.orderNumber)}</h3>
                         <div><strong>Name:</strong> ${escapeHtml(match.name)}</div>
                         <div><strong>Email:</strong> ${escapeHtml(match.email)}</div>
                         <div><strong>Address:</strong> ${escapeHtml(match.address)}</div>
                         <div><strong>Items:</strong>
                           <ul>${match.items.map(i=>`<li>${escapeHtml(i.name)} × ${i.qty} — R${Number(i.price * i.qty).toFixed(2)}</li>`).join("")}</ul>
                         </div>
                         <div><strong>Total:</strong> R${Number(match.total).toFixed(2)}</div>
                         <div><strong>Status:</strong> ${escapeHtml(match.status)}</div>`;
      }
    });

    // show latest
    const showLatest = document.getElementById("showLatest");
    if(showLatest){
      showLatest.addEventListener("click", ()=>{
        const orders = readOrders();
        if(!orders.length){ document.getElementById("lookupResult").innerHTML = "<div class='muted'>No local orders found.</div>"; document.getElementById("lookupResult").style.display='block'; return; }
        const latest = orders[orders.length-1];
        document.getElementById("lookupValue").value = latest.orderNumber || latest.email || "";
        document.getElementById("lookupResult").style.display='block';
        document.getElementById("lookupResult").innerHTML = `<h3>Order ${escapeHtml(latest.orderNumber)}</h3>
          <div><strong>Name:</strong> ${escapeHtml(latest.name)}</div>
          <div><strong>Email:</strong> ${escapeHtml(latest.email)}</div>
          <div><strong>Total:</strong> R${Number(latest.total).toFixed(2)}</div>
          <div><strong>Status:</strong> ${escapeHtml(latest.status)}</div>`;
      });
    }
  }

  // if checkout page: update summary area
  if(document.getElementById("checkoutSummary")) updateCartUI();

  // if on checkout form, ensure hidden fields update when fields change
  const form = document.getElementById("orderForm");
  if(form){
    const updateHidden = ()=> prepareCheckoutForm();
    ["custName","custEmail","custAddress","custNotes"].forEach(id=>{
      const input = document.getElementById(id);
      if(input) input.addEventListener("input", updateHidden);
    });
  }
});
