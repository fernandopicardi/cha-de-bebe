

/**
 * Represents event details to be added to a calendar.
 */
export interface EventDetails {
  /**
   * The title of the event.
   */
  title: string;
  /**
   * The date of the event in ISO format (YYYY-MM-DD).
   */
  date: string;
  /**
   * The time of the event in HH:MM format (24-hour).
   */
  time: string;
  /**
   * The location name/venue of the event.
   */
  location: string;
   /**
    * The full address of the event location.
    */
   address: string;
  /**
   * An optional description for the event.
   */
  description?: string;
  /**
    * Optional: Duration in minutes (default: 180 minutes = 3 hours).
    */
  duration?: number;
}

/**
 * Generates a URL to add an event to Google Calendar or an iCal file download link.
 *
 * @param eventDetails The details of the event to add.
 * @param calendarType The type of calendar link to generate ('google' or 'ical').
 * @returns A URL string for adding the event.
 */
export function addToCalendar(
  eventDetails: EventDetails,
  calendarType: 'google' | 'ical'
): string {

  const { title, date, time, location, address, description, duration = 180 } = eventDetails;

  // Combine date and time, assuming local timezone for the input
  // Note: Timezone handling can be complex. This assumes the user's system timezone matches the event timezone.
  const startDateTime = new Date(`${date}T${time}:00`);
  if (isNaN(startDateTime.getTime())) {
      console.error("Invalid date/time format provided:", date, time);
      throw new Error("Invalid date/time format.");
  }

  // Calculate end time
  const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

  // Format dates for Google Calendar (YYYYMMDDTHHmmssZ) - Needs UTC conversion
  const formatUtcDateTime = (dt: Date): string => {
    return dt.toISOString().replace(/-|:|\.\d{3}/g, '');
  };

  const googleStartDate = formatUtcDateTime(startDateTime);
  const googleEndDate = formatUtcDateTime(endDateTime);

  // Format dates for iCal (YYYYMMDDTHHmmss) - Typically local time or specify TZID
  const formatICalDateTime = (dt: Date): string => {
      const pad = (num: number) => (num < 10 ? '0' : '') + num;
      return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;
  };
  const iCalStartDate = formatICalDateTime(startDateTime);
  const iCalEndDate = formatICalDateTime(endDateTime);

  const fullLocation = `${location}, ${address}`;
  const eventDesc = description || `Chá de Bebê - ${title}`; // Default description


  if (calendarType === 'google') {
    // Construct Google Calendar URL
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${googleStartDate}/${googleEndDate}`,
      details: eventDesc,
      location: fullLocation,
      // ctz: 'America/Sao_Paulo' // Optional: Specify timezone, check valid IDs
    });
    return `https://www.google.com/calendar/render?${params.toString()}`;

  } else if (calendarType === 'ical') {
     // Construct iCal Data URI
     const icsContent = [
       'BEGIN:VCALENDAR',
       'VERSION:2.0',
       'PRODID:-//YourAppName//Event//EN', // Identify your app
       'BEGIN:VEVENT',
       `UID:${Date.now()}@${window.location.hostname}`, // Basic unique ID
       `DTSTAMP:${formatUtcDateTime(new Date())}`, // Timestamp of creation (UTC)
       `DTSTART:${iCalStartDate}`, // Start time (local or specify TZID)
       `DTEND:${iCalEndDate}`, // End time (local or specify TZID)
       // Optional: Specify timezone if times are local
       // `DTSTART;TZID=America/Sao_Paulo:${iCalStartDate}`,
       // `DTEND;TZID=America/Sao_Paulo:${iCalEndDate}`,
       `SUMMARY:${title}`,
       `DESCRIPTION:${eventDesc.replace(/\n/g, '\\n')}`, // Escape newlines
       `LOCATION:${fullLocation.replace(/,/g, '\\,')}`, // Escape commas
       'STATUS:CONFIRMED',
       'SEQUENCE:0', // Sequence number for updates
       'END:VEVENT',
       'END:VCALENDAR'
     ].join('\r\n'); // Use CRLF line endings for iCal

     // Create a Data URI for downloading the .ics file
     return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
  } else {
      throw new Error("Invalid calendar type specified.");
  }
}
