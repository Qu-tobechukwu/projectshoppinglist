/* script.js — heavenly Stellies frontend
   Mobile-first; reads /data/products.json; POSTS orders to Google Apps Script backend.
*/

const DATA_URL = './data/products.json';

// Set this to your deployed Apps Script Web App URL (deployed as Web App).
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbwxP_vLG1PXl4l4_eKi_DTdK1duFwQiscXDDNqkFVcpdIuR_x212lHUp2rQJahWJKRS/exec";

let dataStore = { food: [], merch: [], sponsors: [], addresses: [] };
let cart = []; // { productId, itemName, type:'food'|'merch', flavour, qty, price }
const PAGE_SIZE = 8;
let currentPage = 1;

const $ = id => document.getElementById(id);
const fmt = v => Number(v||0).toFixed(2);

/* storage helpers */
function saveCart(){ localStorage.setItem('stellies_cart', JSON.stringify(cart)); }
function loadCart(){ cart = JSON.parse(localStorage.getItem('stellies_cart') || '[]'); }
function saveLast(){ localStorage.setItem('stellies_last', JSON.stringify(cart)); }
function loadLast(){ return JSON.parse(localStorage.getItem('stellies_last') || '[]'); }
function addPending(o){ const arr = JSON.parse(localStorage.getItem('stellies_pending_orders')||'[]'); arr.push(o); localStorage.setItem('stellies_pending_orders', JSON.stringify(arr)); }
function genOrderNo(){ let n = Number(localStorage.getItem('stellies_order_count')||0); n++; localStorage.setItem('stellies_order_count', n); return 'SDP-' + String(n).padStart(4,'0'); }

/* fetch JSON */
async function loadData(){
  try{
    const res = await fetch(DATA_URL);
    if(!res.ok) throw new Error('Failed to load data');
    dataStore = await res.json();
  } catch(err){
    console.error(err);
    dataStore = { food: [], merch: [], sponsors: [], addresses: [] };
  }
}

/* Sponsors (desktop only) */
function renderSponsors(){
  const col = $('sponsorCol'); if(!col) return;
  col.innerHTML = '';
  const now = new Date();
  const active = (dataStore.sponsors||[]).filter(s => {
    const startOk = !s.startDate || new Date(s.startDate) <= now;
    const endOk = !s.endDate || new Date(s.endDate) >= now;
    return startOk && endOk;
  }).slice(0,10);
  active.forEach(ad=>{
    const d = document.createElement('div'); d.className='sponsor-card';
    const img = document.createElement('img'); img.src = ad.image; img.style.maxWidth='100%'; img.style.borderRadius='8px';
    const a = document.createElement('a'); a.href = ad.link || '#'; a.target='_blank'; a.appendChild(img);
    d.appendChild(a); col.appendChild(d);
  });
}

/* pagination utils */
function pageCount(arr) { return Math.max(1, Math.ceil(arr.length / PAGE_SIZE)); }
function paged(arr, page) { return arr.slice((page-1)*PAGE_SIZE, (page-1)*PAGE_SIZE + PAGE_SIZE); }

