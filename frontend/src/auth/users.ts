// Static credential list — matches the spec the user provided.
//
// Security note: these passwords live in the client bundle and are NOT
// safe against a determined attacker. This file ships acceptable security
// for an internal-only desktop/lab tool where the threat model is
// "stop a casual viewer from changing data", not "stop a hacker".
// For production exposure on the internet, move credentials to the
// FastAPI backend behind a real password hash.

export type Role = 'admin' | 'user'

export interface UserRecord {
  username: string
  password: string
  role: Role
  display: string
}

export const USERS: UserRecord[] = [
  // Admin — only one account, owns upload/configure/destructive actions.
  { username: 'rdudr', password: '9610129501', role: 'admin', display: 'Administrator' },

  // Read-only users — can view, filter, export, but cannot upload PQ files or
  // edit model configurations.
  { username: 'Abhay',       password: 'IITGN1', role: 'user', display: 'Abhay' },
  { username: 'Rahulpatel',  password: 'IITGN4', role: 'user', display: 'Rahul Patel' },
  { username: 'DhruvIT',     password: 'IITGN2', role: 'user', display: 'Dhruv' },
  { username: 'Sagar',       password: 'IITGN8', role: 'user', display: 'Sagar' },
  { username: 'Rishabh',     password: 'IITGN9', role: 'user', display: 'Rishabh' },
  { username: 'Faizan',      password: 'IITGN5', role: 'user', display: 'Faizan' },
]

// Case-insensitive username match (Fox Kisem convention) — passwords are
// case-sensitive.
export function findUser(username: string, password: string): UserRecord | null {
  const u = username.trim().toLowerCase()
  const hit = USERS.find(rec => rec.username.toLowerCase() === u && rec.password === password)
  return hit ?? null
}
