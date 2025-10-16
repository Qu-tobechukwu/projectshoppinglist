// netlify/functions/order.js
const { google } = require('googleapis');
const fetch = require('node-fetch');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // set in Netlify env
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'); // ensure newlines
const YOCO_SECRET = process.env.YOCO_SECRET_KEY || ''; // optional, set later
const TWILIO_SID = process.env.TWILIO_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM = process.env.TWILIO_FROM || '';

exports.handler = async function(event, context) {
  try {
    if(event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      if(params.action === 'list') {
        const rows = await readOrders();
        return { statusCode: 200, body: JSON.stringify({ success:true, orders: rows }) };
      }
      return { statusCode: 400, body: JSON.stringify({ success:false, message:'Use POST to create order or ?action=list to fetch' }) };
    }

    if(event.httpMethod !== 'POST') return { statusCode:405, body: 'Method not allowed' };
    const payload = JSON.parse(event.body);

    // 1) optionally process payment with Yoco (server-side)
    let paymentToken = '';
    if(YOCO_SECRET && payload.paymentToken) {
      // Example Yoco charge (replace with actual Yoco API usage per docs)
      // This is a placeholder: you will implement Yoco's charge/create payment API with your secret key.
      // const payRes = await fetch('https://online.yoco.com/v1/payments', { method:'POST', headers:{ 'Authorization': `Bearer ${YOCO_SECRET}`, 'Content-Type':'application/json' }, body: JSON.stringify({ amountInCents: Math.round(payload.total*100), token: payload.paymentToken }) });
      // const payJson = await payRes.json();
      // paymentToken = payJson.id || '';
      // For now we'll mark as 'mock' if YOCO_SECRET not set.
      paymentToken = payload.paymentToken || '';
    }

    // 2) Append order to Google Sheet
    await appendOrderToSheet(payload, paymentToken);

    // 3) Optionally send SMS via Twilio
    if(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM && payload.phone) {
      await sendSms(payload.phone, `Eden Pantry: Your order ${payload.orderNumber || ''} was received — we'll message when it's ready.`);
    }

    return { statusCode: 200, body: JSON.stringify({ success:true, message: 'Order processed' }) };

  } catch(err) {
    console.error('Order function error', err);
    return { statusCode:500, body: JSON.stringify({ success:false, message: err.message }) };
  }
};

/* ---------- Google Sheets helpers ---------- */
async function getSheetsClient() {
  if(!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_KEY) throw new Error('Google service account not configured');
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  const jwt = new google.auth.JWT(SERVICE_ACCOUNT_EMAIL, null, SERVICE_ACCOUNT_KEY, scopes);
  await jwt.authorize();
  return google.sheets({version:'v4', auth: jwt});
}

async function appendOrderToSheet(payload, paymentToken) {
  const sheets = await getSheetsClient();
  // Ensure headers exist; append row
  const orderNumber = payload.orderNumber || ('EDP-' + Date.now());
  const row = [
    orderNumber,
    payload.name || '',
    payload.phone || '',
    payload.email || '',
    payload.delivery || '',
    payload.tip || 0,
    payload.notes || '',
    (payload.items || []).map(i => `${i.qty}x ${i.itemName}${i.flavour? ' ('+i.flavour+')':''}`).join('; '),
    payload.total || 0,
    payload.timestamp || new Date().toISOString(),
    paymentToken || '',
    '', // Packed
    '', // PackedTimestamp
    '', // Delivered
    ''  // DeliveredTimestamp
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Orders!A:O',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] }
  });
}

/* ---------- Twilio SMS (optional) ---------- */
async function sendSms(to, text) {
  if(!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const body = new URLSearchParams({ From: TWILIO_FROM, To: to, Body: text });
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
  const res = await fetch(url, { method:'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type':'application/x-www-form-urlencoded' }, body: body.toString() });
  const j = await res.json();
  if(!res.ok) {
    console.warn('Twilio failed', j);
  }
  return j;
}
