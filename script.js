/* script.js - reads /data/*.json (static) and handles cart, pagination, discounts, checkout
   - orders are not written to /data on GitHub Pages (read-only). Admin exports CSV from static + local pending.
   - BACKEND_URL: if you add a server later, set it and the checkout will POST to it.
*/

const DATA_BASE = './data';
const PRODUCTS_URL = `${DATA_BASE}/products_stellies.json`;
const MERCH_URL = `${DATA_BASE}/products_merch.json`;
const SPONSORS_URL = `${DATA_BASE}/sponsors.json`;
const ADDRESSES_URL = `${DATA_BASE}/addresses.json`;
// const ORDERS_URL = `${DATA_BASE}/orders.json`; // read-only historical

const BACKEND_URL = ""; // set to your server endpoint when available
const YOCO_PUBLIC_KEY = "pk_test_your_public_key_here"; // replace when ready

/* state */
let products = [], merch = [], sponsors = [], addresses = [];
let cart = []; // items: { productId, itemName, type:'product'|'merch', flavour, qty, price }
const PAGE_SIZE = 10;
let currentPage = 1;

/* helpers */
const $ = id => document.getElementById(id);
const fmtR = v => Number(v||0).toFixed(2);
function saveCart(){ localStorage.setItem('stellies_cart', JSON.stringify(cart)); }
function loadCart(){ cart = JSON.parse(localStorage.getItem('stellies_cart') || '[]'); }
function saveLastOrder(){ localStorage.setItem('stellies_last_order', JSON.stringify(cart)); }
function loadLastOrder(){ return JSON.parse(localStorage.getItem('stellies_last_order') || '[]'); }
function addPendingOrder(order){ const arr = JSON.parse(localStorage.getItem('stellies_pending_orders')||'[]'); arr.push(order); localStorage.setItem('stellies_pending_orders', JSON.stringify(arr)); }
function genOrderNo(){ let n = Number(localStorage.getItem('stellies_order_count')||0); n++; localStorage.setItem('stellies_order_count', n); return 'SDP-' + String(n).padStart(4,'0'); }

/* fetch utilities */
async function fetchJson(url){ const res = await fetch(url); if(!res.ok) return []; return await res.json(); }

/* load all data */
async function loadData(){
  [products, merch, sponsors, addresses] = await Promise.all([fetchJson(PRODUCTS_URL), fetchJson(MERCH_URL), fetchJson(SPONSORS_URL), fetchJson(ADDRESSES_URL)]);
}

/* sponsors */
async function renderSponsors(){
  const col = $('sponsorCol'); if(!col) return;
  col.innerHTML = '';
  const today = new Date();
  const active = (sponsors||[]).filter(s => {
    const startOk = !s.startDate || new Date(s.startDate) <= today;
    const endOk = !s.endDate || new Date(s.endDate) >= today;
    return startOk && endOk;
  }).sort((a,b)=> (a.priority||0)-(b.priority||0)).slice(0,10);
  if(active.length===0){ col.innerHTML = '<div class="sponsor-box">Sponsored content</div>'; return; }
  active.forEach(ad => {
    const box = document.createElement('div'); box.className = 'sponsor-box';
    if(ad.image){
      const img = document.createElement('img'); img.src = ad.image; img.alt = ad.link || 'Sponsor';
      if(ad.link){ const a = document.createElement('a'); a.href = ad.link; a.target='_blank'; a.appendChild(img); box.appendChild(a); }
      else box.appendChild(img);
    } else box.textContent = ad.link || 'Sponsor';
    col.appendChild(box);
  });
  for(let i=active.length;i<10;i++){ const empty = document.createElement('div'); empty.className='sponsor-box'; empty.style.opacity=0.35; empty.textContent='Ad slot'; col.appendChild(empty); }
}

/* pagination helpers */
function pageCount(items){ return Math.max(1, Math.ceil(items.length / PAGE_SIZE)); }
function paged(items, page){ return items.slice((page-1)*PAGE_SIZE, (page-1)*PAGE_SIZE + PAGE_SIZE); }

