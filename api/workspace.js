import { handler } from "../server/handler.js";
import { redisStore } from "../server/redis.js";
export default handler(
  () => redisStore(process.env),
  process.env.VENUE_TIME_ZONE || "Europe/London",
  "live",
);
