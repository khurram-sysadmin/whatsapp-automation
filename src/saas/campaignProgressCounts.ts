export function campaignProgress(stats: Record<string, unknown>, status: string) {
  const count = (key: string) => Math.max(0, Math.floor(Number(stats[key]) || 0));
  // 'sent' already includes delivered/read. These counters must never be added again.
  const sent = count('sent'), failed = count('failed');
  const queued = count('queued') + count('sending');
  const needsReview = count('needsReview');
  const total = sent + failed + queued + needsReview;
  const processed = sent + failed;
  const percent = total ? Math.min(100, Math.round(processed / total * 100)) : 0;
  return { sent, failed, queued, needsReview, total, processed, percent: status === 'completed' ? 100 : percent };
}
