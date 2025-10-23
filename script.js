/* script.js — dynamic products, cart, toasts, PWA install
   Loads ./data/products.json
   Keep data in ./data/products.json (food, merch, addresses arrays)
*/

const DATA_URL = './data/products.json';
const PAGE_SIZE = 8;
const BACKEND_URL = '/.netlify/functions/order'; // optional, used if you deploy Netlify function

let dataStore = { food: [], merch: [], addresses: [] };
let cart = [];
let currentPage = 1;

// helpers
const $ = id => document.getElementById(id);
const fmt = v => Number(v||0).toFixed(2);

function toast(msg, timeout = 2600) {
  const t = document.createElement('div');
  t.className = 'stellies-toast';
  t.innerHTML = msg;
  document.body.appendChild(t);
  // force reflow -> animate
  void t.offsetWidth;
  t.classList.add('show');
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(), 400); }, timeout);
}

function saveCart(){ localStorage.setItem('stellies_cart', JSON.stringify(cart)); }
function loadCart(){ cart = JSON.parse(localStorage.getItem('stellies_cart') || '[]'); }
function saveLast(){ localStorage.setItem('stellies_last', JSON.stringify(cart)); }
function loadLast(){ return JSON.parse(localStorage.getItem('stellies_last') || '[]'); }
function addPending(o){ const arr = JSON.parse(localStorage.getItem('stellies_pending_orders')||'[]'); arr.push(o); localStorage.setItem('stellies_pending_orders', JSON.stringify(arr)); }
function genOrderNo(){ let n = Number(localStorage.getItem('stellies_order_count')||0); n++; localStorage.setItem('stellies_order_count', n); return 'EC-' + String(n).padStart(4,'0'); }

async function loadData(){
  try{
    const res = await fetch(DATA_URL);
    if(!res.ok) throw new Error('Failed loading products');
    dataStore = await res.json();
  } catch(err){
    console.error(err);
    dataStore = { food: [], merch: [], addresses: [] };
  }
}

function pageCount(arr){ return Math.max(1, Math.ceil((arr||[]).length / PAGE_SIZE)); }
function paged(arr, page){ return (arr||[]).slice((page-1)*PAGE_SIZE, (page-1)*PAGE_SIZE + PAGE_SIZE); }

