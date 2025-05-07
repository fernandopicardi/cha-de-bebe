'use server';

import type { GiftItem, EventSettings } from '@/data/gift-store';
// Removed: import { addToCalendar } from './calendar'; // Import calendar service

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@example.com'; // Use default if not set
const PARENT_NAMES = process.env.PARENT_NAMES || '[Nome dos Pais]'; // Get parent names from env or use placeholder

// Basic validation
if (!RESEND_API_KEY) {
  console.warn(
    'Email Service: RESEND_API_KEY environment variable is not set. Email sending will be disabled.'
  );
}
if (!process.env.FROM_EMAIL) {
  // Check specifically if the original env var was set
  console.warn(
    "Email Service: FROM_EMAIL environment variable is not set. Defaulting to 'noreply@example.com'."
  );
}

// --- Email Reminder Function Removed ---
// The sendGiftReminderEmail function has been removed as per the request.
// If you need to re-implement email functionality later, you can add it back here.

console.log('Email Service: Reminder email functionality has been removed.');
