import { items, linen, nextDate } from "../shared/inventory.js";

export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const count = (n, step) =>
  Number.isFinite(n) && n >= 0 && n <= 99999 && Number.isInteger(n / step);
const conflict = (message) => {
  throw new InputError(message, 409);
};

export function applyCommand(current, command, zone, now = new Date()) {
  const result = structuredClone(current);
  if (command.kind === "stock") {
    const changes = command.changes;
    if (!Array.isArray(changes) || !changes.length || changes.length > 12)
      throw new InputError("Enter at least one stock change.");
    const seen = new Set();
    for (const change of changes) {
      if (!change || typeof change !== "object")
        throw new InputError("Invalid stock entry.");
      const { bucket, id, from, to } = change;
      const catalog =
        bucket === "laundry" ? linen : bucket === "stock" ? items : [];
      const item = catalog.find((entry) => entry.id === id);
      const key = bucket + "/" + id;
      if (
        !item ||
        seen.has(key) ||
        !count(from, item.step) ||
        !count(to, item.step)
      )
        throw new InputError("Check stock quantities and units.");
      if (current[bucket][id] !== from)
        conflict(
          item.name +
            " changed on another device. Review the saved count below, then save again.",
        );
      result[bucket][id] = to;
      seen.add(key);
    }
  } else if (command.kind === "send") {
    if (command.date !== nextDate(zone, now))
      conflict(
        "The venue date has changed. Review the service date before sending.",
      );
    if (command.revision !== current.revision)
      conflict(
        "Shared stock or the handover changed. Review the latest counts before sending again.",
      );
    if (
      !count(command.bookings, 1) ||
      !count(command.covers, 1) ||
      typeof command.note !== "string" ||
      command.note.length > 2000
    )
      throw new InputError("Check bookings, covers and the shift note.");
    result.receipt = {
      id: command.id,
      date: command.date,
      at: now.toISOString(),
      bookings: command.bookings,
      covers: command.covers,
      note: command.note.trim(),
      stock: { ...current.stock },
      laundry: { ...current.laundry },
    };
  } else throw new InputError("Unknown change.");
  result.revision++;
  result.updated = now.toISOString();
  return result;
}
