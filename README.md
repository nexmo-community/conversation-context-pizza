# Jurgo's Pizza Place

This is a demo application that shows how to use a named conversation with the Nexmo Voice API to keep track of interactions with a user and customise the experience based on previous events.

## What it does

The user calls a phone number to order a pizza. If they have not ordered before, an IVR listing all of the options will be presented. Once they choose a pizza, that order is added to the conversation as a custom event an an SMS is sent to the chef using the Messages API.

The next time they call, their conversation history is loaded and we find their latest custom order. A different IVR is presented, allowing the user to reorder the last pizza ordered or to hear all of the options again.

## Why did we build this?

Having the historical context for your interactions with a customer allows you to make informed decisions when communicating with them. This is a proof of concept application that shows how it can be implemented

# Running the application

First, clone this repo to your machine

```
git clone https://github.com/nexmo-community/conversation-context-pizza
cd conversation-context-pizza
```

To provide access to your local machine, start `ngrok`:

```
ngrok http 3000
```

Next, create a new Nexmo application and purchase a phone number using the [Nexmo CLI](https://github.com/nexmo/nexmo-cli) (replacing the ngrok URL with your own):

```
nexmo app:create "Conversation Context Pizza" https://abc1234.ngrok.io/webhooks/answer https://abc1234.ngrok.io/webhooks/event --keyfile=private.key --type=voice
nexmo number:buy -c GB --confirm
nexmo link:app <number> <application_id>
```

Create a `.env` file with the required credentials:

```
NEXMO_APPLICATION_ID=<application_id>
NEXMO_PRIVATE_KEY=./private.key
RECIPIENT_NUMBER=<chef phone number - use your personal number for testing)
```

Finally, install dependencies and run the application:

```
npm install
npm start
```

You should now be able to call the number you purchased earlier and hear all of the pizza options. Press 1 to order a pizza, then call the number again. This time, you should hear a different set of options.