/* Product rendering (mobile-first) */
function renderProducts(page = 1){
  currentPage = page;
  const wrap = $('products'); if(!wrap) return;
  wrap.innerHTML = '';
  const list = paged(dataStore.food || [], page);

  list.forEach(p => {
    const card = document.createElement('article'); card.className = 'card';
    card.innerHTML = `
      <img class="card-image" src="${p.image}" alt="${p.name}" loading="lazy" />
      <div class="card-body">
        <div class="card-title">${p.name}</div>
        <div class="card-desc">${p.description || ''}</div>
        <div class="card-footer">
          <div class="price">R ${fmt(p.price)}</div>
          <div class="controls"></div>
        </div>
        ${p.discountThreshold && p.discountPercent ? `<div class="muted small" style="margin-top:8px;color:var(--champagne)">Buy ${p.discountThreshold}+ and get ${p.discountPercent}% off</div>` : ''}
        <div class="flavour-list" id="flv-${p.id}" style="display:none"></div>
      </div>
    `;
    wrap.appendChild(card);

    const controls = card.querySelector('.controls');
    if(p.flavours && p.flavours.length){
      const btn = document.createElement('button'); btn.className='btn ghost'; btn.textContent='Choose flavours';
      btn.addEventListener('click', ()=> {
        const flv = card.querySelector(`#flv-${p.id}`);
        if(!flv) return;
        flv.style.display = flv.style.display === 'block' ? 'none' : 'block';
      });
      controls.appendChild(btn);

      // populate flavours
      const flvWrap = card.querySelector(`#flv-${p.id}`);
      p.flavours.forEach(f => {
        const fr = document.createElement('div'); fr.className='flavour-row';
        fr.innerHTML = `<input type="checkbox" class="flv-cb" data-id="${p.id}" data-fl="${f}" /> <label>${f}</label> <input class="flv-qty" data-id="${p.id}" data-fl="${f}" type="number" min="0" value="0" />`;
        flvWrap.appendChild(fr);
      });
    } else {
      // simple qty + checkbox
      const qty = document.createElement('input'); qty.type='number'; qty.min=1; qty.value=1; qty.className='flv-qty';
      qty.style.width='70px';
      const chk = document.createElement('input'); chk.type='checkbox'; chk.className='simple-check'; chk.dataset.id = p.id;
      controls.appendChild(qty); controls.appendChild(chk);
      chk.addEventListener('change', () => {
        if(chk.checked){
          cart = cart.filter(c => !(c.productId===p.id && c.type==='food'));
          cart.push({ productId:p.id, itemName:p.name, type:'food', flavour:'', qty: Number(qty.value)||1, price: Number(p.price) });
        } else {
          cart = cart.filter(c => !(c.productId===p.id && c.type==='food'));
        }
        saveCart(); updateTotals();
      });
      qty.addEventListener('input', ()=> {
        cart = cart.map(c => (c.productId===p.id && c.type==='food' && c.flavour==='') ? {...c, qty:Number(qty.value)||1} : c);
        saveCart(); updateTotals();
      });
    }
  });

  // attach events for flavour checkboxes / qtys
  document.querySelectorAll('.flv-cb').forEach(cb=>{
    cb.addEventListener('change', e=>{
      const id = Number(cb.dataset.id); const fl = cb.dataset.fl;
      const qtyEl = document.querySelector(`.flv-qty[data-id="${id}"][data-fl="${fl}"]`);
      const q = Math.max(0, Number(qtyEl ? qtyEl.value : 0));
      const p = dataStore.food.find(x=>x.id===id);
      if(cb.checked){
        const use = q>0? q : 1;
        cart = cart.filter(c => !(c.productId===id && c.flavour===fl && c.type==='food'));
        cart.push({ productId:id, itemName:p.name, type:'food', flavour:fl, qty:use, price:Number(p.price)});
        if(qtyEl) qtyEl.value = use;
      } else {
        cart = cart.filter(c => !(c.productId===id && c.flavour===fl && c.type==='food'));
      }
      saveCart(); updateTotals();
    });
  });
  document.querySelectorAll('.flv-qty').forEach(qel=>{
    qel.addEventListener('input', e=>{
      const id = Number(qel.dataset.id); const fl = qel.dataset.fl;
      const qty = Math.max(0, Number(qel.value||0));
      const existing = cart.find(c => c.productId===id && c.flavour===fl && c.type==='food');
      if(existing){
        if(qty<=0){ cart = cart.filter(c => !(c.productId===id && c.flavour===fl && c.type==='food')); const cb=document.querySelector(`.flv-cb[data-id="${id}"][data-fl="${fl}"]`); if(cb) cb.checked=false; }
        else existing.qty = qty;
      } else {
        if(qty>0){ const p = dataStore.food.find(x=>x.id===id); cart.push({ productId:id, itemName:p.name, type:'food', flavour:fl, qty:qty, price:Number(p.price)}); const cb=document.querySelector(`.flv-cb[data-id="${id}"][data-fl="${fl}"]`); if(cb) cb.checked=true; }
      }
      saveCart(); updateTotals();
    });
  });

  // pagination UI
  $('pageInfo').textContent = `Page ${currentPage} / ${pageCount(dataStore.food||[])}`;
  $('prevPage').disabled = currentPage <= 1;
  $('nextPage').disabled = currentPage >= pageCount(dataStore.food||[]);
  restoreUI(); updateTotals();
}

