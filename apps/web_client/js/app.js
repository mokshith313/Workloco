import { radarMap } from './map.js';
import { audioController } from './audioSimulator.js';
import { I18N_TRANSLATIONS } from './i18n.js';

// Enhanced Application State (Clean Slate: Guest User by default)
const state = {
  currentRole: 'SEEKER', // 'SEEKER' | 'PROVIDER'
  currentLocation: {
    city: 'Guntur',
    lat: 16.3067,
    lng: 80.4365
  },
  radiusKm: 10,
  searchQuery: '',
  selectedCategory: 'all',
  activeJobs: [],
  selectedJobForApply: null,
  selectedJobForApplicants: null,
  selectedJobForReport: null,
  masterTitles: [],
  recordedAudioUrl: null,
  currentUser: null, // Clean Slate: No pre-logged-in user
  pendingAuthAction: null, // Action to resume after successful authentication
  pendingIntentRole: null, // null until assigned by user role
  preferred_language: 'en',
  notifications: []
};

// Preset Indian Cities
const INDIAN_CITIES = {
  'Guntur': { lat: 16.3067, lng: 80.4365 },
  'Hyderabad': { lat: 17.3850, lng: 78.4867 },
  'Bangalore': { lat: 12.9716, lng: 77.5946 },
  'Bengaluru': { lat: 12.9716, lng: 77.5946 },
  'Mumbai': { lat: 19.0760, lng: 72.8777 },
  'Delhi': { lat: 28.6139, lng: 77.2090 },
  'Delhi-NCR': { lat: 28.6139, lng: 77.2090 },
  'Vijayawada': { lat: 16.5062, lng: 80.6480 },
  'Chennai': { lat: 13.0827, lng: 80.2707 },
  'Pune': { lat: 18.5204, lng: 73.8567 },
  'Kolkata': { lat: 22.5726, lng: 88.3639 },
  'Jaipur': { lat: 26.9124, lng: 75.7873 },
  'Ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'Kochi': { lat: 9.9312, lng: 76.2673 }
};

// Simulated Google Accounts for dynamic modal selection
const GOOGLE_ACCOUNTS = {
  priya: {
    name: 'Priya Patel',
    email: 'priya.patel@gmail.com',
    picture: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80'
  },
  rahul: {
    name: 'Rahul Verma',
    email: 'rahul.verma@gmail.com',
    picture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'
  },
  admin: {
    user_id: 'WorkLoco_founder',
    name: 'Founder Admin (Venkatesh)',
    email: 'admin@workloco.in',
    phone_number: '+91 7993094858',
    picture: null,
    role: 'ADMIN'
  }
};

let selectedGoogleAccountKey = 'priya';
let selectedGoogleRole = 'SEEKER';

// Initialize Application
async function initializeApp() {
  initTheme();
  initUserSession();
  initLanguage();
  radarMap.init();
  setupEventListeners();
  setupAdminConsoleEventListeners();
  await loadMasterTitles();
  await fetchNearbyJobs();
  await fetchNotifications();
  startLifecycleAuditPoller();

  // Initialize Canvas CAPTCHAs
  generateCaptcha('auth-captcha-canvas', 'auth-captcha-input', 'auth-captcha-error');
  generateCaptcha('post-job-captcha-canvas', 'post-job-captcha-input', 'post-job-captcha-error');

  // Unified App Routing (/admin, /profile, etc.)
  checkAppRouting();
  window.addEventListener('popstate', checkAppRouting);
  window.addEventListener('hashchange', checkAppRouting);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Initialize Theme (Dark/Light Mode)
function initTheme() {
  const savedTheme = localStorage.getItem('workloco_theme') || 'light';
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    document.getElementById('theme-light-label')?.classList.remove('active');
    document.getElementById('theme-dark-label')?.classList.add('active');
  } else {
    document.body.removeAttribute('data-theme');
    document.getElementById('theme-dark-label')?.classList.remove('active');
    document.getElementById('theme-light-label')?.classList.add('active');
  }
  localStorage.setItem('workloco_theme', theme);
}

// Visual Canvas CAPTCHA Challenge Engine
const CaptchaEngine = {
  activeCodes: {},

  generate(canvasId, inputId, errorId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width || 130;
    const height = canvas.height || 40;

    // 5-character alphanumeric string (avoid ambiguous characters like 0, O, 1, I, l)
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.activeCodes[canvasId] = code;

    // Reset error & clear input
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
    const inputEl = document.getElementById(inputId);
    if (inputEl) inputEl.value = '';

    // Render background
    ctx.clearRect(0, 0, width, height);
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#F8FAFC');
    bgGrad.addColorStop(1, '#E2E8F0');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw noise lines to block automated bot submissions
    const lineColors = ['#94A3B8', '#CBD5E1', '#FCA5A5', '#93C5FD', '#FCD34D'];
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.lineTo(Math.random() * width, Math.random() * height);
      ctx.strokeStyle = lineColors[i % lineColors.length];
      ctx.lineWidth = 1.2 + Math.random();
      ctx.stroke();
    }

    // Draw noise dots
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * width, Math.random() * height, 1 + Math.random(), 0, Math.PI * 2);
      ctx.fillStyle = lineColors[Math.floor(Math.random() * lineColors.length)];
      ctx.fill();
    }

    // Render 5 distorted alphanumeric characters
    const charColors = ['#0F172A', '#D94A26', '#0284C7', '#059669', '#7C3AED', '#D97706'];
    const charWidth = (width - 24) / 5;
    for (let i = 0; i < 5; i++) {
      ctx.save();
      const ch = code[i];
      const x = 12 + i * charWidth + (Math.random() * 4 - 2);
      const y = height / 2 + (Math.random() * 6 - 3);

      const angle = (Math.random() * 36 - 18) * (Math.PI / 180); // -18 to +18 degrees rotation
      ctx.translate(x, y);
      ctx.rotate(angle);

      ctx.font = `bold ${Math.floor(19 + Math.random() * 4)}px 'Segoe UI', Roboto, sans-serif`;
      ctx.fillStyle = charColors[Math.floor(Math.random() * charColors.length)];
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, 0, 0);

      ctx.restore();
    }
  },

  validate(canvasId, inputId, errorId) {
    const inputEl = document.getElementById(inputId);
    const errorEl = document.getElementById(errorId);
    const expected = this.activeCodes[canvasId];
    const actual = (inputEl?.value || '').trim();

    if (!actual || actual.toLowerCase() !== (expected || '').toLowerCase()) {
      if (errorEl) {
        errorEl.textContent = '❌ Incorrect CAPTCHA code. Please check and try again.';
        errorEl.style.display = 'block';
      }
      this.generate(canvasId, inputId, errorId);
      inputEl?.focus();
      return false;
    }

    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
    return true;
  }
};

function generateCaptcha(canvasId, inputId, errorId) {
  CaptchaEngine.generate(canvasId, inputId, errorId);
}

function validateCaptcha(canvasId, inputId, errorId) {
  return CaptchaEngine.validate(canvasId, inputId, errorId);
}

// Dynamic Internationalization Engine
function applyAppLanguage(lang, persistToBackend = true) {
  if (!I18N_TRANSLATIONS[lang]) lang = 'en';
  state.preferred_language = lang;
  localStorage.setItem('workloco_lang', lang);

  // Sync all language dropdowns
  document.querySelectorAll('.app-language-select, #drawer-language-select, #header-language-select').forEach(sel => {
    if (sel) sel.value = lang;
  });

  const dict = I18N_TRANSLATIONS[lang] || I18N_TRANSLATIONS.en;

  // Translate all [data-i18n]
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  // Translate all [data-i18n-placeholder]
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key]) {
      el.placeholder = dict[key];
    }
  });

  // Specific dynamic text hooks
  const headlineEl = document.querySelector('.radar-headline h2 span');
  if (headlineEl && dict.radar_headline) headlineEl.textContent = `🎯 ${dict.radar_headline}`;

  const subEl = document.querySelector('.radar-headline p');
  if (subEl && dict.radar_sub) subEl.textContent = dict.radar_sub;

  const searchInput = document.getElementById('search-input');
  if (searchInput && dict.search_placeholder) searchInput.placeholder = dict.search_placeholder;

  // Persist to user record in DB if logged in
  if (persistToBackend && state.currentUser && state.currentUser.user_id) {
    state.currentUser.preferred_language = lang;
    localStorage.setItem('workloco_user', JSON.stringify(state.currentUser));
    fetch(`/api/v1/users/${state.currentUser.user_id}/language`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferred_language: lang })
    }).catch(err => console.warn('Language persistence error:', err));
  }

  showToast(`🌐 Language: ${dict.language || lang.toUpperCase()}`);
}

function initLanguage() {
  const savedLang = localStorage.getItem('workloco_lang') || state.currentUser?.preferred_language || 'en';
  applyAppLanguage(savedLang, false);
}

// 1. CLEAN SLATE: Initialize User Session (Defaults to unauthenticated Guest User)
function initUserSession() {
  try {
    const saved = localStorage.getItem('workloco_user');
    if (saved) {
      state.currentUser = JSON.parse(saved);
    } else {
      state.currentUser = null; // Clean slate: no default user
    }
  } catch (e) {
    state.currentUser = null;
  }
  updateUserHeaderUI();
}

// Update Header & Drawer UI for Authenticated vs Guest State
function updateUserHeaderUI() {
  const user = state.currentUser;
  const userBtnLabel = document.getElementById('header-user-label');
  const userBtnAvatar = document.getElementById('header-user-avatar');
  const drawerName = document.getElementById('drawer-user-name');
  const drawerPhone = document.getElementById('drawer-user-phone');
  const drawerAvatar = document.getElementById('drawer-user-avatar');
  const drawerBadge = document.getElementById('drawer-user-badge');
  const drawerAuthBtn = document.getElementById('drawer-auth-btn');
  const drawerSignoutItem = document.getElementById('drawer-item-signout');

  if (user) {
    // Logged in state
    const initials = user.full_name
      ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      : 'U';
    if (userBtnLabel) userBtnLabel.textContent = user.full_name.split(' ')[0];
    if (userBtnAvatar) userBtnAvatar.textContent = initials;
    if (drawerName) drawerName.textContent = user.full_name;
    if (drawerPhone) drawerPhone.textContent = user.phone_number || user.email;
    if (drawerAvatar) drawerAvatar.textContent = initials;

    if (drawerBadge) {
      drawerBadge.style.display = 'inline-flex';
      if (user.role === 'ADMIN') {
        drawerBadge.className = 'badge-employer-verified';
        drawerBadge.style.background = 'var(--primary)';
        drawerBadge.style.color = '#fff';
        drawerBadge.innerHTML = '⚡ Founder Admin';
      } else if (user.is_business_verified) {
        drawerBadge.className = 'badge-employer-verified';
        drawerBadge.innerHTML = '🛡️ Verified Business';
      } else if (user.is_phone_verified) {
        drawerBadge.className = 'badge-employer-verified';
        drawerBadge.innerHTML = '✓ Phone Verified';
      } else {
        drawerBadge.className = 'badge-employer-unverified';
        drawerBadge.innerHTML = '⚠️ Unverified';
      }
    }

    const drawerAdminItem = document.getElementById('drawer-item-admin');
    if (drawerAdminItem) {
      drawerAdminItem.style.display = user.role === 'ADMIN' ? 'flex' : 'none';
    }

    if (drawerAuthBtn) {
      drawerAuthBtn.textContent = '🚪 Sign Out';
      drawerAuthBtn.style.background = '#FEE2E2';
      drawerAuthBtn.style.color = '#991B1B';
    }

    if (drawerSignoutItem) {
      drawerSignoutItem.style.display = 'flex';
      const badge = document.getElementById('drawer-signout-badge');
      if (badge) badge.textContent = 'Log Out';
    }
  } else {
    // Unauthenticated Guest State
    if (userBtnLabel) userBtnLabel.textContent = 'Sign In';
    if (userBtnAvatar) userBtnAvatar.textContent = '?';
    if (drawerName) drawerName.textContent = 'Guest User';
    if (drawerPhone) drawerPhone.textContent = 'Not signed in';
    if (drawerAvatar) drawerAvatar.textContent = '?';
    if (drawerBadge) drawerBadge.style.display = 'none';

    const drawerAdminItem = document.getElementById('drawer-item-admin');
    if (drawerAdminItem) {
      drawerAdminItem.style.display = 'none';
    }

    if (drawerAuthBtn) {
      drawerAuthBtn.textContent = 'Sign In / Register';
      drawerAuthBtn.style.background = 'var(--primary)';
      drawerAuthBtn.style.color = 'white';
    }

    if (drawerSignoutItem) {
      // Ensure the last menu item inside top-left "W" drawer is always "Sign Out"
      drawerSignoutItem.style.display = 'flex';
      const badge = document.getElementById('drawer-signout-badge');
      if (badge) badge.textContent = 'Guest';
    }
  }

  // Header Quick Access: Founder / Admin Console button (visible if role === 'ADMIN')
  const headerAdminBtn = document.getElementById('header-admin-btn');
  if (headerAdminBtn) {
    headerAdminBtn.style.display = (user && user.role === 'ADMIN') ? 'inline-flex' : 'none';
  }

  // Synchronize Role Switcher Selects in W Drawer and Settings Modal
  const currentRole = user ? user.role : 'GUEST';
  const devSelect = document.getElementById('dev-role-switcher-select');
  const settingsSelect = document.getElementById('settings-role-switcher-select');
  if (devSelect) devSelect.value = currentRole;
  if (settingsSelect) settingsSelect.value = currentRole;
}

// 2. AUTH GUARD: Protects Actions Requiring Authentication
function requireAuth(actionCallback, contextMessage = 'Please sign in to continue') {
  if (state.currentUser) {
    actionCallback();
  } else {
    state.pendingAuthAction = actionCallback;
    const banner = document.getElementById('auth-context-banner');
    if (banner) {
      banner.textContent = `🔒 ${contextMessage}`;
      banner.style.display = 'block';
    }
    openAuthModal('LOGIN');
  }
}

// 3. WORKING SIGN-OUT FUNCTIONALITY
function handleSignOut() {
  // 1. Clear all active session tokens, user objects, and JWTs from localStorage/sessionStorage
  localStorage.removeItem('workloco_user');
  localStorage.removeItem('workloco_token');
  localStorage.removeItem('token');
  localStorage.removeItem('authToken');
  localStorage.removeItem('jwt');
  localStorage.removeItem('session_token');
  sessionStorage.clear();

  // 2. Reset app state back to the unauthenticated Guest state
  state.currentUser = null;
  state.pendingAuthAction = null;
  updateUserHeaderUI();
  toggleSidebarDrawer(false);
  closeProfileModal();
  exitAdminDashboard();

  // 3. Display a "Signed out successfully" message and redirect to the public Landing Page
  if (window.location.pathname !== '/' || window.location.hash) {
    history.pushState(null, '', '/');
  }
  resetToBrandHome();
  showToast('Signed out successfully', 'success');
}

