
import { Baby, CalendarDays, Gift, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GiftList from '@/components/gift-list'; // Assuming GiftList component exists
import AddToCalendarButton from '@/components/add-to-calendar-button'; // Assuming AddToCalendarButton component exists
import SuggestItemButton from '@/components/suggest-item-button'; // Assuming SuggestItemButton component exists

// Placeholder data - Replace with Firestore fetching logic
const eventDetails = {
  date: '2024-12-15',
  time: '14:00',
  location: 'Salão de Festas Felicidade',
  address: 'Rua Exemplo, 123, Bairro Alegre, Cidade Feliz - SP',
  welcomeMessage: 'Sua presença é nosso maior presente! Esta lista é apenas um guia para os presentes.',
  title: 'Chá de Bebê do(a) Futuro Bebê!',
};

// Placeholder - Replace with actual categories from Firestore or config
const categories = ['Roupas', 'Higiene', 'Brinquedos', 'Alimentação', 'Outros'];

export default function Home() {
  const formattedDate = new Date(eventDetails.date + 'T' + eventDetails.time + ':00').toLocaleDateString('pt-BR', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const formattedTime = eventDetails.time;

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      {/* Header Section */}
      <header className="text-center space-y-4">
        <Baby className="mx-auto h-16 w-16 text-secondary" />
        <h1 className="text-3xl md:text-4xl font-semibold text-primary">{eventDetails.title}</h1>
        <p className="text-lg text-muted-foreground">{eventDetails.welcomeMessage}</p>
      </header>

      {/* Event Details Card */}
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
          <AddToCalendarButton eventDetails={eventDetails} />
        </CardContent>
      </Card>

      {/* Gift List Section */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Gift className="h-6 w-6 text-primary" /> Lista de Presentes
          </h2>
           <SuggestItemButton />
        </div>

        {/* Filters and List */}
        <Tabs defaultValue="all" className="w-full">
          {/* Adjusted grid columns and added margin-bottom for mobile */}
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:flex lg:w-auto mb-4 md:mb-0">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="available">Disponíveis</TabsTrigger>
            <TabsTrigger value="selected">Selecionados</TabsTrigger>
            <TabsTrigger value="not_needed">Não Precisa</TabsTrigger> {/* Updated text */}
            {/* Dynamically add category filters if needed */}
            {/* categories.map(category => <TabsTrigger key={category} value={category.toLowerCase()}>{category}</TabsTrigger>) */}
          </TabsList>

          {/* Tab Content - Pass filter criteria to GiftList */}
          <TabsContent value="all">
             {/* Pass showSelectedByName=false to hide names on the public page */}
            <GiftList filterStatus="all" showSelectedByName={false} />
          </TabsContent>
          <TabsContent value="available">
            <GiftList filterStatus="available" showSelectedByName={false} />
          </TabsContent>
          <TabsContent value="selected">
            <GiftList filterStatus="selected" showSelectedByName={false} />
          </TabsContent>
           <TabsContent value="not_needed"> {/* Added content for 'Não precisa' tab */}
            <GiftList filterStatus="not_needed" showSelectedByName={false} />
          </TabsContent>
          {/* Dynamically add category content */}
          {/* categories.map(category => (
            <TabsContent key={category} value={category.toLowerCase()}>
              <GiftList filterCategory={category} filterStatus="available" showSelectedByName={false} />
            </TabsContent>
          ))*/}
        </Tabs>
      </section>

      {/* Footer (Optional) */}
      {/* <footer className="text-center text-muted-foreground text-sm mt-12">
        Feito com ❤️
      </footer> */}
    </div>
  );
}
