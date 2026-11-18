import { handler } from "../server/handler.js";
import { mongoStore } from "../server/mongo.js";
export default handler(
  () => mongoStore(process.env),
  process.env.VENUE_TIME_ZONE || "Europe/London",
  "live",
);
