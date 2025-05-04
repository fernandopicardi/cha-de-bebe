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
   * The time of the event in HH:MM format.
   */
  time: string;
  /**
   * The location of the event.
   */
  location: string;
  /**
   * A description of the event.
   */
  description?: string;
}

/**
 * Adds an event to the user's calendar (Google Calendar or iCal).
 *
 * @param eventDetails The details of the event to add.
 * @param calendarType The type of calendar to add the event to ('google' or 'ical').
 * @returns A promise that resolves to a URL for adding the event to the specified calendar.
 */
export async function addToCalendar(
  eventDetails: EventDetails,
  calendarType: 'google' | 'ical'
): Promise<string> {
  // TODO: Implement this by generating a Google Calendar or iCal URL.
  return `https://example.com/calendar/event?type=${calendarType}&event=${eventDetails.title}`;
}
