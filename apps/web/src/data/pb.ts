import PocketBase from "pocketbase";

/** Same origin in production (PocketBase serves the app); proxied to :8090 in development. */
export const pb = new PocketBase(window.location.origin);
pb.autoCancellation(false);

export type Person = { id: string; name: string; sort: number };
