import fetch from "node-fetch";
import twilio from "twilio";

export async function handler(event) {
  try {
    const data = JSON.parse(event.body);

    const {
      name, phone, email, delivery, tip, notes, items, total
    } = data;

    const orderNumber = Math.floor(1000 + Math.random() * 9000);
    const timestamp = new Date().toISOString();

    // Google Sheets append
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Stellies%20Orders!A1:append?valueInputOption=USER_ENTERED`;
    const body = {
      values: [[
        orderNumber, name, phone, email, delivery, tip, notes,
        JSON.stringify(items), total, timestamp, "", "FALSE", "", "FALSE", ""
      ]]
    };

    await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GOOGLE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    // Twilio SMS
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      from: process.env.TWILIO_PHONE,
      to: phone,
      body: `Hi ${name}, your Golden Grove order #${orderNumber} is confirmed! 🍃✨`
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
  }
}