/* restore UI from cart */
function restoreUI(){
  loadCart();
  // set visible controls based on cart
  document.querySelectorAll('.card').forEach(card=>{
    const title = card.querySelector('.card-title');
    if(!title) return;
    const nm = title.textContent.trim();
    cart.forEach(it=>{
      if(it.itemName === nm && it.type==='food'){
        if(it.flavour){
          const cb = Array.from(card.querySelectorAll('.flv-cb')).find(x=>x.dataset.fl === it.flavour);
          const q = Array.from(card.querySelectorAll('.flv-qty')).find(x=>x.dataset.fl === it.flavour);
          if(cb) cb.checked=true; if(q) q.value = it.qty;
        } else {
          const pchk = card.querySelector('.simple-check'); const q=card.querySelector('.flv-qty');
          if(pchk) pchk.checked=true; if(q) q.value = it.qty;
        }
      }
    });
  });
}

/* render merch */
function renderMerch(){
  const wrap = $('merchWrap'); if(!wrap) return;
  wrap.innerHTML = '';
  dataStore.merch.forEach(m=>{
    const card = document.createElement('article'); card.className='card';
    card.innerHTML = `
      <img class="card-image" src="${m.image}" alt="${m.name}" loading="lazy" />
      <div class="card-body">
        <div class="card-title">${m.name}</div>
        <div class="card-desc">${m.description || ''}</div>
        <div class="card-footer">
          <div class="price">R ${fmt(m.price)}</div>
          <div class="controls"><button class="btn primary add-merch" data-id="${m.id}">Add to cart</button></div>
        </div>
      </div>
    `;
    wrap.appendChild(card);
  });

  document.querySelectorAll('.add-merch').forEach(b=>{
    b.addEventListener('click', ()=> {
      const id = Number(b.dataset.id);
      const item = dataStore.merch.find(x=>x.id===id);
      if(!item) return;
      cart = cart.filter(c => !(c.productId===id && c.type==='merch'));
      cart.push({ productId:id, itemName:item.name, type:'merch', flavour:'', qty:1, price:Number(item.price) });
      saveCart(); updateTotals();
      b.textContent = 'Added ✓'; setTimeout(()=>b.textContent='Add to cart',900);
    });
  });
}

/* totals & discounts */
function computeTotals(){
  const groups = {};
  cart.forEach(c => {
    const key = `${c.itemName}||${c.type}`;
    if(!groups[key]) groups[key] = { name:c.itemName, type:c.type, unitPrice:c.price, qty:0, discountThreshold:0, discountPercent:0, entries:[] };
    groups[key].qty += Number(c.qty || 0);
    groups[key].entries.push(c);
    if(c.type==='food'){
      const p = dataStore.food.find(f => f.id === c.productId);
      if(p){ groups[key].discountThreshold = Number(p.discountThreshold||0); groups[key].discountPercent = Number(p.discountPercent||0); groups[key].unitPrice = Number(p.price||0); }
    }
  });

  let subtotal=0, totalDiscount=0;
  const breakdown=[];
  Object.values(groups).forEach(g=>{
    const s = g.unitPrice * g.qty;
    let discounted = s, d=0;
    if(g.discountThreshold && g.qty >= g.discountThreshold && g.discountPercent){
      discounted = s * (1 - g.discountPercent/100);
      d = s - discounted;
    }
    subtotal += s; totalDiscount += d;
    breakdown.push({name:g.name, qty:g.qty, subtotal:s, discount:d, final:discounted});
  });
  return {subtotal, totalDiscount, final: subtotal - totalDiscount, breakdown};
}

function updateTotals(){
  const t = computeTotals();
  const totalEl = $('total') || $('topTotal');
  if(totalEl) totalEl.textContent = fmt(t.final);
  const tops = document.querySelectorAll('#topTotal,#topTotalM,#topTotalC');
  tops.forEach(el => el.textContent = fmt(t.final));
}