/* render products - paged */
async function renderProducts(page=1){
  currentPage = page;
  const container = $('productList'); if(!container) return;
  container.innerHTML = '';
  const list = paged(products, page);
  list.forEach((p, relIdx) => {
    const globalIdx = (page-1)*PAGE_SIZE + relIdx;
    const card = document.createElement('div'); card.className = 'product-row';
    card.innerHTML = `
      <div class="prod-left">
        <div class="checkbox-w">${p.flavours && p.flavours.length ? '' : `<input type="checkbox" id="pcheck-${globalIdx}" />`}</div>
        <div><div class="item-name">${p.name}</div><div class="item-meta">${p.description||''}</div><div class="small" id="summary-${globalIdx}"></div></div>
      </div>
      <div class="prod-right">
        <div class="price">R ${fmtR(p.price)}</div>
        <div class="controls">${p.flavours && p.flavours.length ? `<button class="btn ghost" id="toggle-${globalIdx}">Choose flavours</button>` : `<input id="qty-${globalIdx}" class="qty" type="number" min="1" value="1" />`}</div>
        ${p.discountThreshold && p.discountPercent ? `<div class="discount-note">Buy ${p.discountThreshold}+ and get ${p.discountPercent}% off</div>` : ''}
      </div>
    `;
    container.appendChild(card);

    // flavour list
    if(p.flavours && p.flavours.length){
      const flvContainer = document.createElement('div'); flvContainer.className = 'flavour-list'; flvContainer.id = `flavours-${globalIdx}`;
      p.flavours.forEach((f, fi) => {
        const fr = document.createElement('div'); fr.className = 'flavour-row';
        fr.innerHTML = `<input class="flv-checkbox" type="checkbox" id="f-${globalIdx}-${fi}" /> <label for="f-${globalIdx}-${fi}" style="flex:1">${f}</label> <input class="flv-qty" id="fq-${globalIdx}-${fi}" type="number" min="0" value="0" />`;
        flvContainer.appendChild(fr);

        // events
        fr.querySelector(`#f-${globalIdx}-${fi}`).addEventListener('change', (ev) => {
          const cb = ev.target; const qEl = fr.querySelector(`#fq-${globalIdx}-${fi}`);
          const qty = Number(qEl.value || 0);
          if(cb.checked){
            const use = qty>0?qty:1;
            cart = cart.filter(c => !(c.productId===p.id && c.flavour===f && c.type==='product'));
            cart.push({ productId: p.id, itemName: p.name, type:'product', flavour: f, qty: use, price: Number(p.price) });
            qEl.value = use;
          } else {
            cart = cart.filter(c => !(c.productId===p.id && c.flavour===f && c.type==='product'));
          }
          saveCart(); updateTotalUI(); updateSummary(globalIdx, p);
        });

        fr.querySelector(`#fq-${globalIdx}-${fi}`).addEventListener('input', (ev) => {
          const qty = Math.max(0, Number(ev.target.value || 0));
          const existing = cart.find(c => c.productId===p.id && c.flavour===f && c.type==='product');
          if(existing){
            if(qty<=0){ fr.querySelector(`#f-${globalIdx}-${fi}`).checked = false; cart = cart.filter(c => !(c.productId===p.id && c.flavour===f && c.type==='product')); }
            else existing.qty = qty;
          } else {
            if(qty>0){ fr.querySelector(`#f-${globalIdx}-${fi}`).checked = true; cart.push({ productId:p.id, itemName:p.name, type:'product', flavour:f, qty: qty, price: Number(p.price) }); }
          }
          saveCart(); updateTotalUI(); updateSummary(globalIdx, p);
        });
      });
      container.appendChild(flvContainer);
    }

    // non-flavour item events
    if(!(p.flavours && p.flavours.length)){
      const chk = document.querySelector(`#pcheck-${globalIdx}`);
      const qtyEl = document.querySelector(`#qty-${globalIdx}`);
      chk && chk.addEventListener('change', ()=> {
        if(chk.checked){ cart = cart.filter(c => !(c.productId===p.id && c.type==='product')); cart.push({ productId:p.id, itemName:p.name, type:'product', flavour:'', qty: Number(qtyEl.value)||1, price: Number(p.price) }); }
        else cart = cart.filter(c => !(c.productId===p.id && c.type==='product'));
        saveCart(); updateTotalUI(); updateSummary(globalIdx, p);
      });
      qtyEl && qtyEl.addEventListener('input', ()=> {
        cart = cart.map(c => c.productId===p.id && c.type==='product' ? {...c, qty: Number(qtyEl.value)||1} : c);
        saveCart(); updateTotalUI(); updateSummary(globalIdx, p);
      });
    } else {
      const toggle = document.querySelector(`#toggle-${globalIdx}`); const flvList = document.querySelector(`#flavours-${globalIdx}`);
      toggle && toggle.addEventListener('click', ()=> { if(!flvList) return; flvList.style.display = flvList.style.display === 'block' ? 'none' : 'block'; });
    }
    updateSummary(globalIdx, p);
  });

  // pagination controls
  $('pageInfo').textContent = `Page ${currentPage} / ${pageCount(products)}`;
  $('prevPage').disabled = currentPage <= 1;
  $('nextPage').disabled = currentPage >= pageCount(products);
  restoreCartUI(); updateTotalUI();
}

