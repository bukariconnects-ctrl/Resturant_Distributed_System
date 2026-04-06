'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { 
  SyncStatus, 
  isOnline, 
  getPendingCount, 
  initSyncDB 
} from '@/lib/sync-manager'
import { processPendingQueue } from '@/lib/sync-executor'

interface SyncContextType {
  status: SyncStatus
  pendingCount: number
  syncNow: () => Promise<void>
  lastSyncTime: Date | null
}

const SyncContext = createContext<SyncContextType>({
  status: 'online',
  pendingCount: 0,
  syncNow: async () => {},
  lastSyncTime: null,
})

export function useSyncStatus() {
  return useContext(SyncContext)
}

interface SyncProviderProps {
  children: ReactNode
}

export function SyncProvider({ children }: SyncProviderProps) {
  const [status, setStatus] = useState<SyncStatus>('online')
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount()
      setPendingCount(count)
    } catch (err) {
      console.error('Error getting pending count:', err)
    }
  }, [])

  // Sync pending operations
  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline()) return

    setIsSyncing(true)
    setStatus('syncing')

    try {
      const result = await processPendingQueue((completed, total) => {
        console.log(`Sync progress: ${completed}/${total}`)
      })

      console.log('Sync completed:', result)
      setLastSyncTime(new Date())
      await updatePendingCount()
    } catch (err) {
      console.error('Sync error:', err)
    } finally {
      setIsSyncing(false)
      setStatus(isOnline() ? 'online' : 'offline')
    }
  }, [isSyncing, updatePendingCount])

  // Initialize and set up listeners
  useEffect(() => {
    // Initialize IndexedDB
    initSyncDB().catch(console.error)

    // Set initial status
    setStatus(isOnline() ? 'online' : 'offline')
    updatePendingCount()

    // Online/offline listeners
    const handleOnline = () => {
      console.log('Network: Online')
      setStatus('online')
      // Auto-sync when coming back online
      syncNow()
    }

    const handleOffline = () => {
      console.log('Network: Offline')
      setStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Periodic pending count check
    const interval = setInterval(updatePendingCount, 5000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [syncNow, updatePendingCount])

  return (
    <SyncContext.Provider value={{ status, pendingCount, syncNow, lastSyncTime }}>
      {children}
    </SyncContext.Provider>
  )
}
