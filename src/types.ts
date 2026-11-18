export type Page = "home" | "stock" | "linen" | "tomorrow" | "sent";
export type Bucket = "stock" | "laundry";
export type Counts = Record<string, number>;
export interface Receipt {
  id: string;
  date: string;
  at: string;
  bookings: number;
  covers: number;
  note: string;
  stock: Counts;
  laundry: Counts;
}
export interface Workspace {
  revision: number;
  updated: string | null;
  stock: Counts;
  laundry: Counts;
  receipt: Receipt | null;
}
export interface Snapshot {
  submitted?: Receipt | null;
  state: Workspace;
  date: string;
  zone: string;
  mode: "live" | "local";
}
export interface Edit {
  bucket: Bucket;
  id: string;
  from: number;
  value: string;
}
