document.addEventListener('DOMContentLoaded', () => {
  // Load menu and ads
  fetch('data/menu.json').then(r => r.json()).then(renderMenu);
  fetch('data/ads.json').then(r => r.json()).then(renderAds);

  // Install app prompt
  let deferredPrompt;
  const installBtn = document.getElementById('installAppBtn');
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'inline-block';
  });
  installBtn.addEventListener('click', async () => {
    deferredPrompt.prompt();
  });
});

function renderMenu(items) {
  const menuList = document.getElementById('menu-list');
  menuList.innerHTML = items.map(i => `
    <div class="menu-card">
      <img src="${i.image}" alt="${i.name}" style="width:100%;border-radius:12px;">
      <h3>${i.name}</h3>
      <p>R${i.price}</p>
      <p class="discount">${i.discount || ''}</p>
      <button class="btn">Add to Cart</button>
    </div>
  `).join('');
}

function renderAds(ads) {
  const adCol = document.getElementById('ads-column');
  if (!adCol) return;
  adCol.innerHTML = ads.map(ad => `<a href="${ad.link}"><img src="${ad.image}" style="width:100%;border-radius:12px;margin:1rem 0;"></a>`).join('');
}
