import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { localStore } from "./server/local.js";
import { handler } from "./server/handler.js";
import { redisStore } from "./server/redis.js";

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
  const useRedis = Boolean(
    env.UPSTASH_REDIS_REST_URL || env.UPSTASH_REDIS_REST_TOKEN,
  );
  const local = localStore(".runner-local");
  const api = handler(
    () => (useRedis ? redisStore(env) : local),
    env.VENUE_TIME_ZONE || "Europe/London",
    useRedis ? "live" : "local",
  );
  const middleware = (server) => {
    server.middlewares.use("/api/workspace", api);
  };
  return {
    plugins: [
      react(),
      tailwind(),
      {
        name: "runner-api",
        configureServer: middleware,
        configurePreviewServer: middleware,
      },
    ],
  };
});
