import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    domains: [],
    unoptimized: true,
  },
  eslint: {
    // Не валим production-билд из-за ESLint-ошибок.
    // Линтер по-прежнему работает в dev-режиме и через `npm run lint`.
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
