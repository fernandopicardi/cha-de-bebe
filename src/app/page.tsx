'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Baby,
  CalendarDays,
  Gift,
  MapPin,
  LogIn,
  RefreshCcw,
  AlertCircle,
  LoaderCircle,
  ListChecks,
  ListX,
  PartyPopper,
  UserCheck,
  Users, // Icon for Confirmation
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GiftList from '@/components/gift-list';
import AddToCalendarButton from '@/components/add-to-calendar-button';
import SuggestItemButton from '@/components/suggest-item-button';
import ConfirmationForm from '@/components/confirmation-form'; // Import the new form component
import {
  getEventSettings,
  getGifts,
  type EventSettings,
  type GiftItem,
} from '@/data/gift-store'; // Corrected import path
import { ThemeToggle } from '@/components/theme-toggle';

// Define default settings to use if fetch fails or returns null
const defaultEventSettings: EventSettings = {
  id: 'main',
  title: 'Chá de Bebê',
  babyName: null,
  date: '', // Provide empty strings or sensible defaults
  time: '',
  location: 'Local a confirmar',
  address: 'Endereço a confirmar',
  welcomeMessage:
    'Sua presença é o nosso maior presente! Esta lista é apenas um guia carinhoso para quem desejar nos presentear. Sinta-se totalmente à vontade, o importante é celebrar conosco!',
  duration: 180,
  headerImageUrl: null,
};

