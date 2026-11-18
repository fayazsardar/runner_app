import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { initialState } from "../shared/inventory.js";
import { applyCommand } from "./commands.js";

// Single development server only. Production uses MongoDB.
export function localStore(directory) {
  const filename = join(directory, "workspace.json");
  let pending = Promise.resolve();
  async function load() {
    try {
      return JSON.parse(await readFile(filename, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return { state: initialState(true), requests: [] };
    }
  }
  return {
    async read() {
      return (await load()).state;
    },
    write(command, zone) {
      const operation = pending.then(async () => {
        const db = await load();
        const existing = db.requests.find((r) => r.id === command.id);
        if (existing) return { state: db.state, submitted: existing.submitted };
        db.state = applyCommand(db.state, command, zone);
        const submitted = command.kind === "send" ? db.state.receipt : null;
        db.requests = [
          ...db.requests.slice(-199),
          { id: command.id, submitted },
        ];
        await mkdir(directory, { recursive: true });
        await writeFile(filename + ".tmp", JSON.stringify(db));
        await rename(filename + ".tmp", filename);
        return { state: db.state, submitted };
      });
      pending = operation.catch(() => {});
      return operation;
    },
  };
}
