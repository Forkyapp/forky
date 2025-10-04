// This file exists only to satisfy Vercel's build process
// The actual serverless function is in api/webhook.js
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Use /webhook endpoint for ClickUp webhooks' });
});

module.exports = app;
