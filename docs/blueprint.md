# **App Name**: Chá de bebê

## Core Features:

- Gift List Display: Categorized gift list (e.g., clothes, hygiene) with name, optional description, and status (Available, Selected, Not Needed).Filters by category/status for easy navigation.Empathetic welcome message (e.g., "Your presence is our greatest gift! This is just a guide for gifting.").Event details (date, time, location) with calendar integration (Google Calendar/iCal).
- Item Selection: Guests select available items, input their name, and see a warm thank-you message (e.g., "Thank you, [name]! [Item] will brighten our baby’s day!").Store selection in Firestore (item, guest name, date).Option to suggest new items, pending admin approval with confirmation message.
- Admin Panel: Secure login via Firebase Authentication to:Add, edit, remove items, and update status.Approve/reject suggested items.View/revert selections.Update event details and custom messages.Export selections as CSV.

## Style Guidelines:

- Primary Colors: Pastel blue (#A0E9FD), soft pink (#F9B7FF) for a welcoming vibe.
- Secondary Colors: Light gray (#E0E0E0) for backgrounds, white (#FFFFFF) for content.
- Accent: Lavender (#E6E6FA) for buttons/CTAs.
- Feedback Colors: Soft green (#C1E1C1) for success, soft red (#FFD1D1) for errors.
- Typography: Poppins (16px body, 24px titles), 1.5 line-height.
- Icons: Rounded, baby-themed (e.g., rattles, bottles) from FontAwesome.
- Layout: Minimalist, responsive (1-column mobile, 2-3 desktop), rounded cards, 16-32px margins.
- Animations: Fade-in items (0.3s), button pulse, confetti on selection.