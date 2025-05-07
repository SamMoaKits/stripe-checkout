import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { cart, email, name, address1, address2, city, postcode } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: cart.map(item => ({
        price_data: {
          currency: 'gbp',
          product_data: { name: item.title },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: 1,
      })),
      mode: 'payment',
      success_url: 'https://www.moakits.com/thank?success=true',
      cancel_url: 'https://www.moakits.com/checkout?cancelled=true',
      customer_email: email,
      metadata: {
        customerName: name,
        address1,
        address2,
        city,
        postcode,
      },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("❌ Stripe session creation failed:", err);
    res.status(500).json({ error: err.message });
  }
}
