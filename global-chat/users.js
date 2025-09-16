// Simple in-memory user store (replace with DB later if you want)
export const USERS = [
  // username, password (plaintext for demo), displayName (shown in chat)
  { username: "alice", password: "alice123", displayName: "Alice" },
  { username: "bob",   password: "bob123",   displayName: "Bob" },
  { username: "minhaj", password: "sup123",  displayName: "Minhaj" }
];

export function findUser(username) {
  return USERS.find(u => u.username === username);
}
