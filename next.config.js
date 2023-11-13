/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        NEXT_PUBLIC_RPC_ENDPOINT: process.env.REACT_APP_RPC_ENDPOINT,
    },
}

const dotenv = require('dotenv');
dotenv.config();

module.exports = nextConfig