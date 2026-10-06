import express from 'express';
import { store } from '../services/store.js';

export const authRouter = express.Router();

// 1. Send OTP to Mobile Phone
authRouter.post('/otp/send', (req, res) => {
  const { phone_number } = req.body;

  if (!phone_number || phone_number.trim().length < 8) {
    return res.status(400).json({ error: 'Valid phone number is required.' });
  }

  const result = store.generateAndSendOtp(phone_number.trim());
  res.json({
    success: true,
    message: `OTP sent successfully to ${phone_number}.`,
    demo_otp: result.otp,
    demo_note: result.demoNote
  });
});

// 2. Verify OTP and Authenticate User
authRouter.post('/otp/verify', (req, res) => {
  const { phone_number, otp, intent_role = null, full_name = '' } = req.body;

  if (!phone_number || !otp) {
    return res.status(400).json({ error: 'Both phone_number and otp are required.' });
  }

  const result = store.verifyOtp(phone_number.trim(), otp.trim(), intent_role, full_name);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({
    success: true,
    message: 'OTP verified successfully.',
    user: result.user,
    token: result.token,
    post_login_intent: result.user?.role || intent_role
  });
});

// 3. Email Authentication (Password or Passwordless Magic Link)
authRouter.post('/login-email', (req, res) => {
  const { email, password, is_magic_link = false, intent_role = null, full_name = '' } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  const result = store.loginWithEmail(email, password, intent_role, full_name);
  res.json({
    success: true,
    message: is_magic_link ? 'Magic link authenticated successfully.' : 'Signed in successfully.',
    user: result.user,
    token: result.token,
    post_login_intent: result.user?.role || intent_role
  });
});

// 4. OAuth 2.0 ("Continue with Google")
authRouter.post('/oauth-google', (req, res) => {
  const { google_profile, intent_role = null } = req.body;

  const profile = google_profile || {
    name: 'Verified Google User',
    email: 'user.google@gmail.com',
    picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
  };

  const result = store.loginWithGoogle(profile, intent_role);
  res.json({
    success: true,
    message: 'Authenticated with Google OAuth 2.0.',
    user: result.user,
    token: result.token,
    post_login_intent: result.user?.role || intent_role
  });
});

// 5. Current User Profile Lookup
authRouter.get('/me', (req, res) => {
  const { user_id, phone } = req.query;
  let user = null;

  if (user_id) {
    user = store.getUserById(user_id);
  } else if (phone) {
    user = store.getUserByPhone(phone);
  } else {
    // Default to first verified provider or seeker
    user = store.getAllUsers()[0];
  }

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  res.json({ success: true, user });
});

// 6. 2-Step Employer Verification Guard (Phone OTP + Business GSTIN/PAN)
authRouter.post('/employer/verify', (req, res) => {
  const { user_id, phone_otp, gstin, pan_number, business_name, pincode } = req.body;

  const result = store.verifyEmployer(user_id, {
    phoneOtp: phone_otp,
    gstin,
    panNumber: pan_number,
    businessName: business_name,
    pincode
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({
    success: true,
    message: result.is_verified_employer
      ? '🎉 Business and phone verified! Verified Employer badge unlocked.'
      : 'Phone verified. Complete Step 2 with GSTIN/PAN for Verified status.',
    ...result
  });
});
