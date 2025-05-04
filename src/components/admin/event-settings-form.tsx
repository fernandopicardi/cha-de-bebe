
'use client';

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2 } from 'lucide-react';
import { getEventSettings, updateEventSettings, type EventSettings } from '@/data/gift-store'; // Import store functions


interface AdminEventSettingsFormProps {
  // No initialSettings prop needed, fetch directly
  onSave?: () => void; // Keep optional onSave callback if parent needs notification
}

// Validation Schema - remains the same
const settingsFormSchema = z.object({
  title: z.string().min(5, "Título muito curto."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (AAAA-MM-DD)."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido (HH:MM)."),
  location: z.string().min(3, "Local muito curto."),
  address: z.string().min(10, "Endereço muito curto."),
  welcomeMessage: z.string().min(10, "Mensagem de boas-vindas muito curta.").max(200, "Mensagem muito longa."),
});


export default function AdminEventSettingsForm({ onSave }: AdminEventSettingsFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true); // State for loading initial data
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<EventSettings>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: async () => { // Use async defaultValues to fetch
       setIsLoading(true);
       try {
         const settings = await getEventSettings();
         return settings;
       } catch (error) {
         console.error("Error fetching event settings:", error);
         toast({ title: "Erro!", description: "Falha ao carregar configurações do evento.", variant: "destructive" });
         return {}; // Return empty object or defaults on error
       } finally {
         setIsLoading(false);
       }
     }
  });

   // useEffect(() => {
   //   // Fetch initial settings when component mounts
   //   async function loadSettings() {
   //     setIsLoading(true);
   //     try {
   //       const settings = await getEventSettings();
   //       reset(settings); // Populate form with fetched data
   //     } catch (error) {
   //       console.error("Error fetching event settings:", error);
   //       toast({ title: "Erro!", description: "Falha ao carregar configurações do evento.", variant: "destructive" });
   //     } finally {
   //       setIsLoading(false);
   //     }
   //   }
   //   loadSettings();
   // }, [reset, toast]);

  const onSubmit = async (data: EventSettings) => {
    try {
       await updateEventSettings(data); // Use the store function to save
       toast({ title: "Sucesso!", description: "Detalhes do evento atualizados." });
       onSave?.(); // Call optional parent callback
    } catch (error) {
      console.error("Error saving event settings:", error);
      toast({ title: "Erro!", description: "Falha ao salvar os detalhes do evento.", variant: "destructive" });
    }
  };

  if (isLoading) {
       return (
           <div className="flex items-center justify-center p-8">
               <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
               <p className="ml-2 text-muted-foreground">Carregando configurações...</p>
           </div>
       );
   }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
       <div className="grid gap-2">
         <Label htmlFor="title">Título do Evento*</Label>
         <Input id="title" {...register('title')} className={errors.title ? 'border-destructive' : ''} />
         {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
       </div>

       <div className="grid grid-cols-2 gap-4">
           <div className="grid gap-2">
             <Label htmlFor="date">Data* (AAAA-MM-DD)</Label>
             <Input id="date" type="date" {...register('date')} className={errors.date ? 'border-destructive' : ''} />
             {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
           </div>
           <div className="grid gap-2">
             <Label htmlFor="time">Hora* (HH:MM)</Label>
             <Input id="time" type="time" {...register('time')} className={errors.time ? 'border-destructive' : ''} />
             {errors.time && <p className="text-sm text-destructive mt-1">{errors.time.message}</p>}
           </div>
       </div>


       <div className="grid gap-2">
         <Label htmlFor="location">Local*</Label>
         <Input id="location" {...register('location')} className={errors.location ? 'border-destructive' : ''} />
         {errors.location && <p className="text-sm text-destructive mt-1">{errors.location.message}</p>}
       </div>

       <div className="grid gap-2">
         <Label htmlFor="address">Endereço Completo*</Label>
         <Input id="address" {...register('address')} className={errors.address ? 'border-destructive' : ''} />
         {errors.address && <p className="text-sm text-destructive mt-1">{errors.address.message}</p>}
       </div>

       <div className="grid gap-2">
         <Label htmlFor="welcomeMessage">Mensagem de Boas-Vindas*</Label>
         <Textarea id="welcomeMessage" {...register('welcomeMessage')} className={errors.welcomeMessage ? 'border-destructive' : ''} />
         {errors.welcomeMessage && <p className="text-sm text-destructive mt-1">{errors.welcomeMessage.message}</p>}
       </div>

      <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isSubmitting || isLoading}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : <><Save className="mr-2 h-4 w-4" /> Salvar Detalhes</>}
          </Button>
      </div>
    </form>
  );
}

    