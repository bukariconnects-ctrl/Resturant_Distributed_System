'use client'

import { useSyncStatus } from '@/components/providers/SyncProvider'
import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff } from 'lucide-react'

export function SyncStatusIndicator() {
  const { status, pendingCount, syncNow } = useSyncStatus()

  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        if (pendingCount > 0) {
          return {
            icon: <Cloud className="w-4 h-4" />,
            text: `${pendingCount} معلق`,
            color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
            showSync: true,
          }
        }
        return {
          icon: <Wifi className="w-4 h-4" />,
          text: 'متصل',
          color: 'text-green-600 bg-green-50 border-green-200',
          showSync: false,
        }
      case 'offline':
        return {
          icon: <WifiOff className="w-4 h-4" />,
          text: pendingCount > 0 ? `غير متصل (${pendingCount})` : 'غير متصل',
          color: 'text-red-600 bg-red-50 border-red-200',
          showSync: false,
        }
      case 'syncing':
        return {
          icon: <RefreshCw className="w-4 h-4 animate-spin" />,
          text: 'جاري المزامنة...',
          color: 'text-blue-600 bg-blue-50 border-blue-200',
          showSync: false,
        }
      default:
        return {
          icon: <Cloud className="w-4 h-4" />,
          text: 'غير معروف',
          color: 'text-gray-600 bg-gray-50 border-gray-200',
          showSync: false,
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${config.color}`}
    >
      {config.icon}
      <span className="hidden sm:inline">{config.text}</span>
      {config.showSync && (
        <button
          onClick={() => syncNow()}
          className="p-1 hover:bg-white/50 rounded-full transition-colors"
          title="مزامنة الآن"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// Compact version for mobile/small spaces
export function SyncStatusDot() {
  const { status, pendingCount } = useSyncStatus()

  const getColor = () => {
    switch (status) {
      case 'online':
        return pendingCount > 0 ? 'bg-yellow-500' : 'bg-green-500'
      case 'offline':
        return 'bg-red-500'
      case 'syncing':
        return 'bg-blue-500 animate-pulse'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="relative">
      <div className={`w-2.5 h-2.5 rounded-full ${getColor()}`} />
      {pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 w-3 h-3 text-[8px] bg-red-500 text-white rounded-full flex items-center justify-center">
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </div>
  )
}
