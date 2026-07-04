const webpack = require('webpack');

module.exports = {
  babel: {
    presets: [
      [
        '@babel/preset-env',
        {
          targets: {
            node: 'current',
          },
        },
      ],
      '@babel/preset-react',
    ],
    plugins: [
      ['@babel/plugin-proposal-class-properties', { loose: true }],
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],
      '@babel/plugin-transform-runtime',
    ],
    looseMode: true,
  },
  webpack: {
    configure: (webpackConfig, { env }) => {
      // Add Node.js polyfills for Solana wallet adapter
      webpackConfig.resolve = {
        ...webpackConfig.resolve,
        fallback: {
          ...webpackConfig.resolve?.fallback,
          crypto: require.resolve('crypto-browserify'),
          stream: require.resolve('stream-browserify'),
          buffer: require.resolve('buffer/'),
          vm: false, // Not needed in browser
        },
      };

      // Add buffer plugin for Solana
      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        }),
      ];

      // Production build optimizations
      if (env === 'production') {
        // Disable source maps completely
        webpackConfig.devtool = false;

        // Disable webpack-dev-server client in production
        if (Array.isArray(webpackConfig.entry)) {
          webpackConfig.entry = webpackConfig.entry.filter(entry =>
            !entry.includes('webpack-dev-server')
          );
        }

        // Optimize bundle splitting
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                chunks: 'all',
                minSize: 30000,
                maxSize: 244000,
              },
            },
          },
        };
      }

      return webpackConfig;
    },
  },
  style: {
    postcss: {
      plugins: [require('tailwindcss'), require('autoprefixer')],
    },
  },
  eslint: {
    configure: eslintConfig => {
      // Ignore @reown files in node_modules for ESLint
      eslintConfig.ignorePatterns = [
        ...(eslintConfig.ignorePatterns || []),
        '**/node_modules/@reown/**/*'
      ];
      
      return eslintConfig;
    },
    enable: false, // Disable ESLint during build for speed
  },
}; 