import 'server-only'

// Уведомление администратору в Telegram. Без TELEGRAM_BOT_TOKEN или chat id
// тихо ничего не делает — демо и локальная разработка работают без бота.
export async function notifyTelegram(chatId: string | null | undefined, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    })
  } catch (e) {
    console.error('telegram notify failed', e)
  }
}

export function appUrl(path = ''): string {
  return `${process.env.APP_URL ?? 'http://localhost:4195'}${path}`
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