// Setup All DOM Event Listeners
function setupEventListeners() {
  // 1. BRAND HOME RESET: Clicking "WorkLoco" header text clears search & returns to Home
  const brandLogo = document.getElementById('brand-home-logo');
  brandLogo?.addEventListener('click', () => {
    resetToBrandHome();
  });

  // 2. TOP-LEFT "W" MENU DRAWER TRIGGER (Mobile & Desktop)
  const wDrawerBtn = document.getElementById('header-w-drawer-toggle');
  if (wDrawerBtn) {
    const handleDrawerOpen = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      toggleSidebarDrawer();
    };
    wDrawerBtn.addEventListener('click', handleDrawerOpen);
    wDrawerBtn.addEventListener('touchstart', handleDrawerOpen, { passive: false });
    wDrawerBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleDrawerOpen(e);
      }
    });
  }

  document.getElementById('sidebar-close-btn')?.addEventListener('click', () => toggleSidebarDrawer(false));

  const sidebarOverlay = document.getElementById('sidebar-drawer-overlay');
  sidebarOverlay?.addEventListener('click', (e) => {
    if (e.target === sidebarOverlay) {
      toggleSidebarDrawer(false);
    }
  });

  // Drawer Menu Items with Auth Guard on Profile
  // 1. My Profile
  document.getElementById('drawer-item-profile')?.addEventListener('click', () => {
    toggleSidebarDrawer(false);
    if (state.currentUser) {
      history.pushState(null, '', '/profile');
      openProfileModal();
    } else {
      requireAuth(() => {
        history.pushState(null, '', '/profile');
        openProfileModal();
      }, 'Sign in to access your profile details');
    }
  });

  // 2. Settings (Language, Theme, Notifications)
  document.getElementById('drawer-item-settings')?.addEventListener('click', () => {
    toggleSidebarDrawer(false);
    openSettingsModal();
  });

  // Settings Modal Controls
  document.getElementById('settings-modal-close')?.addEventListener('click', closeSettingsModal);
  document.getElementById('settings-modal-save-btn')?.addEventListener('click', () => {
    const langSelect = document.getElementById('settings-language-select');
    if (langSelect && langSelect.value !== state.preferred_language) {
      applyAppLanguage(langSelect.value);
    }
    const notifRadar = document.getElementById('notif-pref-radar')?.checked ?? true;
    const notifStatus = document.getElementById('notif-pref-status')?.checked ?? true;
    const notifWhatsApp = document.getElementById('notif-pref-whatsapp')?.checked ?? true;
    localStorage.setItem('workloco_notif_prefs', JSON.stringify({ radar: notifRadar, status: notifStatus, whatsapp: notifWhatsApp }));
    closeSettingsModal();
    showToast('⚙️ Settings & preferences saved successfully!', 'success');
  });

  const settingsThemeToggle = document.getElementById('settings-theme-toggle');
  settingsThemeToggle?.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    applyTheme(isDark ? 'light' : 'dark');
    updateSettingsThemeLabels(!isDark);
  });

  document.getElementById('settings-language-select')?.addEventListener('change', (e) => {
    applyAppLanguage(e.target.value);
  });

  // 3. Help & Support
  document.getElementById('drawer-item-support')?.addEventListener('click', () => {
    toggleSidebarDrawer(false);
    window.open('https://wa.me/919848012345?text=Hi%20WorkLoco%20Support%2C%20I%20need%20assistance.', '_blank');
  });

  // 4. About WorkLoco
  document.getElementById('drawer-item-about')?.addEventListener('click', () => {
    toggleSidebarDrawer(false);
    alert('🇮🇳 WorkLoco v2.0 - Hyperlocal & Nationwide Job Platform\n\nDirect, scam-free discovery connecting job seekers and neighborhood employers with PostGIS spatial precision and Redis BullMQ lifecycle engine.');
  });

  // 5. Feedback
  document.getElementById('drawer-item-feedback')?.addEventListener('click', () => {
    toggleSidebarDrawer(false);
    openFeedbackModal();
  });

  // Feedback Modal Controls
  document.getElementById('feedback-modal-close')?.addEventListener('click', closeFeedbackModal);
  setupFeedbackStars();
  document.getElementById('feedback-modal-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = document.getElementById('feedback-message')?.value;
    const cat = document.getElementById('feedback-category')?.value;
    console.log('[Feedback]', { category: cat, message: msg });
    closeFeedbackModal();
    showToast('⭐ Thank you for your feedback! Your inputs make WorkLoco better.', 'success');
    e.target.reset();
  });

  // 6. Security & Privacy
  document.getElementById('drawer-item-security')?.addEventListener('click', () => {
    toggleSidebarDrawer(false);
    openSecurityModal();
  });
  document.getElementById('security-modal-close')?.addEventListener('click', closeSecurityModal);
  document.getElementById('security-modal-done-btn')?.addEventListener('click', closeSecurityModal);

  // Profile Modal Controls
  document.getElementById('profile-modal-close')?.addEventListener('click', closeProfileModal);
  document.getElementById('profile-modal-done-btn')?.addEventListener('click', closeProfileModal);
  document.getElementById('profile-signout-btn')?.addEventListener('click', handleSignOut);
  document.getElementById('btn-toggle-edit-profile')?.addEventListener('click', () => toggleEditProfileForm(true));
  document.getElementById('btn-cancel-edit-profile')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleEditProfileForm(false);
  });
  document.getElementById('profile-edit-form')?.addEventListener('submit', handleProfileSave);
  document.getElementById('btn-save-profile')?.addEventListener('click', (e) => {
    const form = document.getElementById('profile-edit-form');
    if (form && !form.checkValidity()) {
      form.reportValidity();
      return;
    }
    handleProfileSave(e);
  });

  // Dynamic role fields switch in edit profile form
  document.getElementById('edit-profile-role')?.addEventListener('change', (e) => {
    const role = e.target.value;
    const seekerBox = document.getElementById('edit-profile-seeker-fields');
    const providerBox = document.getElementById('edit-profile-provider-fields');
    if (role === 'PROVIDER') {
      if (seekerBox) seekerBox.style.display = 'none';
      if (providerBox) providerBox.style.display = 'block';
    } else if (role === 'ADMIN') {
      if (seekerBox) seekerBox.style.display = 'block';
      if (providerBox) providerBox.style.display = 'block';
    } else {
      if (seekerBox) seekerBox.style.display = 'block';
      if (providerBox) providerBox.style.display = 'none';
    }
  });

  // Language Selector Listener in Top Navigation
  document.getElementById('header-language-select')?.addEventListener('change', (e) => {
    applyAppLanguage(e.target.value);
  });

  // Security CAPTCHA Refresh Handlers
  document.getElementById('auth-captcha-refresh')?.addEventListener('click', () => {
    generateCaptcha('auth-captcha-canvas', 'auth-captcha-input', 'auth-captcha-error');
  });
  document.getElementById('auth-captcha-canvas')?.addEventListener('click', () => {
    generateCaptcha('auth-captcha-canvas', 'auth-captcha-input', 'auth-captcha-error');
  });
  document.getElementById('post-job-captcha-refresh')?.addEventListener('click', () => {
    generateCaptcha('post-job-captcha-canvas', 'post-job-captcha-input', 'post-job-captcha-error');
  });
  document.getElementById('post-job-captcha-canvas')?.addEventListener('click', () => {
    generateCaptcha('post-job-captcha-canvas', 'post-job-captcha-input', 'post-job-captcha-error');
  });

  // Dedicated Sign Out button inside drawer list
  document.getElementById('drawer-item-signout')?.addEventListener('click', () => {
    handleSignOut();
  });

  // Drawer Footer Button: Sign In when guest, Sign Out when logged in
  document.getElementById('drawer-auth-btn')?.addEventListener('click', () => {
    if (state.currentUser) {
      handleSignOut();
    } else {
      toggleSidebarDrawer(false);
      openAuthModal('LOGIN');
    }
  });

  // User Header Button (Opens Profile Modal when authenticated, or Auth Modal when guest)
  document.getElementById('header-user-btn')?.addEventListener('click', () => {
    if (!state.currentUser) {
      openAuthModal('LOGIN');
    } else {
      history.pushState(null, '', '/profile');
      openProfileModal();
    }
  });

  // 3. NOTIFICATION SYSTEM
  const notifBellBtn = document.getElementById('notif-bell-btn');
  const notifPanel = document.getElementById('notifications-panel');
  notifBellBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    notifPanel?.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (notifPanel && !notifPanel.contains(e.target) && e.target !== notifBellBtn) {
      notifPanel.classList.remove('open');
    }
  });

  document.getElementById('btn-mark-all-read')?.addEventListener('click', handleMarkAllNotificationsRead);
  document.getElementById('notif-refresh-btn')?.addEventListener('click', fetchNotifications);

  // Role Switcher
  const btnSeeker = document.getElementById('role-seeker-btn');
  const btnProvider = document.getElementById('role-provider-btn');
  const btnPostJobHeader = document.getElementById('header-post-job-btn');

  btnSeeker?.addEventListener('click', () => setRole('SEEKER'));
  btnProvider?.addEventListener('click', () => {
    requireAuth(() => setRole('PROVIDER'), 'Please sign in as an Employer to view the hiring dashboard');
  });

  // Post Job Header Action protected by Auth Guard
  btnPostJobHeader?.addEventListener('click', () => {
    requireAuth(() => {
      setRole('PROVIDER');
      handleInitiatePostJob();
    }, 'Please sign in to post a new job position');
  });

  // 4. DYNAMIC LOCATION & GPS ENHANCEMENTS
  const citySelect = document.getElementById('city-quick-select');
  const customCityInput = document.getElementById('custom-city-input');
  const btnLiveGps = document.getElementById('btn-live-gps');

  citySelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      customCityInput?.classList.add('active');
      customCityInput?.focus();
    } else {
      customCityInput?.classList.remove('active');
      if (INDIAN_CITIES[val]) {
        state.currentLocation = {
          city: val,
          ...INDIAN_CITIES[val]
        };
        radarMap.setCenter(state.currentLocation.lat, state.currentLocation.lng);
        fetchNearbyJobs();
      }
    }
  });

  customCityInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleManualCitySearch(customCityInput.value.trim());
    }
  });

  customCityInput?.addEventListener('blur', () => {
    if (customCityInput.value.trim()) {
      handleManualCitySearch(customCityInput.value.trim());
    }
  });

  btnLiveGps?.addEventListener('click', getUserCurrentLocation);

  // Radius Slider
  const slider = document.getElementById('radius-slider');
  const radiusValueLabel = document.getElementById('radius-display-value');

  slider?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    state.radiusKm = val;
    if (radiusValueLabel) radiusValueLabel.textContent = val >= 100 ? 'All India' : `${val} km`;
    radarMap.updateRadarCircle(val);
  });

  slider?.addEventListener('change', () => {
    fetchNearbyJobs();
  });

  // Hybrid Search & Autocomplete
  const searchInput = document.getElementById('job-search-input');
  const searchBtn = document.getElementById('job-search-btn');
  const dropdown = document.getElementById('autocomplete-dropdown');

  searchInput?.addEventListener('input', (e) => {
    handleSearchInput(e.target.value);
  });

  searchInput?.addEventListener('focus', (e) => {
    if (e.target.value.trim().length > 0) {
      handleSearchInput(e.target.value);
    }
  });

  searchBtn?.addEventListener('click', () => {
    state.searchQuery = searchInput.value.trim();
    dropdown?.classList.remove('open');
    fetchNearbyJobs();
  });

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      state.searchQuery = searchInput.value.trim();
      dropdown?.classList.remove('open');
      fetchNearbyJobs();
    }
  });

  document.addEventListener('click', (e) => {
    if (dropdown && searchInput && !searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  // Category Filter Chips
  const chipContainer = document.getElementById('category-chips');
  chipContainer?.addEventListener('click', (e) => {
    if (e.target.classList.contains('chip-btn')) {
      document.querySelectorAll('.chip-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      state.selectedCategory = e.target.getAttribute('data-category');
      fetchNearbyJobs();
    }
  });

  // Authentication Modals Listeners
  setupAuthModalListeners();
  setupGoogleAccountModalListeners();

  // Post-Login Intent Choices (Only shown to brand-new unassigned users)
  document.getElementById('intent-choice-seeker')?.addEventListener('click', () => {
    closeIntentModal();
    if (state.currentUser && !state.currentUser.role) {
      state.currentUser.role = 'SEEKER';
      localStorage.setItem('workloco_user', JSON.stringify(state.currentUser));
      updateUserHeaderUI();
    }
    setRole('SEEKER');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (state.pendingAuthAction) {
      const act = state.pendingAuthAction;
      state.pendingAuthAction = null;
      act();
    }
  });

  document.getElementById('intent-choice-provider')?.addEventListener('click', () => {
    closeIntentModal();
    if (state.currentUser && !state.currentUser.role) {
      state.currentUser.role = 'PROVIDER';
      localStorage.setItem('workloco_user', JSON.stringify(state.currentUser));
      updateUserHeaderUI();
    }
    setRole('PROVIDER');
    handleInitiatePostJob();
  });

  // 2-Step Employer Verification Guard Listeners
  document.getElementById('employer-verify-close')?.addEventListener('click', closeEmployerVerificationModal);
  document.getElementById('employer-verification-form')?.addEventListener('submit', handleEmployerVerificationSubmit);

  // Scam Reporting Listeners
  document.getElementById('report-job-close')?.addEventListener('click', closeReportModal);
  document.getElementById('report-job-form')?.addEventListener('submit', handleReportSubmit);

  // Apply Modal Handlers
  document.getElementById('apply-modal-close')?.addEventListener('click', closeApplyModal);
  document.getElementById('quick-apply-form')?.addEventListener('submit', handleApplySubmit);
  document.getElementById('btn-record-audio')?.addEventListener('click', handleRecordAudioToggle);

  // Post Job Wizard Modal Handlers
  document.getElementById('post-modal-close')?.addEventListener('click', closePostJobModal);
  document.getElementById('create-job-form')?.addEventListener('submit', handleCreateJobSubmit);
  document.getElementById('btn-ai-generate')?.addEventListener('click', handleAiJobDescriptionGeneration);

  // Applicants Modal Handlers
  document.getElementById('applicants-modal-close')?.addEventListener('click', closeApplicantsModal);
}

// Brand Home Reset Function
function resetToBrandHome() {
  state.searchQuery = '';
  state.selectedCategory = 'all';
  state.radiusKm = 10;
  state.currentLocation = { city: 'Guntur', ...INDIAN_CITIES['Guntur'] };

  const searchInput = document.getElementById('job-search-input');
  if (searchInput) searchInput.value = '';

  const slider = document.getElementById('radius-slider');
  if (slider) slider.value = 10;

  const radiusLabel = document.getElementById('radius-display-value');
  if (radiusLabel) radiusLabel.textContent = '10 km';

  const citySelect = document.getElementById('city-quick-select');
  if (citySelect) citySelect.value = 'Guntur';

  document.getElementById('custom-city-input')?.classList.remove('active');

  document.querySelectorAll('.chip-btn').forEach((btn, idx) => {
    if (idx === 0) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  setRole('SEEKER');
  radarMap.setCenter(state.currentLocation.lat, state.currentLocation.lng);
  radarMap.updateRadarCircle(10);
  fetchNearbyJobs();
}

function toggleSidebarDrawer(open = null) {
  const overlay = document.getElementById('sidebar-drawer-overlay');
  if (!overlay) return;
  const isCurrentlyOpen = overlay.classList.contains('open');
  const shouldOpen = (open !== null) ? Boolean(open) : !isCurrentlyOpen;

  if (shouldOpen) {
    updateUserHeaderUI();
    overlay.classList.add('open');
  } else {
    overlay.classList.remove('open');
  }
}

// Manual City Search / Geocoding
function handleManualCitySearch(cityName) {
  if (!cityName) return;

  const foundKey = Object.keys(INDIAN_CITIES).find(k => k.toLowerCase() === cityName.toLowerCase());
  if (foundKey) {
    state.currentLocation = {
      city: foundKey,
      ...INDIAN_CITIES[foundKey]
    };
    radarMap.setCenter(state.currentLocation.lat, state.currentLocation.lng);
    fetchNearbyJobs();
    alert(`📍 Located: ${foundKey}. Proximity radar updated.`);
  } else {
    const hash = cityName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const pseudoLat = 15.0 + (hash % 1200) / 100;
    const pseudoLng = 75.0 + (hash % 1000) / 100;

    state.currentLocation = {
      city: cityName,
      lat: pseudoLat,
      lng: pseudoLng
    };
    radarMap.setCenter(state.currentLocation.lat, state.currentLocation.lng);
    fetchNearbyJobs();
    alert(`📍 Mapped location: "${cityName}" (${pseudoLat.toFixed(4)}, ${pseudoLng.toFixed(4)}). Radar active.`);
  }
}

// Live GPS Geo-location
function getUserCurrentLocation() {
  if ('geolocation' in navigator) {
    const btn = document.getElementById('btn-live-gps');
    if (btn) btn.textContent = '📡 Acquiring GPS...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (btn) btn.textContent = '📍 GPS Active';
        state.currentLocation = {
          city: 'Current GPS Location',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        radarMap.setCenter(state.currentLocation.lat, state.currentLocation.lng);
        fetchNearbyJobs();
        alert(`🎯 Live GPS coordinates acquired!\nLat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}\n\nProximity radar recalculated.`);
      },
      (err) => {
        if (btn) btn.textContent = '📍 Use Current Location';
        alert('Could not acquire GPS permission. Defaulting to Guntur.');
      },
      { timeout: 8000 }
    );
  } else {
    alert('Geolocation is not supported by your browser.');
  }
}

// Dynamic Simulated Authentication Modal Setup (Section 3)
function setupAuthModalListeners() {
  document.getElementById('auth-modal-close')?.addEventListener('click', closeAuthModal);

  const tabOtp = document.getElementById('tab-auth-otp');
  const tabEmail = document.getElementById('tab-auth-email');
  const viewOtp = document.getElementById('auth-view-otp');
  const viewEmail = document.getElementById('auth-view-email');

  tabOtp?.addEventListener('click', () => {
    tabOtp.classList.add('active');
    tabEmail?.classList.remove('active');
    if (viewOtp) viewOtp.style.display = 'block';
    if (viewEmail) viewEmail.style.display = 'none';
  });

  tabEmail?.addEventListener('click', () => {
    tabEmail.classList.add('active');
    tabOtp?.classList.remove('active');
    if (viewEmail) viewEmail.style.display = 'block';
    if (viewOtp) viewOtp.style.display = 'none';
  });

  // Toggle Login vs Sign Up
  document.getElementById('auth-toggle-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    const isSignup = document.getElementById('auth-modal-title').textContent.includes('Sign In');
    document.getElementById('auth-modal-title').textContent = isSignup ? 'Create WorkLoco Account' : 'Sign In to WorkLoco';
    document.getElementById('auth-toggle-btn').textContent = isSignup ? 'Sign In instead' : 'Create an account';
  });

  // 1. Mobile Phone OTP Send (Requires actual phone input + CAPTCHA verification)
  document.getElementById('form-auth-otp-send')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Security Canvas CAPTCHA Verification Guard
    if (!validateCaptcha('auth-captcha-canvas', 'auth-captcha-input', 'auth-captcha-error')) {
      return;
    }

    const phone = document.getElementById('auth-phone-input').value.trim();
    if (!phone) {
      alert('Please enter your mobile phone number.');
      return;
    }

    try {
      const res = await fetch('/api/v1/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone })
      });
      const data = await res.json();
      if (data.success) {
        const banner = document.getElementById('auth-otp-sent-banner');
        if (banner) {
          banner.innerHTML = `<strong>📱 ${data.message}</strong><br/><span>Active Verification Code: <strong style="font-size: 1.1rem; color: #047857; letter-spacing: 0.1em;">${data.demo_otp}</strong> (Expires in 5 minutes).</span>`;
          banner.style.display = 'block';
        }
        document.getElementById('auth-otp-input')?.focus();
      }
    } catch (err) {
      console.error('OTP send failed:', err);
    }
  });

  // 2. Mobile Phone OTP Verify (Strict active code comparison)
  document.getElementById('form-auth-otp-verify')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('auth-phone-input').value.trim();
    const otp = document.getElementById('auth-otp-input').value.trim();
    const fullName = document.getElementById('auth-name-input')?.value.trim();

    if (!phone) {
      alert('Please enter your phone number first and request an OTP.');
      return;
    }
    if (!otp || otp.length < 6) {
      alert('Please enter a valid 6-digit OTP code.');
      return;
    }

    try {
      const res = await fetch('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phone,
          otp,
          intent_role: state.pendingIntentRole,
          full_name: fullName
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        handleAuthSuccess(data.user);
      } else {
        showToast(`❌ ${data.error || 'Invalid OTP code. Please check and try again.'}`, 'alert');
        const otpInp = document.getElementById('auth-otp-input');
        if (otpInp) {
          otpInp.value = '';
          otpInp.focus();
        }
      }
    } catch (err) {
      console.error('OTP verify failed:', err);
      showToast('OTP verification failed. Please try again.', 'alert');
    }
  });

  // 3. Email Login / Magic Link (Protected by CAPTCHA)
  document.getElementById('form-auth-email')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateCaptcha('auth-captcha-canvas', 'auth-captcha-input', 'auth-captcha-error')) {
      return;
    }

    const email = document.getElementById('auth-email-input').value.trim();
    const password = document.getElementById('auth-password-input').value;
    const fullName = document.getElementById('auth-name-input')?.value.trim();

    if (!email) {
      alert('Please enter your email address.');
      return;
    }

    try {
      const res = await fetch('/api/v1/auth/login-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          intent_role: state.pendingIntentRole,
          full_name: fullName
        })
      });
      const data = await res.json();
      if (data.success) {
        handleAuthSuccess(data.user);
      } else {
        showToast(data.error || 'Login failed.', 'alert');
      }
    } catch (err) {
      console.error('Email login failed:', err);
    }
  });

  document.getElementById('btn-magic-link')?.addEventListener('click', async () => {
    if (!validateCaptcha('auth-captcha-canvas', 'auth-captcha-input', 'auth-captcha-error')) {
      return;
    }

    const email = document.getElementById('auth-email-input').value.trim();
    const fullName = document.getElementById('auth-name-input')?.value.trim();
    if (!email) {
      alert('Please enter your email for passwordless magic link sign-in.');
      return;
    }
    const res = await fetch('/api/v1/auth/login-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        is_magic_link: true,
        intent_role: state.pendingIntentRole,
        full_name: fullName
      })
    });
    const data = await res.json();
    if (data.success) {
      alert('🪄 Magic Link verified! Signing you in.');
      handleAuthSuccess(data.user);
    }
  });

  // 4. Continue with Google Trigger: Opens Google Account Selection Modal (Protected by CAPTCHA)
  document.getElementById('btn-google-login')?.addEventListener('click', () => {
    if (!validateCaptcha('auth-captcha-canvas', 'auth-captcha-input', 'auth-captcha-error')) {
      return;
    }
    closeAuthModal();
    openGoogleAccountModal();
  });
}

