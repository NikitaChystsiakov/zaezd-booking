import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Фото домов загружаются через server actions; по умолчанию лимит 1 МБ — меньше любого снимка с телефона.
    // Фото отправляются по одному, на сервере проверяется предел 10 МБ на файл.
    serverActions: { bodySizeLimit: '12mb' },
    // Тот же запрос проходит через proxy.ts (охрана /admin) — у него свой лимит тела
    proxyClientMaxBodySize: '12mb',
  },
}

export default nextConfig
