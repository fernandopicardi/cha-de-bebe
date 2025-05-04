
import Link from 'next/link';
import Image from 'next/image'; // Import next/image
import { Baby, CalendarDays, Gift, MapPin, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GiftList from '@/components/gift-list';
import AddToCalendarButton from '@/components/add-to-calendar-button';
import SuggestItemButton from '@/components/suggest-item-button';
import { getEventSettings } from '@/data/gift-store';
import { ThemeToggle } from '@/components/theme-toggle';


export default async function Home() {
  const eventDetails = await getEventSettings();

   // Formatting Date and Time
   let formattedDate = 'Data inválida';
   let formattedTime = 'Hora inválida';
   try {
     const eventDate = new Date(`${eventDetails.date}T${eventDetails.time}:00`);
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
      ? `${eventDetails.title} ${eventDetails.babyName}!` // Append baby name if exists
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

      {/* Optional Header Image */}
      {eventDetails.headerImageUrl && (
         <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden shadow-md mb-8">
             <Image
                src={eventDetails.headerImageUrl}
                alt="Cabeçalho do Chá de Bebê"
                layout="fill"
                objectFit="cover"
                priority // Prioritize loading the header image
                data-ai-hint="baby shower banner celebration"
             />
         </div>
      )}

      {/* Header Text - Adjust padding if image exists */}
      <header className={`text-center space-y-4 ${eventDetails.headerImageUrl ? 'pt-0' : 'pt-16'}`}> {/* Remove top padding if image exists */}
        <Baby className="mx-auto h-16 w-16 text-secondary" />
        {/* Display dynamic title */}
        <h1 className="text-3xl md:text-4xl font-semibold text-primary">{pageTitle}</h1>
        <p className="text-lg text-muted-foreground">{eventDetails.welcomeMessage}</p>
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
           <SuggestItemButton />
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap pb-2 mb-4 md:mb-6"> {/* Increased bottom margin on md+ */}
            <TabsTrigger value="all" className="flex-shrink-0">Todos</TabsTrigger>
            <TabsTrigger value="available" className="flex-shrink-0">Disponíveis</TabsTrigger>
            <TabsTrigger value="selected" className="flex-shrink-0">Selecionados</TabsTrigger>
            <TabsTrigger value="not_needed" className="flex-shrink-0">Não Precisa</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <GiftList filterStatus="all" showSelectedByName={false} />
          </TabsContent>
          <TabsContent value="available" className="mt-6">
            <GiftList filterStatus="available" showSelectedByName={false} />
          </TabsContent>
          <TabsContent value="selected" className="mt-6">
            <GiftList filterStatus="selected" showSelectedByName={false} />
          </TabsContent>
           <TabsContent value="not_needed" className="mt-6">
            <GiftList filterStatus="not_needed" showSelectedByName={false} />
          </TabsContent>
        </Tabs>
      </section>

    </div>
  );
}
