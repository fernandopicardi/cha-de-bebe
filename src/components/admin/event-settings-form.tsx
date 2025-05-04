'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';

// Placeholder: Define where event details are stored and how they are updated.
// For now, this component is mostly a UI placeholder.
// In a real app, you'd fetch current settings and provide an onSave function.

interface EventSettings {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location: string;
  address: string;
  welcomeMessage: string;
}

interface AdminEventSettingsFormProps {
  // initialSettings?: EventSettings; // Optional initial data
  onSave: (settings: EventSettings) => Promise<void>; // Callback to save data
}

// Validation Schema
const settingsFormSchema = z.object({
  title: z.string().min(5, "Título muito curto."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (AAAA-MM-DD)."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido (HH:MM)."),
  location: z.string().min(3, "Local muito curto."),
  address: z.string().min(10, "Endereço muito curto."),
  welcomeMessage: z.string().min(10, "Mensagem de boas-vindas muito curta.").max(200, "Mensagem muito longa."),
});

// Placeholder initial data (replace with fetched data)
const placeholderSettings: EventSettings = {
  date: '2024-12-15',
  time: '14:00',
  location: 'Salão de Festas Felicidade',
  address: 'Rua Exemplo, 123, Bairro Alegre, Cidade Feliz - SP',
  welcomeMessage: 'Sua presença é nosso maior presente! Esta lista é apenas um guia para os presentes.',
  title: 'Chá de Bebê do(a) Futuro Bebê!',
};


export default function AdminEventSettingsForm({ onSave }: AdminEventSettingsFormProps) {
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<EventSettings>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: placeholderSettings // Load initial/placeholder data
  });

   // Fetch real initial settings if provided
   // useEffect(() => {
   //   if (initialSettings) {
   //     reset(initialSettings);
   //   }
   // }, [initialSettings, reset]);

  const onSubmit = async (data: EventSettings) => {
    try {
       console.log("Saving event settings (placeholder):", data);
       // await onSave(data); // Call the actual save function passed via props
       await new Promise(resolve => setTimeout(resolve, 500)); // Simulate save
       toast({ title: "Sucesso!", description: "Detalhes do evento atualizados." });
    } catch (error) {
      console.error("Error saving event settings:", error);
      toast({ title: "Erro!", description: "Falha ao salvar os detalhes do evento.", variant: "destructive" });
    }
  };

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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : <><Save className="mr-2 h-4 w-4" /> Salvar Detalhes</>}
          </Button>
      </div>
    </form>
  );
}
