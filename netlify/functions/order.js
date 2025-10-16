// netlify/functions/order.js
const { google } = require('googleapis');
const fetch = require('node-fetch');
const qs = require('querystring');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

const YOCO_SECRET = process.env.YOCO_SECRET_KEY || '';
const TWILIO_SID = process.env.TWILIO_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM = process.env.TWILIO_FROM || '';

async function getSheetsClient(){
  if(!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_KEY) throw new Error('Google service account not configured (SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY)');
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  const jwt = new google.auth.JWT(SERVICE_ACCOUNT_EMAIL, null, SERVICE_ACCOUNT_KEY, scopes);
  await jwt.authorize();
  return google.sheets({ version: 'v4', auth: jwt });
}

async function appendOrderToSheet(payload, paymentToken){
  const sheets = await getSheetsClient();
  const orderNumber = payload.orderNumber || ('GG-' + Date.now());
  const itemsString = (payload.items || []).map(i => `${i.qty}x ${i.itemName}${i.flavour? ' ('+i.flavour+')':''}`).join('; ');
  const row = [
    orderNumber,
    payload.name || '',
    payload.phone || '',
    payload.email || '',
    payload.delivery || '',
    Number(payload.tip || 0),
    payload.notes || '',
    itemsString,
    Number(payload.total || 0),
    payload.timestamp || (new Date()).toISOString(),
    paymentToken || '',
    '', // Packed
    '', // PackedTimestamp
    '', // Delivered
    ''  // DeliveredTimestamp
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Stellies Orders!A:O',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] }
  });
  return orderNumber;
}

async function readAllOrders(){
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Stellies Orders!A1:O' });
  const rows = resp.data.values || [];
  if(rows.length <= 1) return [];
  const headers = rows[0];
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h,i) => obj[h] = r[i] === undefined ? '' : r[i]);
    return obj;
  });
}

async function markPackedInSheet(orderNumber, packer){
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Stellies Orders!A1:O' });
  const rows = resp.data.values || [];
  if(rows.length <= 1) return false;
  const headers = rows[0];
  const idx = headers.indexOf('OrderNumber');
  const packedIdx = headers.indexOf('Packed');
  const packedTsIdx = headers.indexOf('PackedTimestamp');
  for(let i=1;i<rows.length;i++){
    if(rows[i][idx] == orderNumber){
      const rowNumber = i+1;
      const vals = [];
      vals[packedIdx] = packer || 'admin';
      vals[packedTsIdx] = (new Date()).toISOString();
      // write individual cells
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Stellies Orders!${String.fromCharCode(65+packedIdx)}${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[vals[packedIdx]]] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Stellies Orders!${String.fromCharCode(65+packedTsIdx)}${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[vals[packedTsIdx]]] }
      });
      return true;
    }
  }
  return false;
}

async function sendSms(to, text){
  if(!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const body = qs.stringify({ From: TWILIO_FROM, To: to, Body: text });
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
  const res = await fetch(url, { method:'POST', headers:{ Authorization:`Basic ${auth}`, 'Content-Type':'application/x-www-form-urlencoded' }, body });
  return res.json();
}

exports.handler = async function(event, context) {
  try {
    if(event.httpMethod === 'GET'){
      const params = event.queryStringParameters || {};
      if(params.action === 'list') {
        const orders = await readAllOrders();
        return { statusCode:200, body: JSON.stringify({ success:true, orders }) };
      }
      return { statusCode:400, body: JSON.stringify({ success:false, message:'Invalid GET action' }) };
    }

    // POST
    const payload = JSON.parse(event.body || '{}');
    if(payload.action === 'markPacked'){
      const ok = await markPackedInSheet(payload.orderNumber, payload.packer || 'admin');
      return { statusCode:200, body: JSON.stringify({ success:ok }) };
    }

    // process payment with YOCO here if YOCO_SECRET and payload.paymentToken exist
    let paymentToken = '';
    if(YOCO_SECRET && payload.paymentToken){
      // PLACEHOLDER: implement actual Yoco charge per Yoco docs, using YOCO_SECRET
      // Example (pseudocode): POST to Yoco payments endpoint with amountInCents and token
      paymentToken = payload.paymentToken;
    }

    // append order to google sheet
    const orderNumber = await appendOrderToSheet(payload, paymentToken);

    // send SMS
    if(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM && payload.phone){
      const msg = `Hi ${payload.name || ''}, your Golden Grove order ${orderNumber} is confirmed! We'll message when it's ready.`;
      await sendSms(payload.phone, msg);
    }

    return { statusCode:200, body: JSON.stringify({ success:true, orderNumber }) };

  } catch(err){
    console.error(err);
    return { statusCode:500, body: JSON.stringify({ success:false, error:err.message }) };
  }
};
