/* script.js - frontend */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwxP_vLG1PXl4l4_eKi_DTdK1duFwQiscXDDNqkFVcpdIuR_x212lHUp2rQJahWJKRS/exec";
const YOCO_PUBLIC_KEY = "pk_test_your_public_key_here"; // replace when ready

let products = [], addresses = [], sponsors = [], cart = [];

/* helpers */
function formatR(v){ return Number(v||0).toFixed(2); }
function saveCart(){ localStorage.setItem("stellies_cart", JSON.stringify(cart)); }
function loadCart(){ cart = JSON.parse(localStorage.getItem("stellies_cart") || "[]"); }
function genOrderNumber(){ let n = Number(localStorage.getItem("stellies_order_count")||0)+1; localStorage.setItem("stellies_order_count", n); return "SDP-" + String(n).padStart(4,"0"); }

/* fetch functions */
async function fetchProducts(){ const r = await fetch(APPS_SCRIPT_URL + "?action=products"); const j = await r.json(); if(!j.success) throw new Error(j.message); products = j.products; return products; }
async function fetchAddresses(){ const r = await fetch(APPS_SCRIPT_URL + "?action=addresses"); const j = await r.json(); if(!j.success) throw new Error(j.message); addresses = j.addresses; return addresses; }
async function fetchSponsors(){ const r = await fetch(APPS_SCRIPT_URL + "?action=sponsors"); const j = await r.json(); if(!j.success) throw new Error(j.message); sponsors = j.sponsors; return sponsors; }

/* render sponsors */
async function renderSponsors(){
  const col = document.getElementById("sponsorCol");
  if(!col) return;
  try{
    await fetchSponsors();
    col.innerHTML = "";
    if(!sponsors || sponsors.length===0){
      for(let i=0;i<4;i++){ const empty = document.createElement("div"); empty.className="sponsor-box"; empty.style.opacity=0.35; empty.textContent="Ad slot"; col.appendChild(empty); }
      return;
    }
    sponsors.forEach(s=>{
      const box = document.createElement("div"); box.className="sponsor-box";
      if(s.image){
        const img = document.createElement("img"); img.src = s.image; img.alt = s.alt || s.title || "Ad";
        if(s.link){
          const a = document.createElement("a"); a.href = s.link; a.target="_blank"; a.rel="noopener noreferrer"; a.appendChild(img); box.appendChild(a);
        } else box.appendChild(img);
      } else {
        box.textContent = s.title || "Sponsored";
      }
      col.appendChild(box);
    });
    for(let i=sponsors.length;i<10;i++){ const empty = document.createElement("div"); empty.className="sponsor-box"; empty.style.opacity=0.35; empty.textContent="Ad slot"; col.appendChild(empty); }
  }catch(err){
    col.innerHTML = '<div class="sponsor-box">Could not load sponsors</div>';
    console.error(err);
  }
}

