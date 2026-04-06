'use client'

// Sync Manager - Global Resilience & Offline Queue System
// Uses IndexedDB for persistent storage of pending operations

export interface PendingOperation {
  id: string
  timestamp: number
  type: 'rpc' | 'insert' | 'update' | 'delete'
  table?: string
  functionName?: string
  payload: Record<string, unknown>
  retryCount: number
  maxRetries: number
}

export type SyncStatus = 'online' | 'offline' | 'syncing'

const DB_NAME = 'restaurant-sync-db'
const DB_VERSION = 1
const STORE_NAME = 'pending-operations'

let db: IDBDatabase | null = null

// Initialize IndexedDB
export async function initSyncDB(): Promise<IDBDatabase> {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('type', 'type', { unique: false })
      }
    }
  })
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Add operation to pending queue
export async function addToPendingQueue(operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
  const database = await initSyncDB()
  const id = generateId()
  
  const pendingOp: PendingOperation = {
    ...operation,
    id,
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries: operation.maxRetries || 3
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add(pendingOp)

    request.onsuccess = () => resolve(id)
    request.onerror = () => reject(request.error)
  })
}

// Get all pending operations
export async function getPendingOperations(): Promise<PendingOperation[]> {
  const database = await initSyncDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('timestamp')
    const request = index.getAll()

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

// Remove operation from queue
export async function removeFromQueue(id: string): Promise<void> {
  const database = await initSyncDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// Update retry count
export async function updateRetryCount(id: string, retryCount: number): Promise<void> {
  const database = await initSyncDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const getRequest = store.get(id)

    getRequest.onsuccess = () => {
      const operation = getRequest.result
      if (operation) {
        operation.retryCount = retryCount
        const putRequest = store.put(operation)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      } else {
        resolve()
      }
    }
    getRequest.onerror = () => reject(getRequest.error)
  })
}

// Get pending count
export async function getPendingCount(): Promise<number> {
  const operations = await getPendingOperations()
  return operations.length
}

// Clear all pending operations
export async function clearPendingQueue(): Promise<void> {
  const database = await initSyncDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// Check if online
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}