// Dedicated Google Account Selection Modal (Section 3.2)
function setupGoogleAccountModalListeners() {
  document.getElementById('google-modal-close')?.addEventListener('click', closeGoogleAccountModal);

  const accBoxes = document.querySelectorAll('.google-account-radio-box');
  accBoxes.forEach(box => {
    box.addEventListener('click', () => {
      accBoxes.forEach(b => {
        b.classList.remove('active');
        const chk = b.querySelector('.g-check');
        if (chk) chk.style.display = 'none';
      });
      box.classList.add('active');
      const activeChk = box.querySelector('.g-check');
      if (activeChk) activeChk.style.display = 'inline';

      const input = box.querySelector('input[name="google_acc_select"]');
      if (input) {
        selectedGoogleAccountKey = input.value;
        const customInputs = document.getElementById('google-custom-inputs');
        if (selectedGoogleAccountKey === 'custom') {
          if (customInputs) customInputs.style.display = 'block';
          document.getElementById('btn-confirm-google-auth').textContent = 'Continue with Custom Account';
        } else {
          if (customInputs) customInputs.style.display = 'none';
          const acc = GOOGLE_ACCOUNTS[selectedGoogleAccountKey];
          document.getElementById('btn-confirm-google-auth').textContent = `Continue as ${acc.name}`;

          if (selectedGoogleAccountKey === 'admin') {
            const roleAdmin = document.getElementById('g-role-admin');
            const roleSeeker = document.getElementById('g-role-seeker');
            const roleProvider = document.getElementById('g-role-provider');
            roleAdmin?.classList.add('active');
            roleSeeker?.classList.remove('active');
            roleProvider?.classList.remove('active');
            selectedGoogleRole = 'ADMIN';
          }
        }
      }
    });
  });

  // Role boxes in Google Modal
  const roleSeeker = document.getElementById('g-role-seeker');
  const roleProvider = document.getElementById('g-role-provider');
  const roleAdmin = document.getElementById('g-role-admin');

  roleSeeker?.addEventListener('click', () => {
    roleSeeker.classList.add('active');
    roleProvider?.classList.remove('active');
    roleAdmin?.classList.remove('active');
    selectedGoogleRole = 'SEEKER';
  });

  roleProvider?.addEventListener('click', () => {
    roleProvider.classList.add('active');
    roleSeeker?.classList.remove('active');
    roleAdmin?.classList.remove('active');
    selectedGoogleRole = 'PROVIDER';
  });

  roleAdmin?.addEventListener('click', () => {
    roleAdmin.classList.add('active');
    roleSeeker?.classList.remove('active');
    roleProvider?.classList.remove('active');
    selectedGoogleRole = 'ADMIN';
  });

  // Confirm Google Sign-In
  document.getElementById('btn-confirm-google-auth')?.addEventListener('click', async () => {
    let profile = null;

    if (selectedGoogleAccountKey === 'custom') {
      const customName = document.getElementById('g-custom-name').value.trim() || 'Custom Google User';
      const customEmail = document.getElementById('g-custom-email').value.trim() || 'custom.user@gmail.com';
      profile = {
        name: customName,
        email: customEmail,
        role: selectedGoogleRole
      };
    } else {
      const preset = GOOGLE_ACCOUNTS[selectedGoogleAccountKey];
      profile = {
        user_id: preset.user_id,
        name: preset.name,
        email: preset.email,
        phone_number: preset.phone_number,
        picture: preset.picture,
        role: selectedGoogleRole
      };
    }

    try {
      const res = await fetch('/api/v1/auth/oauth-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_profile: profile,
          intent_role: selectedGoogleRole
        })
      });
      const data = await res.json();
      if (data.success) {
        closeGoogleAccountModal();
        handleAuthSuccess(data.user);
      }
    } catch (err) {
      console.error('Google OAuth failed:', err);
    }
  });
}

function openGoogleAccountModal() {
  document.getElementById('google-account-modal')?.classList.add('open');
}

function closeGoogleAccountModal() {
  document.getElementById('google-account-modal')?.classList.remove('open');
}

function openAuthModal(mode = 'LOGIN') {
  document.getElementById('auth-modal')?.classList.add('open');
  generateCaptcha('auth-captcha-canvas', 'auth-captcha-input', 'auth-captcha-error');
}

function closeAuthModal() {
  document.getElementById('auth-modal')?.classList.remove('open');
  const banner = document.getElementById('auth-context-banner');
  if (banner) banner.style.display = 'none';
}

function handleAuthSuccess(user) {
  state.currentUser = user;
  localStorage.setItem('workloco_user', JSON.stringify(user));
  updateUserHeaderUI();
  closeAuthModal();

  // 1. ROLE-BASED INTENT REDIRECTION (POST-LOGIN GUARD)
  const role = user ? user.role : null;

  // Case a: role === 'ADMIN' -> Bypass Intent modal, route straight to Founder Admin Dashboard (/admin)
  if (role === 'ADMIN') {
    closeIntentModal();
    state.currentRole = 'ADMIN';
    state.pendingAuthAction = null;
    showToast(`👑 Welcome, Founder Admin (${user.full_name || 'Admin'})! Routing directly to Admin Console...`, 'success');
    openAdminDashboard();
    return;
  }

  // Case b: role === 'SEEKER' -> Route directly to Job Discovery Radar & Spatial Search view
  if (role === 'SEEKER') {
    closeIntentModal();
    setRole('SEEKER');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`🎯 Welcome back, ${user.full_name || 'Job Seeker'}! Routing to Job Discovery Radar.`);
    if (state.pendingAuthAction) {
      const action = state.pendingAuthAction;
      state.pendingAuthAction = null;
      action();
    }
    return;
  }

  // Case c: role === 'PROVIDER' -> Route directly to Employer Dashboard & Job Posting Wizard
  if (role === 'PROVIDER') {
    closeIntentModal();
    setRole('PROVIDER');
    showToast(`💼 Welcome back, ${user.full_name || 'Employer'}! Routing to Employer Dashboard.`);
    if (state.pendingAuthAction) {
      const action = state.pendingAuthAction;
      state.pendingAuthAction = null;
      action();
    }
    return;
  }

  // Case d: ONLY IF role is undefined or null (brand-new unassigned user)
  // Show Intent Selection Modal to assign their initial role
  openIntentModal();
}

// Post-Login Intent Modal
function openIntentModal() {
  document.getElementById('intent-modal')?.classList.add('open');
}

function closeIntentModal() {
  document.getElementById('intent-modal')?.classList.remove('open');
}

// ============================================================
// MODAL CONTROLLERS: SETTINGS, FEEDBACK, SECURITY
// ============================================================
function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  const langSelect = document.getElementById('settings-language-select');
  if (langSelect) {
    langSelect.value = state.currentUser?.preferred_language || state.preferred_language || 'en';
  }
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  updateSettingsThemeLabels(isDark);
  try {
    const rawPrefs = localStorage.getItem('workloco_notif_prefs');
    if (rawPrefs) {
      const prefs = JSON.parse(rawPrefs);
      const r = document.getElementById('notif-pref-radar');
      const s = document.getElementById('notif-pref-status');
      const w = document.getElementById('notif-pref-whatsapp');
      if (r) r.checked = prefs.radar ?? true;
      if (s) s.checked = prefs.status ?? true;
      if (w) w.checked = prefs.whatsapp ?? true;
    }
  } catch (e) {}
  modal.classList.add('open');
}

