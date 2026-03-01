// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = config.resolve.alias || {};
    // Force the pure-JS bigint implementation to avoid noisy native binding warnings.
    config.resolve.alias["bigint-buffer"] = require.resolve("bigint-buffer/dist/browser.js");
    return config;
  },
};

module.exports = nextConfig;
