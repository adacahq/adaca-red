'use client';

import { useEffect, useState } from 'react';
import WidgetCard from './WidgetCard';
import { WidgetBody } from './WidgetBody';
import { aggregate } from '@/lib/dashboard/aggregate';
import { WIDGET_BY_TYPE } from '@/lib/dashboard/widgets';
import type { WidgetData, WidgetInstance } from '@/lib/dashboard/types';

/** Loads a widget's data (for data widgets) and renders it inside the card. */
export default function WidgetView({
  instance,
  editing,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  instance: WidgetInstance;
  editing: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const meta = WIDGET_BY_TYPE[instance.type];
  const [data, setData] = useState<WidgetData | null>(meta.needsData ? null : { kind: 'empty' });
  const [error, setError] = useState(false);
  const cfgKey = JSON.stringify(instance.config);

  // All setState is inside async callbacks (no synchronous set-state-in-effect).
  // Stale data stays visible while a re-fetch resolves.
  useEffect(() => {
    if (!meta.needsData) return;
    let alive = true;
    aggregate(instance.type, instance.config)
      .then((d) => {
        if (alive) {
          setData(d);
          setError(false);
        }
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
    // cfgKey is a stable serialization of instance.config (deep-compare on purpose).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.type, cfgKey, meta.needsData]);

  const loading = meta.needsData && data === null && !error;

  return (
    <WidgetCard
      title={instance.title || meta.title}
      editing={editing}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onRemove={onRemove}
      loading={loading}
      error={error}
    >
      {!loading && !error && <WidgetBody instance={instance} data={data} />}
    </WidgetCard>
  );
}
