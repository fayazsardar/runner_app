import type { ReactNode } from "react";
const paths = {
  home: "M3 10l9-7 9 7v11h-6v-7H9v7H3z",
  stock: "M3 7l9-4 9 4-9 4z M3 7v10l9 4 9-4V7 M12 11v10",
  linen: "M3 8l10-5 8 5-10 5z M3 12l8 5 10-5 M3 16l8 5 10-5",
  tomorrow: "M3 6h18v15H3z M7 3v5 M17 3v5 M3 11h18 M7 15h4",
  drop: "M12 2s-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13z M9 16c0 1 1 2 2 2",
  paper: "M5 4h12v16H5z M17 8h3v13H9 M8 8h6 M8 12h6",
  go: "M4 12h15 M13 6l6 6-6 6",
  check: "M4 12l5 5L20 6",
  undo: "M20 12H5 M11 6l-6 6 6 6",
};
export type IconName = keyof typeof paths;
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function Primary({
  children,
  disabled = false,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button type="submit" className="primary" disabled={disabled}>
      {children}
      <Icon name="go" size={17} />
    </button>
  );
}
export function Counter({
  name,
  hint,
  value,
  step = 1,
  onChange,
}: {
  name: string;
  hint: string;
  value: string;
  step?: number;
  onChange: (v: string) => void;
}) {
  const n = Number(value);
  return (
    <div className="counter">
      <div>
        <strong>{name}</strong>
        <small>{hint}</small>
      </div>
      <div className="stepper">
        <button
          type="button"
          aria-label={"Decrease " + name}
          disabled={n <= 0}
          onClick={() => onChange(String(Math.max(0, n - step)))}
        >
          −
        </button>
        <input
          aria-label={name}
          type="number"
          inputMode={step === 1 ? "numeric" : "decimal"}
          required
          min="0"
          max="99999"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          aria-label={"Increase " + name}
          disabled={n + step > 99999}
          onClick={() => onChange(String(n + step))}
        >
          +
        </button>
      </div>
    </div>
  );
}
export function Heading({ title, detail }: { title: string; detail: string }) {
  return (
    <header className="screen-heading">
      <h1>{title}</h1>
      <p>{detail}</p>
    </header>
  );
}
export function dayLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
}
