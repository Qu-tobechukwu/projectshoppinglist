/* checkout.js
  - Loads cart from localStorage and renders
  - Fetches addresses from ./data/addresses.json
  - Prefills form if data in localStorage (edit flow)
  - Submits to Google Apps Script doPost endpoint
  - Stores orderNumber/finalTotal/delivery and redirects to thankyou.html
*/

const GAS_URL = "https://script.google.com/macros/s/AKfycbwxP_vLG1PXl4l4_eKi_DTdK1duFwQiscXDDNqkFVcpdIuR_x212lHUp2rQJahWJKRS/exec";

const $ = id => document.getElementById(id);
const fmt = v => Number(v||0).toFixed(2);

function toast(msg, t = 2200){
  const el = document.createElement('div'); el.className = 'stellies-toast'; el.textContent = msg; document.body.appendChild(el);
  void el.offsetWidth; el.classList.add('show'); setTimeout(()=>{el.classList.remove('show'); setTimeout(()=>el.remove(),300)}, t);
}

function loadCart(){ try{ return JSON.parse(localStorage.getItem('stellies_cart') || '[]'); } catch(e){ return []; } }

async function fetchProductsForPricing(){
  try {
    const r = await fetch('./data/products.json');
    if(!r.ok) return [];
    const j = await r.json();
    return j.food || [];
  } catch(e){ return []; }
}

async function computeTotalsAndItems(){
  const cart = loadCart();
  const products = await fetchProductsForPricing();
  const groups = {};
  cart.forEach(item=>{
    const key = `${item.itemName}||${item.type||'food'}`;
    if(!groups[key]) groups[key] = { name:item.itemName, unitPrice: item.price||0, qty:0, discountThreshold:0, discountPercent:0, entries:[] };
    groups[key].qty += Number(item.qty||0);
    groups[key].entries.push(item);
    const p = products.find(x => x.id === item.productId);
    if(p){
      groups[key].unitPrice = Number(p.price||groups[key].unitPrice);
      groups[key].discountThreshold = Number(p.discountThreshold||0);
      groups[key].discountPercent = Number(p.discountPercent||0);
    }
  });

  let subtotal = 0, totalDiscount = 0, breakdown = [];
  Object.values(groups).forEach(g=>{
    const s = g.unitPrice * g.qty;
    let final = s, discount = 0;
    if(g.discountThreshold && g.qty >= g.discountThreshold && g.discountPercent){
      final = s * (1 - g.discountPercent/100);
      discount = s - final;
    }
    subtotal += s; totalDiscount += discount; breakdown.push({ name:g.name, qty:g.qty, subtotal:s, discount, final });
  });

  return { subtotal, totalDiscount, final: subtotal - totalDiscount, items: cart, breakdown };
}

