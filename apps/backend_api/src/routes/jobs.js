import express from 'express';
import { store } from '../services/store.js';
import { searchNearbyJobs } from '../services/spatialEngine.js';
import { lifecycleEngine } from '../services/lifecycleEngine.js';

export const jobsRouter = express.Router();

// 1. Spatial Proximity Search Endpoint (Matches TRD Section 10.1)
jobsRouter.get('/nearby', (req, res) => {
  const { lat, lng, radius_km = 10, query = '', category = '' } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({
      error: 'Latitude and Longitude are required for geospatial proximity search.'
    });
  }

  const startTime = Date.now();
  const allJobs = store.getAllJobs();
  const matchedJobs = searchNearbyJobs(allJobs, { lat, lng, radius_km, query, category });
  const latencyMs = Date.now() - startTime;

  res.json({
    success: true,
    count: matchedJobs.length,
    latency_ms: latencyMs,
    search_params: {
      origin: { lat: parseFloat(lat), lng: parseFloat(lng) },
      radius_km: parseFloat(radius_km),
      query: query || null,
      category: category || null
    },
    jobs: matchedJobs
  });
});

// 2. Autocomplete Master Titles & Categories
jobsRouter.get('/titles', (req, res) => {
  const { q } = req.query;
  const titles = store.getJobTitles();

  if (!q) {
    return res.json({ titles });
  }

  const filtered = titles.filter(t =>
    t.title_name.toLowerCase().includes(q.toLowerCase())
  );
  res.json({ titles: filtered });
});

// 3. Create Job with Expiry Calculation (Matches TRD Section 10.1 / 12)
jobsRouter.post('/create', (req, res) => {
  const {
    title,
    custom_title,
    category,
    description,
    salary_min,
    salary_max,
    salary_period,
    is_salary_negotiable,
    location_name,
    lat,
    lng,
    vacancies_count = 1,
    duration_days = 7,
    contact_phone,
    whatsapp_number,
    provider_id
  } = req.body;

  if (!title || !description || !location_name || lat === undefined || lng === undefined) {
    return res.status(400).json({
      error: 'Required fields missing: title, description, location_name, lat, lng.'
    });
  }

  const newJob = store.addJob({
    title,
    custom_title,
    category,
    description,
    salary_min,
    salary_max,
    salary_period,
    is_salary_negotiable,
    location_name,
    lat,
    lng,
    vacancies_count,
    duration_days,
    contact_phone,
    whatsapp_number,
    provider_id
  });

  lifecycleEngine.recordEvent(
    'JOB_CREATED',
    newJob.job_id,
    `New job posted: "${newJob.title}" at ${newJob.location_name}. Expires in ${duration_days} days.`
  );

  res.status(201).json({
    success: true,
    message: 'Job post created successfully and indexed for proximity radar discovery.',
    job: newJob
  });
});

// 4. Fetch All Jobs (For Employer Dashboard)
jobsRouter.get('/all', (req, res) => {
  const { provider_id } = req.query;
  let jobs = store.getAllJobs();

  if (provider_id) {
    jobs = jobs.filter(j => j.provider_id === provider_id);
  }

  // Attach applicant counts to each job
  const enriched = jobs.map(j => {
    const apps = store.getApplicationsForJob(j.job_id);
    return {
      ...j,
      applicants_count: apps.length
    };
  });

  res.json({ jobs: enriched });
});

// 5. Update Job Status (Pause, Activate, Mark Filled)
jobsRouter.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['ACTIVE', 'PAUSED', 'FILLED', 'EXPIRED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  const updated = store.updateJobStatus(id, status);
  if (!updated) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  lifecycleEngine.recordEvent('STATUS_CHANGED', id, `Job status updated to ${status}`);
  res.json({ success: true, job: updated });
});

// 6. 1-Tap Renew Job Listing
jobsRouter.post('/:id/renew', (req, res) => {
  const { id } = req.params;
  const { extra_days = 7 } = req.body;

  const renewed = store.renewJob(id, parseInt(extra_days));
  if (!renewed) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  lifecycleEngine.recordEvent(
    'JOB_RENEWED',
    id,
    `Job "${renewed.title}" renewed for ${extra_days} days. New expiry: ${new Date(renewed.expires_at).toLocaleDateString()}.`
  );

  res.json({
    success: true,
    message: `Job renewed for ${extra_days} days.`,
    job: renewed
  });
});

// 7. Flag & Report Scam/Suspicious Job (Security & Fraud Prevention)
jobsRouter.post('/:id/report', (req, res) => {
  const { id } = req.params;
  const { reason, description, reporter_contact } = req.body;

  const result = store.reportJob(id, {
    reason,
    description,
    reporterContact: reporter_contact
  });

  if (!result) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  lifecycleEngine.recordEvent(
    'JOB_REPORTED',
    id,
    `Security Alert: Job flagged for "${reason}". Report count: ${result.reportCount}. Status: ${result.jobStatus}`
  );

  res.json({
    success: true,
    message: 'Thank you for helping keep WorkLoco safe. Your report has been submitted to Trust & Safety.',
    ...result
  });
});

// 8. Lifecycle Audit Events
jobsRouter.get('/lifecycle-events', (req, res) => {
  res.json({ events: lifecycleEngine.getLogs() });
});

