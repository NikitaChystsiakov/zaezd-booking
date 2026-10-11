import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { appUrl } from '@/lib/notify'
import { ago } from '@/lib/domain'
import { PageHeader, Section } from '@/components/admin/ui'
import { SettingsForm } from '@/components/admin/SettingsForm'
import { AddFeedForm, FeedControls } from '@/components/admin/FeedControls'
import { CopyButton } from '@/components/CopyButton'

export const metadata: Metadata = { title: 'Настройки' }

export default async function SettingsPage() {
  const session = await requireSession()
  const property = await prisma.property.findUniqueOrThrow({
    where: { id: session.propertyId },
    include: { units: { orderBy: { sortOrder: 'asc' }, include: { calendarFeeds: true } } },
  })
  const embed = `<div data-booking="${property.slug}"></div>\n<script src="${appUrl('/embed.js')}" async></script>`

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Настройки" sub="Последнее слово за вами: что гость видит сам, а что узнаёт только от администратора." />

      <SettingsForm
        initial={{
          showAvailability: property.showAvailability,
          priceMode: property.priceMode,
          depositPercent: property.depositPercent,
          callbackMinutes: property.callbackMinutes,
          paymentDetails: property.paymentDetails ?? '',
          telegramChatId: property.telegramChatId ?? '',
        }}
      />

      <Section
        title="Синхронизация календарей"
        sub="Брони отсюда видны в Google Календаре, на Куфаре и Реалте — по ссылке «Наш календарь». А их календари добавьте ниже: занятость оттуда закроет даты на сайте, и один день не продастся дважды."
      >
        <div className="space-y-4">
          {property.units.map((u) => {
            const exportUrl = appUrl(`/ical/${u.icalToken}.ics`)
            return (
              <div key={u.id} className="rounded-2xl border border-line p-5">
                <div className="flex items-center gap-3">
                  {u.photos[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.photos[0]} alt="" className="photo-grade size-10 rounded-lg object-cover" />
                  )}
                  <div className="font-bold">{u.name}</div>
                </div>

                <div className="mt-4 text-xs font-semibold text-ink-3">Наш календарь — вставьте эту ссылку на Куфаре, Реалте или в Google Календаре</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-xl bg-surface-2 px-3 py-2 text-xs">{exportUrl}</code>
                  <CopyButton text={exportUrl} />
                </div>

                <div className="mt-5 text-xs font-semibold text-ink-3">Чужие календари — откуда подтягиваем занятость</div>
                <ul className="mt-1.5 divide-y divide-line">
                  {u.calendarFeeds.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                      <span className="font-semibold">{f.label}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-ink-3">{f.url}</span>
                      <span className={`text-xs ${f.lastError ? 'text-alert' : 'text-ok'}`}>{f.lastError ?? (f.lastSyncAt ? `обновлено ${ago(f.lastSyncAt)}` : 'ещё не обновляли')}</span>
                      <FeedControls feedId={f.id} />
                    </li>
                  ))}
                  {u.calendarFeeds.length === 0 && <li className="py-2 text-sm text-ink-3">Пока нет</li>}
                </ul>
                <AddFeedForm unitId={u.id} />
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Форма бронирования на вашем сайте" sub="Вставьте этот код на любую страницу сайта — появится та же форма с календарём и расчётом, что на странице бронирования. Подстраивается по высоте.">
        <pre className="overflow-x-auto rounded-xl bg-side p-4 text-[13px] leading-relaxed text-side-ink">{embed}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={embed} label="Скопировать код" />
          <a href={`/embed/${property.slug}`} target="_blank" className="btn-quiet btn-sm">
            Посмотреть форму отдельно
          </a>
        </div>
      </Section>
    </div>
  )
}
