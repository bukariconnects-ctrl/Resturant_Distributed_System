'use client'

import { createClient } from '@/lib/supabase/client'
import { addToPendingQueue, isOnline } from './sync-manager'

interface RpcOptions {
  functionName: string
  payload: Record<string, unknown>
  maxRetries?: number
}

interface MutationOptions {
  table: string
  payload: Record<string, unknown>
  maxRetries?: number
}

interface UpdateOptions extends MutationOptions {
  id: string
}

// Resilient RPC call - queues if offline or on network error
export async function resilientRpc<T = unknown>(options: RpcOptions): Promise<{
  data: T | null
  error: Error | null
  queued: boolean
}> {
  const { functionName, payload, maxRetries = 3 } = options
  const supabase = createClient()

  // If offline, queue immediately
  if (!isOnline()) {
    const queueId = await addToPendingQueue({
      type: 'rpc',
      functionName,
      payload,
      maxRetries,
    })
    console.log(`Offline: Queued RPC ${functionName} with ID ${queueId}`)
    return { data: null, error: null, queued: true }
  }

  try {
    const { data, error } = await supabase.rpc(functionName, payload)

    if (error) {
      // Network error - queue for retry
      if (error.message?.includes('fetch') || error.message?.includes('Failed')) {
        const queueId = await addToPendingQueue({
          type: 'rpc',
          functionName,
          payload,
          maxRetries,
        })
        console.log(`Network error: Queued RPC ${functionName} with ID ${queueId}`)
        return { data: null, error: null, queued: true }
      }
      // Business logic error - return immediately
      return { data: null, error: new Error(error.message), queued: false }
    }

    return { data: data as T, error: null, queued: false }
  } catch (err) {
    // Unexpected error - queue for retry
    const queueId = await addToPendingQueue({
      type: 'rpc',
      functionName,
      payload,
      maxRetries,
    })
    console.log(`Error: Queued RPC ${functionName} with ID ${queueId}`)
    return { data: null, error: null, queued: true }
  }
}

// Resilient insert - queues if offline or on network error
export async function resilientInsert<T = unknown>(options: MutationOptions): Promise<{
  data: T | null
  error: Error | null
  queued: boolean
}> {
  const { table, payload, maxRetries = 3 } = options
  const supabase = createClient()

  if (!isOnline()) {
    const queueId = await addToPendingQueue({
      type: 'insert',
      table,
      payload,
      maxRetries,
    })
    console.log(`Offline: Queued INSERT to ${table} with ID ${queueId}`)
    return { data: null, error: null, queued: true }
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select()
      .single()

    if (error) {
      if (error.message?.includes('fetch') || error.message?.includes('Failed')) {
        const queueId = await addToPendingQueue({
          type: 'insert',
          table,
          payload,
          maxRetries,
        })
        console.log(`Network error: Queued INSERT to ${table} with ID ${queueId}`)
        return { data: null, error: null, queued: true }
      }
      return { data: null, error: new Error(error.message), queued: false }
    }

    return { data: data as T, error: null, queued: false }
  } catch (err) {
    const queueId = await addToPendingQueue({
      type: 'insert',
      table,
      payload,
      maxRetries,
    })
    console.log(`Error: Queued INSERT to ${table} with ID ${queueId}`)
    return { data: null, error: null, queued: true }
  }
}

// Resilient update - queues if offline or on network error
export async function resilientUpdate<T = unknown>(options: UpdateOptions): Promise<{
  data: T | null
  error: Error | null
  queued: boolean
}> {
  const { table, id, payload, maxRetries = 3 } = options
  const supabase = createClient()

  const fullPayload = { ...payload, id }

  if (!isOnline()) {
    const queueId = await addToPendingQueue({
      type: 'update',
      table,
      payload: fullPayload,
      maxRetries,
    })
    console.log(`Offline: Queued UPDATE to ${table} with ID ${queueId}`)
    return { data: null, error: null, queued: true }
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.message?.includes('fetch') || error.message?.includes('Failed')) {
        const queueId = await addToPendingQueue({
          type: 'update',
          table,
          payload: fullPayload,
          maxRetries,
        })
        console.log(`Network error: Queued UPDATE to ${table} with ID ${queueId}`)
        return { data: null, error: null, queued: true }
      }
      return { data: null, error: new Error(error.message), queued: false }
    }

    return { data: data as T, error: null, queued: false }
  } catch (err) {
    const queueId = await addToPendingQueue({
      type: 'update',
      table,
      payload: fullPayload,
      maxRetries,
    })
    console.log(`Error: Queued UPDATE to ${table} with ID ${queueId}`)
    return { data: null, error: null, queued: true }
  }
}
