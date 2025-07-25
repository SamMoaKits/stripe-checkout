import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const intervalMap = {
  "weekly": "week",
  "every week": "week",
  "monthly": "month",
  "every month": "month",
  "every 2 months": "month", // handled with interval_count = 2
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
      const isRepeat = item.purchaseType === "repeat";
      const recurringInterval = intervalMap[item.dropdownSelection?.toLowerCase()?.trim() || ""] || null;
      const intervalCount = intervalCountMap[item.dropdownSelection?.toLowerCase()?.trim() || ""] || 1;

      const lineItem = {
        quantity: item.quantity || 1
      };

      if (isRepeat && recurringInterval) {
        lineItem.price_data = {
          currency: 'gbp',
          product_data: {
            name: item.title,
          },
          unit_amount: Math.round(item.price * 100),
          recurring: {
            interval: recurringInterval,
            interval_count: intervalCount
          }
        };
      } else {
        lineItem.price_data = {
          currency: 'gbp',
          product_data: {
            name: item.title,
          },
          unit_amount: Math.round(item.price * 100)
        };
      }

      line_items.push(lineItem);
    }

    const hasSubscription = line_items.some(i => i.price_data.recurring);
    const mode = hasSubscription ? 'subscription' : 'payment';

    console.log("🧾 Final Stripe mode:", mode);
    console.log("📦 Final line_items:", JSON.stringify(line_items, null, 2));

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

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('❌ Stripe error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
