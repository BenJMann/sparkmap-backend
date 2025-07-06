const express = require('express');
const router = express.Router();
const {v4: uuidv4} = require('uuid')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const {getQanaojDB} = require('../getClient.js')
const {offerings} = require('./offerings.js')

router.get('/', (req, res) => {
  res.send({ text: "Qanaoj root endpoint" });
});

const currencies = [
  'eur',
  'gbp',
  'usd',
  'aud',
  'cad',
  'czk',
  'dkk',
  'nok',
  'pln',
  'sek',
  'chf',
  'sgd',
  'nzd'
];


router.get('/currencies', async (req, res) => {
    res.send(currencies.map((c) => c.toUpperCase()))
})

router.get('/offerings', async (req, res) => {
    res.send(offerings)
})

// Payments
router.post('/register-transaction', async (req, res) => {
  const {
    name,
    email,
    language,
    subscribeNewsletter,
    agreeTOC,
    type,
    eventId,
    timezone,
    comment,
    currency,
    amount
    } = req.body;

  if (!agreeTOC)
    return res.status(400).send({
        error: "Didn't accept terms and conditions"
    });

  if (!email || !language)
    return res.status(400).send({
        error: "Missing information"
    });

  if (!["donation", "event"].includes(type))
    return res.status(400).send({
        error: "Invalid type"
    });

  if (amount && !currencies.includes(currency.toLowerCase()))
    return res.status(400).send({
        error: "Invalid currency"
    });
  
  if (type == "donation" && amount <= 0)
    return res.status(400).send({
        error: "Donations must have an amount"
    });

  if (type == "donation" && eventId)
    return res.status(400).send({
        error: "Donations can't have an eventId"
    });
    
  const updateFieldsIfExists = {
    ...(name && { name }),
    ...(subscribeNewsletter && { subscribeNewsletter }),
  };

  const now = new Date();

  const client = await getQanaojDB();
  
  const existingUser = await client.collection("users").findOne({ email });
  
  let userId;
  const transactionId = uuidv4();
  
  const session = client.s.client.startSession();
  try {
    await session.withTransaction( async() => {
        if (existingUser) {
            userId = existingUser._id;

            await client.collection("users").updateOne(
            { _id: userId },
            {
                $set: {
                    language,
                    agreeTOC,
                    ...updateFieldsIfExists,
                    lastTransactionDate: now
                },
            }
            );
        } else {
            // Step 3: Create new user with UUID
            userId = uuidv4();

            await client.collection("users").insertOne({
                _id: userId,
                email,
                language,
                ...updateFieldsIfExists,
                lastTransactionDate: now,
                createdAt: now,
            });
        }

        // Step 4: Insert transaction referencing userId
        await client.collection("transactions").insertOne({
            _id: transactionId,
            userId,
            currency: currency.toLowerCase(),
            amount,
            type,
            eventId,
            timezone,
            comment,
            createdAt: now,
            confirmed: false,
            paymentStatus: !amount ? "N/A" : "Pending",
            emailSent: false,
        });
    })

    let paymentIntent;
    const numericAmount = parseFloat(amount);
    if (numericAmount > 0)
        paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(numericAmount * 100),
            currency: currency.toLowerCase(),
            payment_method_types: ['card', 'paypal'], // 👈 include PayPal here
            metadata: {
                userId,
                transactionId
            }
        });

    res.send({
        ...(paymentIntent && {clientSecret: paymentIntent.client_secret}),
        transactionId
    });
  } catch(e) {
    console.log(e);
    res.status(500).send({error: "Internal server error"})
  }
});

router.post('/confirm-transaction', async (req, res) => {
  const { transactionId } = req.body;

  if (!transactionId) {
    return res.status(400).send({ error: "Missing transactionId" });
  }

  try {
    const client = await getQanaojDB();

    // Find the transaction first
    const transaction = await client.collection("transactions").findOne({ _id: transactionId });

    if (!transaction) {
      return res.status(404).send({ error: "Transaction not found" });
    }

    // Update the confirmed flag
    await client.collection("transactions").updateOne(
      { _id: transactionId },
      { $set: { confirmed: true } }
    );

    // Return transaction details
    const { type, eventId, amount, currency, timezone } = transaction;

    return res.send({
      success: true,
      transactionId,
      type,
      eventId,
      timezone,
      amount,
      currency
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send({ error: "Internal server error" });
  }
});




//Contact form submission
router.post('/contact-form', (req, res) => {
  res.send({ text: "Qanaoj says hello" });
});


module.exports = router;
