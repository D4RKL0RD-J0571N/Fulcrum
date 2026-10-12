const path = require('path');

module.exports = {
  transpilePackages: ['@fulcrum/contracts', '@fulcrum/domain', '@fulcrum/sim-engine'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@fulcrum/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@fulcrum/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
      '@fulcrum/sim-engine': path.resolve(__dirname, '../../packages/sim-engine/src/index.ts')
    };
    return config;
  }
};
