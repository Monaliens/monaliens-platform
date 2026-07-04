import React from 'react'
import { usePlatformFeeUtils } from '@/hooks/usePlatformFees'

interface PlatformFeeDisplayProps {
  ticketPrice: string
  ticketCount: number
  platformFeePercentage: number
  tokenSymbol?: string
  tokenDecimals?: number
  showBreakdown?: boolean
  className?: string
}

export default function PlatformFeeDisplay({
  ticketPrice,
  ticketCount,
  platformFeePercentage,
  tokenSymbol = 'MON',
  tokenDecimals = 18,
  showBreakdown = true,
  className = ''
}: PlatformFeeDisplayProps) {
  const { calculatePlatformFee, formatTokenAmount } = usePlatformFeeUtils()

  const fees = calculatePlatformFee(ticketPrice, ticketCount, platformFeePercentage)

  return (
    <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Fee Breakdown
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Platform Fee: {fees.platformFeePercentage}%
        </span>
      </div>

      {showBreakdown && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-300">
              Total Cost ({ticketCount} tickets)
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {formatTokenAmount((fees.totalRevenue * Math.pow(10, tokenDecimals)).toString(), tokenDecimals, tokenSymbol)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-300">
              Platform Fee ({fees.platformFeePercentage}%)
            </span>
            <span className="font-medium text-orange-600 dark:text-orange-400">
              {formatTokenAmount((fees.platformFee * Math.pow(10, tokenDecimals)).toString(), tokenDecimals, tokenSymbol)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-300">
              To Raffle Owner
            </span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {formatTokenAmount((fees.ownerFee * Math.pow(10, tokenDecimals)).toString(), tokenDecimals, tokenSymbol)}
            </span>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
            <div className="flex justify-between font-semibold">
              <span className="text-gray-900 dark:text-gray-100">You Pay</span>
              <span className="text-gray-900 dark:text-gray-100">
                {formatTokenAmount((fees.totalRevenue * Math.pow(10, tokenDecimals)).toString(), tokenDecimals, tokenSymbol)}
              </span>
            </div>
          </div>
        </div>
      )}

      {!showBreakdown && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Platform Fee ({fees.platformFeePercentage}%)
          </span>
          <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
            {formatTokenAmount((fees.platformFee * Math.pow(10, tokenDecimals)).toString(), tokenDecimals, tokenSymbol)}
          </span>
        </div>
      )}

      <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-600 dark:text-blue-400">
        💡 Platform fees help maintain and improve the raffle system
      </div>
    </div>
  )
}

// Compact version for raffle cards
export function PlatformFeeCompact({
  feePercentage,
  className = ''
}: {
  feePercentage: number
  className?: string
}) {
  return (
    <div className={`inline-flex items-center px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 text-xs rounded-full ${className}`}>
      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
      </svg>
      {feePercentage / 100}% fee
    </div>
  )
}