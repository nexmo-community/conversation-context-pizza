require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const Nexmo = require("nexmo");

const nexmo = new Nexmo(
  {
    applicationId: process.env.NEXMO_APPLICATION_ID,
    privateKey: process.env.NEXMO_PRIVATE_KEY
  },
  { debug: false }
);

const app = express();
app.use(bodyParser.json());

const port = 3000;

const pizzaOptions = {
  1: "pepperoni",
  2: "hawaiian",
  3: "margherita"
};
const orderStates = {};

app.get("/webhooks/answer", (req, res) => {
  const conversation_name = `pizza_${req.query.from}`;

  const ncco = [
    {
      action: "talk",
      text: "Thanks for calling Jurgo's pizza!"
    },
    {
      action: "conversation",
      name: conversation_name
    }
  ];

  return res.json(ncco);
});

app.post("/webhooks/event", async (req, res) => {
  // If it's a transfer, we've moved them in to their own named conversation
  // and need to work out which NCCO to return.
  //
  // We work out which NCCO to return based on the contents of their named
  // conversation
  if (req.body.type == "transfer") {
    const conversation_id = req.body.conversation_uuid_to;

    // Load all the events for this conversation so far
    let events = await loadConversationEvents(conversation_id);

    // Filter down to just the custom:order events
    let orders = selectOrderEvents(events);

    let ncco;
    if (orders.length) {
      // If we had any orders, allow them to place a repeat order
      orderStates[conversation_id] = orders[0].body.type;
      ncco = generateRepeatOrderNcco(orders, req);
    } else {
      // Otherwise list out all the options
      orderStates[conversation_id] = "new";
      ncco = generateNewPizzaNcco(req);
    }

    replaceNcco(conversation_id, ncco);
  }

  return res.status(204).end();
});

app.post("/webhooks/dtmf", async (req, res) => {
  // If it's a DTMF input, they're placing an order. Send it to the kitchen
  // and add it to the conversation

  // If they didn't press anything, don't create an order
  if (req.body.timed_out) {
    return res.status(204).end();
  }

  const conversation_id = req.body.conversation_uuid;
  let pizza;

  // If they've not ordered anything in the past, the DTMF input
  // tells us which pizza they'd like
  if (orderStates[conversation_id] == "new") {
    pizza = pizzaOptions[req.body.dtmf];
    if (!pizza) {
      text = `Sorry, we don't have ${req.body.dtmf} pizzas`;
    } else {
      text = `Thanks for ordering a ${pronounce(pizza)} pizza!`;
    }
  } else {
    // If they have ordered before, 1 means reorder the same pizza,
    // 2 means show me all of the options again
    pizza = orderStates[conversation_id];
    if (req.body.dtmf == 1) {
      text = `A fine choice! We'll have another ${pronounce(
        pizza
      )} pizza on it's way soon!`;
    } else {
      // We set the state to new here so that the next DTMF input is considered
      // a pizza choice, not a reorder
      orderStates[conversation_id] = "new";
      return res.json(generateNewPizzaNcco(req));
    }
  }

  // Add their order to the conversation
  createOrder(conversation_id, pizza);
  sendOrderMessage(process.env.RECIPIENT_NUMBER, pizza);

  return res.json([
    {
      action: "talk",
      text: `<speak>${text}</speak>`
    }
  ]);
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

function loadConversationEvents(conversationId) {
  return new Promise((resolve, reject) => {
    nexmo.conversations.events.get(
      conversationId,
      { page_size: 100, order: "desc" },
      (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data._embedded.data.events);
      }
    );
  });
}

function selectOrderEvents(events) {
  return events.filter(event => event.type == "custom:order");
}

function createOrder(conversationId, type) {
  return new Promise((resolve, reject) => {
    nexmo.conversations.events.create(
      conversationId,
      { type: "custom:order", body: { type } },
      (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      }
    );
  });
}

function generateRepeatOrderNcco(orders, req) {
  const type = orders[0].body.type;
  return [
    {
      action: "talk",
      text: `Welcome back! You can press one to order another ${pronounce(
        type
      )} pizza, or press two to hear the options`
    },
    {
      action: "input",
      maxDigits: 1,
      timeOut: 10,
      eventUrl: [`${req.protocol}://${req.get("host")}/webhooks/dtmf`]
    }
  ];
}

function generateNewPizzaNcco(req) {
  return [
    {
      action: "talk",
      text: `<speak>To order a pepperoni pizza press 1. To order a hawaiian pizza press 2, or to order a ${pronounce(
        "margherita"
      )} pizza press 3</speak>`
    },

    {
      action: "input",
      maxDigits: 1,
      timeOut: 10,
      eventUrl: [`${req.protocol}://${req.get("host")}/webhooks/dtmf`]
    }
  ];
}

function pronounce(word) {
  if (word == "margherita") {
    return "<phoneme alphabet='ipa' ph='mɑr gəˈri tə;'>margherita</phoneme>";
  }
  return word;
}

function replaceNcco(conversationId, ncco) {
  return new Promise((resolve, reject) => {
    nexmo.options.api.request(
      {
        path: `/v1/conversations/${conversationId}/ncco`,
        body: JSON.stringify(ncco),
        headers: {
          Authorization: `Bearer ${nexmo.generateJwt({})}`,
          "Content-Type": "application/json"
        }
      },
      "PUT",
      (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      }
    );
  });
}

function sendOrderMessage(recipientNumber, pizza) {
  return new Promise((resolve, reject) => {
    nexmo.channel.send(
      { type: "sms", number: recipientNumber },
      { type: "sms", number: "JURGO" },
      {
        content: { type: "text", text: `New order! We need a ${pizza} pizza` }
      },
      (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      }
    );
  });
}
