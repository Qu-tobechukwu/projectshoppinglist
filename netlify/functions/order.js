import fetch from 'node-fetch';

export async function handler(event) {
  const order = JSON.parse(event.body);
  const sheetUrl = "https://script.google.com/macros/s/AKfycbwxP_vLG1PXl4l4_eKi_DTdK1duFwQiscXDDNqkFVcpdIuR_x212lHUp2rQJahWJKRS/exec";

  await fetch(sheetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order)
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, message: "Order added successfully" })
  };
}
