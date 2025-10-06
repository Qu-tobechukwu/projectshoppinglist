// Handle first form (index.html)
const groceryForm = document.getElementById('groceryForm');
if (groceryForm) {
  groceryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const shoppingList = document.getElementById('shoppingList').value.trim();
    if (!shoppingList) return alert('Please enter your shopping list.');

    const orderNumber = 'ORD' + Date.now(); // unique order number
    localStorage.setItem('shoppingList', shoppingList);
    localStorage.setItem('orderNumber', orderNumber);

    window.location.href = 'checkout.html';
  });
}

// Handle checkout page
const orderNumberEl = document.getElementById('orderNumber');
const orderListEl = document.getElementById('orderList');
if (orderNumberEl && orderListEl) {
  orderNumberEl.textContent = localStorage.getItem('orderNumber') || '';
  orderListEl.textContent = localStorage.getItem('shoppingList') || '';
}

// Handle payment button
const payButton = document.getElementById('payButton');
if (payButton) {
  payButton.addEventListener('click', () => {
    const name = document.getElementById('studentName').value.trim();
    const phone = document.getElementById('phoneNumber').value.trim();
    const address = document.getElementById('deliveryAddress').value;
    const tip = document.getElementById('tip').value || 0;

    if (!name || !phone || !address) return alert('Please fill all required fields.');

    // Save details before redirect
    localStorage.setItem('studentName', name);
    localStorage.setItem('phoneNumber', phone);
    localStorage.setItem('deliveryAddress', address);
    localStorage.setItem('tip', tip);

    // Placeholder for Yoco API integration
    alert('Redirecting to payment (Yoco)…');
    window.location.href = 'thankyou.html';
  });
}
