export function correctionPayload(mark: string, reason: string) {
  if (!/^\d+$/.test(mark.trim()) || Number(mark) > 20 || !reason.trim() || reason.length > 2000
    || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(reason)) return null;
  for (let i = 0; i < reason.length; i++) {
    const unit = reason.charCodeAt(i);
    if (unit >= 0xD800 && unit <= 0xDBFF) {
      const next = reason.charCodeAt(++i);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) return null;
    } else if (unit >= 0xDC00 && unit <= 0xDFFF) return null;
  }
  return { mark: Number(mark), reason };
}

export function gradingPollInterval(run: { status: string; steps: { status: string; errorCode?: string | null }[] } | undefined) {
  if (!run || run.status !== 'RUNNING' || run.steps.some(s => s.status === 'DEFERRED' || s.status === 'FAILED' || s.errorCode === 'DISPATCH_UNAVAILABLE')) return false;
  return run.steps.some(s => ['PENDING', 'DISPATCHED', 'RUNNING'].includes(s.status)) ? 2000 : false;
}

export function windowExpired(window: { opensAt: string | null; closesAt: string | null }, now: number) {
  return !!window.opensAt && !!window.closesAt && now >= Date.parse(window.closesAt);
}
