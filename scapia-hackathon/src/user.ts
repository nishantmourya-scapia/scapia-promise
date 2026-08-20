const USER_ID_KEY = 'userId'

/** Ensures a userId exists in localStorage, seeding it with "1" on first run. */
export function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = '1'
    localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}
