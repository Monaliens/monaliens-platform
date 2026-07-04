import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sparkles, Trophy, Users, Zap } from 'lucide-react'

const features = [
  {
    icon: Sparkles,
    title: 'Transparent Raffles',
    description: 'Fully transparent and tamper-proof raffle process on the blockchain'
  },
  {
    icon: Trophy,
    title: 'Custom Token Support',
    description: 'Create raffles and win rewards with any ERC-20 token'
  },
  {
    icon: Users,
    title: '5% Platform Fee',
    description: 'Sustainable platform revenue enabling continuous development and improvement'
  },
  {
    icon: Zap,
    title: 'Automatic Payouts',
    description: 'Smart contract system that automatically distributes platform fees'
  }
]

const stats = [
  { value: '10+', label: 'Active Raffles' },
  { value: '100+', label: 'Happy Users' },
  { value: '50+', label: 'Rewards Distributed' }
]

export default function HomePage() {

  return (
    <>
      <Head>
        <title>Web3 Raffle Platform - MON Raffle Platform</title>
        <meta name="description" content="Decentralized raffle platform on Monad Testnet. Join NFT and token raffles!" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 via-purple-900/20 to-pink-900/20" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.3),transparent_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(147,51,234,0.3),transparent_70%)]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold">
                <span className="gradient-text-blue">Web3</span>{' '}
                <span className="gradient-text-purple">Raffle</span>{' '}
                <span className="text-white">Platform</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
                Join secure, transparent, and fair raffles on Monad Testnet.
                Get a chance to win NFT and token rewards!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/raffles" className="btn-primary text-lg px-8 py-4">
                <Sparkles className="w-5 h-5 mr-2" />
                View Raffles
              </Link>
              <Link href="/create" className="btn-outline text-lg px-8 py-4">
                <Trophy className="w-5 h-5 mr-2" />
                Create Raffle
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Floating Elements */}
        <motion.div
          animate={{ y: [-20, 20, -20] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full opacity-20 blur-xl"
        />
        <motion.div
          animate={{ y: [20, -20, 20] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-20 right-10 w-32 h-32 bg-gradient-to-r from-secondary-500 to-accent-500 rounded-full opacity-20 blur-xl"
        />
      </section>

      {/* Platform Stats Section */}
      <section className="py-16 bg-gray-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12">
            <div className="lg:col-span-3">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <h2 className="text-3xl font-bold text-white mb-4">
                  Platform Statistics
                </h2>
                <p className="text-gray-400 mb-6">
                  Real-time platform performance and revenue insights
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg">
                    <p className="text-white text-2xl font-bold">5% Platform Fee</p>
                    <p className="text-gray-400 text-sm">Sustainable revenue model</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg">
                    <p className="text-white text-2xl font-bold">Custom Tokens</p>
                    <p className="text-gray-400 text-sm">Support for any ERC-20 token</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg">
                    <p className="text-white text-2xl font-bold">Instant Payouts</p>
                    <p className="text-gray-400 text-sm">Automated fee distribution</p>
                  </div>
                </div>
              </motion.div>
            </div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg"
            >
              <h3 className="text-sm font-medium opacity-90 mb-2">Platform Revenue</h3>
              <div className="text-2xl font-bold mb-1">
                12.5 MON
              </div>
              <div className="text-sm opacity-75">
                From 25 transactions
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-white mb-4">
              Platform Features
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              A trustworthy raffle experience powered by blockchain technology
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="card-glow text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-400">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-5xl font-bold gradient-text mb-2">
                  {stat.value}
                </div>
                <div className="text-xl text-gray-400">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-900/20 to-secondary-900/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <h2 className="text-4xl font-bold text-white">
              Join the Raffle World
            </h2>
            <p className="text-xl text-gray-300">
              Get started now and seize the chance to win amazing rewards!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/raffles" className="btn-primary text-lg px-8 py-4">
                Get Started
              </Link>
              <Link href="/about" className="btn-outline text-lg px-8 py-4">
                Learn More
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  )
}
