const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// For ids that arrive from a client: a malformed uuid literal makes the SQL
// itself throw, so routes check the shape first and answer 400.
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}