function escapeHtml(s){ if(!s && s !== 0) return ''; return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function renderProducts(page = 1){
  currentPage = page;
  const wrap = $('products'); if(!wrap) return;
  wrap.innerHTML = '';
  const list = paged(dataStore.food||[], page);

  list.forEach(p=>{
    const card = document.createElement('article'); card.className = 'card';
    card.innerHTML = `
      <img class="card-image" src="${p.image || ''}" alt="${escapeHtml(p.name)}" loading="lazy" />
      <div class="card-body">
        <div class="card-title">${escapeHtml(p.name)}</div>
        <div class="card-desc">${escapeHtml(p.description || '')}</div>
        <div class="card-footer">
          <div class="price">R ${fmt(p.price)}</div>
          <div class="controls"></div>
        </div>
        ${p.discountThreshold && p.discountPercent ? `<div class="muted small" style="margin-top:8px;color:var(--gold-light)">Buy ${p.discountThreshold}+ and get ${p.discountPercent}% off</div>` : ''}
        <div class="flavour-list" id="flv-${p.id}" style="display:none"></div>
      </div>
    `;
    wrap.appendChild(card);
    const controls = card.querySelector('.controls');

    if(p.flavours && p.flavours.length){
      const btn = document.createElement('button'); btn.className = 'btn ghost'; btn.textContent = 'Choose flavours';
      controls.appendChild(btn);
      btn.addEventListener('click', ()=> {
        const flv = card.querySelector(`#flv-${p.id}`);
        if(!flv) return;
        flv.style.display = flv.style.display === 'block' ? 'none' : 'block';
      });
      const flvWrap = card.querySelector(`#flv-${p.id}`);
      p.flavours.forEach(f=>{
        const fr = document.createElement('div'); fr.className = 'flavour-row';
        fr.innerHTML = `
          <input type="checkbox" class="flv-cb" data-id="${p.id}" data-fl="${escapeHtml(f)}" />
          <label>${escapeHtml(f)}</label>
          <input class="flv-qty" data-id="${p.id}" data-fl="${escapeHtml(f)}" type="number" min="0" value="0" />
        `;
        flvWrap.appendChild(fr);
      });
    } else {
      const qty = document.createElement('input'); qty.type='number'; qty.min=1; qty.value=1; qty.className='flv-qty';
      qty.style.width='70px';
      const chk = document.createElement('input'); chk.type='checkbox'; chk.className='simple-check'; chk.dataset.id = p.id;
      controls.appendChild(qty); controls.appendChild(chk);

      chk.addEventListener('change', ()=>{
        if(chk.checked){
          cart = cart.filter(c=> !(c.productId===p.id && c.type==='food' && c.flavour===''));
          cart.push({ productId:p.id, itemName:p.name, type:'food', flavour:'', qty: Number(qty.value)||1, price: Number(p.price) });
          toast(`Added ${p.name} ✅`);
        } else {
          cart = cart.filter(c=> !(c.productId===p.id && c.type==='food' && c.flavour===''));
          toast(`Removed ${p.name}`);
        }
        saveCart(); updateTotals();
      });

      qty.addEventListener('input', ()=>{
        cart = cart.map(c=> (c.productId===p.id && c.type==='food' && c.flavour==='')?{...c, qty: Number(qty.value)||1}:c);
        saveCart(); updateTotals();
      });
    }
  });

  // attach dynamically added flavour listeners
  document.querySelectorAll('.flv-cb').forEach(cb=>{
    cb.addEventListener('change', ()=>{
      const id = Number(cb.dataset.id); const fl = cb.dataset.fl;
      const qtyEl = document.querySelector(`.flv-qty[data-id="${id}"][data-fl="${fl}"]`);
      const q = Math.max(0, Number(qtyEl?qtyEl.value:0));
      const p = dataStore.food.find(x=>x.id===id);
      if(!p) return;
      if(cb.checked){
        const use = q>0? q:1;
        cart = cart.filter(c=> !(c.productId===id && c.flavour===fl && c.type==='food'));
        cart.push({ productId:id, itemName:p.name, type:'food', flavour:fl, qty:use, price:Number(p.price) });
        toast(`Added ${p.name} — ${fl} ×${use} ✅`);
        if(qtyEl) qtyEl.value = use;
      } else {
        cart = cart.filter(c=> !(c.productId===id && c.flavour===fl && c.type==='food'));
        toast(`Removed ${p.name} — ${fl}`);
      }
      saveCart(); updateTotals();
    });
  });

  document.querySelectorAll('.flv-qty[data-fl]').forEach(qel=>{
    qel.addEventListener('input', ()=>{
      const id = Number(qel.dataset.id), fl = qel.dataset.fl;
      const qty = Math.max(0, Number(qel.value||0));
      const existing = cart.find(c=> c.productId===id && c.flavour===fl && c.type==='food');
      if(existing){
        if(qty<=0){
          cart = cart.filter(c=> !(c.productId===id && c.flavour===fl && c.type==='food'));
          const cb = document.querySelector(`.flv-cb[data-id="${id}"][data-fl="${fl}"]`); if(cb) cb.checked=false;
          toast(`Removed ${existing.itemName} — ${fl}`);
        } else {
          existing.qty = qty;
          toast(`Updated ${existing.itemName} — ${fl} ×${qty}`);
        }
      } else {
        if(qty>0){
          const p = dataStore.food.find(x=>x.id===id);
          cart.push({ productId:id, itemName:p.name, type:'food', flavour:fl, qty:qty, price:Number(p.price) });
          const cb = document.querySelector(`.flv-cb[data-id="${id}"][data-fl="${fl}"]`); if(cb) cb.checked=true;
          toast(`Added ${p.name} — ${fl} ×${qty} ✅`);
        }
      }
      saveCart(); updateTotals();
    });
  });

  // pagination controls
  $('pageInfo').textContent = `Page ${currentPage} / ${pageCount(dataStore.food||[])}`;
  $('prevPage').disabled = currentPage <= 1;
  $('nextPage').disabled = currentPage >= pageCount(dataStore.food||[]);
  restoreUI();
  updateTotals();
}

function renderMerch(){
  const wrap = $('merchItems'); if(!wrap) return;
  wrap.innerHTML = '';
  (dataStore.merch||[]).forEach(m=>{
    const card = document.createElement('article'); card.className='card';
    card.innerHTML = `<img class="card-image" src="${m.image||''}" alt="${escapeHtml(m.name)}" loading="lazy" /><div class="card-body"><div class="card-title">${escapeHtml(m.name)}</div><div class="card-desc">${escapeHtml(m.description||'')}</div><div class="card-footer"><div class="price">R ${fmt(m.price)}</div><div class="controls"><button class="btn primary add-merch" data-id="${m.id}">Add to cart</button></div></div></div>`;
    wrap.appendChild(card);
  });
  document.querySelectorAll('.add-merch').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id = Number(b.dataset.id); const item = dataStore.merch.find(x=>x.id===id);
      cart = cart.filter(c=> !(c.productId===id && c.type==='merch')); cart.push({ productId:id, itemName:item.name, type:'merch', flavour:'', qty:1, price:Number(item.price) });
      saveCart(); updateTotals(); b.textContent='Added ✓'; setTimeout(()=>b.textContent='Add to cart',700); toast(`${item.name} added`);
    });
  });
}

