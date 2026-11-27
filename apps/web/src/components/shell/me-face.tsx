'use client';

import { useState } from 'react';
import type { ShellUser } from './shell-context';

/** What fills the account tile: the sign-in provider's photo, or the name's initial without one or when it fails to load. */
export function MeFace({ user }: { user: ShellUser }) {
  const [failed, setFailed] = useState(false);
  if (!user.photoUrl || failed) return user.initial;
  // eslint-disable-next-line @next/next/no-img-element -- Google's photo host refuses requests that carry a referrer
  return <img className="me-photo" src={user.photoUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
