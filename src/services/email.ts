'use server';

import type { GiftItem, EventSettings } from '@/data/gift-store';
import { addToCalendar } from './calendar'; // Import calendar service

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL; // e.g., 'noreply@yourdomain.com'

// Basic validation
if (!RESEND_API_KEY) {
  console.warn("Email Service: RESEND_API_KEY environment variable is not set. Email sending will be disabled.");
}
if (!FROM_EMAIL) {
    console.warn("Email Service: FROM_EMAIL environment variable is not set. Defaulting to 'noreply@example.com'.");
    // Provide a default or handle the error appropriately
}

/**
 * Sends a reminder email to the guest who selected a gift.
 *
 * @param guestEmail The email address of the guest.
 * @param guestName The name of the guest.
 * @param item The gift item selected.
 * @param quantitySelected The quantity of the item selected.
 * @param eventSettings The details of the event.
 */
export async function sendGiftReminderEmail(
  guestEmail: string,
  guestName: string,
  item: GiftItem,
  quantitySelected: number,
  eventSettings: EventSettings
): Promise<void> {
  if (!RESEND_API_KEY || !FROM_EMAIL) {
    console.log("Email Service: Skipping email send due to missing API key or FROM address.");
    return; // Don't proceed if Resend isn't configured
  }
  if (!guestEmail) {
     console.log("Email Service: Skipping email send because guest email is missing.");
     return;
  }

  console.log(`Email Service: Preparing reminder email for ${guestName} <${guestEmail}> for item "${item.name}" (Qty: ${quantitySelected})`);

   // Format event date and time
   let formattedDateTime = "Data e hora a confirmar";
   if (eventSettings.date && eventSettings.time) {
     try {
       const date = new Date(`${eventSettings.date}T${eventSettings.time}:00`);
       if (!isNaN(date.getTime())) {
           formattedDateTime = date.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
       }
     } catch (e) { console.error("Error formatting date for email:", e); }
   }

   // Generate calendar links
   let googleCalendarLink = '#';
   let iCalLink = '#';
   try {
       googleCalendarLink = addToCalendar(eventSettings, 'google');
       iCalLink = addToCalendar(eventSettings, 'ical');
   } catch(e) {
       console.error("Error generating calendar links for email:", e);
   }

   const isQuantityItem = typeof item.totalQuantity === 'number' && item.totalQuantity > 0;
   const itemDisplayName = `${item.name}${isQuantityItem ? ` (${quantitySelected} unidade${quantitySelected > 1 ? 's' : ''})` : ''}`;


   // Email subject
   const subject = `Lembrete do presente: ${item.name} - Chá de Bebê ${eventSettings.babyName || ''}`;

   // Email HTML body
   const htmlBody = `
     <!DOCTYPE html>
     <html>
     <head>
       <meta charset="UTF-8">
       <meta name="viewport" content="width=device-width, initial-scale=1.0">
       <title>${subject}</title>
       <style>
         /* Basic styling - enhance as needed */
         body { font-family: sans-serif; line-height: 1.6; color: #333; }
         .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; background-color: #f9f9f9; }
         h1 { color: #A0E9FD; } /* Use theme colors */
         p { margin-bottom: 15px; }
         strong { font-weight: bold; }
         ul { list-style: none; padding: 0; }
         li { margin-bottom: 10px; }
         .item-details { background-color: #ffffff; padding: 15px; border-radius: 5px; margin-top: 20px; border: 1px solid #ddd;}
         .item-image { max-width: 200px; height: auto; border-radius: 8px; margin-top: 10px; border: 1px solid #eee; display: block; }
         .event-details { margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; }
         .calendar-links a { margin-right: 10px; text-decoration: none; background-color: #E6E6FA; color: #333; padding: 8px 12px; border-radius: 5px; font-size: 0.9em; }
         .footer { margin-top: 30px; font-size: 0.8em; color: #777; text-align: center; }
       </style>
     </head>
     <body>
       <div class="container">
         <h1>Olá ${guestName},</h1>
         <p>Muito obrigado por escolher um presente para o nosso Chá de Bebê!</p>
         <p>Este é um lembrete do item que você selecionou:</p>

         <div class="item-details">
           <h2>Presente Selecionado</h2>
           <p><strong>Item:</strong> ${itemDisplayName}</p>
           ${item.description ? `<p><strong>Descrição:</strong> ${item.description}</p>` : ''}
           ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}" class="item-image">` : ''}
         </div>

         <div class="event-details">
           <h2>Detalhes do Evento</h2>
           <ul>
             <li><strong>Data e Hora:</strong> ${formattedDateTime}</li>
             <li><strong>Local:</strong> ${eventSettings.location || 'A confirmar'}</li>
             <li><strong>Endereço:</strong> ${eventSettings.address || 'A confirmar'}</li>
           </ul>
           <p class="calendar-links">
             Adicionar ao calendário:
             <a href="${googleCalendarLink}" target="_blank">Google Calendar</a>
             <a href="${iCalLink}">iCal/Outlook</a>
           </p>
         </div>

         <p>Mal podemos esperar para celebrar com você!</p>
         <p>Com carinho,</p>
         <p>[Nome dos Pais - Pode ser configurável no admin]</p> {/* TODO: Make names dynamic */}

         <div class="footer">
           Este é um e-mail automático. Por favor, não responda.
         </div>
       </div>
     </body>
     </html>
   `;

   // --- Send Email using Resend ---
   try {
     console.log("Email Service: Sending email via Resend...");
     const response = await fetch('https://api.resend.com/emails', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${RESEND_API_KEY}`,
       },
       body: JSON.stringify({
         from: FROM_EMAIL,
         to: guestEmail,
         subject: subject,
         html: htmlBody,
       }),
     });

     const data = await response.json();

     if (!response.ok) {
       console.error(`Email Service: Resend API error (${response.status}):`, data);
       throw new Error(data.message || 'Failed to send email via Resend API');
     }

     console.log("Email Service: Email sent successfully via Resend. Response ID:", data.id);
   } catch (error) {
     console.error("Email Service: Error sending email:", error);
     // Decide if you want to re-throw the error or handle it silently
     // throw error;
   }
}
```