export default function Home() {
  const [eventDetails, setEventDetails] = useState<EventSettings | null>(null);
  const [gifts, setGifts] = useState<GiftItem[] | null>(null); // Start as null for loading state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data function using useCallback for stability
  const fetchData = useCallback(async (source?: string) => {
    console.log(
      `Home Page: Fetching data (triggered by ${source || 'initial load'})...`
    );
    setIsLoading(true); // Set loading true at the start of fetch
    setError(null);

    try {
      console.log('Home Page: Calling getEventSettings and getGifts...');
      // Initialize Firestore data if needed (run once concept)
      // await initializeFirestoreData(); // Consider if this is the right place
      const eventDataPromise = getEventSettings();
      const giftsDataPromise = getGifts();

      // Wait for both promises to resolve
      const [eventData, giftsData] = await Promise.all([
        eventDataPromise,
        giftsDataPromise,
      ]);

      console.log(
        'Home Page: Fetched Event Settings:',
        eventData ? 'Data received' : 'Null/Undefined'
      );
      console.log('Home Page: Fetched Gifts Count:', giftsData?.length ?? 0);
      // console.log("Home Page: Sample gifts:", giftsData?.slice(0, 3));

      // Update state, ensuring defaults/empty arrays are used if data is null/undefined
      setEventDetails(eventData ?? defaultEventSettings);
      setGifts(giftsData || []); // Use fetched gifts or empty array
    } catch (err: any) {
      console.error('Home Page: Error fetching data:', err);
      setError(
        `Erro ao carregar os dados: ${err.message || 'Erro desconhecido'}`
      );
      console.log('Home Page: Clearing state due to error.');
      setEventDetails(defaultEventSettings); // Reset to defaults on error
      setGifts([]); // Set to empty array on error
    } finally {
      setIsLoading(false); // Set loading false after fetch completes (success or error)
      console.log('Home Page: Fetching complete, loading set to false.');
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchData('useEffect[mount]');
  }, [fetchData]);

  // Function to manually trigger data refresh
  const handleRefresh = useCallback(() => {
    console.log('Home Page: Manual refresh requested.');
    fetchData('manual refresh button');
  }, [fetchData]);

  // Callback for when a confirmation is successfully added
  const handleConfirmationSuccess = useCallback(() => {
    console.log(
      'Home Page: Confirmation successful, triggering data refresh (if needed for confirmations display later).'
    );
    // Currently, confirmations aren't displayed on this page, so no immediate refresh needed.
    // If confirmations were displayed here, you might call fetchData("confirmation success");
  }, []);

  // Format Date and Time safely
  let formattedDate = 'Data a confirmar';
  let formattedTime = 'Hora a confirmar';

  if (eventDetails && eventDetails.date && eventDetails.time) {
    try {
      // Try parsing first assuming YYYY-MM-DD format
      let eventDate = new Date(`${eventDetails.date}T${eventDetails.time}:00`);

      // If parsing fails, try adding T00:00:00 (common issue if time is missing/invalid)
      if (isNaN(eventDate.getTime())) {
        console.warn(
          'Home Page: Initial date/time parse failed, trying fallback.'
        );
        eventDate = new Date(`${eventDetails.date}T00:00:00`);
      }

      if (!isNaN(eventDate.getTime())) {
        formattedDate = eventDate.toLocaleDateString('pt-BR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        // Only format time if the original time string looks valid
        if (/^\d{2}:\d{2}$/.test(eventDetails.time)) {
          formattedTime = eventDetails.time; // Display the input time directly if valid format
        } else {
          console.warn(
            'Home Page: Invalid time format, using placeholder:',
            eventDetails.time
          );
          formattedTime = 'Hora a confirmar'; // Fallback if time format is wrong
        }
      } else {
        console.warn(
          'Home Page: Could not parse event date/time:',
          eventDetails.date,
          eventDetails.time
        );
      }
    } catch (e) {
      console.error('Home Page: Error formatting date/time:', e);
    }
  }

  // Construct Page Title and Welcome Message
  const pageTitle = eventDetails?.babyName
    ? `${eventDetails.title} ${eventDetails.babyName}!`
    : eventDetails?.title || 'Chá de Bebê';

  const welcomeMsg =
    eventDetails?.welcomeMessage ||
    'Sua presença é o nosso maior presente! Esta lista é apenas um guia carinhoso para quem desejar nos presentear. Sinta-se totalmente à vontade, o importante é celebrar conosco!';

  // Loading State
  if (isLoading || gifts === null) {
    // Check if gifts is still null
    return (
      <div className='flex flex-col items-center justify-center min-h-screen p-4 text-center'>
        <LoaderCircle className='h-12 w-12 animate-spin text-primary mb-4' />
        <p className='text-lg text-muted-foreground'>
          Carregando informações...
        </p>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen text-center p-4'>
        <AlertCircle className='h-12 w-12 text-destructive mb-4' />
        <h2 className='text-xl font-semibold mb-2'>Erro ao Carregar</h2>
        <p className='text-muted-foreground mb-4'>{error}</p>
        <Button onClick={handleRefresh} variant='outline'>
          <RefreshCcw className='mr-2 h-4 w-4' /> Tentar Novamente
        </Button>
      </div>
    );
  }

  // Main Content Render
  return (
    <div className='container mx-auto p-4 md:p-8 space-y-8 relative'>
      {/* Header Buttons */}
      <div className='absolute top-4 right-4 md:top-8 md:right-8 z-10 flex items-center gap-2'>
        <ThemeToggle />
        <Button
          onClick={handleRefresh}
          variant='outline'
          size='icon'
          title='Recarregar'
        >
          <RefreshCcw className='h-4 w-4' />
        </Button>
        <Link href='/admin/login'>
          <Button variant='outline' size='sm'>
            <LogIn className='mr-2 h-4 w-4' />
            Admin
          </Button>
        </Link>
      </div>

      {/* Page Header */}
      <header className='text-center space-y-4 pt-16'>
        {/* Display Header Image or Placeholder */}
        <div className='relative mx-auto w-40 h-40 md:w-56 md:h-56 rounded-full overflow-hidden shadow-lg mb-6 border-4 border-secondary'>
          {' '}
          {/* Increased size */}
          {eventDetails?.headerImageUrl ? (
            <Image
              src={eventDetails.headerImageUrl}
              alt='Cabeçalho Chá de Bebê'
              fill
              style={{ objectFit: 'cover' }}
              priority // Load header image sooner
              sizes='(max-width: 768px) 160px, 224px' // Adjusted sizes
              data-ai-hint='baby celebration banner'
              // No need for unoptimized if using Firebase Storage URLs
            />
          ) : (
            // Placeholder if no image is set
            <div className='flex items-center justify-center h-full w-full bg-muted'>
              <Baby className='h-20 w-20 md:h-24 md:w-24 text-secondary' />{' '}
              {/* Increased icon size */}
            </div>
          )}
        </div>

        <h1 className='text-3xl md:text-4xl font-semibold text-primary'>
          {pageTitle}
        </h1>
        <p className='text-lg text-muted-foreground px-4 md:px-8'>
          {welcomeMsg}
        </p>
      </header>

      {/* Event Details Card */}
      <Card className='bg-card shadow-md rounded-lg overflow-hidden'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <CalendarDays className='h-6 w-6 text-primary' /> Detalhes
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center gap-2'>
            <CalendarDays className='h-5 w-5 text-accent-foreground' />
            <span>
              {formattedDate} às {formattedTime}
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <MapPin className='h-5 w-5 text-accent-foreground' />
            <span>
              {eventDetails?.location || 'Local a definir'} -{' '}
              {eventDetails?.address || 'Endereço a definir'}
            </span>
          </div>
          {eventDetails && <AddToCalendarButton eventDetails={eventDetails} />}
        </CardContent>
      </Card>

      {/* Presence Confirmation Section */}
      <Card className='bg-card shadow-md rounded-lg overflow-hidden'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Users className='h-6 w-6 text-primary' /> Confirme sua Presença
          </CardTitle>
          <CardDescription>
            Confirme quem irá comparecer ao evento. Digite os nomes separados
            por vírgula.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmationForm onSuccess={handleConfirmationSuccess} />
        </CardContent>
      </Card>

      {/* Gift List Section */}
      <section className='space-y-6'>
        <div className='flex flex-col sm:flex-row justify-between items-center gap-4'>
          <h2 className='text-2xl font-semibold flex items-center gap-2'>
            <Gift className='h-6 w-6 text-primary' /> Lista de Presentes
          </h2>
          <SuggestItemButton onSuggestionAdded={fetchData} />
        </div>

        <Tabs defaultValue='all' className='w-full'>
          <TabsList className='mb-6 md:mb-8'>
            {' '}
            {/* Applied mb-6 and md:mb-8 */}
            <TabsTrigger
              value='all'
              className='data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 sm:flex-none'
            >
              {' '}
              {/* Added flex-1 sm:flex-none */}
              <ListChecks className='mr-1 h-4 w-4' /> Todos
            </TabsTrigger>
            <TabsTrigger
              value='available'
              className='data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 sm:flex-none'
            >
              {' '}
              {/* Added flex-1 sm:flex-none */}
              <PartyPopper className='mr-1 h-4 w-4' /> Disponíveis
            </TabsTrigger>
            <TabsTrigger
              value='selected'
              className='data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 sm:flex-none'
            >
              {' '}
              {/* Added flex-1 sm:flex-none */}
              <UserCheck className='mr-1 h-4 w-4' /> Selecionados
            </TabsTrigger>
            <TabsTrigger
              value='not_needed'
              className='data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 sm:flex-none'
            >
              {' '}
              {/* Added flex-1 sm:flex-none */}
              <ListX className='mr-1 h-4 w-4' /> Não Precisa
            </TabsTrigger>
          </TabsList>

          {/* Pass fetched gifts (which is now guaranteed to be an array or empty array) */}
          <TabsContent value='all' className='mt-6'>
            <GiftList
              items={gifts}
              filterStatus='all'
              onItemAction={fetchData}
            />
          </TabsContent>
          <TabsContent value='available' className='mt-6'>
            <GiftList
              items={gifts}
              filterStatus='available'
              onItemAction={fetchData}
            />
          </TabsContent>
          <TabsContent value='selected' className='mt-6'>
            <GiftList
              items={gifts}
              filterStatus='selected'
              onItemAction={fetchData}
            />
          </TabsContent>
          <TabsContent value='not_needed' className='mt-6'>
            <GiftList
              items={gifts}
              filterStatus='not_needed'
              onItemAction={fetchData}
            />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
