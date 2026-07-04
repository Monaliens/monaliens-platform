import Head from 'next/head'
import Link from 'next/link'
import { Sparkles, Trophy, Users, TrendingUp, Gift, Clock, ChevronRight, Star } from 'lucide-react'
import { useRealTimeRaffles } from '@/hooks/useRealTimeRaffles'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getApiUrl } from '../utils/deployments'

export default function HomePage() {
  const { activeRaffles, loading, error } = useRealTimeRaffles()
  const [stats, setStats] = useState({
    activeRaffles: 0,
    totalUsers: 0,
    totalPrizes: 0
  })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${getApiUrl()}/api/raffles/stats`)
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }

    fetchStats()
  }, [activeRaffles])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  }

  return (
    <>
      <Head>
        <title>Web3 Raffle Platform - Decentralized Raffles on Monad</title>
        <meta name="description" content="Join decentralized raffles on Monad Testnet. Transparent, secure, and fair gaming experience." />
      </Head>

      <div className="min-h-screen relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-emerald-900/20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
        </div>

        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center px-4">
          <motion.div 
            className="max-w-6xl mx-auto text-center"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Hero Badge */}
            <motion.div 
              className="inline-flex items-center px-4 py-2 mb-8 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full"
              variants={itemVariants}
            >
              <Star className="w-4 h-4 mr-2 text-yellow-400" />
              <span className="text-sm font-medium text-white">Powered by Monad Testnet</span>
            </motion.div>

            {/* Main Heading */}
            <motion.h1 
              className="text-6xl md:text-8xl font-bold mb-8 bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent leading-tight"
              variants={itemVariants}
            >
              Next-Gen
              <br />
              <span className="bg-gradient-to-r from-yellow-400 via-red-400 to-pink-400 bg-clip-text text-transparent">
                Web3 Raffles
              </span>
            </motion.h1>
            
            <motion.p 
              className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed"
              variants={itemVariants}
            >
              Experience the future of decentralized gaming. Transparent, secure, and fair raffles 
              powered by blockchain technology.
            </motion.p>
            
            {/* CTA Buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16"
              variants={itemVariants}
            >
              <Link href="/raffles" className="group relative px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                <Sparkles className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform" />
                Explore Raffles
                <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <Link href="/create" className="group relative px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold rounded-xl hover:bg-white/20 transition-all duration-300 flex items-center">
                <Trophy className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform" />
                Create Raffle
              </Link>
            </motion.div>

            {error && (
              <motion.div 
                className="mb-8 p-4 bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-xl text-red-300"
                variants={itemVariants}
              >
                Failed to load data: {error}
              </motion.div>
            )}
          </motion.div>
        </section>

        {/* Live Stats Section */}
        <section className="relative py-20 px-4">
          <motion.div 
            className="max-w-6xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4">Platform Statistics</h2>
              <p className="text-gray-400 text-lg">Real-time insights into our growing ecosystem</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <motion.div 
                className="group relative p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-500"
                whileHover={{ scale: 1.05, y: -10 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <Sparkles className="w-8 h-8 text-blue-400" />
                    <div className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm font-medium">
                      Live
                    </div>
                  </div>
                  <div className="text-4xl font-bold text-white mb-2">
                    {loading ? (
                      <div className="animate-pulse bg-gray-600 h-10 w-16 rounded"></div>
                    ) : (
                      stats.activeRaffles || activeRaffles?.length || 0
                    )}
                  </div>
                  <div className="text-gray-400 font-medium">Active Raffles</div>
                </div>
              </motion.div>

              <motion.div 
                className="group relative p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-500"
                whileHover={{ scale: 1.05, y: -10 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <Users className="w-8 h-8 text-purple-400" />
                    <div className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm font-medium">
                      Growing
                    </div>
                  </div>
                  <div className="text-4xl font-bold text-white mb-2">
                    {loading ? (
                      <div className="animate-pulse bg-gray-600 h-10 w-20 rounded"></div>
                    ) : (
                      `${stats.totalUsers}+`
                    )}
                  </div>
                  <div className="text-gray-400 font-medium">Happy Users</div>
                </div>
              </motion.div>

              <motion.div 
                className="group relative p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-500"
                whileHover={{ scale: 1.05, y: -10 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-green-600/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <Gift className="w-8 h-8 text-emerald-400" />
                    <div className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm font-medium">
                      Distributed
                    </div>
                  </div>
                  <div className="text-4xl font-bold text-white mb-2">
                    {loading ? (
                      <div className="animate-pulse bg-gray-600 h-10 w-24 rounded"></div>
                    ) : (
                      `${stats.totalPrizes}+`
                    )}
                  </div>
                  <div className="text-gray-400 font-medium">Prizes Won</div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="relative py-20 px-4">
          <motion.div 
            className="max-w-6xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4">Why Choose Our Platform?</h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Built with cutting-edge technology for the ultimate gaming experience
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: <TrendingUp className="w-8 h-8 text-blue-400" />,
                  title: "Transparent & Fair",
                  description: "All raffles are verifiable on-chain with complete transparency"
                },
                {
                  icon: <Clock className="w-8 h-8 text-purple-400" />,
                  title: "Instant Settlement",
                  description: "Automatic winner selection and prize distribution"
                },
                {
                  icon: <Star className="w-8 h-8 text-yellow-400" />,
                  title: "Staking Rewards",
                  description: "Earn up to 10% APY by staking MON tokens"
                }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-300"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
      </div>
    </>
  )
}