/* update small summary under product */
function updateSummary(idx, product){
  const el = $('summary-'+idx);
  if(!el) return;
  const entries = cart.filter(c => c.productId===product.id && c.type==='product');
  if(entries.length===0){ el.textContent=''; return; }
  const totalQty = entries.reduce((a,b)=>a+(b.qty||0),0);
  el.textContent = `${entries.length} flavour(s) • ${totalQty} total`;
}

/* restore cart UI (mark controls if visible) */
function restoreCartUI(){
  loadCart();
  // clear visible inputs
  const productRows = document.querySelectorAll('.product-row');
  productRows.forEach(row => {
    row.querySelectorAll('.flv-checkbox').forEach(cb=>cb.checked=false);
    row.querySelectorAll('.flv-qty').forEach(q=>q.value=0);
    const pcheck = row.querySelector('.checkbox-w input[type="checkbox"]'); if(pcheck) pcheck.checked=false;
    const q = row.querySelector('.qty'); if(q) q.value = 1;
  });

  // mark from cart
  cart.forEach(item => {
    if(item.type==='product'){
      const rows = Array.from(document.querySelectorAll('.product-row'));
      rows.forEach(row => {
        const nameEl = row.querySelector('.item-name');
        if(!nameEl) return;
        if(nameEl.textContent.trim() === item.itemName){
          if(item.flavour){
            // find flavour label with matching text
            const labels = Array.from(row.querySelectorAll('.flavour-row label'));
            const idx = labels.findIndex(lb => lb.textContent.trim() === item.flavour);
            if(idx >= 0){
              const cb = row.querySelectorAll('.flv-checkbox')[idx];
              const q = row.querySelectorAll('.flv-qty')[idx];
              if(cb) cb.checked = true;
              if(q) q.value = item.qty;
            }
          } else {
            const pchk = row.querySelector('.checkbox-w input[type="checkbox"]');
            const q = row.querySelector('.qty');
            if(pchk) pchk.checked = true;
            if(q) q.value = item.qty;
          }
        }
      });
    }
  });
}

/* MERCH */
function renderMerch(){
  const el = $('merchList'); if(!el) return;
  el.innerHTML = '';
  merch.forEach(m => {
    const card = document.createElement('div'); card.className='merch-card';
    card.innerHTML = `<img class="merch-img" src="${m.image||'assets/logo.png'}" alt="${m.name}"/>
      <div style="flex:1">
        <div style="font-weight:800">${m.name}</div>
        <div class="small">${m.description||''}</div>
        <div style="margin-top:8px;font-weight:800">R ${fmtR(m.price)}</div>
        <div style="margin-top:8px"><button class="btn add-merch" data-id="${m.id}">Add to cart</button></div>
      </div>`;
    el.appendChild(card);
  });

  document.querySelectorAll('.add-merch').forEach(b => {
    b.addEventListener('click', ()=> {
      const id = Number(b.getAttribute('data-id'));
      const item = merch.find(x=>x.id===id);
      if(!item) return;
      cart = cart.filter(c => !(c.type==='merch' && c.productId===item.id));
      cart.push({ productId: item.id, itemName: item.name, type:'merch', flavour:'', qty:1, price: Number(item.price) });
      saveCart(); updateTotalUI();
      alert(`${item.name} added to cart`);
    });
  });
}

