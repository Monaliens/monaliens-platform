import { useState, useEffect } from 'react'
import Head from 'next/head'
import { motion } from 'framer-motion'
import { Search, Filter, Grid, List, RefreshCw } from 'lucide-react'
import RaffleCard, { RaffleCardSkeleton } from '@/components/RaffleCard'
import { Raffle } from '@/types'
import { useRealTimeRaffles } from '@/hooks/useRealTimeRaffles'

export default function RafflesPage() {
  const { raffles, activeRaffles, endedRaffles, loading, error, refreshData } = useRealTimeRaffles()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended'>('all')
  const [prizeTypeFilter, setPrizeTypeFilter] = useState<'all' | 'TOKEN' | 'NFT'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'newest' | 'ending' | 'popular'>('newest')

  // Get the appropriate raffle list based on status filter
  const getFilteredRafflesByStatus = () => {
    switch (statusFilter) {
      case 'active':
        return activeRaffles
      case 'ended':
        return endedRaffles
      default:
        return raffles
    }
  }

  const filteredRaffles = getFilteredRafflesByStatus().filter(raffle => {
    const matchesSearch = raffle.raffleId.toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
                         raffle.owner.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesPrizeType = prizeTypeFilter === 'all' || raffle.prizeType === prizeTypeFilter

    return matchesSearch && matchesPrizeType
  })

  const sortedRaffles = [...filteredRaffles].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt || b.startTime).getTime() - new Date(a.createdAt || a.startTime).getTime()
      case 'ending':
        return new Date(a.endTime).getTime() - new Date(b.endTime).getTime()
      case 'popular':
        return b.totalTicketsSold - a.totalTicketsSold
      default:
        return 0
    }
  })

  return (
    <>
      <Head>
        <title>Browse Raffles - Web3 Raffle Platform</title>
        <meta name="description" content="Browse and participate in active Web3 raffles" />
      </Head>

      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Browse Raffles
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Discover exciting raffles with amazing prizes. Join the fun and win big!
            </p>
          </motion.div>

          {/* Filters and Controls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-8"
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-6">
              {/* Search */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search raffles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center space-x-4">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="ended">Ended</option>
                </select>

                {/* Prize Type Filter */}
                <select
                  value={prizeTypeFilter}
                  onChange={(e) => setPrizeTypeFilter(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="TOKEN">Token Prizes</option>
                  <option value="NFT">NFT Prizes</option>
                </select>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="createdAt">Newest First</option>
                  <option value="endTime">Ending Soon</option>
                  <option value="totalTicketsSold">Most Popular</option>
                </select>

                {/* View Mode */}
                <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 ${viewMode === 'grid' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 ${viewMode === 'list' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                {/* Refresh */}
                <button
                  onClick={refreshData}
                  disabled={loading}
                  className="p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Results Summary */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {sortedRaffles.length} of {getFilteredRafflesByStatus().length} raffles
                {searchQuery && ` matching "${searchQuery}"`}
                {statusFilter !== 'all' && ` • Status: ${statusFilter}`}
                {prizeTypeFilter !== 'all' && ` • Type: ${prizeTypeFilter}`}
              </p>
            </div>
          </motion.div>

          {/* Results */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center mb-8"
            >
              <p className="text-red-800 dark:text-red-200">
                {error}
              </p>
              <button
                onClick={refreshData}
                className="mt-4 btn-primary"
              >
                Try Again
              </button>
            </motion.div>
          )}

          {loading && (
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
              : 'space-y-4'
            }>
              {[...Array(6)].map((_, i) => (
                <RaffleCardSkeleton key={i} compact={viewMode === 'list'} />
              ))}
            </div>
          )}

          {!loading && sortedRaffles.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <Filter className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No raffles found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Try adjusting your filters or search terms
              </p>
              <button
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                  setPrizeTypeFilter('all')
                }}
                className="btn-outline"
              >
                Clear Filters
              </button>
            </motion.div>
          )}

          {!loading && sortedRaffles.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className={viewMode === 'grid' 
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
                : 'space-y-4'
              }
            >
              {sortedRaffles.map((raffle, index) => (
                <motion.div
                  key={raffle.raffleId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <RaffleCard 
                    raffle={raffle} 
                    compact={viewMode === 'list'}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </>
  )
}