/* render products with multi-flavour controls */
async function renderProducts(){
  const container = document.getElementById("productList"); if(!container) return;
  container.innerHTML = "<div class='small'>Loading items…</div>";
  try{
    await fetchProducts();
    container.innerHTML = "";
    products.forEach((p, idx)=>{
      const card = document.createElement("div"); card.className="product-row"; card.id=`product-${idx}`;
      let left = `
        <div class="prod-left">
          <div class="checkbox-w">${p.hasFlavours ? '' : `<input type="checkbox" id="pcheck-${idx}" data-idx="${idx}" />`}</div>
          <div>
            <div class="item-name">${p.item}</div>
            <div class="item-meta">${p.category || ''}</div>
            <div id="summary-${idx}" class="small"></div>
            ${p.bulkThreshold && p.bulkDiscountPercent ? `<div class="discount-badge">🍦 Buy ${p.bulkThreshold}+ and get ${p.bulkDiscountPercent}% off</div>` : ''}
          </div>
        </div>`;
      let right = `
        <div class="prod-right">
          <div class="price">R ${formatR(p.price)}</div>
          <div class="controls">
            ${p.hasFlavours ? `<button class="btn ghost" id="toggle-${idx}">Choose flavours</button>` : `<input id="qty-${idx}" class="qty" type="number" min="1" value="1" />`}
          </div>
        </div>`;
      card.innerHTML = left + right;

      // flavour list
      if(p.hasFlavours && p.flavours && p.flavours.length){
        const flvContainer = document.createElement("div"); flvContainer.className="flavour-list"; flvContainer.id=`flavours-${idx}`;
        p.flavours.forEach((f, fi)=>{
          const fr = document.createElement("div"); fr.className="flavour-row";
          fr.innerHTML = `<input class="flv-checkbox" type="checkbox" id="f-${idx}-${fi}" data-idx="${idx}" data-fi="${fi}" />
                          <label for="f-${idx}-${fi}" style="flex:1">${f}</label>
                          <input class="flv-qty" id="fq-${idx}-${fi}" type="number" min="0" value="0" />`;
          flvContainer.appendChild(fr);
          const cb = fr.querySelector(`#f-${idx}-${fi}`);
          const q = fr.querySelector(`#fq-${idx}-${fi}`);
          cb.addEventListener("change", ()=>{
            const flavour = p.flavours[fi];
            const qty = Number(q.value || 0) || 0;
            if(cb.checked){
              const useQty = qty>0?qty:1;
              cart = cart.filter(c=>!(c.itemName===p.item && c.flavour===flavour));
              cart.push({ itemName: p.item, flavour, qty: useQty, price: Number(p.price||0), bulkThreshold: Number(p.bulkThreshold||0), bulkDiscountPercent: Number(p.bulkDiscountPercent||0) });
              q.value = useQty;
            } else {
              cart = cart.filter(c=>!(c.itemName===p.item && c.flavour===flavour));
            }
            saveCart(); updateTotalUI(); updateSummary(idx);
          });
          q.addEventListener("input", ()=>{
            const flavour = p.flavours[fi]; const newQty = Math.max(0, Number(q.value||0));
            const existing = cart.find(c=>c.itemName===p.item && c.flavour===flavour);
            if(existing){
              if(newQty<=0){ fr.querySelector('.flv-checkbox').checked = false; cart = cart.filter(c=>!(c.itemName===p.item && c.flavour===flavour)); }
              else existing.qty = newQty;
            } else {
              if(newQty>0){ fr.querySelector('.flv-checkbox').checked = true; cart.push({ itemName:p.item, flavour, qty:newQty, price:Number(p.price||0), bulkThreshold:Number(p.bulkThreshold||0), bulkDiscountPercent:Number(p.bulkDiscountPercent||0) }); }
            }
            saveCart(); updateTotalUI(); updateSummary(idx);
          });
        });
        card.appendChild(flvContainer);
      }

      container.appendChild(card);

      // non-flavour checkbox events
      if(!p.hasFlavours){
        const cb = card.querySelector(`#pcheck-${idx}`);
        const qty = card.querySelector(`#qty-${idx}`);
        cb.addEventListener("change", ()=>{
          if(cb.checked){
            cart = cart.filter(c=>c.itemName!==p.item);
            cart.push({ itemName:p.item, flavour:"", qty:Number(qty.value)||1, price:Number(p.price||0), bulkThreshold:Number(p.bulkThreshold||0), bulkDiscountPercent:Number(p.bulkDiscountPercent||0) });
          } else cart = cart.filter(c=>c.itemName!==p.item);
          saveCart(); updateTotalUI(); updateSummary(idx);
        });
        qty.addEventListener("input", ()=>{ cart = cart.map(c=>c.itemName===p.item?{...c, qty:Number(qty.value)||1}:c); saveCart(); updateTotalUI(); updateSummary(idx); });
      } else {
        const toggle = card.querySelector(`#toggle-${idx}`);
        const flvList = card.querySelector(`#flavours-${idx}`);
        toggle.addEventListener("click", ()=> flvList.style.display = flvList.style.display==='block'?'none':'block');
      }

      updateSummary(idx);
    });

    restoreCartUI(); updateTotalUI();
  }catch(err){
    container.innerHTML = `<div class="small" style="color:#c22">Could not load products. Check Apps Script URL.</div>`;
    console.error(err);
  }
}

/* update small summary under product */
function updateSummary(idx){
  const p = products[idx];
  const el = document.getElementById(`summary-${idx}`);
  if(!el) return;
  const entries = cart.filter(c=>c.itemName===p.item);
  if(!entries || entries.length===0){ el.textContent = ""; return; }
  if(p.hasFlavours){
    const totalQty = entries.reduce((a,b)=>a+Number(b.qty||0),0);
    el.textContent = `${entries.length} flavour(s) • ${totalQty} total`;
  } else el.textContent = `${entries[0].qty} selected`;
}

