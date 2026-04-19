// Curalink session id — anonymous, persisted in localStorage. Replace with auth later.
const KEY = "curalink_session_id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
