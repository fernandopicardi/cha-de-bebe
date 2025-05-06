"use server";

import type { GiftItem, EventSettings } from "@/data/gift-store";
import { addToCalendar } from "./calendar"; // Import calendar service

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@example.com"; // Use default if not set
const PARENT_NAMES = process.env.PARENT_NAMES || "[Nome dos Pais]"; // Get parent names from env or use placeholder

// Basic validation
if (!RESEND_API_KEY) {
  console.warn(
    "Email Service: RESEND_API_KEY environment variable is not set. Email sending will be disabled.",
  );
}
if (!process.env.FROM_EMAIL) {
  // Check specifically if the original env var was set
  console.warn(
    "Email Service: FROM_EMAIL environment variable is not set. Defaulting to 'noreply@example.com'.",
  );
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
  eventSettings: EventSettings,
): Promise<void> {
  if (!RESEND_API_KEY || !FROM_EMAIL) {
    console.log(
      "Email Service: Skipping email send due to missing API key or FROM address.",
    );
    return; // Don't proceed if Resend isn't configured
  }
  if (!guestEmail) {
    console.log(
      "Email Service: Skipping email send because guest email is missing.",
    );
    return;
  }

  console.log(
    `Email Service: Preparing reminder email for ${guestName} <${guestEmail}> for item "${item.name}" (Qty: ${quantitySelected})`,
  );

  // Format event date and time
  let formattedDateTime = "Data e hora a confirmar";
  if (eventSettings.date && eventSettings.time) {
    try {
      const date = new Date(`${eventSettings.date}T${eventSettings.time}:00`);
      if (!isNaN(date.getTime())) {
        formattedDateTime = date.toLocaleString("pt-BR", {
          dateStyle: "full",
          timeStyle: "short",
        });
      }
    } catch (e) {
      console.error("Error formatting date for email:", e);
    }
  }

  // Generate calendar links
  let googleCalendarLink = "#";
  let iCalLink = "#";
  try {
    googleCalendarLink = addToCalendar(eventSettings, "google");
    iCalLink = addToCalendar(eventSettings, "ical");
  } catch (e) {
    console.error("Error generating calendar links for email:", e);
  }

  const isQuantityItem =
    typeof item.totalQuantity === "number" && item.totalQuantity > 0;
  const itemDisplayName = `${item.name}${isQuantityItem ? ` (${quantitySelected} unidade${quantitySelected > 1 ? "s" : ""})` : ""}`;

  // Email subject
  const subject = `Lembrete do presente: ${item.name} - Chá de Bebê ${eventSettings.babyName || ""}`;

  // Email HTML body using template literals for better readability
  const htmlBody = `
     <!DOCTYPE html>
     <html>
     <head>
       <meta charset="UTF-8">
       <meta name="viewport" content="width=device-width, initial-scale=1.0">
       <title>${subject}</title>
       <style>
         body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
         .email-container { max-width: 600px; margin: 20px auto; padding: 30px; border: 1px solid #ddd; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
         .header { text-align: center; margin-bottom: 30px; }
         .header h1 { color: hsl(var(--primary)); margin: 0; font-size: 28px; font-weight: 600; } /* Use primary color */
         .content p { margin-bottom: 15px; font-size: 16px; }
         .content strong { font-weight: 600; }
         .section { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
         .section h2 { color: hsl(var(--secondary)); margin-top: 0; margin-bottom: 15px; font-size: 22px; font-weight: 600; } /* Use secondary color */
         .item-details { background-color: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #eee; margin-bottom: 20px; }
         .item-image-container { text-align: center; margin-top: 15px; }
         .item-image { max-width: 100%; height: auto; max-height: 250px; border-radius: 8px; border: 1px solid #eee; display: inline-block; }
         .event-details ul { list-style: none; padding: 0; }
         .event-details li { margin-bottom: 10px; font-size: 16px; }
         .calendar-links { margin-top: 20px; text-align: center; }
         .calendar-links a { display: inline-block; margin: 5px; text-decoration: none; background-color: hsl(var(--accent)); color: hsl(var(--accent-foreground)); padding: 10px 15px; border-radius: 5px; font-size: 14px; font-weight: 500; transition: background-color 0.2s ease; }
         .calendar-links a:hover { background-color: hsl(var(--accent) / 0.9); } /* Slightly darker accent on hover */
         .footer { margin-top: 40px; font-size: 12px; color: #777; text-align: center; }
         .parents-signature { margin-top: 20px; }
       </style>
     </head>
     <body>
       <div class="email-container">
         <div class="header">
           <h1>Lembrete do Chá de Bebê ${eventSettings.babyName ? `de ${eventSettings.babyName}` : ""}!</h1>
         </div>

         <div class="content">
           <p>Olá ${guestName},</p>
           <p>Esperamos que esteja bem!</p>
           <p>Queremos agradecer de coração por ter escolhido um presente para o nosso Chá de Bebê. Sua generosidade significa muito para nós!</p>
           <p>Este é um lembrete amigável do item que você reservou:</p>

           <div class="item-details">
             <h2>🎁 Presente Selecionado</h2>
             <p><strong>Item:</strong> ${itemDisplayName}</p>
             ${item.description ? `<p><strong>Detalhes:</strong> ${item.description}</p>` : ""}
             ${item.imageUrl ? `<div class="item-image-container"><img src="${item.imageUrl}" alt="${item.name}" class="item-image"></div>` : ""}
           </div>

           <div class="section event-details">
             <h2>🗓️ Detalhes do Evento</h2>
             <ul>
               <li><strong>Data e Hora:</strong> ${formattedDateTime}</li>
               <li><strong>Local:</strong> ${eventSettings.location || "A confirmar"}</li>
               <li><strong>Endereço:</strong> ${eventSettings.address || "A confirmar"}</li>
             </ul>
             <p class="calendar-links">
               Adicione ao seu calendário para não esquecer: <br>
               <a href="${googleCalendarLink}" target="_blank">Google Calendar</a>
               <a href="${iCalLink}">iCal/Outlook</a>
             </p>
           </div>

           <p class="parents-signature">Mal podemos esperar para celebrar este momento especial com você!</p>
           <p>Com carinho,</p>
           <p><strong>${PARENT_NAMES}</strong></p>
         </div>

         <div class="footer">
           Este é um e-mail automático. Por favor, não responda diretamente.
         </div>
       </div>
     </body>
     </html>
   `;

  // --- Send Email using Resend ---
  try {
    console.log("Email Service: Sending email via Resend...");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
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
      console.error(
        `Email Service: Resend API error (${response.status}):`,
        data,
      );
      // Log specific error details if available
      const errorMessage =
        data?.message ||
        data?.error?.message ||
        "Failed to send email via Resend API";
      throw new Error(errorMessage);
    }

    console.log(
      "Email Service: Email sent successfully via Resend. Response ID:",
      data.id,
    );
  } catch (error) {
    console.error("Email Service: Error sending email:", error);
    // Decide if you want to re-throw the error or handle it silently
    // throw error; // Re-throwing might be better for debugging in development
  }
}
