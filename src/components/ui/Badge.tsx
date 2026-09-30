import { lower } from '../../services/normalize';
import React from 'react';
import type { CampaignStatus, MessageStatus, ContactStatus } from '../../types';

interface BadgeProps {
  status: CampaignStatus | MessageStatus | ContactStatus | string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'sm' }) => {
  const normalized = lower(status);

  let style = 'bg-zinc-100 text-zinc-700 border-zinc-200';
  let dotColor = 'bg-zinc-400';
  let label = normalized || 'Unknown';

  switch (normalized) {
    case 'running':
    case 'active':
    case 'delivered':
      style = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      dotColor = 'bg-emerald-500';
      label = normalized === 'running' ? 'Running' : normalized === 'active' ? 'Active' : 'Delivered';
      break;

    case 'read':
    case 'replied':
      style = 'bg-sky-50 text-sky-700 border-sky-200/80';
      dotColor = 'bg-sky-500';
      label = normalized === 'read' ? 'Read' : 'Replied';
      break;

    case 'sent':
    case 'queued':
      style = 'bg-amber-50 text-amber-700 border-amber-200/80';
      dotColor = 'bg-amber-500';
      label = normalized === 'sent' ? 'Sent' : 'Queued';
      break;

    case 'paused':
    case 'draft':
      style = 'bg-zinc-100 text-zinc-700 border-zinc-300';
      dotColor = 'bg-zinc-500';
      label = normalized === 'paused' ? 'Paused' : 'Draft';
      break;

    case 'completed':
      style = 'bg-purple-50 text-purple-700 border-purple-200/80';
      dotColor = 'bg-purple-500';
      label = 'Completed';
      break;

    case 'failed':
    case 'stopped':
    case 'invalid':
    case 'opted_out':
      style = 'bg-rose-50 text-rose-700 border-rose-200/80';
      dotColor = 'bg-rose-500';
      label = normalized === 'opted_out' ? 'Opted Out' : normalized.charAt(0).toUpperCase() + normalized.slice(1);
      break;

    default:
      break;
  }

  const px = size === 'sm' ? 'px-2.5 py-0.5 text-xs font-medium' : 'px-3 py-1 text-xs font-semibold';

  return (
    <span className={`inline-flex items-center rounded-full border ${px} ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotColor}`} />
      {label}
    </span>
  );
};
