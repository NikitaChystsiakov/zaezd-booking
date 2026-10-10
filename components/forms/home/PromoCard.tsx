// components/forms/home/PromoCard.tsx
'use client';

import type { FC } from 'react';
import { useToast } from '@/hooks/useToast';
import { useCooldown } from '@/hooks/useCooldown';
import s from './PromoCard.module.css';

const PromoCard: FC = () => {
  const { show } = useToast();
  const cd = useCooldown(6);

  const showPromo = (): void => {
    if (cd.active) return;

    // Копируем промокод в буфер обмена
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText('Divan2025').catch(() => { });
    }

    show({
      title: 'Промокод скопирован!',
      description: 'Divan2025 - скидка 3% при заказе у менеджера в магазине.',
      duration: 6000,
    });

    cd.start();
  };

  return (
    <section className={s.container}>
      <div className={s.card}>
        <div className={s.content}>
          <h2 className={s.title}>Скидка 3% при заказе у менеджера</h2>
          <p className={s.description}>
            Нажмите на кнопку, чтобы получить промокод. Покажите его менеджеру в магазине
            и получите скидку на оформление. Действует на весь ассортимент мебели.
          </p>
          <div className={s.features}>
            <span className={s.feature}>✓ Работает во всех магазинах</span>
            <span className={s.feature}>✓ Действует весь 2025 год</span>
          </div>
          <div className={s.promoCode}>
            <button
              className={s.copyButton}
              onClick={showPromo}
              disabled={cd.active}
              aria-label="Показать и скопировать промокод"
            >
              {cd.active ? ` Повторно через ${cd.left}с` : ' Показать промокод'}
            </button>
          </div>
        </div>

        <div className={s.promoBox}>
          <div className={s.promoImage}>
            <div className={s.promoOverlay}>
              <span className={s.promoText}>-3%</span>
              <span className={s.promoSubtext}>при заказе в магазине</span>
            </div>
          </div>
          <div className={s.promoInfo}>
            <span className={s.infoText}>
              Промокод появится в уведомлении после нажатия кнопки
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PromoCard;