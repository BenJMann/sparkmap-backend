// webhook.js (Express Router or in app.js)
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const {getQanaojDB} = require('../getClient.js')

// Use raw body for webhook verification
const bodyParser = require('body-parser');

// Must use raw body parser for Stripe to verify signature
router.post('/stripe-verify-transaction', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }


  const transactionId = event.data.object.metadata.transactionId

  if (!transactionId) return res.status(200).send({ ignored: true });

  const client = await getQanaojDB();
  // Handle the event
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await client.collection("transactions").updateOne(
          { _id: transactionId },
          {
            $set: {
                paymentStatus: "suceeded"
              },
          });
        break;

      case 'payment_intent.payment_failed':
        await client.collection("transactions").updateOne(
          { _id: transactionId },
          {
            $set: {
                paymentStatus: "failed"
              },
          });
        break;

      case 'payment_intent.canceled':
        await client.collection("transactions").updateOne(
          { _id: transactionId },
          {
            $set: {
                paymentStatus: "canceled"
              },
          });
        break;

      case 'charge.refunded':
        await client.collection("transactions").updateOne(
          { _id: transactionId },
          {
            $set: {
                paymentStatus: "refunded"
              },
          });
        break;

      case 'charge.dispute.created':
        await client.collection("transactions").updateOne(
          { _id: transactionId },
          {
            $set: {
                paymentStatus: "disputed"
              },
          });
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }  
    res.status(200).json({ received: true });  
  }
  catch (e) {
    console.log("Stripe webhook error", e)
    res.status(500).send(`Webhook Error: ${err.message}`);
  }
});

module.exports = router;