function closeSettingsModal() {
  document.getElementById('settings-modal')?.classList.remove('open');
}

function updateSettingsThemeLabels(isDark) {
  const lightLabel = document.getElementById('settings-theme-light');
  const darkLabel = document.getElementById('settings-theme-dark');
  if (isDark) {
    lightLabel?.classList.remove('active');
    darkLabel?.classList.add('active');
  } else {
    lightLabel?.classList.add('active');
    darkLabel?.classList.remove('active');
  }
}

function openFeedbackModal() {
  document.getElementById('feedback-modal')?.classList.add('open');
}

function closeFeedbackModal() {
  document.getElementById('feedback-modal')?.classList.remove('open');
}

let selectedFeedbackRating = 5;
function setupFeedbackStars() {
  const starContainer = document.getElementById('feedback-stars');
  if (!starContainer) return;
  const stars = starContainer.querySelectorAll('.star-rating-item');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      selectedFeedbackRating = parseInt(star.dataset.val, 10);
      stars.forEach(s => {
        const val = parseInt(s.dataset.val, 10);
        s.style.opacity = val <= selectedFeedbackRating ? '1' : '0.35';
      });
    });
  });
}

function openSecurityModal() {
  document.getElementById('security-modal')?.classList.add('open');
}

function closeSecurityModal() {
  document.getElementById('security-modal')?.classList.remove('open');
}

// ============================================================
// USER PROFILE VIEW & EDIT MODAL CONTROLLER
// ============================================================
function openProfileModal() {
  if (!state.currentUser) {
    requireAuth(() => {
      history.pushState(null, '', '/profile');
      openProfileModal();
    }, 'Sign in to access your profile details');
    return;
  }

  const user = state.currentUser;

  // Sync route
  if (window.location.pathname !== '/profile') {
    history.pushState(null, '', '/profile');
  }

  // Populate Read-Only view fields
  const nameEl = document.getElementById('profile-display-name');
  if (nameEl) nameEl.textContent = user.full_name || 'WorkLoco Member';

  const roleBadge = document.getElementById('profile-display-role-badge');
  const roleText = document.getElementById('profile-display-role-text');
  if (roleBadge) {
    if (user.role === 'ADMIN') {
      roleBadge.textContent = '⚡ FOUNDER ADMIN';
      roleBadge.style.background = 'var(--primary)';
      if (roleText) roleText.textContent = '⚡ Founder Superadmin';
    } else if (user.role === 'PROVIDER') {
      roleBadge.textContent = '💼 EMPLOYER / PROVIDER';
      roleBadge.style.background = 'var(--emerald)';
      if (roleText) roleText.textContent = '💼 Job Provider (Employer)';
    } else {
      roleBadge.textContent = '🎯 JOB SEEKER';
      roleBadge.style.background = 'var(--accent-blue)';
      if (roleText) roleText.textContent = '🎯 Job Seeker (Candidate)';
    }
  }

  const verBadge = document.getElementById('profile-display-verified-badge');
  if (verBadge) {
    if (user.role === 'ADMIN') {
      verBadge.className = 'badge-employer-verified';
      verBadge.style.background = 'var(--primary)';
      verBadge.style.color = '#FFF';
      verBadge.innerHTML = '👑 Superadmin Verified';
    } else if (user.is_business_verified) {
      verBadge.className = 'badge-employer-verified';
      verBadge.style.background = '#ECFDF5';
      verBadge.style.color = '#065F46';
      verBadge.innerHTML = '🛡️ Verified Business';
    } else if (user.is_phone_verified) {
      verBadge.className = 'badge-employer-verified';
      verBadge.style.background = '#ECFDF5';
      verBadge.style.color = '#065F46';
      verBadge.innerHTML = '✓ Phone Verified';
    } else {
      verBadge.className = 'badge-employer-unverified';
      verBadge.style.background = '#FEF2F2';
      verBadge.style.color = '#991B1B';
      verBadge.innerHTML = '⚠️ Unverified';
    }
  }

  const langBadge = document.getElementById('profile-display-lang-badge');
  if (langBadge) {
    langBadge.textContent = `🌐 ${(user.preferred_language || state.preferred_language || 'en').toUpperCase()}`;
  }

  const phoneEl = document.getElementById('profile-display-phone');
  if (phoneEl) phoneEl.textContent = user.phone_number || 'Not provided';

  const emailEl = document.getElementById('profile-display-email');
  if (emailEl) emailEl.textContent = user.email || 'Not provided';

  const cityEl = document.getElementById('profile-display-city');
  if (cityEl) cityEl.textContent = user.city || state.currentLocation?.city || 'All India / Remote';

  const bioEl = document.getElementById('profile-display-bio');
  if (bioEl) {
    bioEl.textContent = user.bio || 'No bio added yet. Click "Edit Profile" to share your background, skills, or business summary.';
  }

  // Business row for employers or admins
  const bizRow = document.getElementById('profile-display-business-row');
  const bizEl = document.getElementById('profile-display-business');
  if (bizRow && bizEl) {
    if (user.role === 'PROVIDER' || user.role === 'ADMIN' || user.business_name) {
      bizRow.style.display = 'block';
      bizEl.textContent = user.business_name || (user.role === 'ADMIN' ? 'WorkLoco Technologies' : 'Verified Business Partner');
    } else {
      bizRow.style.display = 'none';
    }
  }

  // Skills chips & Portfolio for Seekers
  const skillsRow = document.getElementById('profile-display-skills-row');
  const skillsListEl = document.getElementById('profile-display-skills-list');
  const portRow = document.getElementById('profile-display-portfolio-row');
  const portLink = document.getElementById('profile-display-portfolio-link');

  const skillsArr = Array.isArray(user.skills)
    ? user.skills
    : (user.skills ? String(user.skills).split(',').map(s => s.trim()).filter(Boolean) : []);

  if (skillsRow && skillsListEl) {
    if (user.role === 'SEEKER' || skillsArr.length > 0) {
      skillsRow.style.display = 'block';
      if (skillsArr.length > 0) {
        skillsListEl.innerHTML = skillsArr.map(s => `<span class="profile-skill-chip">⚡ ${escapeHtml(s)}</span>`).join('');
      } else {
        skillsListEl.innerHTML = `<span style="font-size: 0.8rem; color: #94A3B8;">No skills added yet. Click "Edit Profile" to add key skills.</span>`;
      }
    } else {
      skillsRow.style.display = 'none';
    }
  }

  if (portRow && portLink) {
    if (user.portfolio_url) {
      portRow.style.display = 'block';
      portLink.href = user.portfolio_url;
      portLink.textContent = user.portfolio_url;
    } else {
      portRow.style.display = 'none';
    }
  }

  const uidEl = document.getElementById('profile-display-uid');
  if (uidEl) uidEl.textContent = user.user_id || 'u-member';

  // Avatar view
  const avatarImg = document.getElementById('profile-view-avatar-img');
  const avatarInitials = document.getElementById('profile-view-avatar-initials');
  if (user.avatar_url && avatarImg) {
    avatarImg.src = user.avatar_url;
    avatarImg.style.display = 'block';
    if (avatarInitials) avatarInitials.style.display = 'none';
  } else {
    if (avatarImg) avatarImg.style.display = 'none';
    if (avatarInitials) {
      avatarInitials.style.display = 'block';
      avatarInitials.textContent = user.full_name
        ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        : 'U';
    }
  }

  // Show read-only section, hide edit form
  const displaySec = document.getElementById('profile-display-section');
  const editForm = document.getElementById('profile-edit-form');
  if (displaySec) displaySec.style.display = 'block';
  if (editForm) editForm.style.display = 'none';

  document.getElementById('profile-modal')?.classList.add('open');
}

function closeProfileModal() {
  document.getElementById('profile-modal')?.classList.remove('open');
  if (window.location.pathname === '/profile' || window.location.hash === '#profile') {
    history.pushState(null, '', '/');
  }
}

function toggleEditProfileForm(showEdit) {
  const displaySec = document.getElementById('profile-display-section');
  const editForm = document.getElementById('profile-edit-form');
  const user = state.currentUser;
  if (!user) return;

  if (showEdit) {
    if (displaySec) displaySec.style.display = 'none';
    if (editForm) {
      editForm.style.display = 'block';
      const nameInput = document.getElementById('edit-profile-name');
      const avatarInput = document.getElementById('edit-profile-avatar');
      const cityInput = document.getElementById('edit-profile-city');
      const bioInput = document.getElementById('edit-profile-bio');
      const roleSelect = document.getElementById('edit-profile-role');
      const adminOpt = document.getElementById('edit-profile-role-admin-opt');
      const skillsInput = document.getElementById('edit-profile-skills');
      const portInput = document.getElementById('edit-profile-portfolio');
      const bizInput = document.getElementById('edit-profile-business');
      const phoneInput = document.getElementById('edit-profile-phone');
      const emailInput = document.getElementById('edit-profile-email');
      const langSelect = document.getElementById('edit-profile-language');

      if (nameInput) nameInput.value = user.full_name || '';
      if (avatarInput) avatarInput.value = user.avatar_url || '';
      if (cityInput) cityInput.value = user.city || state.currentLocation?.city || '';
      if (bioInput) bioInput.value = user.bio || '';

      const skillsArr = Array.isArray(user.skills)
        ? user.skills
        : (user.skills ? String(user.skills).split(',').map(s => s.trim()).filter(Boolean) : []);
      if (skillsInput) skillsInput.value = skillsArr.join(', ');
      if (portInput) portInput.value = user.portfolio_url || '';
      if (bizInput) bizInput.value = user.business_name || '';
      if (phoneInput) phoneInput.value = user.phone_number || '';
      if (emailInput) emailInput.value = user.email || '';

      if (user.role === 'ADMIN') {
        if (adminOpt) adminOpt.style.display = 'block';
        if (roleSelect) roleSelect.value = 'ADMIN';
      } else {
        if (adminOpt) adminOpt.style.display = 'none';
        if (roleSelect) roleSelect.value = user.role || 'SEEKER';
      }

      if (langSelect) langSelect.value = user.preferred_language || state.preferred_language || 'en';

      // Toggle role-specific input boxes
      const seekerBox = document.getElementById('edit-profile-seeker-fields');
      const providerBox = document.getElementById('edit-profile-provider-fields');
      const currentRole = roleSelect ? roleSelect.value : (user.role || 'SEEKER');
      if (currentRole === 'PROVIDER') {
        if (seekerBox) seekerBox.style.display = 'none';
        if (providerBox) providerBox.style.display = 'block';
      } else if (currentRole === 'ADMIN') {
        if (seekerBox) seekerBox.style.display = 'block';
        if (providerBox) providerBox.style.display = 'block';
      } else {
        if (seekerBox) seekerBox.style.display = 'block';
        if (providerBox) providerBox.style.display = 'none';
      }
    }
  } else {
    if (displaySec) displaySec.style.display = 'block';
    if (editForm) {
      editForm.style.display = 'none';
      editForm.reset();
    }
  }
}

async function handleProfileSave(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!state.currentUser) {
    showToast('Please sign in to update your profile', 'alert');
    return;
  }

  // 1. Input Validation
  const nameInput = document.getElementById('edit-profile-name');
  const fullName = nameInput ? nameInput.value.trim() : '';
  if (!fullName) {
    showToast('⚠️ Please enter your Full Name', 'alert');
    if (nameInput) {
      nameInput.focus();
      nameInput.style.borderColor = '#DC2626';
      setTimeout(() => { nameInput.style.borderColor = ''; }, 3000);
    }
    return;
  }

  const emailInput = document.getElementById('edit-profile-email');
  const email = emailInput ? emailInput.value.trim() : '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('⚠️ Please enter a valid email address (e.g. name@example.com)', 'alert');
    if (emailInput) {
      emailInput.focus();
      emailInput.style.borderColor = '#DC2626';
      setTimeout(() => { emailInput.style.borderColor = ''; }, 3000);
    }
    return;
  }

  const phoneInput = document.getElementById('edit-profile-phone');
  const phone = phoneInput ? phoneInput.value.trim() : '';
  if (phone && phone.replace(/\D/g, '').length < 10) {
    showToast('⚠️ Please enter a valid 10-digit phone number', 'alert');
    if (phoneInput) {
      phoneInput.focus();
      phoneInput.style.borderColor = '#DC2626';
      setTimeout(() => { phoneInput.style.borderColor = ''; }, 3000);
    }
    return;
  }

  const userId = state.currentUser.user_id;
  const avatarUrl = document.getElementById('edit-profile-avatar')?.value.trim() || '';
  const city = document.getElementById('edit-profile-city')?.value.trim() || '';
  const bio = document.getElementById('edit-profile-bio')?.value.trim() || '';
  const role = document.getElementById('edit-profile-role')?.value || 'SEEKER';
  const skillsRaw = document.getElementById('edit-profile-skills')?.value.trim() || '';
  const skills = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);
  const portfolioUrl = document.getElementById('edit-profile-portfolio')?.value.trim() || '';
  const businessName = document.getElementById('edit-profile-business')?.value.trim() || '';
  const lang = document.getElementById('edit-profile-language')?.value || 'en';

  const submitBtn = document.getElementById('btn-save-profile');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ <span>Saving Changes...</span>';
  }

  try {
    const res = await fetch(`/api/v1/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        avatar_url: avatarUrl,
        city,
        bio,
        role,
        skills,
        portfolio_url: portfolioUrl,
        business_name: businessName,
        phone_number: phone,
        email,
        preferred_language: lang
      })
    });
    const data = await res.json();
    if (data.success && data.user) {
      // Updates local state and localStorage
      state.currentUser = data.user;
      localStorage.setItem('workloco_user', JSON.stringify(data.user));
      updateUserHeaderUI();
      if (lang !== state.preferred_language) {
        applyAppLanguage(lang, false);
      }
      // Displays "Profile Updated Successfully!" toast notification
      showToast('Profile Updated Successfully!', 'success');
      // Switches back to View Mode
      toggleEditProfileForm(false);
      openProfileModal(); // Refresh view mode
    } else {
      showToast(data.error || 'Failed to update profile.', 'alert');
    }
  } catch (err) {
    console.error('Profile update failed:', err);
    showToast('Failed to update profile. Please try again.', 'alert');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '💾 <span data-i18n="save_changes">Save Changes</span>';
    }
  }
}

function checkProfileRouteAccess() {
  const path = window.location.pathname;
  const hash = window.location.hash;
  const isProfile = path === '/profile' || hash === '#profile';
  if (!isProfile) return false;

  if (state.currentUser) {
    openProfileModal();
  } else {
    requireAuth(() => {
      history.pushState(null, '', '/profile');
      openProfileModal();
    }, 'Sign in to access your profile details');
  }
  return true;
}

function checkAppRouting() {
  if (checkAdminRouteAccess()) return;
  checkProfileRouteAccess();
}

// 2-Step Employer Verification Guard
function handleInitiatePostJob() {
  const user = state.currentUser;

  if (!user || !user.is_business_verified) {
    openEmployerVerificationModal();
  } else {
    openPostJobModal();
  }
}

function openEmployerVerificationModal() {
  if (state.currentUser?.phone_number) {
    const phoneInput = document.getElementById('verify-employer-phone');
    if (phoneInput) phoneInput.value = state.currentUser.phone_number;
  }
  document.getElementById('employer-verify-modal')?.classList.add('open');
}

function closeEmployerVerificationModal() {
  document.getElementById('employer-verify-modal')?.classList.remove('open');
}

async function handleEmployerVerificationSubmit(e) {
  e.preventDefault();
  const phoneOtp = document.getElementById('verify-employer-otp').value.trim();
  const businessName = document.getElementById('verify-business-name').value.trim();
  const gstin = document.getElementById('verify-gstin').value.trim();
  const pan = document.getElementById('verify-pan').value.trim();

  try {
    const res = await fetch('/api/v1/auth/employer/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: state.currentUser?.user_id,
        phone_otp: phoneOtp,
        business_name: businessName,
        gstin,
        pan_number: pan
      })
    });

    const data = await res.json();
    if (data.success) {
      if (data.user) {
        state.currentUser = data.user;
        localStorage.setItem('workloco_user', JSON.stringify(data.user));
        updateUserHeaderUI();
      }
      alert(data.message);
      closeEmployerVerificationModal();
      openPostJobModal();
    } else {
      alert(data.error || 'Verification failed.');
    }
  } catch (err) {
    console.error('Employer verification error:', err);
  }
}

// Scam Reporting Modal
window.openReportJobModal = function(jobId, jobTitle) {
  state.selectedJobForReport = { jobId, jobTitle };
  document.getElementById('report-job-id').value = jobId;
  document.getElementById('report-job-title').textContent = jobTitle;
  document.getElementById('report-job-desc').value = '';
  document.getElementById('report-job-modal')?.classList.add('open');
};

function closeReportModal() {
  document.getElementById('report-job-modal')?.classList.remove('open');
  state.selectedJobForReport = null;
}

async function handleReportSubmit(e) {
  e.preventDefault();
  const jobId = document.getElementById('report-job-id').value;
  const reasonRadio = document.querySelector('input[name="report_reason"]:checked');
  const reason = reasonRadio ? reasonRadio.value : 'SUSPICIOUS';
  const desc = document.getElementById('report-job-desc').value.trim();

  try {
    const res = await fetch(`/api/v1/jobs/${jobId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason,
        description: desc,
        reporter_contact: state.currentUser?.email || state.currentUser?.phone_number || 'Seeker'
      })
    });
    const data = await res.json();
    if (data.success) {
      alert('🚩 Report submitted. Our Trust & Safety team is reviewing the listing.');
      closeReportModal();
      fetchNearbyJobs();
    }
  } catch (err) {
    console.error('Report submission failed:', err);
  }
}

