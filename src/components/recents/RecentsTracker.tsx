'use client';

import { useEffect } from 'react';
import { recordRecent, type RecentType } from '@/lib/recents';

/**
 * Drop into a node detail page; records the visit into the recents store
 * (localStorage) so it surfaces in the sidebar. Renders nothing.
 */
export default function RecentsTracker({
  type,
  id,
  title,
}: {
  type: RecentType;
  id: string;
  title: string;
}) {
  useEffect(() => {
    recordRecent({ type, id, title });
  }, [type, id, title]);
  return null;
}