/* totals & discounts */
function computeTotals(){
  const groups = {};
  cart.forEach(c => {
    const key = `${c.itemName}||${c.type}`;
    if(!groups[key]) groups[key] = { itemName: c.itemName, type: c.type, unitPrice: c.price, totalQty:0, discountThreshold:0, discountPercent:0, items: [] };
    groups[key].totalQty += Number(c.qty||0);
    groups[key].items.push(c);
    if(c.type==='product'){
      const p = products.find(pp => pp.id === c.productId);
      if(p){ groups[key].discountThreshold = Number(p.discountThreshold||0); groups[key].discountPercent = Number(p.discountPercent||0); groups[key].unitPrice = Number(p.price||0); }
    }
  });

  let subtotal = 0, totalDiscount = 0;
  const productTotals = [];
  Object.values(groups).forEach(g => {
    const s = g.unitPrice * g.totalQty;
    let discounted = s; let dAmt = 0;
    if(g.discountThreshold && g.totalQty >= g.discountThreshold && g.discountPercent){
      discounted = s * (1 - (g.discountPercent/100));
      dAmt = s - discounted;
    }
    subtotal += s; totalDiscount += dAmt;
    productTotals.push({ name: g.itemName, unitPrice: g.unitPrice, totalQty: g.totalQty, subtotal: s, discountAmount: dAmt, discounted });
  });
  return { subtotal, totalDiscount, finalTotal: subtotal - totalDiscount, productTotals };
}

function updateTotalUI(){
  const t = computeTotals();
  const el = $('total') || $('totalTop');
  if(el) el.textContent = fmtR(t.finalTotal);
  if($('totalTop')) $('totalTop').textContent = fmtR(t.finalTotal);
}

/* finish/checkout interactions */
document.addEventListener('click', (e) => {
  if(e.target && e.target.id === 'finishBtn'){
    loadCart();
    if(cart.length===0){ alert('Please select at least one item'); return; }
    const orderNo = genOrderNo();
    localStorage.setItem('orderNumber', orderNo);
    localStorage.setItem('orderList', JSON.stringify(cart));
    saveLastOrder();
    window.location.href = 'checkout.html';
  } else if(e.target && e.target.id === 'prevPage'){ if(currentPage>1){ currentPage--; renderProducts(currentPage); window.scrollTo({top:0,behavior:'smooth'}); } }
  else if(e.target && e.target.id === 'nextPage'){ if(currentPage < pageCount(products)){ currentPage++; renderProducts(currentPage); window.scrollTo({top:0,behavior:'smooth'}); } }
  else if(e.target && e.target.id === 'resetCart'){ if(confirm('Clear your cart?')){ cart=[]; saveCart(); updateTotalUI(); restoreCartUI(); } }
  else if(e.target && e.target.id === 'repeatOrder'){ const last = loadLastOrder(); if(!last || last.length===0){ alert('No previous order'); return; } cart = last; saveCart(); updateTotalUI(); restoreCartUI(); alert('Last order reloaded'); }
  else if(e.target && e.target.id === 'viewOrder'){ window.location.href = 'checkout.html'; }
  else if(e.target && e.target.id === 'refreshProducts'){ renderProducts(currentPage); renderSponsors(); }
  else if(e.target && e.target.id === 'editButton'){ window.location.href = 'index.html'; }
});

