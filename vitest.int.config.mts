import path from 'node:path'
import os from 'node:os'
import { defineConfig } from 'vitest/config'

// Интеграционные тесты: настоящий серверный код (server actions, обработчики маршрутов)
// против отдельной базы PostgreSQL. Создать её один раз:
//   createdb usadba_test && DATABASE_URL=…/usadba_test npx prisma migrate deploy
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
      // Вне React Server Components этот пакет бросает исключение — в тестах он не нужен
      'server-only': path.resolve(import.meta.dirname, 'node_modules/server-only/empty.js'),
    },
  },
  test: {
    include: ['tests/int/**/*.test.ts'],
    setupFiles: ['tests/int/setup.ts'],
    // Одна база на все тесты — по очереди
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@localhost:5433/usadba_test',
      JWT_SECRET: 'test-secret',
      UPLOAD_DIR: path.join(os.tmpdir(), 'usadba-test-uploads'),
      APP_URL: 'http://test.local',
      TELEGRAM_BOT_TOKEN: '',
    },
  },
})
