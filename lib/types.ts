export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export type ServicesError =
  | { kind: "unauthorized" }
  | { kind: "not_found" }
  | { kind: "network"; message: string }
  | { kind: "unexpected"; status: number; body: string }