/* order submission */
async function submitOrderToBackend(payload){
  const res = await fetch(BACKEND_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if(!res.ok) throw new Error('Backend error: ' + res.status);
  return await res.json();
}

async function checkoutInit(){
  loadCart();
  const orderNumber = localStorage.getItem('orderNumber') || genOrderNo();
  const orderList = JSON.parse(localStorage.getItem('orderList') || '[]');
  const totals = computeTotals();

  $('orderNumber') && ($('orderNumber').textContent = orderNumber);
  const orderTable = $('orderTable'); if(orderTable){ orderTable.innerHTML = ''; orderList.forEach(i => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${i.itemName}</td><td>${i.flavour||'-'}</td><td>${i.qty}</td><td>R ${fmtR(i.price * i.qty)}</td>`; orderTable.appendChild(tr); }); }

  $('orderSubtotal') && ($('orderSubtotal').textContent = fmtR(totals.subtotal));
  const bd = $('discountBreakdown');
  let bdText = '';
  totals.productTotals.forEach(pt => { if(pt.discountAmount>0) bdText += `${pt.name}: -R ${fmtR(pt.discountAmount)} (bulk discount)\n`; });
  bd && (bd.textContent = totals.totalDiscount>0 ? `Total savings: R ${fmtR(totals.totalDiscount)}\n\n${bdText}` : 'No bulk discounts applied.');
  $('orderFinal') && ($('orderFinal').textContent = fmtR(totals.finalTotal));
  $('checkoutTip') && ($('checkoutTip').textContent = '0.00');

  // load addresses
  try{
    const addrs = await fetchJson(ADDRESSES_URL) || [];
    const sel = $('delivery');
    if(sel){ sel.innerHTML=''; addrs.forEach(a => { const opt = document.createElement('option'); opt.value = a; opt.textContent = a; sel.appendChild(opt); }); }
  } catch(err){ console.error(err); }

  const tipInput = $('tip');
  tipInput && tipInput.addEventListener('input', ()=> {
    const tip = Number(tipInput.value || 0);
    const final = totals.finalTotal + tip;
    $('orderFinal') && ($('orderFinal').textContent = fmtR(final));
    $('checkoutTip') && ($('checkoutTip').textContent = fmtR(tip));
  });

  const payBtn = $('payButton');
  payBtn && payBtn.addEventListener('click', async () => {
    const name = ($('name')||{}).value.trim(); const phone = ($('phone')||{}).value.trim();
    const email = ($('email')||{}).value.trim(); const delivery = ($('delivery')||{}).value;
    const tip = Number(($('tip')||{}).value || 0); const notes = ($('notes')||{}).value || '';
    const finalTotal = computeTotals().finalTotal + tip;
    if(!name || !phone || !delivery){ alert('Please fill name, phone and delivery address.'); return; }

    const payload = {
      orderNumber, name, phone, email, delivery, tip, notes,
      items: orderList.map(i => ({ productId: i.productId, itemName: i.itemName, flavour: i.flavour, qty: i.qty, unitPrice: i.price, type: i.type })),
      total: finalTotal, timestamp: (new Date()).toISOString()
    };

    // if no server: save pending and force download so you can upload it
    if(!BACKEND_URL){
      addPendingOrder(payload);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${orderNumber}.json`; a.click(); URL.revokeObjectURL(url);

      localStorage.setItem('finalTotal', fmtR(finalTotal)); localStorage.setItem('delivery', delivery); localStorage.setItem('orderNumber', orderNumber);
      saveLastOrder(); localStorage.removeItem('stellies_cart');
      window.location.href = 'thankyou.html';
      return;
    }

    // If BACKEND_URL exists, you'd POST (and ideally run payment prior)
    try{
      const result = await submitOrderToBackend(payload);
      localStorage.setItem('finalTotal', fmtR(finalTotal)); localStorage.setItem('delivery', delivery); localStorage.setItem('orderNumber', orderNumber);
      localStorage.removeItem('stellies_cart');
      window.location.href = 'thankyou.html';
    } catch(err){
      alert('Failed to submit order: ' + err.message);
      console.error(err);
    }
  });
}

/* DOM ready */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  loadCart();
  if(document.getElementById('productList')) { renderProducts(currentPage); renderSponsors(); }
  if(document.getElementById('merchList')) { renderMerch(); renderSponsors(); }
  if(document.getElementById('orderTable')) { checkoutInit(); renderSponsors(); }
});