async function renderOrder(){
  const orderTable = $('orderTable');
  const orderNoEl = $('orderNumber');
  const orderNum = localStorage.getItem('orderNumber') || ('EC-' + String(Date.now()).slice(-6));
  if(orderNoEl) orderNoEl.textContent = orderNum;

  const data = await computeTotalsAndItems();
  const items = data.items || [];
  orderTable.innerHTML = '';
  if(items.length === 0){
    orderTable.innerHTML = `<tr><td colspan="4" class="muted">Your cart is empty</td></tr>`;
  } else {
    items.forEach(i=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(i.itemName)}</td><td>${escapeHtml(i.flavour||'-')}</td><td>${i.qty}</td><td>R ${fmt(i.price * i.qty)}</td>`;
      orderTable.appendChild(tr);
    });
  }
  if($('orderSubtotal')) $('orderSubtotal').textContent = fmt(data.subtotal);
  if($('orderDiscount')) $('orderDiscount').textContent = fmt(data.totalDiscount);
  if($('orderTotal')) $('orderTotal').textContent = fmt(data.final);
  // update top totals pill
  document.querySelectorAll('#topTotalC,#topTotal,#topTotalM').forEach(el => { el.textContent = fmt(data.final); });
}

function escapeHtml(s){ if(!s && s !== 0) return ''; return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Load addresses from /data/addresses.json
async function loadAddresses(){
  const sel = $('delivery');
  if(!sel) return;
  sel.innerHTML = `<option>Loading addresses…</option>`;
  try{
    const res = await fetch('./data/addresses.json');
    if(!res.ok) throw new Error('Addresses fetch failed');
    const j = await res.json();
    const addresses = j.addresses || [];
    sel.innerHTML = '';
    if(addresses.length === 0) sel.innerHTML = `<option value="">No addresses available</option>`;
    addresses.forEach(a => {
      const opt = document.createElement('option'); opt.value = a; opt.textContent = a; sel.appendChild(opt);
    });
  } catch(err){
    console.error(err);
    sel.innerHTML = `<option value="">Error loading addresses</option>`;
  }
}

// prefill form values from localStorage (edit flow)
function prefillForm(){
  const name = localStorage.getItem('ec_name') || '';
  const email = localStorage.getItem('ec_email') || '';
  const delivery = localStorage.getItem('ec_delivery') || '';
  const notes = localStorage.getItem('ec_notes') || '';
  if($('name')) $('name').value = name;
  if($('email')) $('email').value = email;
  if($('notes')) $('notes').value = notes;
  if($('delivery') && delivery){
    // wait until addresses loaded then set value (addresses loaded async)
    setTimeout(()=> {
      const sel = $('delivery');
      if(sel) sel.value = delivery;
    }, 350);
  }
}

// submit order to GAS
async function submitOrder(payload){
  try{
    const r = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    return j;
  } catch(err){
    console.error(err);
    throw err;
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  await renderOrder();
  await loadAddresses();
  prefillForm();

  // wire edit cart
  const editBtn = $('editButton');
  if(editBtn) editBtn.addEventListener('click', ()=> {
    // store current form values temporarily so user doesn't lose them
    try {
      localStorage.setItem('ec_name', $('name').value || '');
      localStorage.setItem('ec_email', $('email').value || '');
      localStorage.setItem('ec_delivery', $('delivery').value || '');
      localStorage.setItem('ec_notes', $('notes').value || '');
    } catch(e){}
    window.location.href = './index.html';
  });

  // handle submit
  const form = $('checkoutForm');
  if(form){
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const name = ($('name')||{}).value.trim();
      const email = ($('email')||{}).value.trim();
      const delivery = ($('delivery')||{}).value;
      const notes = ($('notes')||{}).value.trim();

      if(!name || !email || !delivery){
        alert('Please enter Name, Email and choose a delivery address.');
        return;
      }

      // compute totals & items
      const totals = await computeTotalsAndItems();
      const finalTotal = totals.final;
      const orderNumber = localStorage.getItem('orderNumber') || ('EC-' + String(Date.now()).slice(-6));

      const payload = {
        orderNumber: orderNumber,
        name: name,
        phone: "",      // left empty by request
        email: email,
        delivery: delivery,
        tip: 0,
        notes: notes,
        items: totals.items.map(i => ({ itemName: i.itemName, flavour: i.flavour || "", qty: i.qty, price: i.price })),
        total: finalTotal,
        timestamp: new Date().toISOString(),
        paymentToken: ""
      };

      // save form fields locally (so thankyou or admin pages can show them)
      localStorage.setItem('ec_name', name);
      localStorage.setItem('ec_email', email);
      localStorage.setItem('ec_delivery', delivery);
      localStorage.setItem('ec_notes', notes);

      // disable button
      const btn = $('payButton'); btn.disabled = true; btn.textContent = 'Placing...';

      try{
        const resp = await submitOrder(payload);
        // if GAS returns success:true (your doPost earlier did), proceed
        if(resp && resp.success !== false){
          // clear cart
          localStorage.removeItem('stellies_cart');
          localStorage.setItem('orderNumber', orderNumber);
          localStorage.setItem('finalTotal', fmt(finalTotal));
          localStorage.setItem('delivery', delivery);
          toast('Order placed — thank you!', 2000);
          setTimeout(()=> window.location.href = './thankyou.html', 900);
          return;
        } else {
          // fallback: save pending local
          const pending = JSON.parse(localStorage.getItem('stellies_pending_orders')||'[]');
          pending.push(payload); localStorage.setItem('stellies_pending_orders', JSON.stringify(pending));
          toast('Saved offline — will submit when online', 2400);
          setTimeout(()=> window.location.href = './thankyou.html', 900);
        }
      } catch(err){
        console.error(err);
        const pending = JSON.parse(localStorage.getItem('stellies_pending_orders')||'[]');
        pending.push(payload); localStorage.setItem('stellies_pending_orders', JSON.stringify(pending));
        toast('Saved offline — will submit when online', 2400);
        setTimeout(()=> window.location.href = './thankyou.html', 900);
      } finally {
        btn.disabled = false; btn.textContent = 'Place Order';
      }
    });
  }
});
