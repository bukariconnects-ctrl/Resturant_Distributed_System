'use client'

import { createClient } from '@/lib/supabase/client'
import { 
  PendingOperation, 
  getPendingOperations, 
  removeFromQueue, 
  updateRetryCount 
} from './sync-manager'

export interface SyncResult {
  success: boolean
  operationId: string
  error?: string
}

// Execute a single pending operation
export async function executeOperation(operation: PendingOperation): Promise<SyncResult> {
  const supabase = createClient()

  try {
    if (operation.type === 'rpc' && operation.functionName) {
      const { data, error } = await supabase.rpc(
        operation.functionName, 
        operation.payload as Record<string, unknown>
      )

      if (error) {
        // Check if it's a network error vs a business logic error
        if (error.message?.includes('fetch') || error.message?.includes('network')) {
          throw new Error('Network error')
        }
        // Business logic error - remove from queue (idempotent check failed, etc.)
        return { success: true, operationId: operation.id }
      }

      // Check RPC response for idempotent success
      if (data && typeof data === 'object' && 'success' in data) {
        return { success: true, operationId: operation.id }
      }

      return { success: true, operationId: operation.id }
    }

    if (operation.type === 'insert' && operation.table) {
      const { error } = await supabase
        .from(operation.table)
        .insert(operation.payload)

      if (error) {
        // Duplicate key = already inserted (idempotent)
        if (error.code === '23505') {
          return { success: true, operationId: operation.id }
        }
        if (error.message?.includes('fetch') || error.message?.includes('network')) {
          throw new Error('Network error')
        }
        return { success: false, operationId: operation.id, error: error.message }
      }

      return { success: true, operationId: operation.id }
    }

    if (operation.type === 'update' && operation.table) {
      const { id, ...updateData } = operation.payload as { id: string; [key: string]: unknown }
      
      const { error } = await supabase
        .from(operation.table)
        .update(updateData)
        .eq('id', id)

      if (error) {
        if (error.message?.includes('fetch') || error.message?.includes('network')) {
          throw new Error('Network error')
        }
        return { success: false, operationId: operation.id, error: error.message }
      }

      return { success: true, operationId: operation.id }
    }

    return { success: false, operationId: operation.id, error: 'Unknown operation type' }

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    
    // Network error - keep in queue for retry
    if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
      return { success: false, operationId: operation.id, error: 'Network error' }
    }

    return { success: false, operationId: operation.id, error: errorMessage }
  }
}

// Process all pending operations
export async function processPendingQueue(
  onProgress?: (completed: number, total: number) => void
): Promise<{ successful: number; failed: number; remaining: number }> {
  const operations = await getPendingOperations()
  let successful = 0
  let failed = 0

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i]
    
    // Skip if max retries exceeded
    if (operation.retryCount >= operation.maxRetries) {
      await removeFromQueue(operation.id)
      failed++
      continue
    }

    const result = await executeOperation(operation)

    if (result.success) {
      await removeFromQueue(operation.id)
      successful++
    } else if (result.error === 'Network error') {
      // Stop processing - we're offline
      break
    } else {
      // Increment retry count
      await updateRetryCount(operation.id, operation.retryCount + 1)
      failed++
    }

    onProgress?.(i + 1, operations.length)
  }

  const remainingOps = await getPendingOperations()
  return { successful, failed, remaining: remainingOps.length }
}
