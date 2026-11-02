// Who may do what. People sign in with the KISEM team's one login, kept in FOX Console
// (console.eassiitgn.page); no username or password is kept in this app's code.
//
//   admin  the Console's Super Admin: upload PQ files, edit model configurations
//   user   everyone else in the team: view, filter, export

export type Role = 'admin' | 'user'

export interface UserRecord {
  username: string
  role: Role
  display: string
}
