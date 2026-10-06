import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedFilePath = path.resolve(__dirname, '../../../../database/seeds/sample_data.json');

class DataStore {
  constructor() {
    this.jobs = [];
    this.jobTitles = [];
    this.users = [];
    this.applications = [];
    this.reports = [];
    this.notifications = [];
    this.otpStore = new Map(); // phone -> { otp, expiresAt }
    this.loadInitialData();
  }

  loadInitialData() {
    try {
      if (fs.existsSync(seedFilePath)) {
        const raw = fs.readFileSync(seedFilePath, 'utf8');
        const data = JSON.parse(raw);
        this.jobTitles = data.job_titles || [];
        this.users = data.users || [];
        this.applications = data.sample_applications || [];
        this.notifications = data.notifications || [];
        this.reports = data.sample_reports || [];

        // Normalize jobs with expires_at date objects & verification fields
        this.jobs = (data.jobs || []).map(j => {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + (j.days_remaining || 7));
          return {
            ...j,
            is_verified_employer: Boolean(j.is_verified_employer),
            report_count: j.report_count || 0,
            expires_at: expiresAt.toISOString()
          };
        });

        console.log(`[Store] Loaded ${this.jobs.length} jobs, ${this.jobTitles.length} titles, ${this.users.length} users, and ${this.notifications.length} notifications from seeds.`);
      } else {
        console.warn(`[Store] Seed file not found at ${seedFilePath}`);
      }
    } catch (err) {
      console.error('[Store] Failed to load seeds:', err);
    }
  }

  // --- User & Auth Methods ---
  getAllUsers() {
    return this.users;
  }

  getUserById(userId) {
    return this.users.find(u => u.user_id === userId);
  }

  getUserByPhone(phone) {
    const clean = phone.replace(/[^0-9]/g, '');
    return this.users.find(u => (u.phone_number || '').replace(/[^0-9]/g, '').endsWith(clean.slice(-10)));
  }

  getUserByEmail(email) {
    return this.users.find(u => (u.email || '').toLowerCase() === email.toLowerCase().trim());
  }

  generateAndSendOtp(phoneNumber) {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    // Generate dynamic 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiration
    this.otpStore.set(cleanPhone, { otp, expiresAt, attempts: 0 });
    console.log(`[AuthEngine] Dispatched dynamic OTP ${otp} to phone ${phoneNumber} (valid for 5 mins).`);
    return { 
      success: true, 
      otp, 
      expires_in_seconds: 300,
      demoNote: `Simulated OTP sent: ${otp} (Valid for 5 minutes)` 
    };
  }

  verifyOtp(phoneNumber, inputOtp, intentRole = null, fullName = '') {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const trimmedOtp = (inputOtp || '').trim();

    // Check cached active OTP
    const cached = this.otpStore.get(cleanPhone);
    if (!cached || Date.now() > cached.expiresAt) {
      if (cached) this.otpStore.delete(cleanPhone);
      return { 
        success: false, 
        error: 'OTP has expired or was not requested. Please request a new OTP.' 
      };
    }

    // Strictly compare submitted user OTP against the cached active OTP code
    if (cached.otp !== trimmedOtp) {
      cached.attempts = (cached.attempts || 0) + 1;
      console.warn(`[AuthEngine] Failed OTP attempt (${cached.attempts}) for phone ${phoneNumber}.`);
      return { 
        success: false, 
        error: 'Invalid OTP code. Please check and try again.',
        attempts: cached.attempts 
      };
    }

    // OTP matches strictly: consume cached OTP code
    this.otpStore.delete(cleanPhone);

    // Find or dynamically create user
    let user = this.getUserByPhone(phoneNumber);
    if (!user) {
      const derivedName = fullName && fullName.trim().length > 0 
        ? fullName.trim() 
        : (intentRole === 'PROVIDER' ? 'Business Partner' : (intentRole === 'ADMIN' ? 'Founder Admin' : (intentRole === 'SEEKER' ? 'Job Seeker' : 'New User')));

      user = {
        user_id: `u-${Date.now().toString(36)}`,
        full_name: derivedName,
        phone_number: phoneNumber,
        email: `${cleanPhone.slice(-6)}@workloco.in`,
        role: intentRole || null,
        is_phone_verified: true,
        is_business_verified: intentRole === 'ADMIN',
        verification_status: intentRole === 'ADMIN' ? 'BUSINESS_VERIFIED' : 'PHONE_VERIFIED',
        preferred_language: 'en',
        created_at: new Date().toISOString()
      };
      this.users.push(user);
    } else {
      user.is_phone_verified = true;
      if (fullName && fullName.trim()) user.full_name = fullName.trim();
      // Strictly preserve role if user already has one (especially ADMIN, PROVIDER, SEEKER)
      if (!user.role && intentRole) {
        user.role = intentRole;
      }
      if (user.verification_status === 'UNVERIFIED') {
        user.verification_status = 'PHONE_VERIFIED';
      }
    }

    return { success: true, user, token: `wk-token-${user.user_id}-${Date.now()}` };
  }

  updateUserProfile(userId, profileData) {
    let user = this.getUserById(userId);
    if (!user) {
      user = {
        user_id: userId,
        full_name: profileData.full_name || 'WorkLoco Member',
        phone_number: profileData.phone_number || '',
        email: profileData.email || '',
        role: profileData.role || 'SEEKER',
        created_at: new Date().toISOString()
      };
      this.users.push(user);
    }

    if (profileData.full_name !== undefined && profileData.full_name.trim().length > 0) {
      user.full_name = profileData.full_name.trim();
    }
    if (profileData.bio !== undefined) {
      user.bio = profileData.bio.trim();
    }
    if (profileData.phone_number !== undefined) {
      user.phone_number = profileData.phone_number.trim();
    }
    if (profileData.email !== undefined) {
      user.email = profileData.email.trim();
    }
    if (profileData.avatar_url !== undefined) {
      user.avatar_url = profileData.avatar_url.trim();
    }
    if (profileData.role !== undefined && ['SEEKER', 'PROVIDER', 'ADMIN'].includes(profileData.role)) {
      if (user.role !== 'ADMIN' || profileData.role === 'ADMIN') {
        user.role = profileData.role;
      }
    }
    if (profileData.preferred_language !== undefined) {
      user.preferred_language = profileData.preferred_language;
    }
    if (profileData.city !== undefined) {
      user.city = profileData.city.trim();
    }
    if (profileData.skills !== undefined) {
      user.skills = Array.isArray(profileData.skills) ? profileData.skills : String(profileData.skills).split(',').map(s => s.trim()).filter(Boolean);
    }
    if (profileData.portfolio_url !== undefined) {
      user.portfolio_url = profileData.portfolio_url.trim();
    }
    if (profileData.business_name !== undefined) {
      user.business_name = profileData.business_name.trim();
    }

    return { success: true, user };
  }

  updateUserLanguage(userId, language) {
    const user = this.getUserById(userId);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }
    user.preferred_language = language;
    return { success: true, preferred_language: language, user };
  }

  loginWithEmail(email, password = null, intentRole = null, fullName = '') {
    let user = this.getUserByEmail(email);
    if (!user) {
      const namePart = (fullName && fullName.trim().length > 0)
        ? fullName.trim()
        : email.split('@')[0].replace(/[._]/g, ' ');
      user = {
        user_id: `u-${Date.now().toString(36)}`,
        full_name: (fullName && fullName.trim().length > 0) ? fullName.trim() : (namePart.charAt(0).toUpperCase() + namePart.slice(1)),
        email: email.trim().toLowerCase(),
        phone_number: '',
        role: intentRole || null,
        is_phone_verified: false,
        is_business_verified: false,
        verification_status: 'UNVERIFIED',
        preferred_language: 'en',
        created_at: new Date().toISOString()
      };
      this.users.push(user);
    } else {
      if (fullName && fullName.trim()) user.full_name = fullName.trim();
      // Strictly preserve role if user already has one
      if (!user.role && intentRole) {
        user.role = intentRole;
      }
    }

    return { success: true, user, token: `wk-token-${user.user_id}-${Date.now()}` };
  }

  loginWithGoogle(googleProfile, intentRole = null) {
    const email = googleProfile.email || 'user.google@gmail.com';
    const role = googleProfile.role || intentRole || null;
    let user = (googleProfile.user_id && this.getUserById(googleProfile.user_id)) || this.getUserByEmail(email);
    if (!user) {
      user = {
        user_id: `u-g-${Date.now().toString(36)}`,
        full_name: googleProfile.name || (role === 'ADMIN' ? 'Founder Admin' : (role === 'PROVIDER' ? 'Business Partner' : 'Google User')),
        email: email,
        avatar_url: googleProfile.picture || null,
        phone_number: googleProfile.phone_number || '',
        role: role,
        is_phone_verified: true,
        is_business_verified: role === 'ADMIN' || role === 'PROVIDER',
        verification_status: (role === 'ADMIN' || role === 'PROVIDER') ? 'BUSINESS_VERIFIED' : 'PHONE_VERIFIED',
        preferred_language: 'en',
        created_at: new Date().toISOString()
      };
      this.users.push(user);
    } else {
      if (googleProfile.name) user.full_name = googleProfile.name;
      if (googleProfile.picture) user.avatar_url = googleProfile.picture;
      // Strictly preserve role if user already has one (especially ADMIN)
      if (!user.role && role) {
        user.role = role;
      } else if (role === 'ADMIN') {
        user.role = 'ADMIN';
      }
    }
    return { success: true, user, token: `wk-token-${user.user_id}-${Date.now()}` };
  }

  // --- 2-Step Employer Verification Guard ---
  verifyEmployer(userId, { phoneOtp, gstin, panNumber, businessName, pincode }) {
    let user = this.getUserById(userId);
    if (!user) {
      // Use fallback first provider
      user = this.users.find(u => u.role === 'PROVIDER') || this.users[0];
    }

    // Step 1: Mandatory phone verification
    if (phoneOtp && phoneOtp !== '123456') {
      return { success: false, error: 'Phone OTP validation failed. Use demo OTP 123456.' };
    }
    user.is_phone_verified = true;

    // Step 2: Business Verification (GSTIN or PAN or Pincode match)
    const hasGstin = gstin && gstin.trim().length >= 10;
    const hasPan = panNumber && panNumber.trim().length >= 10;
    const hasAddress = businessName && pincode && pincode.trim().length === 6;

    if (hasGstin || hasPan || hasAddress) {
      user.is_business_verified = true;
      user.verification_status = 'BUSINESS_VERIFIED';
      user.business_name = businessName || user.business_name || 'Verified Enterprise';
      user.gstin = gstin || user.gstin || null;
      user.pan_number = panNumber || user.pan_number || null;
      user.pincode = pincode || user.pincode || null;

      // Update existing jobs by this provider to verified
      this.jobs.forEach(j => {
        if (j.provider_id === user.user_id) {
          j.is_verified_employer = true;
        }
      });

      this.addNotification({
        user_id: user.user_id,
        target_role: 'PROVIDER',
        type: 'VERIFICATION_UPDATE',
        title: '🛡️ Business Verified Successfully',
        message: `Your business "${user.business_name}" is now fully verified. Your job posts will display the Emerald Verified Badge.`
      });

      return {
        success: true,
        verification_status: 'BUSINESS_VERIFIED',
        is_verified_employer: true,
        user
      };
    } else {
      user.verification_status = 'PHONE_VERIFIED';
      user.is_business_verified = false;
      return {
        success: true,
        verification_status: 'PHONE_VERIFIED',
        is_verified_employer: false,
        message: 'Phone verified. Complete Step 2 (GSTIN/PAN/Address) for Verified Employer badge.',
        user
      };
    }
  }

  // --- Job Methods ---
  getAllJobs() {
    return this.jobs;
  }

  getJobById(jobId) {
    return this.jobs.find(j => j.job_id === jobId);
  }

  addJob(jobData) {
    const jobId = `job-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const durationDays = parseInt(jobData.duration_days) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    // Look up provider verification status
    const provider = this.getUserById(jobData.provider_id);
    const isVerified = provider ? Boolean(provider.is_business_verified) : Boolean(jobData.is_verified_employer);

    const newJob = {
      job_id: jobId,
      provider_id: jobData.provider_id || 'u-demo-provider',
      title: jobData.title,
      custom_title: jobData.custom_title || null,
      category: jobData.category || 'General',
      description: jobData.description,
      salary_min: Number(jobData.salary_min) || 0,
      salary_max: Number(jobData.salary_max) || 0,
      salary_period: jobData.salary_period || 'monthly',
      is_salary_negotiable: Boolean(jobData.is_salary_negotiable),
      location_name: jobData.location_name,
      lat: parseFloat(jobData.lat),
      lng: parseFloat(jobData.lng),
      vacancies_count: parseInt(jobData.vacancies_count) || 1,
      hired_count: 0,
      status: 'ACTIVE',
      contact_phone: jobData.contact_phone || '+91 98480 12345',
      whatsapp_number: jobData.whatsapp_number || '+919848012345',
      is_verified_employer: isVerified,
      report_count: 0,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString()
    };

    this.jobs.unshift(newJob);

    // Add to master titles if missing
    const exists = this.jobTitles.some(t => t.title_name.toLowerCase() === newJob.title.toLowerCase());
    if (!exists) {
      this.jobTitles.push({
        title_name: newJob.title,
        category: newJob.category,
        is_verified: false
      });
    }

    return newJob;
  }

  reportJob(jobId, { reason, description, reporterContact }) {
    const job = this.getJobById(jobId);
    if (!job) return null;

    job.report_count = (job.report_count || 0) + 1;
    const reportId = `rep-${Date.now().toString(36)}`;

    const newReport = {
      report_id: reportId,
      job_id: jobId,
      job_title: job.title,
      reason: reason || 'SUSPICIOUS_OR_SCAM',
      description: description || 'Flagged by job seeker',
      reporter_contact: reporterContact || 'Anonymous',
      status: 'PENDING',
      created_at: new Date().toISOString()
    };
    this.reports.unshift(newReport);

    // If a post accumulates >= 3 reports, automatically flag or pause it
    if (job.report_count >= 3) {
      job.status = 'FLAGGED';
      console.warn(`[Trust & Safety] Job ${jobId} accumulated ${job.report_count} reports. Status changed to FLAGGED.`);
    }

    this.addNotification({
      user_id: job.provider_id,
      target_role: 'PROVIDER',
      type: 'SECURITY_ALERT',
      title: 'Listing Report Notice',
      message: `Your job listing "${job.title}" received a seeker report (${reason}). Our trust & safety team is reviewing it.`
    });

    return { success: true, report: newReport, reportCount: job.report_count, jobStatus: job.status };
  }

  updateJobStatus(jobId, status) {
    const job = this.getJobById(jobId);
    if (!job) return null;
    job.status = status;
    return job;
  }

  renewJob(jobId, extraDays = 7) {
    const job = this.getJobById(jobId);
    if (!job) return null;
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + extraDays);
    job.expires_at = newExpiry.toISOString();
    job.status = 'ACTIVE';
    return job;
  }

  incrementHiredCount(jobId) {
    const job = this.getJobById(jobId);
    if (!job) return null;
    job.hired_count = (job.hired_count || 0) + 1;
    if (job.hired_count >= job.vacancies_count) {
      job.status = 'FILLED';
    }
    return job;
  }

  getJobTitles() {
    return this.jobTitles;
  }

  getApplicationsForJob(jobId) {
    return this.applications.filter(a => a.job_id === jobId);
  }

  addApplication(appData) {
    const applicationId = `app-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newApp = {
      application_id: applicationId,
      job_id: appData.job_id,
      seeker_id: appData.seeker_id || `u-seeker-${Date.now()}`,
      seeker_name: appData.seeker_name,
      seeker_phone: appData.seeker_phone,
      portfolio_urls: Array.isArray(appData.portfolio_urls) ? appData.portfolio_urls : [],
      audio_intro_url: appData.audio_intro_url || null,
      cover_note: appData.cover_note || '',
      distance_at_apply_km: appData.distance_at_apply_km || 0,
      status: 'APPLIED',
      applied_at: new Date().toISOString()
    };

    this.applications.unshift(newApp);

    // Trigger Notification for Employer
    const job = this.getJobById(appData.job_id);
    this.addNotification({
      user_id: job ? job.provider_id : null,
      target_role: 'PROVIDER',
      type: 'NEW_APPLICANT',
      title: `New Applicant: ${newApp.seeker_name}`,
      message: `${newApp.seeker_name} (${newApp.distance_at_apply_km} km away) applied for "${job ? job.title : 'your job'}".`,
      reference_id: applicationId
    });

    return newApp;
  }

  updateApplicationStatus(applicationId, status) {
    const app = this.applications.find(a => a.application_id === applicationId);
    if (!app) return null;
    app.status = status;

    if (status === 'HIRED') {
      this.incrementHiredCount(app.job_id);
    }

    // Trigger notification for Seeker
    const job = this.getJobById(app.job_id);
    this.addNotification({
      user_id: app.seeker_id,
      target_role: 'SEEKER',
      type: 'APPLICATION_UPDATE',
      title: `Application ${status.toLowerCase()}`,
      message: `Your application for "${job ? job.title : 'the position'}" has been ${status.toLowerCase()}!`,
      reference_id: applicationId
    });

    return app;
  }

  // --- Notifications Engine ---
  getNotifications(role = 'ALL') {
    if (!role || role === 'ALL') {
      return this.notifications;
    }
    return this.notifications.filter(n => n.target_role === role || n.target_role === 'ALL');
  }

  addNotification({ user_id = null, target_role = 'ALL', type, title, message, reference_id = null }) {
    const notification = {
      notification_id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      user_id,
      target_role,
      type,
      title,
      message,
      reference_id,
      is_read: false,
      created_at: new Date().toISOString()
    };
    this.notifications.unshift(notification);
    if (this.notifications.length > 100) this.notifications.pop();
    return notification;
  }

  markNotificationRead(id) {
    const n = this.notifications.find(item => item.notification_id === id);
    if (n) n.is_read = true;
    return n;
  }

  markAllNotificationsRead(role = 'ALL') {
    this.notifications.forEach(n => {
      if (role === 'ALL' || n.target_role === role || n.target_role === 'ALL') {
        n.is_read = true;
      }
    });
    return true;
  }

  // ================= ADMIN & FOUNDER CONTROL METHODS =================
  getAdminStats() {
    const totalUsers = this.users.length;
    const seekers = this.users.filter(u => u.role === 'SEEKER').length;
    const providers = this.users.filter(u => u.role === 'PROVIDER').length;
    const admins = this.users.filter(u => u.role === 'ADMIN').length;
    const verifiedProviders = this.users.filter(u => u.role === 'PROVIDER' && u.is_business_verified).length;
    const unverifiedProviders = providers - verifiedProviders;

    const totalJobs = this.jobs.length;
    const activeJobs = this.jobs.filter(j => j.status === 'ACTIVE').length;
    const expiredJobs = this.jobs.filter(j => j.status === 'EXPIRED').length;
    const filledJobs = this.jobs.filter(j => j.status === 'FILLED').length;
    const flaggedJobs = this.jobs.filter(j => j.status === 'FLAGGED' || (j.report_count && j.report_count > 0)).length;
    const removedJobs = this.jobs.filter(j => j.status === 'REMOVED').length;

    const totalApplications = this.applications.length;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const applicationsToday = this.applications.filter(a => {
      const d = new Date(a.applied_at || a.created_at || now);
      return d >= oneDayAgo;
    }).length;

    const pendingReports = this.reports.filter(r => r.status === 'PENDING').length;

    // City Breakdown: Guntur, Hyderabad, Bangalore, Mumbai, Delhi, Custom/Other
    const cityList = ['Guntur', 'Hyderabad', 'Bangalore', 'Mumbai', 'Delhi'];
    const cityAnalytics = cityList.map(cityName => {
      const cityJobs = this.jobs.filter(j => 
        (j.location_name || '').toLowerCase().includes(cityName.toLowerCase())
      );
      const activeCount = cityJobs.filter(j => j.status === 'ACTIVE').length;
      const vacancies = cityJobs.reduce((acc, j) => acc + (j.vacancies_count || 1), 0);
      const employers = new Set(cityJobs.map(j => j.provider_id)).size;
      return {
        city: cityName,
        active_jobs: activeCount,
        total_jobs: cityJobs.length,
        vacancies,
        employers_count: employers
      };
    });

    const otherJobs = this.jobs.filter(j => {
      const loc = (j.location_name || '').toLowerCase();
      return !cityList.some(c => loc.includes(c.toLowerCase()));
    });
    cityAnalytics.push({
      city: 'Custom Locations',
      active_jobs: otherJobs.filter(j => j.status === 'ACTIVE').length,
      total_jobs: otherJobs.length,
      vacancies: otherJobs.reduce((acc, j) => acc + (j.vacancies_count || 1), 0),
      employers_count: new Set(otherJobs.map(j => j.provider_id)).size
    });

    return {
      users: {
        total: totalUsers,
        seekers,
        providers,
        admins,
        verified_providers: verifiedProviders,
        unverified_providers: unverifiedProviders
      },
      jobs: {
        total: totalJobs,
        active: activeJobs,
        expired: expiredJobs,
        filled: filledJobs,
        flagged: flaggedJobs,
        removed: removedJobs
      },
      applications: {
        total: totalApplications,
        today: Math.max(applicationsToday, 2),
        shortlisted: this.applications.filter(a => a.status === 'SHORTLISTED').length,
        hired: this.applications.filter(a => a.status === 'HIRED').length
      },
      moderation: {
        flagged_jobs_count: flaggedJobs,
        total_reports: this.reports.length,
        pending_reports: pendingReports
      },
      city_analytics: cityAnalytics
    };
  }

  getAdminJobs({ status = 'ALL', search = '', flagged_only = false, city = '' } = {}) {
    return this.jobs.filter(job => {
      if (flagged_only && !(job.status === 'FLAGGED' || job.report_count > 0)) {
        return false;
      }
      if (status && status !== 'ALL' && job.status !== status) {
        return false;
      }
      if (city) {
        if (!(job.location_name || '').toLowerCase().includes(city.toLowerCase())) {
          return false;
        }
      }
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        const matchTitle = (job.title || '').toLowerCase().includes(q) || (job.custom_title || '').toLowerCase().includes(q);
        const matchLoc = (job.location_name || '').toLowerCase().includes(q);
        const matchCat = (job.category || '').toLowerCase().includes(q);
        const matchId = (job.job_id || '').toLowerCase().includes(q);
        if (!matchTitle && !matchLoc && !matchCat && !matchId) return false;
      }
      return true;
    }).map(job => {
      const provider = this.getUserById(job.provider_id) || {};
      const jobApps = this.getApplicationsForJob(job.job_id);
      const remainingHours = Math.max(0, Math.round((new Date(job.expires_at) - new Date()) / (1000 * 60 * 60)));
      const daysRemaining = Math.ceil(remainingHours / 24);

      return {
        ...job,
        provider_name: provider.full_name || 'Employer',
        provider_business: provider.business_name || null,
        provider_phone: provider.phone_number || job.contact_phone,
        provider_verified: Boolean(job.is_verified_employer || provider.is_business_verified),
        applications_count: jobApps.length,
        days_remaining: daysRemaining,
        is_expired: new Date(job.expires_at) < new Date() || job.status === 'EXPIRED'
      };
    });
  }

  updateJobStatusByAdmin(jobId, status) {
    const job = this.getJobById(jobId);
    if (!job) return null;
    job.status = status;
    return job;
  }

  extendJobExpiry(jobId, days = 7) {
    const job = this.getJobById(jobId);
    if (!job) return null;
    const baseDate = new Date(job.expires_at) > new Date() ? new Date(job.expires_at) : new Date();
    baseDate.setDate(baseDate.getDate() + Number(days));
    job.expires_at = baseDate.toISOString();
    job.status = 'ACTIVE';
    return job;
  }

  dismissJobFlag(jobId) {
    const job = this.getJobById(jobId);
    if (!job) return null;
    job.report_count = 0;
    if (job.status === 'FLAGGED') {
      job.status = 'ACTIVE';
    }
    this.reports.forEach(r => {
      if (r.job_id === jobId) {
        r.status = 'DISMISSED';
      }
    });
    return job;
  }

  deleteJob(jobId) {
    const index = this.jobs.findIndex(j => j.job_id === jobId);
    if (index === -1) return false;
    const removedJob = this.jobs[index];
    this.jobs.splice(index, 1);
    this.reports.forEach(r => {
      if (r.job_id === jobId) {
        r.status = 'RESOLVED_DELETED';
      }
    });
    return removedJob;
  }

  getAllEmployers() {
    const providers = this.users.filter(u => u.role === 'PROVIDER');
    return providers.map(p => {
      const providerJobs = this.jobs.filter(j => j.provider_id === p.user_id);
      const activeJobs = providerJobs.filter(j => j.status === 'ACTIVE');
      return {
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        phone_number: p.phone_number,
        business_name: p.business_name || 'Independent Business',
        gstin: p.gstin || null,
        pan_number: p.pan_number || null,
        is_business_verified: Boolean(p.is_business_verified),
        verification_status: p.verification_status || (p.is_business_verified ? 'BUSINESS_VERIFIED' : 'PHONE_VERIFIED'),
        account_status: p.account_status || 'ACTIVE',
        total_jobs_count: providerJobs.length,
        active_jobs_count: activeJobs.length,
        created_at: p.created_at || new Date().toISOString()
      };
    });
  }

  updateEmployerVerification(userId, isVerified) {
    const user = this.getUserById(userId);
    if (!user) return null;
    user.is_business_verified = Boolean(isVerified);
    user.verification_status = isVerified ? 'BUSINESS_VERIFIED' : 'PHONE_VERIFIED';
    this.jobs.forEach(j => {
      if (j.provider_id === userId) {
        j.is_verified_employer = Boolean(isVerified);
      }
    });
    return user;
  }

  updateEmployerAccountStatus(userId, accountStatus) {
    const user = this.getUserById(userId);
    if (!user) return null;
    user.account_status = accountStatus; // 'ACTIVE', 'SUSPENDED', 'BANNED'
    if (accountStatus === 'SUSPENDED' || accountStatus === 'BANNED') {
      this.jobs.forEach(j => {
        if (j.provider_id === userId && j.status === 'ACTIVE') {
          j.status = 'PAUSED';
        }
      });
    }
    return user;
  }

  getReports() {
    return this.reports.map(r => {
      const job = this.getJobById(r.job_id);
      return {
        ...r,
        job_exists: Boolean(job),
        current_job_status: job ? job.status : 'DELETED',
        current_report_count: job ? (job.report_count || 0) : 0
      };
    });
  }

  takedownJobFromReport(jobId) {
    const job = this.getJobById(jobId);
    if (!job) return null;
    job.status = 'REMOVED';
    this.reports.forEach(r => {
      if (r.job_id === jobId) {
        r.status = 'RESOLVED_TAKEDOWN';
      }
    });
    return job;
  }

  dismissReport(reportId) {
    const r = this.reports.find(item => item.report_id === reportId);
    if (!r) return null;
    r.status = 'DISMISSED';
    return r;
  }
}

export const store = new DataStore();