function restoreUI(){
  loadCart();
  document.querySelectorAll('.card').forEach(card=>{
    const title = card.querySelector('.card-title'); if(!title) return;
    const nm = title.textContent.trim();
    cart.forEach(it=>{
      if(it.itemName === nm && it.type==='food'){
        if(it.flavour){
          const cb = Array.from(card.querySelectorAll('.flv-cb')).find(x=> x.dataset.fl === it.flavour);
          const q = Array.from(card.querySelectorAll('.flv-qty')).find(x=> x.dataset.fl === it.flavour);
          if(cb) cb.checked = true; if(q) q.value = it.qty;
        } else {
          const pchk = card.querySelector('.simple-check'); const q = card.querySelector('.flv-qty');
          if(pchk) pchk.checked = true; if(q) q.value = it.qty;
        }
      }
    });
  });
}

function computeTotals(){
  const groups = {};
  cart.forEach(c=>{
    const key = `${c.itemName}||${c.type}`;
    if(!groups[key]) groups[key] = { name:c.itemName, type:c.type, unitPrice:c.price, qty:0, discountThreshold:0, discountPercent:0, entries:[] };
    groups[key].qty += Number(c.qty||0); groups[key].entries.push(c);
    if(c.type==='food'){ const p = dataStore.food.find(f=>f.id===c.productId); if(p){ groups[key].discountThreshold = Number(p.discountThreshold||0); groups[key].discountPercent = Number(p.discountPercent||0); groups[key].unitPrice = Number(p.price||0); } }
  });

  let subtotal = 0, totalDiscount = 0;
  const breakdown = [];
  Object.values(groups).forEach(g=>{
    const s = g.unitPrice * g.qty; let discounted = s, d=0;
    if(g.discountThreshold && g.qty >= g.discountThreshold && g.discountPercent){
      discounted = s * (1 - g.discountPercent/100);
      d = s - discounted;
    }
    subtotal += s; totalDiscount += d;
    breakdown.push({ name:g.name, qty:g.qty, subtotal:s, discount:d, final:discounted });
  });
  return { subtotal, totalDiscount, final: subtotal - totalDiscount, breakdown };
}

function updateTotals(){
  const t = computeTotals();
  if($('total')) $('total').textContent = fmt(t.final);
  const tops = document.querySelectorAll('#topTotal,#topTotalM,#topTotalC');
  tops.forEach(el => el.textContent = fmt(t.final));
}

