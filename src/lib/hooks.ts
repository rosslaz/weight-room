import { useEffect, useState } from 'react'
import { QUEUE_EVENT, getFailedCount, getQueue, isFlushing } from './offline'

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

export function useQueueStatus(uid: string) {
  const read = () => ({ pending: getQueue(uid).length, failed: getFailedCount(uid), flushing: isFlushing() })
  const [status, setStatus] = useState(read)
  useEffect(() => {
    const update = () => setStatus(read())
    window.addEventListener(QUEUE_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(QUEUE_EVENT, update)
      window.removeEventListener('storage', update)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])
  return status
}
