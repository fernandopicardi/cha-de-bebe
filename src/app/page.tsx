

import Link from 'next/link';
import { Baby, CalendarDays, Gift, MapPin, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GiftList from '@/components/gift-list';
import AddToCalendarButton from '@/components/add-to-calendar-button';
import SuggestItemButton from '@/components/suggest-item-button';
import { getEventSettings } from '@/data/gift-store'; // Import function to get event settings

// Placeholder categories - Replace or fetch if dynamic
const categories = ['Roupas', 'Higiene', 'Brinquedos', 'Alimentação', 'Outros'];

export default async function Home() {
  // Fetch event details server-side from the store
  const eventDetails = await getEventSettings();

   // Formatting Date and Time - Ensure locale consistency
   let formattedDate = 'Data inválida';
   let formattedTime = 'Hora inválida';
   try {
     // Use UTC to avoid timezone issues during parsing if the input is just date/time
     // Or ensure the server environment's timezone matches the expected event timezone
     const eventDate = new Date(`${eventDetails.date}T${eventDetails.time}:00`); // Assuming local time input for now
     if (!isNaN(eventDate.getTime())) {
        formattedDate = eventDate.toLocaleDateString('pt-BR', {
          year: 'numeric', month: 'long', day: 'numeric'
        });
        formattedTime = eventDate.toLocaleTimeString('pt-BR', {
            hour: '2-digit', minute: '2-digit', hour12: false // Use 24h format consistent with input
        });
     } else {
       console.error("Failed to parse event date/time:", eventDetails.date, eventDetails.time);
     }
   } catch (e) {
     console.error("Error formatting date/time:", e);
   }


  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 relative">

      <div className="absolute top-4 right-4 md:top-8 md:right-8 z-10">
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <LogIn className="mr-2 h-4 w-4" />
            Admin
          </Button>
        </Link>
      </div>

      <header className="text-center space-y-4 pt-12">
        <Baby className="mx-auto h-16 w-16 text-secondary" />
        {/* Display title fetched from settings */}
        <h1 className="text-3xl md:text-4xl font-semibold text-primary">{eventDetails.title}</h1>
        <p className="text-lg text-muted-foreground">{eventDetails.welcomeMessage}</p>
      </header>

      <Card className="bg-secondary/20 shadow-md rounded-lg overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-secondary-foreground">
            <CalendarDays className="h-6 w-6" /> Detalhes do Evento
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
          {/* Pass all necessary details to the calendar button */}
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
          {/* Update TabsList for better responsiveness */}
          {/* Add mb-4 for margin-bottom */}
          <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap pb-2 mb-4">
             {/* Ensure triggers don't shrink */}
            <TabsTrigger value="all" className="flex-shrink-0">Todos</TabsTrigger>
            <TabsTrigger value="available" className="flex-shrink-0">Disponíveis</TabsTrigger>
            <TabsTrigger value="selected" className="flex-shrink-0">Selecionados</TabsTrigger>
            <TabsTrigger value="not_needed" className="flex-shrink-0">Não Precisa</TabsTrigger>
            {/* Add dynamic categories later if needed */}
            {/* {categories.map(cat => (
              <TabsTrigger key={cat} value={cat.toLowerCase()} className="flex-shrink-0">{cat}</TabsTrigger>
            ))} */}
          </TabsList>

          <TabsContent value="all">
             {/* Pass showSelectedByName=false for public view */}
             {/* No onDataChange needed for public view */}
             {/* Add mt-6 for margin-top */}
            <GiftList filterStatus="all" showSelectedByName={false} />
          </TabsContent>
          <TabsContent value="available">
            {/* Add mt-6 */}
            <GiftList filterStatus="available" showSelectedByName={false} />
          </TabsContent>
          <TabsContent value="selected">
             {/* Add mt-6 */}
            <GiftList filterStatus="selected" showSelectedByName={false} />
          </TabsContent>
           <TabsContent value="not_needed">
             {/* Add mt-6 */}
            <GiftList filterStatus="not_needed" showSelectedByName={false} />
          </TabsContent>
            {/* Add dynamic category content later */}
            {/* {categories.map(cat => (
               <TabsContent key={cat} value={cat.toLowerCase()}>
                 <GiftList filterCategory={cat} showSelectedByName={false} />
               </TabsContent>
            ))} */}
        </Tabs>
      </section>

    </div>
  );
}
