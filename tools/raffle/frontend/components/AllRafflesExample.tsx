import React from 'react'
import { useAllRaffles, useUserRaffles, useRaffleAddressesBatch } from '@/hooks/useAllRaffles'
import { useAccount } from 'wagmi'

/**
 * Example component showing how to use the new contract functions
 * to get all raffle addresses efficiently
 */
export default function AllRafflesExample() {
  const { address } = useAccount()
  const { 
    activeRaffles, 
    totalRaffles, 
    activeRaffleAddresses, 
    isLoading: loadingAll 
  } = useAllRaffles()

  const { 
    raffleIds: userRaffleIds, 
    raffleDetails: userRaffles, 
    isLoading: loadingUser 
  } = useUserRaffles(address)

  const { 
    raffleAddresses: batchAddresses, 
    totalRaffles: batchTotal, 
    hasMore,
    isLoading: loadingBatch 
  } = useRaffleAddressesBatch(0, 20)

  if (loadingAll) {
    return <div className="text-center py-8">Loading all raffles...</div>
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold text-center">All Raffles Dashboard</h1>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card text-center">
          <h3 className="text-lg font-semibold mb-2">Total Raffles</h3>
          <p className="text-3xl font-bold text-primary-500">{totalRaffles}</p>
        </div>
        <div className="card text-center">
          <h3 className="text-lg font-semibold mb-2">Active Raffles</h3>
          <p className="text-3xl font-bold text-green-500">{activeRaffles.length}</p>
        </div>
        <div className="card text-center">
          <h3 className="text-lg font-semibold mb-2">Your Raffles</h3>
          <p className="text-3xl font-bold text-purple-500">
            {loadingUser ? '...' : userRaffleIds.length}
          </p>
        </div>
      </div>

      {/* Active Raffle Addresses */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">🔴 Active Raffle Addresses</h2>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {activeRaffleAddresses.length > 0 ? (
            activeRaffleAddresses.map((address, index) => (
              <div key={index} className="p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono">
                <span className="text-green-600 dark:text-green-400">#{index}</span> {address}
              </div>
            ))
          ) : (
            <p className="text-gray-500">No active raffles found</p>
          )}
        </div>
      </div>

      {/* User's Raffles */}
      {address && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">👤 Your Raffle IDs</h2>
          {loadingUser ? (
            <p>Loading your raffles...</p>
          ) : userRaffleIds.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {userRaffleIds.map((id, index) => (
                <div key={index} className="p-2 bg-purple-100 dark:bg-purple-900 rounded text-center">
                  <span className="font-bold">#{id}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">You haven't created any raffles yet</p>
          )}
        </div>
      )}

      {/* Batch Loading Example */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">📦 Batch Loading (First 20)</h2>
        {loadingBatch ? (
          <p>Loading batch...</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing first 20 of {batchTotal} total raffles
              {hasMore && ' (has more)'}
            </p>
            <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto text-xs">
              {batchAddresses.map((address, index) => (
                <div key={index} className="p-1 bg-gray-50 dark:bg-gray-800 rounded font-mono">
                  {address}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Code Examples */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">💻 Usage Examples</h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold text-green-600">Get All Active Raffles:</h3>
            <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 overflow-x-auto">
{`const { activeRaffles, activeRaffleAddresses } = useAllRaffles()
// activeRaffles: full details of active raffles
// activeRaffleAddresses: just the addresses`}
            </pre>
          </div>
          
          <div>
            <h3 className="font-semibold text-purple-600">Get User's Raffles:</h3>
            <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 overflow-x-auto">
{`const { raffleIds, raffleDetails } = useUserRaffles(userAddress)
// raffleIds: array of raffle IDs created by user
// raffleDetails: full details of user's raffles`}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold text-blue-600">Batch Loading:</h3>
            <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 overflow-x-auto">
{`const { raffleAddresses, hasMore } = useRaffleAddressesBatch(0, 100)
// Load raffles in batches of 100
// Perfect for pagination`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
} 