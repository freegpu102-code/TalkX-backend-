// api/index.js
const serverless = require("serverless-http");
const app = require("../server"); // Import your existing Express app

module.exports.handler = serverless(app);
