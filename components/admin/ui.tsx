// Общие кусочки админки

export function PageHeader({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="display text-[44px] sm:text-[52px]">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-[15px] text-ink-2">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export function Section({ title, sub, children, aside }: { title: string; sub?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold">{title}</h2>
          {sub && <p className="mt-1 max-w-2xl text-sm text-ink-2">{sub}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function SaveBar({ pending, msg, label = 'Сохранить' }: { pending: boolean; msg: { ok: boolean; text: string } | null; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <button className="btn-primary" disabled={pending}>
        {pending ? 'Сохраняем…' : label}
      </button>
      {msg && (
        <span role="status" className={`text-sm ${msg.ok ? 'text-ok' : 'text-alert'}`}>
          {msg.text}
        </span>
      )}
    </div>
  )
}
