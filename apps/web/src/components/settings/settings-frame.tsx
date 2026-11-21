'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Page } from '@/components/shell/page';
import { SETTINGS_GROUPS, settingsPlace, type SettingsSection } from '@/lib/settings-nav';
import { Mdi, SECTION_ICONS } from './mdi';
import { useMerchantNames } from './use-merchant-names';
import '@/components/ledger/ledger.css';
import '@/components/activity/activity.css';
import './settings.css';

/**
 * W2-Data's Settings: the section nav beside every section. Under 700 wide the nav is the phone's
 * Profile rows on `/settings`, and each section is a page pushed over it with Back.
 */
export function SettingsFrame({ children }: { children: ReactNode }) {
  const place = settingsPlace(usePathname());
  const toName = useMerchantNames().toName.length;
  const meta: Partial<Record<SettingsSection, ReactNode>> = {
    merchants: toName ? (
      <span className="nav-badge num" aria-label={`${toName} ${toName === 1 ? 'code' : 'codes'} to name`}>
        {toName}
      </span>
    ) : null,
  };
  return (
    <Page title="Settings" phone="pushed" phoneTitle={place.phoneTitle} back={place.back}>
      <div className="settings" data-index={place.index || undefined}>
        <nav aria-label="Settings" className="settings-nav">
          {SETTINGS_GROUPS.map((group) => (
            <div key={group.caption} className="settings-group">
              <span className="caps settings-caption">{group.caption}</span>
              {group.items.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="settings-link press"
                  aria-current={!place.index && place.section === item.key ? 'page' : undefined}
                  data-current={place.section === item.key || undefined}
                >
                  <Mdi path={SECTION_ICONS[item.key]} size={20} />
                  <span className="settings-link-label">{item.label}</span>
                  {meta[item.key]}
                  <span className="settings-chevron" aria-hidden="true">
                    <Mdi path={SECTION_ICONS.chevron} size={18} />
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="settings-panel">{children}</div>
      </div>
    </Page>
  );
}
