import { campaignProgress } from './campaignProgressCounts';

export function CampaignProgress({stats,status}:{stats:Record<string,unknown>;status:string}) {
  const progress=campaignProgress(stats,status);
  return <section className="v2-campaign-progress" aria-label="Campaign progress">
    <div className="v2-progress-heading"><strong>{status==='completed'?'Completed':status==='running'?'Sending messages':status==='paused'?'Campaign paused':status==='stopped'?'Campaign stopped':'Campaign progress'}</strong><span>{progress.processed.toLocaleString()} of {progress.total.toLocaleString()} processed</span></div>
    <div className={'v2-send-progress '+(status==='completed'?'complete':'')} role="progressbar" aria-label="Messages processed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}><span style={{width:progress.percent+'%'}}/></div>
    <div className="v2-progress-counts"><span>Queued <strong>{progress.queued.toLocaleString()}</strong></span><span>Sent <strong>{progress.sent.toLocaleString()}</strong></span><span>Failed <strong>{progress.failed.toLocaleString()}</strong></span></div>
    {progress.needsReview>0&&<p className="v2-notice">Delivery needs checking for {progress.needsReview} {progress.needsReview===1?'message':'messages'}. These will not be resent automatically.</p>}
  </section>;
}

