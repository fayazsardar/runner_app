import { useEffect, useRef, useState } from "react";
import { groups, items, linen, lowStock } from "../shared/inventory.js";
import { Counter, dayLabel, Heading, Icon, Primary } from "./ui";
import type { IconName } from "./ui";
import type { Bucket, Counts, Edit, Page, Receipt, Snapshot } from "./types";

const links: { page: Page; title: string; short: string; icon: IconName }[] = [
  { page: "home", title: "Shared stock", short: "Home", icon: "home" },
  { page: "stock", title: "Update stock", short: "Stock", icon: "stock" },
  {
    page: "linen",
    title: "Tablecloth stock",
    short: "Tablecloths",
    icon: "linen",
  },
  {
    page: "tomorrow",
    title: "Tomorrow & handover",
    short: "Tomorrow",
    icon: "tomorrow",
  },
];
const symbols: Record<string, IconName> = {
  Chemicals: "drop",
  "Paper supplies": "paper",
  Linen: "linen",
};
function currentPage(): Page {
  const route = location.hash.slice(1);
  return ["home", "stock", "linen", "tomorrow", "sent"].includes(route)
    ? (route as Page)
    : "home";
}
function dateReceipt(data: Snapshot) {
  return data.state.receipt?.date === data.date ? data.state.receipt : null;
}
function listRows(stock: Counts, catalog = items) {
  return catalog.map((i) => (
    <div className="quantity-row" key={i.id}>
      <span>{i.name}</span>
      <span>
        <b>{stock[i.id]}</b> <small>{i.unit}</small>
      </span>
    </div>
  ));
}
function HandoverDetails({ receipt }: { receipt: Receipt }) {
  return (
    <section className="card p-5">
      <h2>Submitted handover</h2>
      <div className="quantity-row">
        <span>Bookings</span>
        <b>{receipt.bookings}</b>
      </div>
      <div className="quantity-row">
        <span>Expected covers</span>
        <b>{receipt.covers}</b>
      </div>
      <div className="pt-4">
        <strong>Shift note</strong>
        <p className="mt-1 whitespace-pre-wrap break-words">
          {receipt.note || "No note added."}
        </p>
      </div>
      <details className="mt-5">
        <summary>Saved counts and laundry</summary>
        {listRows(receipt.stock)}
        <h3 className="mt-4">In laundry</h3>
        {listRows(receipt.laundry, linen)}
      </details>
    </section>
  );
}
type FormDraft = {
  bookings: string;
  covers: string;
  note: string;
  date: string;
  revision: number;
  receiptId: string | null;
};
function startForm(data: Snapshot): FormDraft {
  const r = dateReceipt(data);
  return {
    bookings: String(r?.bookings ?? 0),
    covers: String(r?.covers ?? 0),
    note: r?.note ?? "",
    date: data.date,
    revision: data.state.revision,
    receiptId: r?.id ?? null,
  };
}
export default function App() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [page, setPage] = useState<Page>(currentPage);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState(
    "Shared stock is unavailable.",
  );
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [bucket, setBucket] = useState<Bucket>("stock");
  const [form, setForm] = useState<FormDraft | null>(null);
  const [compose, setCompose] = useState(false);
  const [confirmation, setConfirmation] = useState<Receipt | null>(null);
  const inFlight = useRef(false),
    readSequence = useRef(0);
  const retry = useRef<{ body: string; id: string } | null>(null);
  async function refresh() {
    if (inFlight.current) return;
    const seq = ++readSequence.current;
    try {
      const resp = await fetch("/api/workspace", {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      const payload = await resp.json();
      if (!resp.ok)
        throw Error(payload.error || "Shared stock is unavailable.");
      if (seq !== readSequence.current) return;
      setData(payload);
      setOffline(false);
    } catch (e) {
      if (seq === readSequence.current) {
        setOffline(true);
        setConnectionMessage(
          e instanceof Error ? e.message : "Shared stock is unavailable.",
        );
      }
    }
  }
  useEffect(() => {
    void refresh();
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(tick, 10000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    const route = () => {
      setPage(currentPage());
      setError("");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", route);
    return () => {
      clearInterval(timer);
      window.removeEventListener("hashchange", route);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  function nav(to: Page) {
    setError("");
    if (to === "tomorrow") setCompose(false);
    location.hash = to;
    setPage(to);
    window.scrollTo(0, 0);
  }
  function update(k: string, v: string, b: Bucket = "stock") {
    if (!data) return;
    const key = b + "/" + k;
    setEdits((previous) => {
      const next = { ...previous };
      const from = next[key]?.from ?? data.state[b][k];
      if (v !== "" && Number(v) === from) delete next[key];
      else next[key] = { id: k, bucket: b, from, value: v };
      return next;
    });
  }
  async function write(
    body: Record<string, unknown>,
    onSuccess: (s: Snapshot) => void,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    ++readSequence.current;
    setBusy(true);
    setError("");
    const signature = JSON.stringify(body);
    if (retry.current?.body !== signature)
      retry.current = { body: signature, id: crypto.randomUUID() };
    try {
      const resp = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, id: retry.current.id }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await resp.json();
      if (resp.status === 409 && result.state) {
        setData(result);
        setOffline(false);
        retry.current = null;
        if (body.kind === "stock") {
          const submitted = (
            body.changes as { bucket: Bucket; id: string }[]
          ).map((c) => c.bucket + "/" + c.id);
          setEdits((prev) =>
            Object.fromEntries(
              Object.entries(prev).map(([k, e]) => [
                k,
                submitted.includes(k)
                  ? { ...e, from: result.state[e.bucket][e.id] }
                  : e,
              ]),
            ),
          );
        }
        if (body.kind === "send")
          setForm((prev) =>
            prev
              ? {
                  ...prev,
                  revision: result.state.revision,
                  date: result.date,
                  receiptId: prev.receiptId,
                }
              : prev,
          );
      }
      if (!resp.ok)
        throw Error(result.error || "Save failed. Retry with your draft.");
      retry.current = null;
      setData(result);
      setOffline(false);
      onSuccess(result);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Save failed. Retry with your draft.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const navButtons = (mobile = false) =>
    links.map((l) => (
      <button
        key={l.page}
        disabled={busy}
        className="nav-link"
        aria-current={
          (page === "sent" ? "tomorrow" : page) === l.page ? "page" : undefined
        }
        onClick={() => nav(l.page)}
      >
        <Icon name={l.icon} />
        <span>{mobile ? l.short : l.title}</span>
      </button>
    ));
  const r = data ? dateReceipt(data) : null;
  const recent = data?.state.updated
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: data.zone,
        day: "numeric",
        month: "short",
      }).format(new Date(data.state.updated))
    : null;
  function home(d: Snapshot) {
    const lows = lowStock(d.state.stock);
    return (
      <>
        <Heading
          title="Shared stock"
          detail="Current counts across the stockroom."
        />
        <div className="home-grid">
          <div className="space-y-4">
            {groups.map((g) => {
              const catalog = items.filter((i) => i.group === g);
              return (
                <section className="card" key={g}>
                  <header className="card-head">
                    <span className="item-icon">
                      <Icon name={symbols[g]} />
                    </span>
                    <h2>{g}</h2>
                  </header>
                  <div className="px-5">{listRows(d.state.stock, catalog)}</div>
                </section>
              );
            })}
          </div>
          <aside className="space-y-4">
            <section className="service">
              <Icon name="tomorrow" size={26} />
              <h2>Tomorrow’s list</h2>
              <p>{dayLabel(d.date)}</p>
              {r ? (
                <p>
                  {r.bookings} bookings · {r.covers} covers
                </p>
              ) : (
                <p>Prepare the next shift’s bookings, counts and notes.</p>
              )}
              <button className="card-action" onClick={() => nav("tomorrow")}>
                {r ? "View handover" : "Prepare handover"}
                <Icon name="go" size={17} />
              </button>
            </section>
            <section className="card p-5">
              <h2>Restock reminders</h2>
              {lows.length ? (
                listRows(d.state.stock, lows)
              ) : (
                <p className="mt-3">All monitored items meet their minimums.</p>
              )}
            </section>
            <button className="primary w-full" onClick={() => nav("stock")}>
              Update stock
              <Icon name="go" />
            </button>
          </aside>
        </div>
      </>
    );
  }
  function editor(d: Snapshot, isLinen: boolean) {
    const cat = isLinen ? linen : items.filter((i) => i.group !== "Linen");
    const b = isLinen ? bucket : "stock";
    const pending = Object.values(edits).filter((e) =>
      cat.some((i) => i.id === e.id),
    );
    function save() {
      if (
        pending.some(
          (e) =>
            e.value === "" ||
            !Number.isFinite(Number(e.value)) ||
            Number(e.value) < 0 ||
            Number(e.value) > 99999 ||
            !Number.isInteger(
              Number(e.value) / (items.find((i) => i.id === e.id)?.step || 1),
            ),
        )
      ) {
        setError("Check both clean and laundry quantities before saving.");
        return;
      }
      const next = isLinen ? "tomorrow" : "linen";
      if (!pending.length) {
        nav(next);
        if (isLinen) {
          setCompose(true);
          setForm((previous) => previous ?? startForm(d));
        }
        return;
      }
      void write(
        {
          kind: "stock",
          changes: pending.map((e) => ({
            bucket: e.bucket,
            id: e.id,
            from: e.from,
            to: Number(e.value),
          })),
        },
        (result) => {
          setEdits((old) => {
            const remaining = { ...old };
            pending.forEach((e) => delete remaining[e.bucket + "/" + e.id]);
            return remaining;
          });
          nav(next);
          if (isLinen) {
            setCompose(true);
            setForm((previous) => previous ?? startForm(result));
          }
        },
      );
    }
    return (
      <>
        <Heading
          title={isLinen ? "Tablecloth stock" : "Update stock"}
          detail={
            isLinen
              ? "Count clean linen and pieces in laundry separately."
              : "Enter the amount remaining on the shelf."
          }
        />
        <form
          className="form-width"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <fieldset disabled={busy}>
            {isLinen && (
              <div className="segments">
                {(["stock", "laundry"] as const).map((k) => (
                  <button
                    type="button"
                    key={k}
                    aria-pressed={bucket === k}
                    onClick={() => setBucket(k)}
                  >
                    {k === "stock" ? "Clean stock" : "In laundry"}
                  </button>
                ))}
              </div>
            )}
            {groups
              .filter((g) => cat.some((i) => i.group === g))
              .map((g) => (
                <section className="card mb-4" key={g}>
                  <header className="card-head">
                    <span className="item-icon">
                      <Icon name={symbols[g]} />
                    </span>
                    <h2>
                      {isLinen
                        ? bucket === "stock"
                          ? "Clean linen"
                          : "In laundry"
                        : g}
                    </h2>
                  </header>
                  <div className="px-5">
                    {cat
                      .filter((i) => i.group === g)
                      .map((i) => {
                        const e = edits[b + "/" + i.id];
                        return (
                          <Counter
                            key={i.id}
                            name={i.name}
                            hint={i.unit + " · saved " + d.state[b][i.id]}
                            step={i.step}
                            value={e?.value ?? String(d.state[b][i.id])}
                            onChange={(v) => update(i.id, v, b)}
                          />
                        );
                      })}
                  </div>
                </section>
              ))}
            <Primary disabled={busy}>
              {busy
                ? "Saving…"
                : isLinen
                  ? "Save & prepare handover"
                  : "Save stock & continue"}
            </Primary>
          </fieldset>
        </form>
      </>
    );
  }
  function tomorrow(d: Snapshot) {
    const f = form ?? startForm(d);
    const change = (k: "bookings" | "covers" | "note", v: string) =>
      setForm((prev) => ({ ...(prev ?? startForm(d)), [k]: v }));
    if (r && !compose)
      return (
        <>
          <Heading title="Tomorrow’s list" detail={dayLabel(r.date)} />
          <div className="form-width space-y-4">
            <HandoverDetails receipt={r} />
            <section className="card p-5">
              <h2>Restock reminders</h2>
              {lowStock(r.stock).length ? (
                listRows(r.stock, lowStock(r.stock))
              ) : (
                <p>All monitored items meet their minimums.</p>
              )}
            </section>
            <button
              className="primary"
              onClick={() => {
                setCompose(true);
                setForm((old) => old ?? startForm(d));
              }}
            >
              Edit handover
              <Icon name="go" />
            </button>
          </div>
        </>
      );
    return (
      <>
        <Heading title="Tomorrow & handover" detail={dayLabel(d.date)} />
        <form
          className="form-width"
          onSubmit={(e) => {
            e.preventDefault();
            if (Object.keys(edits).length) {
              setError(
                "Save your pending stock or linen edits before sending the handover.",
              );
              return;
            }
            if (!form) setForm(f);
            void write(
              {
                kind: "send",
                revision: f.revision,
                date: f.date,
                bookings: Number(f.bookings),
                covers: Number(f.covers),
                note: f.note,
              },
              (result) => {
                setConfirmation(result.submitted ?? result.state.receipt);
                setForm(null);
                setCompose(false);
                nav("sent");
              },
            );
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            <section className="card px-5">
              <Counter
                name="Bookings"
                hint="Total reservations"
                value={f.bookings}
                onChange={(v) => change("bookings", v)}
              />
              <Counter
                name="Expected covers"
                hint="Guests expected"
                value={f.covers}
                onChange={(v) => change("covers", v)}
              />
            </section>
            <section className="card p-5">
              <label htmlFor="note">
                <strong>Shift note</strong>
              </label>
              <textarea
                id="note"
                maxLength={2000}
                value={f.note}
                onChange={(e) => change("note", e.target.value)}
                placeholder="Anything the opening team should know?"
              />
            </section>
            <section className="card p-5">
              <h2>Restock reminders</h2>
              {lowStock(d.state.stock).length ? (
                listRows(d.state.stock, lowStock(d.state.stock))
              ) : (
                <p>No items below their minimum.</p>
              )}
              <details className="mt-4">
                <summary>Review all counts</summary>
                {listRows(d.state.stock)}
                <h3 className="mt-4">In laundry</h3>
                {listRows(d.state.laundry, linen)}
              </details>
            </section>
            {r && form && form.receiptId !== r.id && (
              <HandoverDetails receipt={r} />
            )}
            <Primary disabled={busy}>
              {busy
                ? "Sending…"
                : r
                  ? "Send revised handover"
                  : "Send to tomorrow’s list"}
            </Primary>
          </fieldset>
        </form>
      </>
    );
  }
  function sent(d: Snapshot) {
    const receipt = confirmation ?? dateReceipt(d);
    if (!receipt)
      return (
        <>
          <Heading
            title="No handover sent yet"
            detail="Prepare tomorrow’s list to create a receipt."
          />
          <button className="primary" onClick={() => nav("tomorrow")}>
            Prepare handover
            <Icon name="go" />
          </button>
        </>
      );
    return (
      <div className="form-width">
        <span className="success-icon">
          <Icon name="check" size={32} />
        </span>
        <Heading
          title="Handover sent."
          detail={dayLabel(receipt.date) + " · Available to the next shift."}
        />
        <section className="card p-5">
          <h2>Handover receipt</h2>
          {[
            ["Stock counts saved", 8],
            ["Bookings", receipt.bookings],
            ["Expected covers", receipt.covers],
            ["Restock reminders", lowStock(receipt.stock).length],
          ].map(([k, v]) => (
            <div className="quantity-row" key={k}>
              <span>{k}</span>
              <b>{v}</b>
            </div>
          ))}
        </section>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="primary" onClick={() => nav("tomorrow")}>
            View tomorrow’s list
            <Icon name="go" />
          </button>
          <button className="secondary" onClick={() => nav("home")}>
            Back to shared stock
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="shell">
      <a
        className="skip"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand">
          <img src="/runner.svg" alt="" />
          runner.
        </div>
        <nav aria-label="Workspace">{navButtons()}</nav>
        <div className="side-foot">
          <span className="status-dot" />
          {offline
            ? "Connection interrupted"
            : data?.mode === "live"
              ? "Shared workspace"
              : data
                ? "Local workspace"
                : "Connecting…"}
        </div>
      </aside>
      <main id="main-content" tabIndex={-1}>
        <div className="topline">
          <span className="phone-brand">
            <img src="/runner.svg" alt="" />
            runner.
          </span>
          <span className="desktop-label">Runner workspace</span>
          <span>
            {recent
              ? "Saved " + recent
              : data
                ? "Opening count"
                : "Connecting…"}
          </span>
        </div>
        <div className="content">
          {offline && (
            <div role="status" className="alert">
              {connectionMessage}{" "}
              <button onClick={() => void refresh()}>Retry connection</button>
            </div>
          )}
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          {!data ? (
            <Heading
              title={offline ? "Unable to load stock" : "Loading stock…"}
              detail={
                offline
                  ? "Check the connection and shared storage settings."
                  : "Opening the workspace."
              }
            />
          ) : page === "home" ? (
            home(data)
          ) : page === "stock" ? (
            editor(data, false)
          ) : page === "linen" ? (
            editor(data, true)
          ) : page === "tomorrow" ? (
            tomorrow(data)
          ) : (
            sent(data)
          )}
          {data?.mode === "local" && (
            <p className="local-note">
              Local workspace · sample opening counts
            </p>
          )}
        </div>
      </main>
      <nav className="mobile-nav" aria-label="Mobile workspace">
        {navButtons(true)}
      </nav>
    </div>
  );
}