/* checkout flow */
function checkoutInit(){
  loadCart();
  const orderNo = genOrderNo();
  localStorage.setItem('orderNumber', orderNo);
  const orderList = JSON.parse(localStorage.getItem('stellies_cart') || '[]');
  const totals = computeTotals();

  if($('orderNumber')) $('orderNumber').textContent = orderNo;
  const table = $('orderTable'); if(table){ table.innerHTML=''; orderList.forEach(i=>{ const tr=document.createElement('tr'); tr.innerHTML = `<td>${i.itemName}</td><td>${i.flavour||'-'}</td><td>${i.qty}</td><td>R ${fmt(i.price * i.qty)}</td>`; table.appendChild(tr); }); }

  if($('orderSubtotal')) $('orderSubtotal').textContent = fmt(totals.subtotal);
  if($('orderDiscount')) $('orderDiscount').textContent = fmt(totals.totalDiscount);
  if($('orderTotal')) $('orderTotal').textContent = fmt(totals.final);
  if($('orderTip')) $('orderTip').textContent = '0.00';

  // addresses
  const sel = $('delivery');
  if(sel){ sel.innerHTML = ''; (dataStore.addresses||[]).forEach(a => { const opt=document.createElement('option'); opt.value=a; opt.textContent=a; sel.appendChild(opt); }); }

  const tipEl = $('tip');
  tipEl && tipEl.addEventListener('input', ()=> {
    const tip = Number(tipEl.value || 0);
    if($('orderTip')) $('orderTip').textContent = fmt(tip);
    if($('orderTotal')) $('orderTotal').textContent = fmt(totals.final + tip);
  });

  // pay button
  const payBtn = $('payButton');
  payBtn && payBtn.addEventListener('click', async ()=>{
    const name = ($('name')||{}).value.trim(); const phone = ($('phone')||{}).value.trim();
    const delivery = ($('delivery')||{}).value; const tip = Number(($('tip')||{}).value || 0);
    if(!name || !phone || !delivery){ alert('Please fill in name, phone and delivery address'); return; }
    const finalTotal = computeTotals().final + tip;
    const payload = {
      orderNumber: localStorage.getItem('orderNumber') || genOrderNo(),
      name, phone, delivery, tip,
      items: JSON.parse(localStorage.getItem('stellies_cart') || '[]'),
      total: finalTotal,
      timestamp: (new Date()).toISOString()
    };

    // if backend configured, POST to backend; otherwise save local and download JSON
    if(BACKEND_URL){
      try{
        const res = await fetch(BACKEND_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const j = await res.json();
        if(!j.success) throw new Error(j.message || 'Backend failed');
        // backend saved — proceed to thankyou
        localStorage.setItem('finalTotal', fmt(finalTotal)); localStorage.setItem('delivery', delivery); localStorage.setItem('orderNumber', payload.orderNumber);
        localStorage.removeItem('stellies_cart');
        window.location.href = 'thankyou.html';
      } catch(err){
        console.error(err); alert('Failed to submit order to server — saved locally instead.');
        addPending(payload);
        downloadPayload(payload);
      }
      return;
    }

    // fallback: save locally + download file
    addPending(payload);
    downloadPayload(payload);
    localStorage.setItem('finalTotal', fmt(finalTotal)); localStorage.setItem('delivery', delivery); localStorage.setItem('orderNumber', payload.orderNumber);
    saveLast();
    localStorage.removeItem('stellies_cart');
    window.location.href = 'thankyou.html';
  });
}

function downloadPayload(payload){
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${payload.orderNumber}.json`; a.click(); URL.revokeObjectURL(url);
}

/* events */
document.addEventListener('click', e=>{
  if(e.target && e.target.id === 'nextPage'){ if(currentPage < pageCount(dataStore.food||[])){ currentPage++; renderProducts(currentPage); window.scrollTo({top:0,behavior:'smooth'}); } }
  if(e.target && e.target.id === 'prevPage'){ if(currentPage > 1){ currentPage--; renderProducts(currentPage); window.scrollTo({top:0,behavior:'smooth'}); } }
  if(e.target && e.target.id === 'resetCart'){ if(confirm('Clear your cart?')){ cart=[]; saveCart(); updateTotals(); renderProducts(currentPage); } }
  if(e.target && e.target.id === 'repeatOrder'){ const last = loadLast(); if(!last || last.length===0){ alert('No previous order saved'); return; } cart = last; saveCart(); updateTotals(); renderProducts(currentPage); alert('Previous order restored'); }
  if(e.target && e.target.id === 'finishBtn'){ loadCart(); if(cart.length===0){ alert('Please choose something first'); return; } window.location.href = 'checkout.html'; }
  if(e.target && e.target.id === 'navToggle'){ const nl=$('navLinks'); if(nl) nl.style.display = nl.style.display === 'flex' ? 'none' : 'flex'; }
});

/* init */
document.addEventListener('DOMContentLoaded', async ()=>{
  await loadData();
  loadCart();
  renderProducts(currentPage);
  renderMerch();
  renderSponsors();
  updateTotals();
  if(document.getElementById('orderTable')) checkoutInit();
  // handle mobile nav toggle
  const navToggle = $('navToggle'); if(navToggle){ navToggle.addEventListener('click', ()=> { const nl=$('navLinks'); if(nl) nl.style.display = nl.style.display==='flex' ? 'none' : 'flex'; }); }
});
