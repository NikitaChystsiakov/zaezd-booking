import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { appUrl } from '@/lib/notify'
import { ago } from '@/lib/domain'
import { SettingsForm } from '@/components/admin/SettingsForm'
import { FeedControls, AddFeedForm } from '@/components/admin/FeedControls'
import { CopyButton } from '@/components/CopyButton'

export const metadata: Metadata = { title: 'Настройки' }

export default async function SettingsPage() {
  const session = await requireSession()
  const property = await prisma.property.findUniqueOrThrow({
    where: { id: session.propertyId },
    include: { units: { orderBy: { sortOrder: 'asc' }, include: { calendarFeeds: true } } },
  })

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Настройки</h1>
        <p className="mt-1 text-sm text-ink-2">Последнее слово всегда за вами: решите, что гость видит сам, а что узнаёт только при звонке.</p>
      </div>

      <SettingsForm
        initial={{
          showAvailability: property.showAvailability,
          priceMode: property.priceMode,
          prepaymentPercent: property.prepaymentPercent,
          callbackMinutes: property.callbackMinutes,
          paymentDetails: property.paymentDetails ?? '',
          telegramChatId: property.telegramChatId ?? '',
        }}
      />

      <section className="card p-5 sm:p-6">
        <h2 className="font-semibold">Синхронизация календарей</h2>
        <p className="mt-1 text-sm text-ink-2">
          Отдайте ссылку «Наш календарь» в Google Календарь, Куфар или Реалт — там будут видны брони отсюда. А их ленты добавьте ниже — занятость
          оттуда появится в календаре и защитит от двойной продажи.
        </p>

        <div className="mt-6 space-y-6">
          {property.units.map((u) => {
            const exportUrl = appUrl(`/ical/${u.icalToken}.ics`)
            return (
              <div key={u.id} className="rounded-lg border border-line p-4">
                <div className="font-medium">{u.name}</div>

                <div className="mt-3 text-xs text-ink-3">Наш календарь (для подписки)</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-surface-2 px-2 py-1.5 text-xs">{exportUrl}</code>
                  <CopyButton text={exportUrl} />
                </div>

                <div className="mt-4 text-xs text-ink-3">Внешние календари</div>
                <ul className="mt-1 space-y-2">
                  {u.calendarFeeds.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-medium">{f.label}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-ink-3">{f.url}</span>
                      <span className={`text-xs ${f.lastError ? 'text-accent' : 'text-ink-3'}`}>
                        {f.lastError ?? (f.lastSyncAt ? `обновлено ${ago(f.lastSyncAt)}` : 'не синхронизировано')}
                      </span>
                      <FeedControls feedId={f.id} />
                    </li>
                  ))}
                  {u.calendarFeeds.length === 0 && <li className="text-sm text-ink-3">Пока нет</li>}
                </ul>
                <AddFeedForm unitId={u.id} />
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
