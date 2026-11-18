import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { localStore } from "./server/local.js";
import { handler } from "./server/handler.js";
import { mongoStore } from "./server/mongo.js";

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
  const useMongo = Boolean(env.MONGODB_URI);
  const local = localStore(".runner-local");
  const api = handler(
    () => (useMongo ? mongoStore(env) : local),
    env.VENUE_TIME_ZONE || "Europe/London",
    useMongo ? "live" : "local",
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
