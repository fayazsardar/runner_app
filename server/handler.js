import { nextDate } from "../shared/inventory.js";
import { InputError } from "./commands.js";

async function readBody(req) {
  if (!req.headers["content-type"]?.includes("application/json"))
    throw new InputError("Use a JSON request.", 415);
  let body = req.body;
  if (body === undefined) {
    let total = 0;
    const chunks = [];
    for await (const chunk of req) {
      total += chunk.length;
      if (total > 16384) throw new InputError("Request is too large.", 413);
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks).toString();
  }
  if (typeof body === "string") {
    if (Buffer.byteLength(body) > 16384)
      throw new InputError("Request is too large.", 413);
    try {
      body = JSON.parse(body);
    } catch {
      throw new InputError("Invalid JSON.");
    }
  }
  if (
    !body ||
    typeof body !== "object" ||
    typeof body.id !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(body.id)
  )
    throw new InputError("Missing request identifier.");
  return body;
}

export function handler(storeFactory, zone, mode) {
  return async (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    const reply = (status, body) => {
      res.statusCode = status;
      res.end(JSON.stringify(body));
    };
    let store;
    const envelope = (state) => ({ state, date: nextDate(zone), zone, mode });
    try {
      if (!["GET", "POST"].includes(req.method)) {
        res.setHeader("Allow", "GET, POST");
        return reply(405, { error: "Unsupported method." });
      }
      store = storeFactory();
      if (req.method === "GET") return reply(200, envelope(await store.read()));
      const { state, submitted } = await store.write(await readBody(req), zone);
      reply(200, { ...envelope(state), submitted });
    } catch (err) {
      if (err instanceof InputError) {
        if (err.status === 409 && store) {
          try {
            return reply(409, {
              ...envelope(await store.read()),
              error: err.message,
            });
          } catch {
            /* Storage went offline. */
          }
        } else return reply(err.status, { error: err.message });
      }
      reply(503, {
        error:
          "Could not reach shared storage. Your draft is still here. Try again.",
      });
    }
  };
}