// Fetch Notifications Feed
async function fetchNotifications() {
  try {
    const role = state.currentRole === 'PROVIDER' ? 'PROVIDER' : 'SEEKER';
    const res = await fetch(`/api/v1/notifications?role=${role}`);
    const data = await res.json();

    if (data.success) {
      state.notifications = data.notifications;
      const unreadCount = data.unread_count || 0;
      const badge = document.getElementById('notif-count-badge');
      if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
      }
      renderNotificationsList(data.notifications);
    }
  } catch (err) {
    console.error('Failed to fetch notifications:', err);
  }
}

function renderNotificationsList(notifications) {
  const container = document.getElementById('notifications-list');
  if (!container) return;

  if (!notifications || notifications.length === 0) {
    container.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: #94A3B8; font-size: 0.85rem;">No new notifications</div>';
    return;
  }

  container.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="window.markNotifRead('${n.notification_id}')">
      <div class="notif-item-title">
        <span>${getNotifIcon(n.type)}</span>
        <span>${escapeHtml(n.title)}</span>
      </div>
      <div class="notif-item-msg">${escapeHtml(n.message)}</div>
      <div class="notif-item-time">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  `).join('');
}

function getNotifIcon(type) {
  switch (type) {
    case 'APPLICATION_UPDATE': return '📋';
    case 'NEW_APPLICANT': return '👤';
    case 'EXPIRY_WARNING': return '⏱️';
    case 'VERIFICATION_UPDATE': return '🛡️';
    case 'SECURITY_ALERT': return '⚠️';
    default: return '🔔';
  }
}

window.markNotifRead = async function(id) {
  try {
    await fetch(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
    fetchNotifications();
  } catch (e) {}
};

async function handleMarkAllNotificationsRead() {
  try {
    await fetch('/api/v1/notifications/read-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'ALL' })
    });
    fetchNotifications();
  } catch (e) {}
}

// Fetch Nearby Jobs with Spatial Latency Tracking
async function fetchNearbyJobs() {
  const feedContainer = document.getElementById('jobs-feed');
  if (feedContainer) feedContainer.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748B;">Scanning spatial radius...</div>';

  const { lat, lng } = state.currentLocation;
  const radius = state.radiusKm;
  const q = encodeURIComponent(state.searchQuery);
  const cat = encodeURIComponent(state.selectedCategory);

  try {
    const res = await fetch(`/api/v1/jobs/nearby?lat=${lat}&lng=${lng}&radius_km=${radius}&query=${q}&category=${cat}`);
    const data = await res.json();

    if (data.success) {
      state.activeJobs = data.jobs;

      const statPill = document.getElementById('spatial-latency-pill');
      if (statPill) {
        statPill.innerHTML = `
          <span class="dot"></span>
          <span>PostGIS Query: <strong>${data.latency_ms}ms</strong> | ${data.count} nearby jobs</span>
        `;
      }

      const countBadge = document.getElementById('nearby-count-badge');
      if (countBadge) countBadge.textContent = `${data.count} jobs`;

      radarMap.renderJobPins(data.jobs, (job, openModal = false) => {
        highlightJobCard(job.job_id);
        if (openModal) {
          requireAuth(() => openApplyModal(job), 'Please sign in to apply for this position');
        }
      });

      renderJobsFeed(data.jobs);
    }
  } catch (err) {
    console.error('Failed to fetch spatial jobs:', err);
    if (feedContainer) feedContainer.innerHTML = '<div class="empty-state"><p>Could not connect to WorkLoco Spatial Engine. Retrying...</p></div>';
  }
}

// Render Job Listing Cards
function renderJobsFeed(jobs) {
  const container = document.getElementById('jobs-feed');
  if (!container) return;

  if (!jobs || jobs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📍</div>
        <h4>No jobs found within ${state.radiusKm >= 100 ? 'India' : state.radiusKm + ' km'}</h4>
        <p>Try expanding your radius slider or clearing search keywords.</p>
        <button onclick="document.getElementById('radius-slider').value=25; document.getElementById('radius-slider').dispatchEvent(new Event('input')); document.getElementById('radius-slider').dispatchEvent(new Event('change'));"
                style="margin-top: 1rem; background: var(--primary); color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 700; cursor: pointer;">
          Expand to 25 km
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = jobs.map(job => {
    const isUrgent = (job.days_remaining || 4) <= 3;
    const salaryFormatted = job.salary_min && job.salary_max
      ? `₹${job.salary_min.toLocaleString()} - ₹${job.salary_max.toLocaleString()}/${job.salary_period || 'mo'}`
      : '₹ Negotiable';

    const whatsappText = encodeURIComponent(
      `Hi! I saw your post for "${job.title}" on WorkLoco (${job.distance_km || 0} km away). I would like to apply.`
    );

    const verificationBadgeHtml = job.is_verified_employer
      ? `<span class="badge-employer-verified" title="Verified employer: Business & phone authenticated">🛡️ Verified Employer</span>`
      : `<span class="badge-employer-unverified" title="New listing: Phone verified only">⚠️ Unverified Employer</span>`;

    return `
      <div class="job-card" id="card-${job.job_id}" onclick="window.selectJobPin('${job.job_id}')">
        <div class="card-top-row">
          <div class="job-role-info">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <h4>${escapeHtml(job.title)}</h4>
              ${verificationBadgeHtml}
            </div>
            ${job.custom_title ? `<div class="custom-title-tag">✨ ${escapeHtml(job.custom_title)}</div>` : ''}
          </div>
          <div class="distance-badge">
            📍 ${job.distance_km !== undefined ? `${job.distance_km} km away` : 'Nearby'}
          </div>
        </div>

        <div class="card-location-row" style="justify-content: space-between;">
          <span>🏢 ${escapeHtml(job.location_name)}</span>
          <button class="btn-report-job" onclick="event.stopPropagation(); window.openReportJobModal('${job.job_id}', '${escapeHtml(job.title)}')">
            🚩 Report
          </button>
        </div>

        <div class="card-meta-pills">
          <div class="meta-pill salary">
            💰 ${salaryFormatted}
          </div>
          <div class="meta-pill expiry ${isUrgent ? 'urgent' : ''}">
            ⏱ ${isUrgent ? '⚡ Urgent: ' : ''}Expires in ${job.days_remaining || 4} Days
          </div>
          <div class="meta-pill vacancies">
            👥 ${job.vacancies_count} Openings (${job.hired_count || 0} hired)
          </div>
        </div>

        <div class="job-description-excerpt">
          ${escapeHtml(job.description)}
        </div>

        <div class="card-actions-row" onclick="event.stopPropagation()">
          <button class="btn-apply-primary" onclick="window.triggerApplyModal('${job.job_id}')">
            ⚡ 1-Tap Quick Apply
          </button>
          <a class="btn-whatsapp-direct" href="https://wa.me/${(job.whatsapp_number || '919848012345').replace(/[^0-9]/g, '')}?text=${whatsappText}" target="_blank">
            💬 WhatsApp
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// Highlight job card when marker clicked
function highlightJobCard(jobId) {
  document.querySelectorAll('.job-card').forEach(c => c.classList.remove('highlighted'));
  const card = document.getElementById(`card-${jobId}`);
  if (card) {
    card.classList.add('highlighted');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

window.selectJobPin = function(jobId) {
  highlightJobCard(jobId);
};

// 1-Tap Quick Apply Flow Protected by Auth Guard
window.triggerApplyModal = function(jobId) {
  const job = state.activeJobs.find(j => j.job_id === jobId);
  if (!job) return;

  requireAuth(() => {
    openApplyModal(job);
  }, `Please sign in to apply for "${job.title}"`);
};

function openApplyModal(job) {
  state.selectedJobForApply = job;
  document.getElementById('modal-job-title').textContent = job.title;
  document.getElementById('modal-job-location').textContent = `${job.location_name} (${job.distance_km || 0} km away)`;
  document.getElementById('apply-job-id').value = job.job_id;
  document.getElementById('apply-distance').value = job.distance_km || 0;

  // Pre-fill with authenticated user details if available
  const seekerNameInput = document.getElementById('apply-seeker-name');
  const seekerPhoneInput = document.getElementById('apply-seeker-phone');

  if (state.currentUser) {
    if (seekerNameInput) seekerNameInput.value = state.currentUser.full_name || '';
    if (seekerPhoneInput) seekerPhoneInput.value = state.currentUser.phone_number || '';
  }

  audioController.recordedAudioUrl = null;
  state.recordedAudioUrl = null;
  const recBtn = document.getElementById('btn-record-audio');
  if (recBtn) {
    recBtn.classList.remove('recording');
    recBtn.innerHTML = '🎙️ Record 30s Audio Intro';
  }
  audioController.renderWaveform(false);

  document.getElementById('apply-modal')?.classList.add('open');
}

function closeApplyModal() {
  document.getElementById('apply-modal')?.classList.remove('open');
  state.selectedJobForApply = null;
}

// Audio Recording Toggle
function handleRecordAudioToggle() {
  const btn = document.getElementById('btn-record-audio');
  if (!btn) return;

  if (!audioController.isRecording) {
    btn.classList.add('recording');
    audioController.startRecording(
      (seconds) => {
        btn.innerHTML = `🔴 Recording... (${seconds}s / 30s) [Tap to Finish]`;
      },
      (audioUrl, duration) => {
        btn.classList.remove('recording');
        btn.innerHTML = `✅ Audio Intro Saved (${duration}s)`;
        state.recordedAudioUrl = audioUrl;
      }
    );
  } else {
    audioController.stopRecording((audioUrl, duration) => {
      btn.classList.remove('recording');
      btn.innerHTML = `✅ Audio Intro Saved (${duration}s)`;
      state.recordedAudioUrl = audioUrl;
    });
  }
}

// Submit Application
async function handleApplySubmit(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting 1-Tap Application...';
  }

  const portfolioUrls = [];
  const drive = document.getElementById('apply-portfolio-drive').value.trim();
  const youtube = document.getElementById('apply-portfolio-youtube').value.trim();
  const behance = document.getElementById('apply-portfolio-behance').value.trim();

  if (drive) portfolioUrls.push(drive);
  if (youtube) portfolioUrls.push(youtube);
  if (behance) portfolioUrls.push(behance);

  const payload = {
    job_id: document.getElementById('apply-job-id').value,
    seeker_name: document.getElementById('apply-seeker-name').value.trim(),
    seeker_phone: document.getElementById('apply-seeker-phone').value.trim(),
    cover_note: document.getElementById('apply-cover-note').value.trim(),
    portfolio_urls: portfolioUrls,
    audio_intro_url: state.recordedAudioUrl || null,
    distance_at_apply_km: parseFloat(document.getElementById('apply-distance').value) || 0
  };

  try {
    const res = await fetch('/api/v1/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      alert(`🎉 Application Sent Successfully!\n\nThe employer has received an alert with your distance (${payload.distance_at_apply_km} km).\n\nDirect Employer Contact:\nPhone: ${data.employer_contact.phone}`);
      closeApplyModal();
      form.reset();
      fetchNotifications();
    } else {
      alert(`Submission error: ${data.error}`);
    }
  } catch (err) {
    console.error('Application failed:', err);
    alert('Failed to connect to WorkLoco application engine.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '⚡ Submit Instant 1-Tap Application';
    }
  }
}

// Master Titles Loading for Autocomplete
async function loadMasterTitles() {
  try {
    const res = await fetch('/api/v1/jobs/titles');
    const data = await res.json();
    state.masterTitles = data.titles || [];
  } catch (err) {
    console.error('Failed to load job titles:', err);
  }
}

// Autocomplete Input Handling
function handleSearchInput(query) {
  const dropdown = document.getElementById('autocomplete-dropdown');
  const q = query.trim().toLowerCase();

  if (!q || !dropdown) {
    dropdown?.classList.remove('open');
    return;
  }

  const matches = state.masterTitles.filter(t =>
    t.title_name.toLowerCase().includes(q)
  ).slice(0, 5);

  let html = `<div class="autocomplete-header">Matching Titles</div>`;

  matches.forEach(item => {
    html += `
      <div class="autocomplete-item" onclick="window.selectAutocompleteTitle('${escapeHtml(item.title_name)}')">
        <span>${escapeHtml(item.title_name)}</span>
        <span class="cat-badge">${escapeHtml(item.category)}</span>
      </div>
    `;
  });

  html += `
    <div class="autocomplete-item autocomplete-custom" onclick="window.selectAutocompleteTitle('${escapeHtml(query)}')">
      <span>✨ Search or add custom title: "<strong>${escapeHtml(query)}</strong>"</span>
      <span class="cat-badge" style="background:#FDE68A; color:#92400E;">Free-Text</span>
    </div>
  `;

  dropdown.innerHTML = html;
  dropdown.classList.add('open');
}

window.selectAutocompleteTitle = function(title) {
  const searchInput = document.getElementById('job-search-input');
  if (searchInput) searchInput.value = title;
  state.searchQuery = title;
  document.getElementById('autocomplete-dropdown')?.classList.remove('open');
  fetchNearbyJobs();
};

// Switch Role View: Seeker vs Employer
function setRole(role) {
  state.currentRole = role;
  const seekerBtn = document.getElementById('role-seeker-btn');
  const providerBtn = document.getElementById('role-provider-btn');
  const discoveryView = document.getElementById('seeker-discovery-view');
  const dashboardView = document.getElementById('employer-dashboard-view');
  const adminView = document.getElementById('founder-admin-dashboard-view');

  if (adminView) adminView.style.display = 'none';
  if (window.location.pathname === '/admin' || window.location.pathname === '/founder-dashboard' || window.location.hash === '#admin') {
    history.pushState(null, '', '/');
  }

  if (role === 'SEEKER') {
    seekerBtn?.classList.add('active');
    providerBtn?.classList.remove('active');
    if (discoveryView) discoveryView.style.display = 'block';
    dashboardView?.classList.remove('active');
  } else {
    providerBtn?.classList.add('active');
    seekerBtn?.classList.remove('active');
    if (discoveryView) discoveryView.style.display = 'none';
    dashboardView?.classList.add('active');
    loadEmployerDashboard();
  }
}

// Employer Dashboard Management
async function loadEmployerDashboard() {
  try {
    const res = await fetch('/api/v1/jobs/all');
    const data = await res.json();
    const jobs = data.jobs || [];

    const activeCount = jobs.filter(j => j.status === 'ACTIVE').length;
    const totalApplicants = jobs.reduce((acc, j) => acc + (j.applicants_count || 0), 0);
    const totalHired = jobs.reduce((acc, j) => acc + (j.hired_count || 0), 0);

    const statActive = document.getElementById('stat-active-jobs');
    const statApplicants = document.getElementById('stat-total-applicants');
    const statHired = document.getElementById('stat-total-hired');

    if (statActive) statActive.textContent = activeCount;
    if (statApplicants) statApplicants.textContent = totalApplicants;
    if (statHired) statHired.textContent = totalHired;

    const tableContainer = document.getElementById('employer-jobs-list');
    if (!tableContainer) return;

    if (jobs.length === 0) {
      tableContainer.innerHTML = '<div style="padding: 2rem; text-align: center;">No active listings yet. Tap "Post New Job" to create your first listing!</div>';
      return;
    }

    tableContainer.innerHTML = jobs.map(job => {
      const isFilled = job.status === 'FILLED';
      const isVerified = job.is_verified_employer;

      return `
        <div class="employer-job-row">
          <div class="employer-job-info">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <h4>${escapeHtml(job.title)}</h4>
              ${isVerified ? '<span class="badge-employer-verified">🛡️ Verified</span>' : '<span class="badge-employer-unverified">⚠️ Unverified</span>'}
            </div>
            <div class="employer-job-meta">
              <span>📍 ${escapeHtml(job.location_name)}</span>
              <span>💰 ₹${job.salary_min ? job.salary_min.toLocaleString() : 0} - ₹${job.salary_max ? job.salary_max.toLocaleString() : 0}</span>
              <span>⏱ ${new Date(job.expires_at).toLocaleDateString()} (${job.status})</span>
              <span>👥 ${job.hired_count || 0}/${job.vacancies_count} Hired</span>
            </div>
          </div>
          <div class="employer-job-actions">
            <button class="btn-sm-action primary" onclick="window.viewApplicants('${job.job_id}')">
              View Applicants (${job.applicants_count || 0})
            </button>
            <button class="btn-sm-action" onclick="window.renewJobListing('${job.job_id}')">
              🔄 Renew (+7d)
            </button>
            <button class="btn-sm-action" onclick="window.toggleJobFilled('${job.job_id}', '${job.status}')">
              ${isFilled ? 'Reopen' : 'Mark Filled'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load employer dashboard:', err);
  }
}

// Renew Job
window.renewJobListing = async function(jobId) {
  try {
    const res = await fetch(`/api/v1/jobs/${jobId}/renew`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extra_days: 7 })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Listing renewed for 7 additional days. New expiry: ${new Date(data.job.expires_at).toLocaleDateString()}`);
      loadEmployerDashboard();
      fetchNearbyJobs();
    }
  } catch (err) {
    console.error('Renewal error:', err);
  }
};

// Toggle Filled Status
window.toggleJobFilled = async function(jobId, currentStatus) {
  const newStatus = currentStatus === 'FILLED' ? 'ACTIVE' : 'FILLED';
  try {
    const res = await fetch(`/api/v1/jobs/${jobId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      loadEmployerDashboard();
      fetchNearbyJobs();
    }
  } catch (err) {
    console.error('Status toggle error:', err);
  }
};

// View Applicants
window.viewApplicants = async function(jobId) {
  try {
    const res = await fetch(`/api/v1/applications/job/${jobId}`);
    const data = await res.json();
    const apps = data.applications || [];

    const container = document.getElementById('applicants-list-box');
    document.getElementById('applicants-modal-title').textContent = `Applicants for Position (${apps.length})`;

    if (apps.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No applications received for this post yet.</p>
        </div>
      `;
    } else {
      container.innerHTML = apps.map(app => {
        const portfolioLinks = (app.portfolio_urls || []).map(url => `
          <a href="${url}" target="_blank" style="color: #2563EB; font-size: 0.82rem; text-decoration: underline; margin-right: 0.5rem;">
            🔗 View Portfolio
          </a>
        `).join('');

        const audioSection = app.audio_intro_url ? `
          <div style="background: #F1F5F9; padding: 0.5rem 0.8rem; border-radius: 8px; margin: 0.5rem 0; display: flex; align-items: center; gap: 0.5rem;">
            <span>🎙️ Audio Intro:</span>
            <button onclick="alert('Playing candidate voice introduction audio clip...')" style="background: #D94A26; color: white; border: none; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.78rem; cursor: pointer;">
              ▶ Play Clip
            </button>
          </div>
        ` : '';

        const whatsappLink = `https://wa.me/${app.seeker_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi ${app.seeker_name}, we reviewed your application on WorkLoco.`)}`;

        return `
          <div style="border: 1px solid #E2E8F0; border-radius: 12px; padding: 1rem; margin-bottom: 0.85rem; background: white;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem;">
              <div>
                <h4 style="font-size: 1.05rem; margin-bottom: 0.15rem;">${escapeHtml(app.seeker_name)}</h4>
                <div style="font-size: 0.82rem; color: #64748B;">
                  📍 ${app.distance_at_apply_km || 0} km away • Applied ${new Date(app.applied_at).toLocaleDateString()}
                </div>
              </div>
              <span style="font-size: 0.75rem; font-weight: 700; background: #D1FAE5; color: #065F46; padding: 0.2rem 0.6rem; border-radius: 9999px;">
                ${app.status}
              </span>
            </div>

            ${app.cover_note ? `<p style="font-size: 0.86rem; color: #334155; margin: 0.5rem 0;">"${escapeHtml(app.cover_note)}"</p>` : ''}
            ${audioSection}
            <div style="margin: 0.4rem 0;">${portfolioLinks}</div>

            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; padding-top: 0.65rem; border-top: 1px solid #F1F5F9;">
              <a href="tel:${app.seeker_phone}" style="flex: 1; text-align: center; background: #1E293B; color: white; padding: 0.45rem; border-radius: 6px; font-size: 0.82rem; font-weight: 600; text-decoration: none;">
                📞 Call Candidate
              </a>
              <a href="${whatsappLink}" target="_blank" style="flex: 1; text-align: center; background: #25D366; color: white; padding: 0.45rem; border-radius: 6px; font-size: 0.82rem; font-weight: 600; text-decoration: none;">
                💬 WhatsApp
              </a>
              <button onclick="window.markCandidateHired('${app.application_id}')" style="background: #059669; color: white; border: none; padding: 0.45rem 0.75rem; border-radius: 6px; font-size: 0.82rem; font-weight: 600; cursor: pointer;">
                ✅ Hire
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    document.getElementById('applicants-modal')?.classList.add('open');
  } catch (err) {
    console.error('Failed to view applicants:', err);
  }
};

window.markCandidateHired = async function(appId) {
  try {
    const res = await fetch(`/api/v1/applications/${appId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'HIRED' })
    });
    const data = await res.json();
    if (data.success) {
      alert('Candidate marked as HIRED! Quota counter updated.');
      closeApplicantsModal();
      loadEmployerDashboard();
      fetchNearbyJobs();
    }
  } catch (err) {
    console.error('Hire error:', err);
  }
};

function closeApplicantsModal() {
  document.getElementById('applicants-modal')?.classList.remove('open');
}

// Post Job Modal
function openPostJobModal() {
  document.getElementById('post-job-modal')?.classList.add('open');
  document.getElementById('post-lat').value = state.currentLocation.lat;
  document.getElementById('post-lng').value = state.currentLocation.lng;
  document.getElementById('post-location-name').value = `${state.currentLocation.city} Center`;
  generateCaptcha('post-job-captcha-canvas', 'post-job-captcha-input', 'post-job-captcha-error');
}

function closePostJobModal() {
  document.getElementById('post-job-modal')?.classList.remove('open');
}

// AI Job Description Generator Click
async function handleAiJobDescriptionGeneration() {
  const title = document.getElementById('post-title').value.trim();
  const location = document.getElementById('post-location-name').value.trim();
  const salaryMin = document.getElementById('post-salary-min').value;
  const salaryMax = document.getElementById('post-salary-max').value;

  if (!title) {
    alert('Please enter a Job Title first so the AI can generate a targeted description.');
    document.getElementById('post-title')?.focus();
    return;
  }

  const aiBtn = document.getElementById('btn-ai-generate');
  if (aiBtn) aiBtn.textContent = '✨ Drafting description...';

  try {
    const res = await fetch('/api/v1/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        location_name: location,
        salary_hint: salaryMin && salaryMax ? `₹${salaryMin} - ₹${salaryMax}/month` : 'Competitive market salary'
      })
    });

    const data = await res.json();
    if (data.success) {
      document.getElementById('post-description').value = data.suggested_description;
    }
  } catch (err) {
    console.error('AI generation error:', err);
  } finally {
    if (aiBtn) aiBtn.textContent = '✨ Generate with AI';
  }
}

// Create Job Submit
async function handleCreateJobSubmit(e) {
  e.preventDefault();

  // Visual Canvas CAPTCHA Security Guard
  if (!validateCaptcha('post-job-captcha-canvas', 'post-job-captcha-input', 'post-job-captcha-error')) {
    return;
  }

  const title = document.getElementById('post-title').value.trim();
  const category = document.getElementById('post-category').value;
  const locationName = document.getElementById('post-location-name').value.trim();
  const lat = parseFloat(document.getElementById('post-lat').value);
  const lng = parseFloat(document.getElementById('post-lng').value);
  const salaryMin = parseFloat(document.getElementById('post-salary-min').value) || 0;
  const salaryMax = parseFloat(document.getElementById('post-salary-max').value) || 0;
  const vacancies = parseInt(document.getElementById('post-vacancies').value) || 1;
  const durationDays = parseInt(document.getElementById('post-duration').value) || 7;
  const description = document.getElementById('post-description').value.trim();

  const payload = {
    title,
    category,
    location_name: locationName,
    lat,
    lng,
    salary_min: salaryMin,
    salary_max: salaryMax,
    vacancies_count: vacancies,
    duration_days: durationDays,
    description,
    provider_id: state.currentUser?.user_id || 'u-demo-provider',
    contact_phone: state.currentUser?.phone_number || '+91 98000 00000',
    whatsapp_number: state.currentUser?.phone_number || '+919800000000',
    is_verified_employer: Boolean(state.currentUser?.is_business_verified)
  };

  try {
    const res = await fetch('/api/v1/jobs/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      alert(`🎉 Job Posted Successfully!\n\n"${data.job.title}" is now active and indexed on the proximity radar. Expiry scheduled in ${durationDays} days.`);
      closePostJobModal();
      document.getElementById('create-job-form')?.reset();
      generateCaptcha('post-job-captcha-canvas', 'post-job-captcha-input', 'post-job-captcha-error');
      loadEmployerDashboard();
      fetchNearbyJobs();
    }
  } catch (err) {
    console.error('Failed to create job:', err);
    alert('Error posting job listing.');
  }
}

// Background Lifecycle Audit Ticker
function startLifecycleAuditPoller() {
  const tickerContainer = document.getElementById('lifecycle-ticker-msg');
  const poll = async () => {
    try {
      const res = await fetch('/api/v1/jobs/lifecycle-events');
      const data = await res.json();
      const events = data.events || [];
      if (events.length > 0) {
        const latest = events[0];
        if (tickerContainer) tickerContainer.textContent = `${latest.type}: ${latest.message} (${new Date(latest.timestamp).toLocaleTimeString()})`;
      } else {
        if (tickerContainer) tickerContainer.textContent = 'BullMQ Worker Active: Monitoring spatial indexes and auto-expiry schedules.';
      }
    } catch (e) {}
  };

  poll();
  setInterval(poll, 8000);
}

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

// =======================================================
// FOUNDER ADMIN DASHBOARD ENGINE (RBAC & MODERATION)
// =======================================================

// Modern Notification Toast
function showToast(message, type = 'info') {
  let container = document.getElementById('workloco-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'workloco-toast-container';
    container.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 999999; display: flex; flex-direction: column; gap: 8px; pointer-events: none;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bg = type === 'alert' || message.includes('Denied') ? '#DC2626' : (type === 'success' ? '#059669' : '#1E293B');
  toast.style.cssText = `background: ${bg}; color: white; padding: 12px 18px; border-radius: 8px; font-size: 0.88rem; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 8px; pointer-events: auto; max-width: 380px; transition: all 0.25s ease; transform: translateY(0); opacity: 1;`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// Admin RBAC Headers
function getAdminHeaders() {
  const user = state.currentUser;
  return {
    'Content-Type': 'application/json',
    'x-user-id': user?.user_id || '',
    'Authorization': `Bearer wk-token-${user?.user_id || 'guest'}`
  };
}

// 1. RBAC Route Guard: Direct /admin and /founder-dashboard access check
function checkAdminRouteAccess() {
  const path = window.location.pathname;
  const hash = window.location.hash;
  const isAdminPath = path === '/admin' || path === '/founder-dashboard' || hash === '#admin' || hash === '#founder-dashboard';

  if (!isAdminPath) {
    return false;
  }

  // Enforce Role-Based Access Control (RBAC)
  if (!state.currentUser || state.currentUser.role !== 'ADMIN') {
    showToast('⛔ Access Denied: Founder Admin privileges required. Redirecting to home...', 'alert');
    history.replaceState(null, '', '/');
    exitAdminDashboard();
    return false;
  }

  openAdminDashboard();
  return true;
}

// Open Admin Dashboard (Only accessible by role === 'ADMIN')
function openAdminDashboard() {
  if (!state.currentUser || state.currentUser.role !== 'ADMIN') {
    showToast('⛔ Access Denied: Founder Admin privileges required.', 'alert');
    history.replaceState(null, '', '/');
    exitAdminDashboard();
    return;
  }

  const discoveryView = document.getElementById('seeker-discovery-view');
  const dashboardView = document.getElementById('employer-dashboard-view');
  const adminView = document.getElementById('founder-admin-dashboard-view');

  if (discoveryView) discoveryView.style.display = 'none';
  if (dashboardView) dashboardView.classList.remove('active');
  if (adminView) {
    adminView.style.display = 'block';
    adminView.scrollIntoView({ behavior: 'smooth' });
  }

  if (window.location.pathname !== '/admin') {
    history.pushState(null, '', '/admin');
  }

  refreshAllAdminData();
}

// Exit Admin Dashboard back to public portal
function exitAdminDashboard() {
  const adminView = document.getElementById('founder-admin-dashboard-view');
  const discoveryView = document.getElementById('seeker-discovery-view');

  if (adminView) adminView.style.display = 'none';
  if (discoveryView) discoveryView.style.display = 'block';

  if (window.location.pathname === '/admin' || window.location.pathname === '/founder-dashboard' || window.location.hash === '#admin') {
    history.pushState(null, '', '/');
  }
}

// ============================================================
// INSTANT ROLE SWITCHER (DEVELOPER / FOUNDER PERSONA TESTING)
// ============================================================
function switchActiveRole(newRole) {
  // Synchronize selects in drawer and settings
  const devSelect = document.getElementById('dev-role-switcher-select');
  const settingsSelect = document.getElementById('settings-role-switcher-select');
  if (devSelect) devSelect.value = newRole;
  if (settingsSelect) settingsSelect.value = newRole;

  if (newRole === 'GUEST') {
    handleSignOut();
    showToast('Switched to Guest mode (Unauthenticated)', 'info');
    return;
  }

  let user = state.currentUser;

  if (newRole === 'SEEKER') {
    user = {
      user_id: (user && user.role === 'SEEKER') ? user.user_id : 'u-seeker-demo',
      full_name: (user && user.full_name && user.role !== 'GUEST') ? user.full_name : 'Priya Sharma',
      phone_number: user?.phone_number || '+91 98765 43210',
      email: user?.email || 'priya.seeker@workloco.in',
      role: 'SEEKER',
      is_phone_verified: true,
      city: user?.city || 'Hyderabad',
      bio: user?.bio || 'Experienced Video Editor & Digital Media Specialist',
      skills: ['Video Editing', 'Motion Graphics', 'Figma']
    };
    state.currentUser = user;
    localStorage.setItem('workloco_user', JSON.stringify(user));
    localStorage.setItem('workloco_token', `wk-token-${user.user_id}`);
    updateUserHeaderUI();
    setRole('SEEKER');
    showToast('Switched active role to Job Seeker (Candidate)', 'success');
  } else if (newRole === 'PROVIDER') {
    user = {
      user_id: (user && user.role === 'PROVIDER') ? user.user_id : 'u-ramesh-101',
      full_name: (user && user.full_name && user.role !== 'GUEST') ? user.full_name : 'Ramesh Kumar',
      phone_number: user?.phone_number || '+91 98480 12345',
      email: user?.email || 'ramesh.studio9@gmail.com',
      role: 'PROVIDER',
      business_name: user?.business_name || 'Studio 9 Digital Arts & Media',
      is_phone_verified: true,
      is_business_verified: true,
      city: user?.city || 'Guntur',
      bio: 'Studio 9 Digital Arts hiring local videographers, editors, and camera crew'
    };
    state.currentUser = user;
    localStorage.setItem('workloco_user', JSON.stringify(user));
    localStorage.setItem('workloco_token', `wk-token-${user.user_id}`);
    updateUserHeaderUI();
    setRole('PROVIDER');
    showToast('Switched active role to Job Provider (Employer)', 'success');
  } else if (newRole === 'ADMIN') {
    user = {
      user_id: 'WorkLoco_founder',
      full_name: 'Founder Admin (Venkatesh)',
      phone_number: '+91 7993094858',
      email: 'admin@workloco.in',
      role: 'ADMIN',
      is_phone_verified: true,
      is_business_verified: true,
      city: 'Hyderabad',
      bio: 'WorkLoco Founder & Platform Superadmin'
    };
    state.currentUser = user;
    localStorage.setItem('workloco_user', JSON.stringify(user));
    localStorage.setItem('workloco_token', 'wk-token-WorkLoco_founder-session');
    updateUserHeaderUI();
    toggleSidebarDrawer(false);
    closeSettingsModal();
    // Instantly unlock and mount the Admin Portal
    openAdminDashboard();
    showToast('⚡ Founder / Admin Privileges Unlocked! Admin Portal Mounted.', 'success');
  }
}

// Setup Admin Console Listeners
function setupAdminConsoleEventListeners() {
  // Drawer Admin Console click
  document.getElementById('drawer-item-admin')?.addEventListener('click', () => {
    toggleSidebarDrawer(false);
    openAdminDashboard();
  });

  // Header Admin Console button click
  document.getElementById('header-admin-btn')?.addEventListener('click', () => {
    openAdminDashboard();
  });

  // Role Switcher Dropdown (Drawer)
  document.getElementById('dev-role-switcher-select')?.addEventListener('change', (e) => {
    switchActiveRole(e.target.value);
  });

  // Role Switcher Dropdown (Settings Modal)
  document.getElementById('settings-role-switcher-select')?.addEventListener('change', (e) => {
    switchActiveRole(e.target.value);
  });

  // Admin Topbar buttons
  document.getElementById('admin-exit-btn')?.addEventListener('click', exitAdminDashboard);
  document.getElementById('admin-refresh-btn')?.addEventListener('click', () => {
    refreshAllAdminData();
    showToast('🔄 Admin Console data refreshed.', 'info');
  });

  // Tab Navigation in Admin View
  const tabBtns = document.querySelectorAll('.admin-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.adminTab;
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = document.getElementById(`admin-tab-${targetTab}`);
      if (panel) panel.classList.add('active');
    });
  });

  // Quick inspect from KPI card
  document.getElementById('kpi-quick-inspect-flags')?.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));

    const fraudTabBtn = document.querySelector('[data-admin-tab="fraud-moderation"]');
    const fraudPanel = document.getElementById('admin-tab-fraud-moderation');
    if (fraudTabBtn) fraudTabBtn.classList.add('active');
    if (fraudPanel) fraudPanel.classList.add('active');
  });

  // Employer search input filter
  document.getElementById('admin-employer-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const rows = document.querySelectorAll('#admin-employers-tbody tr');
    rows.forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  // Job search input filter with debounce
  let jobSearchTimer = null;
  document.getElementById('admin-jobs-search-input')?.addEventListener('input', () => {
    clearTimeout(jobSearchTimer);
    jobSearchTimer = setTimeout(() => {
      loadAdminJobs();
    }, 300);
  });

  // Job status filter dropdown
  document.getElementById('admin-jobs-status-filter')?.addEventListener('change', () => {
    loadAdminJobs();
  });
}

// Refresh all admin tabs
async function refreshAllAdminData() {
  await Promise.all([
    loadAdminStats(),
    loadAdminEmployers(),
    loadAdminJobs(),
    loadAdminReports()
  ]);
}

// 1. MODULE: Load System Overview KPI Metrics
async function loadAdminStats() {
  try {
    const res = await fetch('/api/v1/admin/stats', { headers: getAdminHeaders() });
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        showToast('⛔ Access Denied: Admin authorization token missing or invalid.', 'alert');
        exitAdminDashboard();
      }
      return;
    }

    const data = await res.json();
    const stats = data.stats;
    if (!stats) return;

    // KPI Card 1: Users
    const kpiTotalUsers = document.getElementById('kpi-total-users');
    const kpiSeekers = document.getElementById('kpi-seekers-count');
    const kpiProviders = document.getElementById('kpi-providers-count');
    const kpiAdmins = document.getElementById('kpi-admins-count');
    if (kpiTotalUsers) kpiTotalUsers.textContent = stats.users.total;
    if (kpiSeekers) kpiSeekers.textContent = `${stats.users.seekers} Seekers`;
    if (kpiProviders) kpiProviders.textContent = `${stats.users.providers} Employers`;
    if (kpiAdmins) kpiAdmins.textContent = `${stats.users.admins} Founder Admin`;

    // KPI Card 2: Jobs
    const kpiActiveJobs = document.getElementById('kpi-active-jobs');
    const kpiActiveBadge = document.getElementById('kpi-active-badge');
    const kpiExpiredBadge = document.getElementById('kpi-expired-badge');
    const kpiFilledBadge = document.getElementById('kpi-filled-badge');
    if (kpiActiveJobs) kpiActiveJobs.textContent = stats.jobs.active;
    if (kpiActiveBadge) kpiActiveBadge.textContent = `${stats.jobs.active} Active`;
    if (kpiExpiredBadge) kpiExpiredBadge.textContent = `${stats.jobs.expired} Expired`;
    if (kpiFilledBadge) kpiFilledBadge.textContent = `${stats.jobs.filled} Filled`;

    // KPI Card 3: Pending Verifications
    const kpiPendingVerif = document.getElementById('kpi-pending-verifications');
    const kpiPendingVerifBadge = document.getElementById('kpi-pending-verif-badge');
    const kpiVerifiedProvidersBadge = document.getElementById('kpi-verified-providers-badge');
    if (kpiPendingVerif) kpiPendingVerif.textContent = stats.users.unverified_providers;
    if (kpiPendingVerifBadge) kpiPendingVerifBadge.textContent = `${stats.users.unverified_providers} Pending Verification`;
    if (kpiVerifiedProvidersBadge) kpiVerifiedProvidersBadge.textContent = `${stats.users.verified_providers} Verified`;

    // KPI Card 4: Moderation
    const kpiFlaggedJobs = document.getElementById('kpi-flagged-jobs');
    const kpiPendingReports = document.getElementById('kpi-pending-reports-badge');
    if (kpiFlaggedJobs) kpiFlaggedJobs.textContent = stats.moderation.flagged_jobs_count;
    if (kpiPendingReports) kpiPendingReports.textContent = `${stats.moderation.pending_reports} Pending Reports`;

    // KPI Card 5: Applications
    const kpiTodayApps = document.getElementById('kpi-today-applications');
    const kpiTotalApps = document.getElementById('kpi-total-apps-badge');
    const kpiHiredApps = document.getElementById('kpi-hired-apps-badge');
    if (kpiTodayApps) kpiTodayApps.textContent = stats.applications.today;
    if (kpiTotalApps) kpiTotalApps.textContent = `${stats.applications.total} Lifetime Total`;
    if (kpiHiredApps) kpiHiredApps.textContent = `${stats.applications.hired} Hired`;

    // Employer Verification Ratio Bar
    const totalProviders = stats.users.providers || 1;
    const verifiedPercent = Math.round((stats.users.verified_providers / totalProviders) * 100);
    const unverifiedPercent = 100 - verifiedPercent;

    const barVerified = document.getElementById('ratio-bar-verified');
    const barUnverified = document.getElementById('ratio-bar-unverified');
    const numVerified = document.getElementById('ratio-verified-num');
    const numUnverified = document.getElementById('ratio-unverified-num');

    if (barVerified) barVerified.style.width = `${verifiedPercent}%`;
    if (barUnverified) barUnverified.style.width = `${unverifiedPercent}%`;
    if (numVerified) numVerified.textContent = stats.users.verified_providers;
    if (numUnverified) numUnverified.textContent = stats.users.unverified_providers;

    // Render Regional City Analytics
    renderCityAnalytics(stats.city_analytics);
  } catch (err) {
    console.error('Failed to load admin stats:', err);
  }
}

// 2. MODULE: Employer Moderation & Security
async function loadAdminEmployers() {
  try {
    const res = await fetch('/api/v1/admin/employers', { headers: getAdminHeaders() });
    if (!res.ok) return;

    const data = await res.json();
    const employers = data.employers || [];
    const tbody = document.getElementById('admin-employers-tbody');
    if (!tbody) return;

    if (employers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No registered employers found.</td></tr>';
      return;
    }

    tbody.innerHTML = employers.map(emp => {
      const isVerified = Boolean(emp.is_business_verified);
      const isBanned = emp.account_status === 'BANNED';
      const isSuspended = emp.account_status === 'SUSPENDED';

      const statusChipClass = isBanned ? 'banned' : (isSuspended ? 'suspended' : 'active');
      const statusLabel = emp.account_status || 'ACTIVE';

      return `
        <tr data-emp-id="${emp.user_id}">
          <td>
            <strong>${escapeHtml(emp.full_name)}</strong>
            <div style="font-size: 0.75rem; color: var(--neutral-mid);">${escapeHtml(emp.phone_number || emp.email)}</div>
          </td>
          <td>
            <div style="font-weight: 600;">${escapeHtml(emp.business_name)}</div>
            <div style="font-size: 0.72rem; color: #64748B;">
              ${emp.gstin ? `<span class="badge" style="background:#E0F2FE; color:#0369A1; font-size:0.68rem; padding:1px 4px; border-radius:3px;">GSTIN: ${escapeHtml(emp.gstin)}</span>` : '<span style="color:#94A3B8;">No GSTIN</span>'}
              ${emp.pan_number ? `<span class="badge" style="background:#FEF3C7; color:#B45309; font-size:0.68rem; padding:1px 4px; border-radius:3px; margin-left:4px;">PAN: ${escapeHtml(emp.pan_number)}</span>` : ''}
            </div>
          </td>
          <td>
            <strong>${emp.active_jobs_count}</strong> active
            <span style="font-size: 0.75rem; color: #94A3B8;">(${emp.total_jobs_count} total)</span>
          </td>
          <td>
            <label class="admin-toggle-switch" title="Toggle Verified Employer Badge">
              <input type="checkbox" ${isVerified ? 'checked' : ''} onchange="toggleEmployerVerification('${emp.user_id}', this.checked)" />
              <span class="admin-toggle-slider"></span>
            </label>
            <span style="font-size: 0.72rem; margin-left: 0.4rem; font-weight: 700; color: ${isVerified ? 'var(--success)' : '#94A3B8'};">
              ${isVerified ? 'Verified' : 'Unverified'}
            </span>
          </td>
          <td>
            <span class="chip-mod-status ${statusChipClass}">${statusLabel}</span>
          </td>
          <td>
            <div class="admin-btn-group">
              ${statusLabel === 'ACTIVE' ? `
                <button class="btn-action-pill expire" onclick="updateEmployerStatus('${emp.user_id}', 'SUSPENDED')">Suspend</button>
                <button class="btn-action-pill delete" onclick="updateEmployerStatus('${emp.user_id}', 'BANNED')">Ban</button>
              ` : `
                <button class="btn-action-pill extend" onclick="updateEmployerStatus('${emp.user_id}', 'ACTIVE')">Reactivate</button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load employers:', err);
  }
}

// Toggle "Verified Employer" status
async function toggleEmployerVerification(userId, isVerified) {
  try {
    const res = await fetch(`/api/v1/admin/employers/${userId}/verify`, {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify({ is_verified: isVerified })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isVerified ? '🛡️ Emerald Verified Badge granted to employer.' : 'Verified status revoked.', isVerified ? 'success' : 'info');
      loadAdminEmployers();
      loadAdminStats();
      loadAdminJobs();
    } else {
      showToast(data.error || 'Failed to update verification status', 'alert');
    }
  } catch (err) {
    showToast('Network error updating verification status', 'alert');
  }
}

// Suspend or Ban suspicious accounts
async function updateEmployerStatus(userId, status) {
  const confirmMsg = status === 'BANNED' 
    ? 'Are you sure you want to BAN this employer? All active jobs will be paused and access restricted.'
    : `Set employer status to ${status}?`;

  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`/api/v1/admin/employers/${userId}/status`, {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify({ account_status: status })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`⚠️ Employer account marked as ${status}.`, 'info');
      loadAdminEmployers();
      loadAdminJobs();
      loadAdminStats();
    } else {
      showToast(data.error || 'Failed to update account status', 'alert');
    }
  } catch (err) {
    showToast('Network error updating account status', 'alert');
  }
}

// 3. MODULE: Job Lifecycle Manager
async function loadAdminJobs() {
  const searchInput = document.getElementById('admin-jobs-search-input');
  const statusSelect = document.getElementById('admin-jobs-status-filter');

  const search = searchInput ? searchInput.value.trim() : '';
  const status = statusSelect ? statusSelect.value : 'ALL';

  try {
    const url = `/api/v1/admin/jobs?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`;
    const res = await fetch(url, { headers: getAdminHeaders() });
    if (!res.ok) return;

    const data = await res.json();
    const jobs = data.jobs || [];
    const tbody = document.getElementById('admin-jobs-tbody');
    if (!tbody) return;

    if (jobs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No jobs match the specified criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = jobs.map(job => {
      const isExpired = job.status === 'EXPIRED' || job.is_expired;
      const isFlagged = job.status === 'FLAGGED' || job.report_count > 0;
      let statusChipClass = 'active';
      if (isFlagged) statusChipClass = 'flagged';
      else if (isExpired) statusChipClass = 'expired';
      else if (job.status === 'FILLED') statusChipClass = 'active';
      else if (job.status === 'REMOVED') statusChipClass = 'removed';

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--neutral-dark);">${escapeHtml(job.title)}</div>
            <div style="font-size: 0.75rem; color: var(--neutral-mid);">
              📍 ${escapeHtml(job.location_name)} • <span style="color: var(--primary); font-weight: 600;">${escapeHtml(job.category)}</span>
            </div>
            ${job.custom_title ? `<div style="font-size: 0.72rem; color: #64748B;">Tag: ${escapeHtml(job.custom_title)}</div>` : ''}
          </td>
          <td>
            <div style="font-weight: 600;">${escapeHtml(job.provider_name)}</div>
            <div style="font-size: 0.75rem; color: #64748B;">
              ${escapeHtml(job.provider_business || 'Independent')}
              ${job.provider_verified ? '<span style="color: #059669; font-weight: 700; margin-left: 4px;">🛡️ Verified</span>' : ''}
            </div>
          </td>
          <td>
            <div>₹${(job.salary_min || 0).toLocaleString()} - ₹${(job.salary_max || 0).toLocaleString()} <span style="font-size: 0.75rem;">/${job.salary_period}</span></div>
            <div style="font-size: 0.75rem; color: #64748B;">Vacancies: ${job.hired_count || 0}/${job.vacancies_count} • Apps: ${job.applications_count || 0}</div>
          </td>
          <td>
            <span class="chip-mod-status ${statusChipClass}">${job.status}</span>
            <div style="font-size: 0.75rem; color: ${job.days_remaining <= 2 ? 'var(--alert)' : '#64748B'}; margin-top: 3px;">
              ⏱️ ${job.days_remaining > 0 ? `${job.days_remaining}d left` : 'Expired'}
              ${job.report_count > 0 ? `<span style="color: var(--alert); font-weight: 700;">(🚩 ${job.report_count})</span>` : ''}
            </div>
          </td>
          <td>
            <div class="admin-btn-group">
              ${job.status !== 'EXPIRED' && job.status !== 'REMOVED' ? `
                <button class="btn-action-pill expire" onclick="adminExpireJob('${job.job_id}')" title="Force job status to EXPIRED">Force Expire</button>
              ` : ''}
              <button class="btn-action-pill extend" onclick="adminExtendJob('${job.job_id}', 7)" title="Extend duration by 7 days">+7d</button>
              <button class="btn-action-pill extend" onclick="adminExtendJob('${job.job_id}', 14)" title="Extend duration by 14 days">+14d</button>
              <button class="btn-action-pill extend" onclick="adminExtendJob('${job.job_id}', 30)" title="Extend duration by 30 days">+30d</button>
              ${job.report_count > 0 ? `
                <button class="btn-action-pill" style="background: #D1FAE5; color: #065F46;" onclick="adminDismissJobFlag('${job.job_id}')" title="Clear seeker reports">Dismiss Flag</button>
              ` : ''}
              <button class="btn-action-pill delete" onclick="adminDeleteJob('${job.job_id}')" title="Permanently delete malicious posting">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load admin jobs:', err);
  }
}

// Admin: Force Expire Job
async function adminExpireJob(jobId) {
  try {
    const res = await fetch(`/api/v1/admin/jobs/${jobId}/status`, {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify({ status: 'EXPIRED' })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Job listing forced to EXPIRED state.`, 'info');
      loadAdminJobs();
      loadAdminStats();
    } else {
      showToast(data.error || 'Failed to expire job', 'alert');
    }
  } catch (err) {
    showToast('Network error expiring job', 'alert');
  }
}

// Admin: Extend Job Duration
async function adminExtendJob(jobId, days = 7) {
  try {
    const res = await fetch(`/api/v1/admin/jobs/${jobId}/extend`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ days })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Listing extended by +${days} days. Status is ACTIVE.`, 'success');
      loadAdminJobs();
      loadAdminStats();
    } else {
      showToast(data.error || 'Failed to extend job', 'alert');
    }
  } catch (err) {
    showToast('Network error extending job', 'alert');
  }
}

// Admin: Dismiss Flag on Job
async function adminDismissJobFlag(jobId) {
  try {
    const res = await fetch(`/api/v1/admin/jobs/${jobId}/dismiss-flag`, {
      method: 'POST',
      headers: getAdminHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Flag on listing dismissed and marked clean.`, 'success');
      loadAdminJobs();
      loadAdminReports();
      loadAdminStats();
    }
  } catch (err) {
    showToast('Network error dismissing flag', 'alert');
  }
}

