import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Disable body parsing to get raw payload
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to read raw body from request
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  let event;
  const sig = req.headers['stripe-signature'];

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log("✅ Payment complete for:", session.customer_email);

    const googleSheetWebhookUrl = "https://script.google.com/macros/s/AKfycbwMuuLg5Wj5vb6-ty7olCY6kWz1oJMeyYldrrwOTBvdFZ1tz6ApRmwtqzYr8OCkkJ8/exec";

    const payload = {
      to: session.customer_email,
      name: session.metadata?.customerName || '',
      orderId: session.id,
      total: session.amount_total ? `£${(session.amount_total / 100).toFixed(2)}` : '',
      orderSummary: 'Sent via Stripe Webhook'
    };

    try {
      await fetch(googleSheetWebhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log("📦 Sent to Google Sheets");
    } catch (error) {
      console.error("❌ Failed to send to Google Sheets:", error);
    }
  }

  res.json({ received: true });
}
