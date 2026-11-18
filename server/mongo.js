import { MongoClient } from "mongodb";
import { initialState } from "../shared/inventory.js";
import { applyCommand, InputError } from "./commands.js";

const clients = new Map();

function clientFor(uri) {
  if (!clients.has(uri)) {
    const client = new MongoClient(uri, {
      appName: "runner-stock",
      serverSelectionTimeoutMS: 7000,
      connectTimeoutMS: 7000,
    });
    clients.set(
      uri,
      client.connect().catch((error) => {
        clients.delete(uri);
        throw error;
      }),
    );
  }
  return clients.get(uri);
}

export function mongoStore(env) {
  const uri = env.MONGODB_URI;
  if (!uri)
    throw new InputError(
      "Shared storage is not configured. Add MONGODB_URI in Vercel.",
      503,
    );

  const database = env.MONGODB_DATABASE || "runner";
  const namespace = env.RUNNER_NAMESPACE || "runner";
  const collection = clientFor(uri).then((client) =>
    client.db(database).collection("workspaces"),
  );

  async function load() {
    const workspaces = await collection;
    await workspaces.updateOne(
      { _id: namespace },
      { $setOnInsert: { state: initialState(), requests: [] } },
      { upsert: true },
    );
    return workspaces.findOne({ _id: namespace });
  }

  return {
    async read() {
      return (await load()).state;
    },
    async write(command, zone) {
      const workspaces = await collection;
      for (let attempt = 0; attempt < 4; attempt++) {
        const workspace = await load();
        const existing = workspace.requests.find(
          (request) => request.id === command.id,
        );
        if (existing)
          return { state: workspace.state, submitted: existing.submitted };

        const updated = applyCommand(workspace.state, command, zone);
        const submitted = command.kind === "send" ? updated.receipt : null;
        const result = await workspaces.updateOne(
          {
            _id: namespace,
            "state.revision": workspace.state.revision,
            "requests.id": { $ne: command.id },
          },
          {
            $set: { state: updated },
            $push: {
              requests: {
                $each: [{ id: command.id, submitted }],
                $slice: -200,
              },
            },
          },
        );
        if (result.modifiedCount === 1) return { state: updated, submitted };
      }
      throw new InputError(
        "Another update is being saved. Review the current counts and retry.",
        409,
      );
    },
  };
}
