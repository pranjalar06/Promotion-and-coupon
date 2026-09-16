require("dotenv").config();
const app = require("./app");
const { log } = require("./utils/logger");

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  log("server.started", { port: PORT });
});
