// The last email used to sign in on this phone. Kept after sign-out so signing back in is one tap.
const KEY = 'wr:last-email'

export function readLastEmail(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveLastEmail(email: string): void {
  try {
    localStorage.setItem(KEY, email)
  } catch {
    /* storage unavailable: nothing to remember */
  }
}
