import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { handler } from "../server/handler.js";
import { localStore } from "../server/local.js";
import { applyCommand } from "../server/commands.js";
import { initialState, nextDate } from "../shared/inventory.js";

const zone = "Europe/London";
const sheet = (bucket, id, from, to) => ({
  id: randomUUID(),
  kind: "stock",
  changes: [{ bucket, id, from, to }],
});
const request = (api, method, body) =>
  new Promise((resolve, reject) => {
    const res = {
      setHeader() {},
      end(text) {
        resolve({ status: this.statusCode, ...JSON.parse(text) });
      },
    };
    Promise.resolve(
      api(
        { method, headers: { "content-type": "application/json" }, body },
        res,
      ),
    ).catch(reject);
  });
test("London service day follows local midnight and year rollover", () => {
  assert.equal(nextDate(zone, new Date("2026-06-18T23:10:00Z")), "2026-06-20");
  assert.equal(nextDate(zone, new Date("2026-12-31T23:10:00Z")), "2027-01-01");
});
test("live opening inventory has zero quantities", () => {
  assert.equal(Object.keys(initialState().stock).length, 8);
  assert.deepEqual(Object.values(initialState().stock), Array(8).fill(0));
});
test("invalid sheets are rejected atomically", () => {
  const state = initialState(true),
    command = sheet("stock", "wash", 2.5, 2);
  command.changes.push({ bucket: "laundry", id: "wash", from: 0, to: 1 });
  assert.throws(() => applyCommand(state, command, zone));
  assert.equal(state.stock.wash, 2.5);
  for (const n of [-1, 0.25, 100000, NaN]) {
    assert.throws(() =>
      applyCommand(state, sheet("stock", "wash", 2.5, n), zone),
    );
  }
});
test("two runners, retries, immutable handover and reload through the API", async (t) => {
  const path = await mkdtemp(join(tmpdir(), "runner-test-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  const store = localStore(path),
    api = handler(() => store, zone, "local");
  const a = sheet("stock", "wash", 2.5, 2);
  const responses = await Promise.all([
    request(api, "POST", a),
    request(api, "POST", a),
  ]);
  assert.deepEqual(
    responses.map((r) => r.state.revision),
    [1, 1],
  );
  const losing = await request(api, "POST", sheet("stock", "wash", 2.5, 1));
  assert.equal(losing.status, 409);
  assert.equal(losing.state.stock.wash, 2);
  assert.equal(
    (await request(api, "POST", sheet("laundry", "square", 8, 9))).status,
    200,
  );
  const read = await request(api, "GET");
  assert.equal(read.state.stock.square, 48);
  const handover = {
    id: randomUUID(),
    kind: "send",
    revision: read.state.revision,
    date: read.date,
    bookings: 25,
    covers: 68,
    note: " Prepare front tables. ",
  };
  assert.equal(
    (await request(api, "POST", { ...handover, revision: 0 })).status,
    409,
  );
  assert.equal(
    (await request(api, "POST", { ...handover, covers: 0.5 })).status,
    400,
  );
  const sent = await request(api, "POST", handover);
  assert.equal(sent.state.receipt.bookings, 25);
  assert.equal(sent.state.receipt.note, "Prepare front tables.");
  const after = await request(api, "POST", sheet("stock", "wash", 2, 3));
  assert.equal(after.state.receipt.stock.wash, 2);
  const revised = await request(api, "POST", {
    ...handover,
    id: randomUUID(),
    revision: after.state.revision,
    bookings: 30,
  });
  assert.equal(revised.submitted.bookings, 30);
  const retried = await request(api, "POST", handover);
  assert.equal(retried.submitted.bookings, 25);
  assert.equal(retried.state.receipt.bookings, 30);
  const reopened = await localStore(path).read();
  assert.deepEqual(revised.state, reopened);
  assert.equal((await request(api, "DELETE")).status, 405);
});
