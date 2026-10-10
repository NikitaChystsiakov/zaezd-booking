"use client";

import { useEffect, useState } from "react";
import s from "./AdminManagers.module.css";
import { useToast } from "@/hooks/useToast";
import Link from "next/link";

type Shop = {
  id: number;
  city: string;
  street: string;
};

type Manager = {
  id: number;
  email: string | null;
  first_name: string | null;
  second_name: string | null;
  last_name: string | null;
  phone: string | null;
  shops: Shop[];
};

type ApiResponse = {
  managers: Manager[];
  shops: Shop[];
  message?: string;
};

export default function AdminManagersPage() {
  const toast = useToast();

  const [managers, setManagers] = useState<Manager[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setErr(null);
      setLoading(true);

      const res = await fetch("/api/v1/admin/manager-shops", {
        credentials: "include",
      });
      const json: ApiResponse = await res.json();
      if (!res.ok) throw new Error(json.message || "Ошибка загрузки");

      setManagers(Array.isArray(json.managers) ? json.managers : []);
      setShops(Array.isArray(json.shops) ? json.shops : []);
    } catch (e: any) {
      const msg = e?.message ?? "Ошибка загрузки менеджеров";
      setErr(msg);
      setManagers([]);
      setShops([]);
      toast.show({ title: "Ошибка", description: msg });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleLink(managerId: number, shopId: number, attach: boolean) {
    try {
      setSaving(true);
      const res = await fetch("/api/v1/admin/manager-shops", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerId,
          shopId,
          action: attach ? "attach" : "detach",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Ошибка сохранения");

      toast.show({
        title: attach ? "Магазин привязан" : "Магазин отвязан",
        description: attach
          ? `Менеджер #${managerId} → магазин #${shopId}`
          : `Магазин #${shopId} отвязан от менеджера #${managerId}`,
      });

      await load();
    } catch (e: any) {
      const msg = e?.message ?? "Не удалось обновить привязку";
      toast.show({ title: "Ошибка", description: msg });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className={s.wrapper}>
        <div className={s.card}>
          <p className={s.muted}>Загрузка менеджеров…</p>
        </div>
      </section>
    );
  }

  if (err) {
    return (
      <section className={s.wrapper}>
        <div className={s.card}>
          <p className={s.error}>{err}</p>
        </div>
      </section>
    );
  }

  if (managers.length === 0) {
    return (
      <section className={s.wrapper}>
        <div className={s.card}>
          <div className={s.headerRow}>
            <h1 className={s.title}>Привязка менеджеров к магазинам</h1>
          </div>
          <div className={s.placeholder}>Менеджеров пока нет.</div>
        </div>
      </section>
    );
  }

  const totalManagers = managers.length;
  const totalShops = shops.length;

  return (
    <section className={s.wrapper}>
      <div className={s.card}>
        <div className={s.headerRow}>
          <h1 className={s.title}>Привязка менеджеров к магазинам</h1>
          <div className={s.headerActions}>
            <span className={s.muted}>
              Всего менеджеров: <b>{totalManagers}</b> Магазинов:{" "}
              <b>{totalShops}</b>
              <Link className={s.secondary} href="/admin">
                ← Назад
              </Link>
            </span>
          </div>
        </div>

        <div className={s.tableContainer}>
          <div className={s.tableWrapper}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ФИО</th>
                  <th>Email / Телефон</th>
                  <th>Магазины</th>
                  <th className={s.actionsCell}>Управление</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m) => {
                  const fullName =
                    [m.last_name, m.first_name, m.second_name]
                      .filter(Boolean)
                      .join(" ") || "Без имени";

                  const linkedShopIds = new Set(m.shops.map((sh) => sh.id));
                  const availableShops = shops.filter(
                    (sh) => !linkedShopIds.has(sh.id)
                  );

                  const attachDisabled =
                    availableShops.length === 0 || saving;
                  const detachDisabled = m.shops.length === 0 || saving;

                  return (
                    <tr key={m.id}>
                      <td>{m.id}</td>
                      <td>{fullName}</td>
                      <td>
                        <div>{m.email ?? "—"}</div>
                        <div className={s.muted}>{m.phone ?? "—"}</div>
                      </td>
                      <td>
                        {m.shops.length === 0 ? (
                          <span className={s.muted}>Не привязан</span>
                        ) : (
                          <div className={s.shopBadges}>
                            {m.shops.map((sh) => (
                              <span key={sh.id} className={s.shopBadge}>
                                {sh.id} {sh.city}, {sh.street}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className={s.actionsCell}>
                        <div className={s.selectGroup}>
                          <select
                            className={s.select}
                            defaultValue=""
                            disabled={attachDisabled}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              toggleLink(Number(m.id), Number(val), true);
                              e.target.value = "";
                            }}
                          >
                            <option value="">
                              {availableShops.length === 0
                                ? "Все магазины уже привязаны"
                                : "+ Привязать к магазину"}
                            </option>
                            {availableShops.map((sh) => (
                              <option key={sh.id} value={sh.id}>
                                #{sh.id} • {sh.city}, {sh.street}
                              </option>
                            ))}
                          </select>

                          <select
                            className={s.select}
                            defaultValue=""
                            disabled={detachDisabled}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              toggleLink(Number(m.id), Number(val), false);
                              e.target.value = "";
                            }}
                          >
                            <option value="">
                              {m.shops.length === 0
                                ? "Нет привязанных магазинов"
                                : "− Отвязать от магазина"}
                            </option>
                            {m.shops.map((sh) => (
                              <option key={sh.id} value={sh.id}>
                                #{sh.id} • {sh.city}, {sh.street}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* MOBILE: карточки */}
        <div className={s.mobileList}>
          {managers.map((m) => {
            const fullName =
              [m.last_name, m.first_name, m.second_name]
                .filter(Boolean)
                .join(" ") || "Без имени";

            const linkedShopIds = new Set(m.shops.map((sh) => sh.id));
            const availableShops = shops.filter(
              (sh) => !linkedShopIds.has(sh.id)
            );

            const attachDisabled = availableShops.length === 0 || saving;
            const detachDisabled = m.shops.length === 0 || saving;

            return (
              <div key={m.id} className={s.managerCard}>
                <div className={s.managerTop}>
                  <div>
                    <div className={s.managerName}>{fullName}</div>
                    <div className={s.managerMeta}>
                      ID {m.id} • {m.email ?? "—"}
                    </div>
                    <div className={s.managerMeta}>
                      Телефон: {m.phone ?? "—"}
                    </div>
                  </div>
                </div>

                <div className={s.managerShopsBlock}>
                  <div className={s.managerLabel}>Магазины:</div>
                  {m.shops.length === 0 ? (
                    <span className={s.muted}>Не привязан</span>
                  ) : (
                    <div className={s.shopBadges}>
                      {m.shops.map((sh) => (
                        <span key={sh.id} className={s.shopBadge}>
                          #{sh.id} • {sh.city}, {sh.street}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className={s.managerControls}>
                  <select
                    className={s.select}
                    defaultValue=""
                    disabled={attachDisabled}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      toggleLink(Number(m.id), Number(val), true);
                      e.target.value = "";
                    }}
                  >
                    <option value="">
                      {availableShops.length === 0
                        ? "Все магазины уже привязаны"
                        : "+ Привязать к магазину"}
                    </option>
                    {availableShops.map((sh) => (
                      <option key={sh.id} value={sh.id}>
                        #{sh.id} • {sh.city}, {sh.street}
                      </option>
                    ))}
                  </select>

                  <select
                    className={s.select}
                    defaultValue=""
                    disabled={detachDisabled}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      toggleLink(Number(m.id), Number(val), false);
                      e.target.value = "";
                    }}
                  >
                    <option value="">
                      {m.shops.length === 0
                        ? "Нет привязанных магазинов"
                        : "− Отвязать от магазина"}
                    </option>
                    {m.shops.map((sh) => (
                      <option key={sh.id} value={sh.id}>
                        #{sh.id} • {sh.city}, {sh.street}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {saving && (
          <p className={s.muted} style={{ marginTop: 10 }}>
            Сохраняем изменения…
          </p>
        )}
      </div>
    </section>
  );
}
