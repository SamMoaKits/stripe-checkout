import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Mapping from frontend label to Stripe-recognized values
const intervalMap = {
  "weekly": "week",
  "every week": "week",
  "monthly": "month",
  "every month": "month",
  "every 2 months": "month",
  "every 3 months": "month"
};

const intervalCountMap = {
  "every 2 months": 2,
  "every 3 months": 3
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader("Access-Control-Allow-Origin", "https://www.moakits.com");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  res.setHeader("Access-Control-Allow-Origin", "https://www.moakits.com");

  const { cart, email, name, address1, address2, city, postcode } = req.body;

  try {
    const line_items = [];

    for (const item of cart) {
      const isSubscription = item.subscription === true;
      const intervalLabel = item.interval?.toLowerCase().trim() || "";
      const recurringInterval = intervalMap[intervalLabel] || null;
      const intervalCount = intervalCountMap[intervalLabel] || 1;

      const price_data = {
        currency: 'gbp',
        product_data: {
          name: item.kitTitle || item.title || "Kit"
        },
        unit_amount: Math.round(item.price * 100)
      };

      if (isSubscription && recurringInterval) {
        price_data.recurring = {
          interval: recurringInterval,
          interval_count: intervalCount
        };
      }

      line_items.push({
        price_data,
        quantity: item.quantity || 1
      });
    }

    const hasSubscription = line_items.some(li => li.price_data.recurring);
    const mode = hasSubscription ? 'subscription' : 'payment';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode,
      line_items,
      success_url: 'https://www.moakits.com/thank?success=true',
      cancel_url: 'https://www.moakits.com/checkout?cancel=true',
      customer_email: email,
      metadata: {
        customerName: name,
        address1,
        address2,
        city,
        postcode
      }
    });

    console.log(`✅ Stripe session created [mode: ${mode}] → ${session.id}`);
    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('❌ Stripe session creation error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
