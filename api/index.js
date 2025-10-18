// backend/api/index.js
const serverless = require("serverless-http");
const { app, connectDB } = require("../server");

// Wrap Express app in serverless function
const handler = async (req, res) => {
  await connectDB(); // ensure MongoDB connection
  return app(req, res); // handle request
};

module.exports = serverless(handler);
