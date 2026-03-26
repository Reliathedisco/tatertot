export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const { key } = req.body || {};
  if (!key) return res.status(400).json({ valid: false, error: "missing key" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ valid: false, error: "server misconfigured" });

  try {
    // The activation key is a Stripe checkout session ID
    // Look up the session to verify it's a completed payment
    const sessionRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(key)}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } },
    );

    if (!sessionRes.ok) {
      // Maybe it's a subscription ID or customer ID — try subscription
      const subRes = await fetch(
        `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(key)}`,
        { headers: { Authorization: `Bearer ${stripeKey}` } },
      );

      if (subRes.ok) {
        const sub = await subRes.json();
        if (sub.status === "active" || sub.status === "trialing") {
          return res.status(200).json({ valid: true, status: sub.status });
        }
        return res.status(200).json({ valid: false, status: sub.status });
      }

      return res.status(200).json({ valid: false, error: "key not recognized" });
    }

    const session = await sessionRes.json();

    if (session.payment_status === "paid" || session.status === "complete") {
      // Check if there's an active subscription
      if (session.subscription) {
        const subRes = await fetch(
          `https://api.stripe.com/v1/subscriptions/${session.subscription}`,
          { headers: { Authorization: `Bearer ${stripeKey}` } },
        );
        if (subRes.ok) {
          const sub = await subRes.json();
          return res.status(200).json({
            valid: sub.status === "active" || sub.status === "trialing",
            status: sub.status,
          });
        }
      }
      return res.status(200).json({ valid: true, status: "paid" });
    }

    return res.status(200).json({ valid: false, status: session.payment_status });
  } catch (err) {
    return res.status(500).json({ valid: false, error: "verification failed" });
  }
}
