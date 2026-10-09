// Chrome/Android fire this once, early in page load, so capture it before any screen mounts.
export type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferred: InstallPrompt | null = null
const listeners = new Set<() => void>()

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as InstallPrompt
  listeners.forEach((fn) => fn())
})
window.addEventListener('appinstalled', () => {
  deferred = null
  listeners.forEach((fn) => fn())
})

export function getInstallPrompt() {
  return deferred
}

export function onInstallPromptChange(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export async function promptInstall() {
  if (!deferred) return
  await deferred.prompt()
  deferred = null
  listeners.forEach((fn) => fn())
}
