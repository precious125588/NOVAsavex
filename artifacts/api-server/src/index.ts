import app from "./app";
import { logger } from "./lib/logger";

const boundPort = Number(process.env["PORT"] || "8080");

const server = app.listen(boundPort, "0.0.0.0", () => {
  logger.info({ port: boundPort }, "Server listening");
});

server.on("error", (err) => {
  logger.error({ err }, "Server failed to start");
  process.exit(1);
});
