
"use client";

import React, { useState, useEffect, useCallback } from "react"; // Added useCallback
import Link from "next/link";
import Image from "next/image"; // Import next/image
import { Baby, CalendarDays, Gift, MapPin, LogIn, RefreshCcw, AlertCircle } from "lucide-react"; // Added RefreshCcw, AlertCircle
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GiftList from "@/components/gift-list";
import AddToCalendarButton from "@/components/add-to-calendar-button";
import SuggestItemButton from "@/components/suggest-item-button";
import { getEventSettings, getGifts, type EventSettings, type GiftItem } from "@/data/gift-store"; // Use correct import path
import { ThemeToggle } from "@/components/theme-toggle";
import { Loader2 } from "lucide-react";


export default function Home() {
  const [eventDetails, setEventDetails] = useState<EventSettings | null>(null);
  const [gifts, setGifts] = useState<GiftItem[]>([]); // Use GiftItem[] type
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // State for errors


  // Use useCallback for fetchData to ensure stable reference if needed elsewhere
  const fetchData = useCallback(async (source?: string) => {
    console.log(`Home Page: Fetching data (triggered by ${source || 'useEffect'})...`);
    setIsLoading(true); // Set loading true at the start of fetch
    setError(null); // Clear previous errors

    try {
      const eventDataPromise = getEventSettings();
      const giftsDataPromise = getGifts(); // Fetch gifts

      // Fetch in parallel
      const [eventData, giftsData] = await Promise.all([eventDataPromise, giftsDataPromise]);

      console.log("Home Page: Fetched Event Settings:", !!eventData);
      console.log("Home Page: Fetched Gifts Count:", giftsData?.length ?? 0);
      // console.log("Home Page: Fetched Gifts Sample:", giftsData?.slice(0, 3) ?? []); // Log first few gifts for inspection

      // Add null check before setting state
      if (eventData) {
         console.log("Home Page: Setting event details state.");
        setEventDetails(eventData);
      } else {
         console.warn("Home Page: Event data was null or undefined after fetch.");
         console.log("Home Page: Setting event details state to null.");
         setEventDetails(null); // Explicitly set to null if fetch returns null
      }

      // Add null/undefined check for giftsData
      if (giftsData) {
        console.log("Home Page: Setting gifts state with fetched data. Count:", giftsData.length);
        // Log details of the first few gifts to verify data structure
        console.log("Home Page: Sample gifts being set to state:", giftsData.slice(0, 5));
        setGifts(giftsData);
      } else {
         console.warn("Home Page: Gifts data was null or undefined after fetch.");
         console.log("Home Page: Setting gifts state to empty array.");
         setGifts([]); // Set to empty array if fetch fails or returns null/undefined
      }

    } catch (err: any) {
      console.error("Home Page: Error fetching data:", err);
      setError(`Erro ao carregar os dados: ${err.message || 'Erro desconhecido'}`);
      console.log("Home Page: Clearing state due to error.");
      setEventDetails(null); // Clear on error
      setGifts([]); // Clear on error
    } finally {
      setIsLoading(false);
      console.log("Home Page: Fetching complete, loading set to false.");
    }
  // No dependencies for useCallback as it doesn't depend on component state/props
  }, []);


  // useEffect to fetch data on mount
  useEffect(() => {
    fetchData("useEffect[mount]");
     // Empty dependency array ensures this runs once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Manual refresh function - use the useCallback version of fetchData
  const handleRefresh = useCallback(() => {
    console.log("Home Page: Manual refresh requested.");
    fetchData("manual refresh button");
  }, [fetchData]);


  // Formatting Date and Time
  let formattedDate = "Data inválida";
  let formattedTime = "Hora inválida";

  if (eventDetails) {
    try {
      const timeString = eventDetails.time || "00:00";
      // Attempt to parse date and time. Handle potential invalid formats.
      const eventDate = new Date(`${eventDetails.date}T${timeString}:00`);

      if (!isNaN(eventDate.getTime())) {
        formattedDate = eventDate.toLocaleDateString("pt-BR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        formattedTime = eventDate.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false, // Use 24-hour format
        });
      } else {
        console.error(
          "Home Page: Failed to parse event date/time:",
          eventDetails.date,
          eventDetails.time
        );
        // Keep default "Data inválida" etc.
      }
    } catch (e) {
      console.error("Home Page: Error formatting date/time:", e);
      // Keep default "Data inválida" etc.
    }
  }


  const pageTitle = eventDetails?.babyName
    ? `${eventDetails.title} ${eventDetails.babyName}!`
    : eventDetails?.title || "Chá de Bebê";

  const welcomeMsg = eventDetails?.welcomeMessage ||
  "Sua presença é o nosso maior presente! Esta lista é apenas um guia carinhoso para quem desejar nos presentear. Sinta-se totalmente à vontade, o importante é celebrar conosco!";


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Carregando informações do chá...</p>
        <p className="text-sm text-muted-foreground mt-2">(Isso pode levar alguns segundos)</p>
      </div>
    );
  }

  if (error) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Erro ao Carregar</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleRefresh} variant="outline">
                  <RefreshCcw className="mr-2 h-4 w-4" /> Tentar Novamente
              </Button>
          </div>
      );
  }

  // Add log just before render to check final state
  console.log(`Home Page: Rendering with ${gifts.length} gifts in state. Event Title: ${pageTitle}`);

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 relative">
      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 md:top-8 md:right-8 z-10 flex items-center gap-2">
        <ThemeToggle />
        <Button onClick={handleRefresh} variant="outline" size="icon" title="Recarregar Dados">
           <RefreshCcw className="h-4 w-4" />
         </Button>
         <Link href="/admin/login"> {/* Link to the admin login page */}
           <Button variant="outline" size="sm">
             <LogIn className="mr-2 h-4 w-4" />
             Admin
           </Button>
         </Link>
      </div>

      {/* Header Text - Adjust padding */}
      <header className="text-center space-y-4 pt-16">
        {/* Conditionally render Image or Baby Icon */}
        {eventDetails?.headerImageUrl ? (
          <div className="relative mx-auto w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden shadow-lg mb-6 border-4 border-secondary">
            <Image
              src={eventDetails.headerImageUrl}
              alt="Foto Cabeçalho Chá de Bebê"
              fill // Use fill to cover the container
              style={{ objectFit: "cover" }} // Ensure image covers the area
              priority // Prioritize loading the header image
              sizes="(max-width: 768px) 128px, 160px" // Provide sizes hint based on w-32/w-40
              data-ai-hint="baby celebration banner"
              unoptimized={eventDetails.headerImageUrl.startsWith('data:image/')} // Disable optimization for data URIs if needed
            />
          </div>
        ) : (
          <Baby className="mx-auto h-16 w-16 text-secondary mb-4" /> // Keep margin for icon consistency
        )}

        {/* Display dynamic title */}
        <h1 className="text-3xl md:text-4xl font-semibold text-primary">
          {pageTitle}
        </h1>
        <p className="text-lg text-muted-foreground px-4 md:px-8">
           {welcomeMsg}
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
            <span>
              {formattedDate} às {formattedTime}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-accent-foreground" />
            <span>
              {eventDetails?.location || "Local a definir"} - {eventDetails?.address || "Endereço a definir"}
            </span>
          </div>
           {eventDetails && <AddToCalendarButton eventDetails={eventDetails} />}
        </CardContent>
      </Card>

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Gift className="h-6 w-6 text-primary" /> Lista de Presentes
          </h2>
           {/* Pass the stable fetchData callback to SuggestItemButton */}
          <SuggestItemButton onSuggestionAdded={fetchData} />
        </div>

        <Tabs defaultValue="all" className="w-full">
          {/* Use flex-wrap for responsive tabs */}
          <TabsList className="w-full flex flex-wrap justify-center sm:justify-start h-auto mb-4 md:mb-6 gap-1 px-1 py-1.5">
            <TabsTrigger value="all" className="flex-shrink-0">
              Todos
            </TabsTrigger>
            <TabsTrigger value="available" className="flex-shrink-0">
              Disponíveis
            </TabsTrigger>
            <TabsTrigger value="selected" className="flex-shrink-0">
              Selecionados
            </TabsTrigger>
            {/* Removed 'not_needed' tab from public view */}
             <TabsTrigger value="not_needed" className="flex-shrink-0">
                Não Precisa
             </TabsTrigger>
          </TabsList>

          {/* Increased top margin on tabs content */}
           {/* Pass fetched gifts and stable refresh callback to GiftList */}
           {/* Ensure gifts is passed correctly here */}
          <TabsContent value="all" className="mt-6">
            <GiftList items={gifts} filterStatus="all" onItemAction={fetchData} />
          </TabsContent>
          <TabsContent value="available" className="mt-6">
            <GiftList items={gifts} filterStatus="available" onItemAction={fetchData} />
          </TabsContent>
          <TabsContent value="selected" className="mt-6">
            <GiftList items={gifts} filterStatus="selected" onItemAction={fetchData} />
          </TabsContent>
           {/* Added 'not_needed' tab content back */}
           <TabsContent value="not_needed" className="mt-6">
              <GiftList items={gifts} filterStatus="not_needed" onItemAction={fetchData} />
           </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
