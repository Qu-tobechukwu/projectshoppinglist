// netlify/functions/order.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const payload = JSON.parse(event.body);

    // 1) Process payment with Yoco (optional) — placeholder
    // If you plan to accept card details on client, you'd send a payment token to this endpoint.
    // We expect payload.paymentToken if client collected payment token.
    let paymentToken = payload.paymentToken || '';
    if (process.env.YOCO_SECRET_KEY && paymentToken) {
      try{
        const yRes = await fetch('https://online.yoco.com/v1/payments', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.YOCO_SECRET_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountInCents: Math.round((payload.total || 0) * 100),
            token: paymentToken,
            currency: 'ZAR',
            // optional: additional fields
          })
        });
        const yjson = await yRes.json();
        if (!yRes.ok) {
          console.warn('Yoco error:', yjson);
          // continue: we won't fail entire flow if Yoco not configured properly
        } else {
          payload.paymentResponse = yjson;
        }
      } catch(err) { console.error('Yoco error', err); }
    }

    // 2) Append to Google Apps Script endpoint (APPSCRIPT makes sheet write)
    const appsScriptUrl = process.env.APPSCRIPT_URL;
    if (appsScriptUrl) {
      try {
        const r = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const jr = await r.json().catch(()=>null);
        // don't fail if apps script has issues; we log
        console.log('AppsScript response', jr);
      } catch(err) { console.error('AppsScript append error', err); }
    } else {
      console.warn('No APPSCRIPT_URL set in environment; orders will not be appended to sheet.');
    }

    // 3) (Optional) Send SMS via Twilio (if configured)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
      try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const from = process.env.TWILIO_FROM;
        const to = payload.phone;
        const body = `Hi ${payload.name}, your Stellies order ${payload.orderNumber} has been received. We will message when it's ready. Total: R${payload.total}.`;
        const form = new URLSearchParams({ From: from, To: to, Body: body });
        const twRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: form.toString()
        });
        const twJson = await twRes.json();
        console.log('Twilio response', twJson);
      } catch(err){
        console.error('Twilio error', err);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Order processed', orderNumber: payload.orderNumber }) };
  } catch(err) {
    console.error('order function error', err);
    return { statusCode: 500, body: JSON.stringify({ success:false, message: err.toString() }) };
  }
};
