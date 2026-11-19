import type { ReactNode } from 'react';
import { Moment, ReplayButton } from './moment';

/** The bento's cards; each kind sets its column span and height in bento.css. */
export type BentoKind = 'fan' | 'snap' | 'bars' | 'chat' | 'debts';

export function BentoCard({
  kind,
  title,
  body,
  replayLabel,
  children,
}: {
  kind: BentoKind;
  title: string;
  body: string;
  replayLabel: string;
  children: ReactNode;
}) {
  return (
    <article className={`bn-card bn-card-${kind}`}>
      <Moment className="bn-moment">
        <div className="bn-head">
          <div className="bn-head-text">
            <h3 className="bn-title disp">{title}</h3>
            <p className="bn-body">{body}</p>
          </div>
          <ReplayButton label={replayLabel} />
        </div>
        {children}
      </Moment>
    </article>
  );
}
