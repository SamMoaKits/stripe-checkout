import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  let event;
  try {
    const rawBody = await buffer(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Stripe signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      console.log('✅ Stripe payment success for:', session.customer_email);

      await fetch(
        'https://script.google.com/macros/s/AKfycbwMuuLg5Wj5vb6-ty7olCY6kWz1oJMeyYldrrwOTBvdFZ1tz6ApRmwtqzYr8OCkkJ8/exec',
        {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: session.customer_email,
            name: session.metadata?.customerName || '',
            orderId: session.id,
            total: `£${(session.amount_total / 100).toFixed(2)}`,
            orderSummary: 'Stripe webhook processed',
          }),
        }
      );

      console.log('📦 Sent to Google Sheets');
    }

    // ✅ Always respond
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('❌ Webhook handler error:', err.message);
    // Still respond 200 to prevent repeated retries
    res.status(200).json({ error: 'Handled error' });
  }
}