// Admin: Delete Job
async function adminDeleteJob(jobId) {
  if (!confirm('Are you sure you want to permanently delete this job posting? This action cannot be undone.')) {
    return;
  }

  try {
    const res = await fetch(`/api/v1/admin/jobs/${jobId}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Job posting permanently deleted.`, 'info');
      loadAdminJobs();
      loadAdminReports();
      loadAdminStats();
    } else {
      showToast(data.error || 'Failed to delete job', 'alert');
    }
  } catch (err) {
    showToast('Network error deleting job', 'alert');
  }
}

// 4. MODULE: Fraud & Flagged Content Moderation
async function loadAdminReports() {
  try {
    const res = await fetch('/api/v1/admin/reports', { headers: getAdminHeaders() });
    if (!res.ok) return;

    const data = await res.json();
    const reports = data.reports || [];
    const pendingReports = reports.filter(r => r.status === 'PENDING');

    // Update Flag Count Pills
    const tabBadge = document.getElementById('admin-tab-flag-count');
    const headerPill = document.getElementById('admin-flag-count-pill');
    if (tabBadge) {
      tabBadge.textContent = pendingReports.length;
      tabBadge.style.display = pendingReports.length > 0 ? 'inline-block' : 'none';
    }
    if (headerPill) {
      headerPill.textContent = `${pendingReports.length} Flagged Item${pendingReports.length === 1 ? '' : 's'}`;
    }

    const container = document.getElementById('admin-fraud-queue-list');
    if (!container) return;

    if (reports.length === 0) {
      container.innerHTML = `
        <div style="background: white; border: 1px dashed var(--neutral-border); border-radius: 8px; padding: 2.5rem; text-align: center;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🛡️</div>
          <h4 style="font-weight: 700; color: var(--neutral-dark);">Clean Trust & Safety Queue</h4>
          <p style="font-size: 0.85rem; color: var(--neutral-mid); margin-top: 0.25rem;">No seeker complaints or fraudulent job listings pending review.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = reports.map(rep => {
      const isPending = rep.status === 'PENDING';
      const isResolved = rep.status.includes('RESOLVED');
      const isDismissed = rep.status === 'DISMISSED';

      return `
        <div class="fraud-card" style="${isDismissed || isResolved ? 'opacity: 0.65; border-left-color: #94A3B8;' : ''}">
          <div class="fraud-card-header">
            <div>
              <span class="fraud-reason-tag">${escapeHtml(rep.reason)}</span>
              <h4 style="font-size: 1.05rem; font-weight: 700; margin-top: 0.4rem; color: var(--neutral-dark);">
                Job: "${escapeHtml(rep.job_title)}"
              </h4>
            </div>
            <span class="chip-mod-status ${isPending ? 'flagged' : (isDismissed ? 'expired' : 'active')}">
              ${rep.status}
            </span>
          </div>

          <div style="font-size: 0.88rem; color: var(--neutral-dark); background: rgba(255,255,255,0.7); padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0;">
            <strong>Seeker Evidence/Note:</strong> "${escapeHtml(rep.description)}"
          </div>

          <div style="font-size: 0.78rem; color: var(--neutral-mid); display: flex; justify-content: space-between; flex-wrap: wrap;">
            <span>Reporter: <strong>${escapeHtml(rep.reporter_contact || 'Anonymous')}</strong></span>
            <span>Date: ${new Date(rep.created_at).toLocaleString()}</span>
          </div>

          ${isPending ? `
            <div class="fraud-actions-row">
              <button class="btn-takedown" onclick="adminTakedownReport('${rep.report_id}')">
                🛡️ Take Down Job Post (Status: REMOVED)
              </button>
              <button class="btn-dismiss-flag" onclick="adminDismissReport('${rep.report_id}')">
                Dismiss Flag as False Alarm
              </button>
            </div>
          ` : `
            <div style="font-size: 0.75rem; color: #64748B; margin-top: 0.5rem; font-style: italic;">
              ${isResolved ? '✓ Post has been taken down and mitigated.' : 'Flag reviewed and dismissed.'}
            </div>
          `}
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load admin reports:', err);
  }
}

// Admin: Take Down Job from Report
async function adminTakedownReport(reportId) {
  try {
    const res = await fetch(`/api/v1/admin/reports/${reportId}/takedown`, {
      method: 'POST',
      headers: getAdminHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast('🛡️ Post taken down successfully. Status set to REMOVED.', 'success');
      loadAdminReports();
      loadAdminJobs();
      loadAdminStats();
    } else {
      showToast(data.error || 'Failed to take down job', 'alert');
    }
  } catch (err) {
    showToast('Network error taking down job', 'alert');
  }
}

// Admin: Dismiss Report
async function adminDismissReport(reportId) {
  try {
    const res = await fetch(`/api/v1/admin/reports/${reportId}/dismiss`, {
      method: 'POST',
      headers: getAdminHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast('Report dismissed.', 'info');
      loadAdminReports();
      loadAdminJobs();
      loadAdminStats();
    }
  } catch (err) {
    showToast('Network error dismissing report', 'alert');
  }
}

// 5. MODULE: Regional & City Analytics
function renderCityAnalytics(cityData) {
  const container = document.getElementById('admin-city-analytics-grid');
  if (!container || !Array.isArray(cityData)) return;

  const maxActive = Math.max(...cityData.map(c => c.active_jobs || 1), 1);

  container.innerHTML = cityData.map(city => {
    const percentage = Math.round((city.active_jobs / maxActive) * 100);

    return `
      <div class="city-stat-card">
        <div class="city-card-top">
          <span class="city-card-name">${escapeHtml(city.city)}</span>
          <span class="badge" style="background: var(--primary-subtle); color: var(--primary); font-weight: 700; font-size: 0.75rem; padding: 2px 8px; border-radius: 4px;">
            ${city.active_jobs} Active Jobs
          </span>
        </div>

        <div class="city-progress-bar">
          <div class="city-bar-fill" style="width: ${Math.max(percentage, 5)}%;"></div>
        </div>

        <div style="font-size: 0.8rem; color: var(--neutral-mid); display: flex; justify-content: space-between; margin-top: 0.4rem;">
          <span>Vacancies: <strong>${city.vacancies}</strong></span>
          <span>Employers: <strong>${city.employers_count}</strong></span>
        </div>

        <button class="btn-micro" style="margin-top: 0.75rem; width: 100%; border-color: var(--neutral-border); color: var(--neutral-dark);" onclick="filterLifecycleByCity('${escapeHtml(city.city)}')">
          Inspect ${escapeHtml(city.city)} Jobs →
        </button>
      </div>
    `;
  }).join('');
}

// Quick filter Lifecycle table by City
function filterLifecycleByCity(cityName) {
  const tabBtns = document.querySelectorAll('.admin-tab-btn');
  tabBtns.forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));

  const lifecycleTabBtn = document.querySelector('[data-admin-tab="job-lifecycle"]');
  const lifecyclePanel = document.getElementById('admin-tab-job-lifecycle');
  if (lifecycleTabBtn) lifecycleTabBtn.classList.add('active');
  if (lifecyclePanel) lifecyclePanel.classList.add('active');

  const searchInput = document.getElementById('admin-jobs-search-input');
  if (searchInput) {
    searchInput.value = cityName === 'Custom Locations' ? '' : cityName;
    loadAdminJobs();
  }
}

// Expose functions globally for inline HTML event handlers
window.toggleEmployerVerification = toggleEmployerVerification;
window.updateEmployerStatus = updateEmployerStatus;
window.adminExpireJob = adminExpireJob;
window.adminExtendJob = adminExtendJob;
window.adminDismissJobFlag = adminDismissJobFlag;
window.adminDeleteJob = adminDeleteJob;
window.adminTakedownReport = adminTakedownReport;
window.adminDismissReport = adminDismissReport;
window.filterLifecycleByCity = filterLifecycleByCity;
window.openAdminDashboard = openAdminDashboard;
window.exitAdminDashboard = exitAdminDashboard;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.toggleEditProfileForm = toggleEditProfileForm;
window.toggleSidebarDrawer = toggleSidebarDrawer;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.openFeedbackModal = openFeedbackModal;
window.closeFeedbackModal = closeFeedbackModal;
window.openSecurityModal = openSecurityModal;
window.closeSecurityModal = closeSecurityModal;
window.applyAppLanguage = applyAppLanguage;
window.generateCaptcha = generateCaptcha;
window.validateCaptcha = validateCaptcha;
window.showToast = showToast;
window.switchActiveRole = switchActiveRole;