/* restore cart UI */
function restoreCartUI(){
  loadCart();
  cart.forEach(item=>{
    const idx = products.findIndex(p=>p.item===item.itemName);
    if(idx<0) return;
    if(item.flavour){
      const p = products[idx];
      const fi = (p.flavours||[]).findIndex(f=>f===item.flavour);
      if(fi>=0){
        const cb = document.getElementById(`f-${idx}-${fi}`); const q = document.getElementById(`fq-${idx}-${fi}`);
        if(cb) cb.checked = true; if(q) q.value = item.qty;
      }
    } else {
      const cb = document.getElementById(`pcheck-${idx}`); const q = document.getElementById(`qty-${idx}`);
      if(cb) cb.checked = true; if(q) q.value = item.qty;
    }
    updateSummary(idx);
  });
}

/* calculate totals and return breakdown per product */
function calculateTotalsWithDiscounts(){
  // group by product name
  const groups = {};
  cart.forEach(c=>{
    if(!groups[c.itemName]) groups[c.itemName] = { unitPrice:c.price, totalQty:0, entries:[], bulkThreshold:c.bulkThreshold||0, bulkDiscountPercent:c.bulkDiscountPercent||0 };
    groups[c.itemName].totalQty += Number(c.qty||0);
    groups[c.itemName].entries.push(c);
  });

  let grandSubtotal = 0, totalSavings = 0;
  const breakdown = [];

  for(const name of Object.keys(groups)){
    const g = groups[name];
    const subtotal = g.unitPrice * g.totalQty;
    let discount = 0;
    if(g.bulkThreshold && g.totalQty >= g.bulkThreshold && g.bulkDiscountPercent){
      discount = subtotal * (g.bulkDiscountPercent/100);
    }
    const totalAfter = subtotal - discount;
    grandSubtotal += subtotal;
    totalSavings += discount;
    breakdown.push({ itemName:name, unitPrice:g.unitPrice, qty:g.totalQty, subtotal, discount, totalAfter, entries:g.entries });
  }

  const grandTotal = grandSubtotal - totalSavings;
  return { breakdown, grandSubtotal, totalSavings, grandTotal };
}

/* update top total UI */
function updateTotalUI(){
  const totalEl = document.getElementById("total");
  if(!totalEl) return;
  const totals = calculateTotalsWithDiscounts();
  totalEl.textContent = formatR(totals.grandTotal);
}

/* finish button */
document.addEventListener("click", (e)=>{
  if(e.target && e.target.id === "finishBtn"){
    loadCart();
    if(cart.length===0){ alert("Please select at least one item."); return; }
    const orderNumber = genOrderNumber();
    localStorage.setItem("orderNumber", orderNumber);
    localStorage.setItem("orderList", JSON.stringify(cart));
    const totals = calculateTotalsWithDiscounts();
    localStorage.setItem("orderSubtotal", formatR(totals.grandSubtotal));
    localStorage.setItem("orderSavings", formatR(totals.totalSavings));
    localStorage.setItem("orderTotal", formatR(totals.grandTotal));
    window.location.href = "checkout.html";
  } else if(e.target && e.target.id === "refreshProducts"){ renderProducts(); renderSponsors(); }
  else if(e.target && e.target.id === "viewOrder"){ window.location.href = "checkout.html"; }
  else if(e.target && e.target.id === "editButton"){ window.location.href = "index.html"; }
});

