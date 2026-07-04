const { createProxyMiddleware } = require('http-proxy-middleware');

const GAME_WS_TARGETS = {
  bj:    'ws://localhost:9597',
  hilo:  'ws://localhost:9595',
  dice:  'ws://localhost:9596',
  mines: 'ws://localhost:9598',
  limbo: 'ws://localhost:9599',
  keno:  'ws://localhost:10000',
  plinko: 'ws://localhost:10003',
  flip:  'ws://localhost:10001',
};

const wsProxies = {};

for (const [game, target] of Object.entries(GAME_WS_TARGETS)) {
  wsProxies[game] = createProxyMiddleware({
    target,
    ws: true,
    changeOrigin: true,
    pathRewrite: { [`^/ws/${game}`]: '/' },
    on: {
      proxyReqWs: (proxyReq) => {
        proxyReq.removeHeader('sec-websocket-extensions');
      },
      error: (err, req, res) => {
        console.error(`[WS Proxy][${game}] Error:`, err.message);
      },
    },
  });
}

module.exports = wsProxies;
