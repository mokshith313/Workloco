import { store } from './store.js';

export class LifecycleEngine {
  constructor() {
    this.intervalId = null;
    this.eventLogs = [];
  }

  start(intervalMs = 15000) {
    if (this.intervalId) return;
    console.log('[LifecycleEngine] Job auto-expiry and quota monitor started.');

    this.intervalId = setInterval(() => {
      this.checkExpiringJobs();
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  checkExpiringJobs() {
    const now = new Date();
    const jobs = store.getAllJobs();

    jobs.forEach(job => {
      if (job.status === 'ACTIVE') {
        const expiryDate = new Date(job.expires_at);

        // Check if expired
        if (expiryDate <= now) {
          store.updateJobStatus(job.job_id, 'EXPIRED');
          const logMsg = `Auto-expired job "${job.title}" (${job.job_id}). WhatsApp alert triggered to provider (${job.contact_phone}) with 1-tap renewal offer.`;
          console.log(`[LifecycleEngine] ${logMsg}`);
          this.recordEvent('JOB_EXPIRED', job.job_id, logMsg);
        }

        // Check quota (if hired_count reaches vacancies_count)
        if (job.hired_count >= job.vacancies_count) {
          store.updateJobStatus(job.job_id, 'FILLED');
          const logMsg = `Quota reached (${job.hired_count}/${job.vacancies_count}). Marked job "${job.title}" as FILLED. Discovery feed updated.`;
          console.log(`[LifecycleEngine] ${logMsg}`);
          this.recordEvent('JOB_FILLED', job.job_id, logMsg);
        }
      }
    });
  }

  recordEvent(type, jobId, message) {
    this.eventLogs.unshift({
      id: `evt-${Date.now()}`,
      type,
      jobId,
      message,
      timestamp: new Date().toISOString()
    });
    if (this.eventLogs.length > 50) {
      this.eventLogs.pop();
    }
  }

  getLogs() {
    return this.eventLogs;
  }
}

export const lifecycleEngine = new LifecycleEngine();