/* post order to Apps Script */
async function postOrder(payload){
  const res = await fetch(APPS_SCRIPT_URL, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
  const json = await res.json();
  if(!json.success) throw new Error(json.message || "Failed to save order");
  localStorage.removeItem("stellies_cart");
  return json;
}

/* checkout init - show breakdown of discounts */
async function checkoutInit(){
  loadCart();
  const orderNumber = localStorage.getItem("orderNumber") || genOrderNumber();
  const orderList = JSON.parse(localStorage.getItem("orderList") || "[]");
  const totals = calculateTotalsWithDiscounts();

  document.getElementById("orderNumber").textContent = orderNumber;
  const orderTable = document.getElementById("orderTable");
  orderTable.innerHTML = "";
  orderList.forEach(i=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i.itemName}</td><td>${i.flavour||"-"}</td><td>${i.qty}</td><td>R ${formatR(i.price * i.qty)}</td>`;
    orderTable.appendChild(tr);
  });

  // discount breakdown UI
  const discountDiv = document.getElementById("discountBreakdown");
  discountDiv.innerHTML = "";
  totals.breakdown.forEach(b=>{
    if(b.discount && b.discount > 0){
      const p = document.createElement("div"); p.className="discount-row";
      p.textContent = `${b.itemName}: Saved R ${formatR(b.discount)} (${b.qty} items — ${Math.round((b.discount/(b.subtotal||1))*100)}% off)`;
      discountDiv.appendChild(p);
    }
  });

  document.getElementById("orderSubtotal").textContent = formatR(totals.grandSubtotal);
  document.getElementById("totalSavings").textContent = formatR(totals.totalSavings);
  const orderSubtotal = totals.grandSubtotal;
  const totalSaved = totals.totalSavings;

  // load addresses
  try{
    await fetchAddresses();
    const sel = document.getElementById("delivery"); sel.innerHTML="";
    addresses.forEach(a => { const opt = document.createElement("option"); opt.value=a; opt.textContent=a; sel.appendChild(opt); });
  }catch(err){ console.error(err); }

  // tip handling
  const tipInput = document.getElementById("tip");
  const finalTotalEl = document.getElementById("finalTotal");
  function updateFinal(){ const tip = Number(tipInput.value||0); finalTotalEl.textContent = formatR(totals.grandTotal + tip); }
  if(tipInput) tipInput.addEventListener("input", updateFinal); updateFinal();

  // pay button
  const payBtn = document.getElementById("payButton");
  if(!payBtn) return;
  payBtn.addEventListener("click", async ()=>{
    const name = (document.getElementById("name")||{}).value.trim();
    const phone = (document.getElementById("phone")||{}).value.trim();
    const email = (document.getElementById("email")||{}).value.trim();
    const delivery = (document.getElementById("delivery")||{}).value;
    const tip = Number((document.getElementById("tip")||{}).value || 0);
    const notes = (document.getElementById("notes")||{}).value || "";
    const finalTotal = totals.grandTotal + tip;
    const orderNumberNow = orderNumber;
    const orderListNow = orderList;

    if(!name || !phone || !delivery){ alert("Please fill name, phone and delivery address."); return; }

    localStorage.setItem("customerName", name); localStorage.setItem("customerPhone", phone); localStorage.setItem("delivery", delivery); localStorage.setItem("tip", tip); localStorage.setItem("finalTotal", formatR(finalTotal));

    // skip payment if Yoco not configured
    if(typeof window.YocoSDK === "undefined" || YOCO_PUBLIC_KEY === "pk_test_your_public_key_here"){
      try{
        await postOrder({ orderNumber:orderNumberNow, name, phone, email, delivery, tip, notes, items:orderListNow, total:finalTotal, paymentToken:"" });
        window.location.href = "thankyou.html";
      }catch(err){ alert("Failed to save order: "+err.message); }
      return;
    }

    // Yoco flow
    const yoco = new window.YocoSDK({ publicKey: YOCO_PUBLIC_KEY });
    yoco.showPopup({
      amountInCents: Math.round(finalTotal * 100),
      currency: "ZAR",
      name: "Stellies Dinner Packs Order",
      description: `Order ${orderNumberNow}`,
      callback: async function(result){
        if(result.error){ alert("Payment failed: "+result.error.message); }
        else{
          const token = result.id || "";
          try{
            await postOrder({ orderNumber:orderNumberNow, name, phone, email, delivery, tip, notes, items:orderListNow, total:finalTotal, paymentToken:token });
            window.location.href = "thankyou.html";
          }catch(err){ alert("Failed to save order after payment: "+err.message); }
        }
      }
    });
  });
}

/* init on DOMContentLoaded */
document.addEventListener("DOMContentLoaded", async ()=>{
  if(document.getElementById("productList")){ await renderProducts(); renderSponsors(); }
  if(document.getElementById("orderTable")){ await checkoutInit(); const editBtn=document.getElementById("editButton"); if(editBtn) editBtn.addEventListener("click", ()=>window.location.href="index.html"); }
});