// Checkout page init
function checkoutInit(){
  loadCart();
  const orderNo = genOrderNo();
  localStorage.setItem('orderNumber', orderNo);
  const list = JSON.parse(localStorage.getItem('stellies_cart') || '[]');
  const t = computeTotals();
  if($('orderNumber')) $('orderNumber').textContent = orderNo;
  if($('orderTable')){
    const tbody = $('orderTable'); tbody.innerHTML = '';
    list.forEach(i=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(i.itemName)}</td><td>${escapeHtml(i.flavour||'-')}</td><td>${i.qty}</td><td>R ${fmt(i.price * i.qty)}</td>`;
      tbody.appendChild(tr);
    });
  }
  if($('orderSubtotal')) $('orderSubtotal').textContent = fmt(t.subtotal);
  if($('orderDiscount')) $('orderDiscount').textContent = fmt(t.totalDiscount);
  if($('orderTotal')) $('orderTotal').textContent = fmt(t.final);
  if($('orderTip')) $('orderTip').textContent = '0.00';

  if($('delivery')){
    $('delivery').innerHTML = '';
    (dataStore.addresses||[]).forEach(a=>{ const opt = document.createElement('option'); opt.value=a; opt.textContent=a; $('delivery').appendChild(opt); });
  }

  const tipEl = $('tip');
  tipEl && tipEl.addEventListener('input', ()=> {
    const tip = Number(tipEl.value||0);
    if($('orderTip')) $('orderTip').textContent = fmt(tip);
    if($('orderTotal')) $('orderTotal').textContent = fmt(t.final + tip);
  });

  const payBtn = $('payButton');
  payBtn && payBtn.addEventListener('click', async ()=>{
    const name = ($('name')||{}).value.trim(), phone = ($('phone')||{}).value.trim(), email = ($('email')||{}).value.trim();
    const delivery = ($('delivery')||{}).value, tip = Number(($('tip')||{}).value||0), notes = ($('notes')||{}).value||'';
    if(!name || !phone || !delivery){ alert('Please fill name, phone and delivery address'); return; }
    const finalTotal = computeTotals().final + tip;
    const payload = { orderNumber: orderNo, name, phone, email, delivery, tip, notes, items: JSON.parse(localStorage.getItem('stellies_cart')||'[]'), total: finalTotal, timestamp: new Date().toISOString() };

    try{
      if(BACKEND_URL){
        const res = await fetch(BACKEND_URL, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
        const j = await res.json();
        if(!j || !j.success) throw new Error(j && j.message ? j.message : 'Server error');
      } else {
        addPending(payload);
      }
      localStorage.setItem('finalTotal', fmt(finalTotal)); localStorage.setItem('delivery', delivery); localStorage.setItem('orderNumber', orderNo);
      saveLast(); localStorage.removeItem('stellies_cart');
      toast('Order placed ✨', 2000);
      setTimeout(()=> window.location.href = './thankyou.html', 900);
    } catch(err){
      console.error(err);
      addPending(payload); downloadPayload(payload);
      localStorage.setItem('finalTotal', fmt(finalTotal)); localStorage.setItem('delivery', delivery); localStorage.setItem('orderNumber', orderNo);
      saveLast(); localStorage.removeItem('stellies_cart');
      toast('Saved offline — will submit when online', 2800);
      setTimeout(()=> window.location.href = './thankyou.html', 900);
    }
  });
}

function downloadPayload(payload){
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${payload.orderNumber}.json`; a.click(); URL.revokeObjectURL(url);
}

/* Events */
document.addEventListener('click', e=>{
  if(e.target && e.target.id === 'nextPage'){
    if(currentPage < pageCount(dataStore.food||[])){ currentPage++; renderProducts(currentPage); window.scrollTo({top:0,behavior:'smooth'}); }
  }
  if(e.target && e.target.id === 'prevPage'){
    if(currentPage > 1){ currentPage--; renderProducts(currentPage); window.scrollTo({top:0,behavior:'smooth'}); }
  }
  if(e.target && e.target.id === 'resetCart'){
    if(confirm('Clear your cart?')){ cart=[]; saveCart(); updateTotals(); renderProducts(currentPage); toast('Cart reset 🧺',1600); }
  }
  if(e.target && e.target.id === 'repeatOrder'){
    const last = loadLast();
    if(!last || last.length===0){ alert('No previous order saved'); return; }
    cart = last; saveCart(); updateTotals(); renderProducts(currentPage); toast('Previous order restored',1400);
  }
  if(e.target && e.target.id === 'finishBtn'){ loadCart(); if(cart.length===0){ alert('Please choose something first'); return; } window.location.href = './checkout.html'; }
});

/* PWA install prompt handling */
let deferredPrompt = null;
function showInstallButtons(show){
  const h = $('installBtnHeader'); const f = $('installBtnFooter');
  if(h) h.style.display = show ? 'inline-block' : 'none';
  if(f) f.style.display = show ? 'inline-block' : 'none';
}

window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  showInstallButtons(true);
});

async function promptInstall(){
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if(choice && choice.outcome === 'accepted') toast('App installed ✨',2200);
  else toast('Install dismissed',1400);
  deferredPrompt = null;
  showInstallButtons(false);
}

/* wire install button events on DOM ready */
document.addEventListener('DOMContentLoaded', async ()=>{
  const hb = $('installBtnHeader'); const fb = $('installBtnFooter');
  if(hb) hb.addEventListener('click', ()=> promptInstall());
  if(fb) fb.addEventListener('click', ()=> promptInstall());

  await loadData();
  loadCart();
  renderProducts(currentPage);
  renderMerch();
  updateTotals();

  if(document.querySelector('.checkout')) checkoutInit();
});

/* utility */
