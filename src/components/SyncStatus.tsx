import { useOnline, useQueueStatus } from '../lib/hooks'
import { clearFailed } from '../lib/offline'

export default function SyncStatus({ uid }: { uid: string }) {
  const online = useOnline()
  const { pending, failed, flushing } = useQueueStatus(uid)

  if (failed > 0) {
    return (
      <button className="sync sync-error" onClick={() => clearFailed(uid)} title="Dismiss">
        {failed === 1 ? '1 set' : `${failed} sets`} couldn't save (workout was removed)
      </button>
    )
  }
  if (!online) {
    return (
      <span className="sync sync-offline" role="status">
        Offline{pending ? `, ${pending} to upload` : ''}
      </span>
    )
  }
  if (pending > 0 || flushing) {
    return (
      <span className="sync" role="status">
        Saving…
      </span>
    )
  }
  return (
    <span className="sync sync-ok" role="status">
      Saved
    </span>
  )
}
