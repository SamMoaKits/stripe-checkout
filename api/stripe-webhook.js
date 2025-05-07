import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15',
});

export const config = {
  api: {
    bodyParser: false, // Important to disable default body parsing!
  },
};

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];

  let event;
  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Stripe signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("✅ Stripe payment success for:", session.customer_email);

    try {
      await fetch("https://script.google.com/macros/s/AKfycbwMuuLg5Wj5vb6-ty7olCY6kWz1oJMeyYldrrwOTBvdFZ1tz6ApRmwtqzYr8OCkkJ8/exec", {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: session.customer_email,
          name: session.metadata?.customerName || "",
          orderId: session.id,
          total: `£${(session.amount_total / 100).toFixed(2)}`,
          orderSummary: "Webhook-triggered order",
        }),
      });
      console.log("📦 Sent to Google Sheets");
    } catch (err) {
      console.error("❌ Failed to send to Google Sheets:", err);
    }
  }

  res.status(200).json({ received: true });
}
