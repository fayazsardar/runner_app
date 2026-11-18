import { initialState } from "../shared/inventory.js";
import { applyCommand, InputError } from "./commands.js";

// Matching and writing the state, and marking a request as applied, form one Redis operation.
const commit = `
if redis.call('EXISTS', KEYS[2]) == 1 then return 2 end
local before = redis.call('GET', KEYS[1])
if (before or '') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3], 'EX', 86400)
return 1`;

export function redisStore(env) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token)
    throw new InputError(
      "Shared storage is not configured. Add the Redis environment variables in Vercel.",
      503,
    );
  const key = "{" + (env.RUNNER_NAMESPACE || "runner") + "}:stock";
  async function redis(...args) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error("Storage request failed");
    const data = await response.json();
    if (data.error) throw new Error("Storage command failed");
    return data.result;
  }
  const unpack = (raw) => (raw ? JSON.parse(raw) : initialState());
  return {
    async read() {
      return unpack(await redis("GET", key));
    },
    async write(command, zone) {
      const op = key + ":op:" + command.id;
      for (let attempt = 0; attempt < 4; attempt++) {
        const [raw, applied] = await redis("MGET", key, op);
        const state = unpack(raw);
        if (applied) return { state, submitted: JSON.parse(applied) };
        const updated = applyCommand(state, command, zone);
        const submitted = command.kind === "send" ? updated.receipt : null;
        const status = await redis(
          "EVAL",
          commit,
          2,
          key,
          op,
          raw || "",
          JSON.stringify(updated),
          JSON.stringify(submitted),
        );
        if (status === 1) return { state: updated, submitted };
        if (status === 2) {
          const [latest, cached] = await redis("MGET", key, op);
          return { state: unpack(latest), submitted: JSON.parse(cached) };
        }
      }
      throw new InputError(
        "Another update is being saved. Review the current counts and retry.",
        409,
      );
    },
  };
}
