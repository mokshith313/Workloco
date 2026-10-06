import express from 'express';
import { store } from '../services/store.js';
import { lifecycleEngine } from '../services/lifecycleEngine.js';

export const applicationsRouter = express.Router();

// 1. Submit 1-Tap Application (Seeker)
applicationsRouter.post('/', (req, res) => {
  const {
    job_id,
    seeker_name,
    seeker_phone,
    portfolio_urls,
    audio_intro_url,
    cover_note,
    distance_at_apply_km
  } = req.body;

  if (!job_id || !seeker_name || !seeker_phone) {
    return res.status(400).json({
      error: 'job_id, seeker_name, and seeker_phone are required.'
    });
  }

  const job = store.getJobById(job_id);
  if (!job) {
    return res.status(404).json({ error: 'Job listing not found.' });
  }

  if (job.status !== 'ACTIVE') {
    return res.status(400).json({
      error: `This job is currently ${job.status.toLowerCase()} and cannot accept new applications.`
    });
  }

  const app = store.addApplication({
    job_id,
    seeker_name,
    seeker_phone,
    portfolio_urls: Array.isArray(portfolio_urls) ? portfolio_urls : [],
    audio_intro_url,
    cover_note,
    distance_at_apply_km: parseFloat(distance_at_apply_km) || 0
  });

  // Simulated Push & WhatsApp alert to employer as per Section 6 Primary Flow
  const notificationMsg = `🔔 New Applicant: ${seeker_name} (${app.distance_at_apply_km} km away) applied for "${job.title}". WhatsApp contact unmasked.`;
  console.log(`[Alert Engine] Alert sent to employer (${job.contact_phone}): ${notificationMsg}`);
  lifecycleEngine.recordEvent('APPLICATION_RECEIVED', job.job_id, notificationMsg);

  res.status(201).json({
    success: true,
    message: 'Application submitted successfully! Direct contact has been notified.',
    application: app,
    employer_contact: {
      phone: job.contact_phone,
      whatsapp: job.whatsapp_number,
      unmasked: true
    }
  });
});

// 2. Fetch Applicants for a Job (Employer)
applicationsRouter.get('/job/:jobId', (req, res) => {
  const { jobId } = req.params;
  const applications = store.getApplicationsForJob(jobId);
  res.json({ count: applications.length, applications });
});

// 3. Update Application Status (SHORTLISTED, HIRED, REJECTED)
applicationsRouter.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['APPLIED', 'SHORTLISTED', 'REJECTED', 'HIRED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid application status.' });
  }

  const updated = store.updateApplicationStatus(id, status);
  if (!updated) {
    return res.status(404).json({ error: 'Application not found.' });
  }

  lifecycleEngine.recordEvent(
    'APPLICATION_STATUS',
    updated.job_id,
    `Candidate ${updated.seeker_name} status updated to ${status}.`
  );

  res.json({ success: true, application: updated });
});
