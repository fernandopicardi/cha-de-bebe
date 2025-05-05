
import Link from 'next/link';
import Image from 'next/image'; // Import next/image
import { Baby, CalendarDays, Gift, MapPin, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GiftList from '@/components/gift-list';
import AddToCalendarButton from '@/components/add-to-calendar-button';
import SuggestItemButton from '@/components/suggest-item-button';
import { getEventSettings, getGifts } from '@/data/gift-store'; // Import getGifts
import { ThemeToggle } from '@/components/theme-toggle';
import { revalidateHomePage } from '@/actions/revalidate'; // Import revalidation action


export default async function Home() {
   // Fetch the latest event settings directly on the server component
  const eventDetails = await getEventSettings();
  // Fetch the gift list on the server
  const gifts = await getGifts();

   // Formatting Date and Time
   let formattedDate = 'Data inválida';
   let formattedTime = 'Hora inválida';
   try {
     // Ensure time exists before attempting to parse
     const timeString = eventDetails.time || '00:00'; // Default time if missing
     const eventDate = new Date(`${eventDetails.date}T${timeString}:00`);
     if (!isNaN(eventDate.getTime())) {
        formattedDate = eventDate.toLocaleDateString('pt-BR', {
          year: 'numeric', month: 'long', day: 'numeric'
        });
        formattedTime = eventDate.toLocaleTimeString('pt-BR', {
            hour: '2-digit', minute: '2-digit', hour12: false
        });
     } else {
       console.error("Failed to parse event date/time:", eventDetails.date, eventDetails.time);
     }
   } catch (e) {
     console.error("Error formatting date/time:", e);
   }

   // Construct the dynamic title including baby name if available
    const pageTitle = eventDetails.babyName
       ? `${eventDetails.title} ${eventDetails.babyName}!` // Append baby name if exists and not null/empty
       : eventDetails.title; // Use only the base title otherwise

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 relative">

      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 md:top-8 md:right-8 z-10 flex items-center gap-2">
         <ThemeToggle />
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <LogIn className="mr-2 h-4 w-4" />
            Admin
          </Button>
        </Link>
      </div>


      {/* Header Text - Adjust padding */}
      <header className="text-center space-y-4 pt-16">
        {/* Conditionally render Image or Baby Icon */}
        {eventDetails.headerImageUrl ? (
           // Increased size (w-32 h-32) and margin-bottom (mb-6)
          <div className="relative mx-auto w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden shadow-lg mb-6 border-4 border-secondary">
            <Image
              src={eventDetails.headerImageUrl}
              alt="Foto Cabeçalho Chá de Bebê"
              fill // Use fill to cover the container
              style={{ objectFit: 'cover' }} // Ensure image covers the area
              priority // Prioritize loading the header image
              sizes="(max-width: 768px) 128px, 160px" // Provide sizes hint based on w-32/w-40
              data-ai-hint="baby celebration banner"
            />
          </div>
        ) : (
           <Baby className="mx-auto h-16 w-16 text-secondary mb-4" /> // Keep margin for icon consistency
        )}

        {/* Display dynamic title */}
        <h1 className="text-3xl md:text-4xl font-semibold text-primary">{pageTitle}</h1>
         <p className="text-lg text-muted-foreground px-4 md:px-8">
           {eventDetails.welcomeMessage || 'Sua presença é o nosso maior presente! Esta lista é um guia carinhoso para quem desejar nos presentear, mas sinta-se totalmente à vontade, o importante é celebrar conosco!'}
         </p>
      </header>

      <Card className="bg-card shadow-md rounded-lg overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <CalendarDays className="h-6 w-6 text-primary" /> Detalhes do Evento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-accent-foreground" />
            <span>{formattedDate} às {formattedTime}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-accent-foreground" />
            <span>{eventDetails.location} - {eventDetails.address}</span>
          </div>
          <AddToCalendarButton eventDetails={eventDetails} />
        </CardContent>
      </Card>

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Gift className="h-6 w-6 text-primary" /> Lista de Presentes
          </h2>
           {/* Pass revalidation action to SuggestItemButton */}
           <SuggestItemButton onSuggestionAdded={revalidateHomePage} />
        </div>

        <Tabs defaultValue="all" className="w-full">
           {/* Use flex-wrap for responsive tabs */}
           <TabsList className="w-full flex flex-wrap justify-center sm:justify-start h-auto mb-4 md:mb-6 gap-1">
            <TabsTrigger value="all" className="flex-shrink-0">Todos</TabsTrigger>
            <TabsTrigger value="available" className="flex-shrink-0">Disponíveis</TabsTrigger>
            <TabsTrigger value="selected" className="flex-shrink-0">Selecionados</TabsTrigger>
            <TabsTrigger value="not_needed" className="flex-shrink-0">Não Precisa</TabsTrigger>
          </TabsList>

           {/* Increased top margin on tabs content */}
           {/* Pass fetched gifts and revalidation action to GiftList */}
          <TabsContent value="all" className="mt-6">
            <GiftList items={gifts} filterStatus="all" onClientAction={revalidateHomePage} />
          </TabsContent>
          <TabsContent value="available" className="mt-6">
            <GiftList items={gifts} filterStatus="available" onClientAction={revalidateHomePage} />
          </TabsContent>
          <TabsContent value="selected" className="mt-6">
            <GiftList items={gifts} filterStatus="selected" onClientAction={revalidateHomePage} />
          </TabsContent>
           <TabsContent value="not_needed" className="mt-6">
            <GiftList items={gifts} filterStatus="not_needed" onClientAction={revalidateHomePage} />
          </TabsContent>
        </Tabs>
      </section>

    </div>
  );
}
