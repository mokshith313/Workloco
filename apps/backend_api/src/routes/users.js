import express from 'express';
import { store } from '../services/store.js';

export const usersRouter = express.Router();

// 1. Get User Profile by ID
usersRouter.get('/:userId', (req, res) => {
  const { userId } = req.params;
  const user = store.getUserById(userId);

  if (!user) {
    return res.status(404).json({ success: false, error: `User with ID ${userId} not found.` });
  }

  res.json({ success: true, user });
});

// 2. Update User Profile (Full Name, Bio, Phone, Email, Role, Avatar URL, City, Skills, Business Name)
usersRouter.put('/:userId', (req, res) => {
  const { userId } = req.params;
  const { full_name, bio, phone_number, email, role, avatar_url, preferred_language, city, skills, portfolio_url, business_name } = req.body;

  const result = store.updateUserProfile(userId, {
    full_name,
    bio,
    phone_number,
    email,
    role,
    avatar_url,
    preferred_language,
    city,
    skills,
    portfolio_url,
    business_name
  });

  if (!result.success) {
    return res.status(404).json({ success: false, error: result.error });
  }

  console.log(`[UsersAPI] Profile updated for user ${userId} (${result.user.full_name}).`);

  res.json({
    success: true,
    message: 'User profile updated successfully.',
    user: result.user
  });
});

// 3. Update User Preferred Language
usersRouter.patch('/:userId/language', (req, res) => {
  const { userId } = req.params;
  const { preferred_language } = req.body;

  if (!preferred_language) {
    return res.status(400).json({ success: false, error: 'preferred_language is required (e.g. en, hi, te).' });
  }

  const result = store.updateUserLanguage(userId, preferred_language);

  if (!result.success) {
    return res.status(404).json({ success: false, error: result.error });
  }

  console.log(`[UsersAPI] Language updated to ${preferred_language} for user ${userId}.`);

  res.json({
    success: true,
    message: `Language updated to ${preferred_language}.`,
    preferred_language: result.preferred_language,
    user: result.user
  });
});
