import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: cart.map(item => ({
        price_data: {
          currency: 'gbp',
          product_data: {
            name: item.title,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: 1,
      })),
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
