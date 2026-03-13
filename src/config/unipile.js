const { UnipileClient } = require("unipile-node-sdk");
require("dotenv").config();

const unipile = new UnipileClient(
  process.env.UNIPILE_DSN,
  process.env.UNIPILE_API_KEY
);

module.exports = { unipile };
