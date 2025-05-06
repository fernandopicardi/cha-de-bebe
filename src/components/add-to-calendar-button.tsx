'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CalendarPlus } from 'lucide-react';
import { addToCalendar, type EventDetails } from '@/services/calendar'; // Assuming service exists

interface AddToCalendarButtonProps {
  eventDetails: EventDetails;
}

export default function AddToCalendarButton({
  eventDetails,
}: AddToCalendarButtonProps) {
  const handleAddToCalendar = async (type: 'google' | 'ical') => {
    try {
      const url = await addToCalendar(eventDetails, type);
      // Attempt to open the URL in a new tab
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error(`Erro ao gerar link do calendário (${type}):`, error);
      // Optionally show a toast notification for the error
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='outline'
          className='border-primary text-primary hover:bg-primary/10'
        >
          <CalendarPlus className='mr-2 h-4 w-4' />
          Adicionar ao Calendário
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='bg-popover border-border'>
        <DropdownMenuItem
          onClick={() => handleAddToCalendar('google')}
          className='cursor-pointer focus:bg-accent focus:text-accent-foreground'
        >
          Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleAddToCalendar('ical')}
          className='cursor-pointer focus:bg-accent focus:text-accent-foreground'
        >
          iCal (Apple, Outlook)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
