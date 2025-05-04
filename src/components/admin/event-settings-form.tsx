
'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image'; // Import next/image
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2, Image as ImageIcon, XCircle } from 'lucide-react'; // Added icons
import { getEventSettings, updateEventSettings, type EventSettings } from '@/data/gift-store';


interface AdminEventSettingsFormProps {
  onSave?: () => void;
}

// Extend schema for header image URL (optional string, can be data URI)
const settingsFormSchema = z.object({
  title: z.string().min(5, "Título muito curto."),
  babyName: z.string().optional(), // Make baby name optional or add validation
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (AAAA-MM-DD)."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido (HH:MM)."),
  location: z.string().min(3, "Local muito curto."),
  address: z.string().min(10, "Endereço muito curto."),
  welcomeMessage: z.string().min(10, "Mensagem de boas-vindas muito curta.").max(200, "Mensagem muito longa."),
  headerImageUrl: z.string().optional().nullable(), // Allow string (URL/Data URI) or null
  headerImageFile: z.instanceof(File).optional().nullable(), // For file input handling
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;


export default function AdminEventSettingsForm({ onSave }: AdminEventSettingsFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null); // State for image preview

  const { control, register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: async () => {
       setIsLoading(true);
       try {
         const settings = await getEventSettings();
         setImagePreview(settings.headerImageUrl || null); // Set initial preview
         return {
             ...settings,
             headerImageFile: null, // Initialize file input as null
         };
       } catch (error) {
         console.error("Error fetching event settings:", error);
         toast({ title: "Erro!", description: "Falha ao carregar configurações do evento.", variant: "destructive" });
         return {};
       } finally {
         setIsLoading(false);
       }
     }
  });

   // Watch for changes in the file input
   const headerImageFile = watch('headerImageFile');

   useEffect(() => {
      if (headerImageFile instanceof File) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setImagePreview(reader.result as string);
              setValue('headerImageUrl', reader.result as string); // Store as data URI string
          };
          reader.readAsDataURL(headerImageFile);
      } else if (headerImageFile === null) { // Handle removal
           // If file is explicitly set to null (e.g., by remove button), clear preview and URL
          // But only if the initial value wasn't already null
          if (imagePreview !== null) {
             setImagePreview(null);
             setValue('headerImageUrl', null);
          }
      }
      // Don't reset preview if headerImageFile is undefined (initial load)

   }, [headerImageFile, setValue, imagePreview]); // Add imagePreview to dependencies

   const removeImage = () => {
      setValue('headerImageFile', null); // Clear the file input value in RHF state
      // The useEffect will handle clearing the preview and URL
   };

  const onSubmit = async (data: SettingsFormData) => {
    try {
       // Prepare data for saving (remove the temporary file object)
       const { headerImageFile, ...settingsToSave } = data;
       await updateEventSettings(settingsToSave);
       toast({ title: "Sucesso!", description: "Detalhes do evento atualizados." });
       onSave?.();
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

       <div className="grid gap-2">
         <Label htmlFor="babyName">Nome do Bebê (Opcional)</Label>
         <Input id="babyName" {...register('babyName')} className={errors.babyName ? 'border-destructive' : ''} />
         {errors.babyName && <p className="text-sm text-destructive mt-1">{errors.babyName.message}</p>}
       </div>

       {/* Header Image Upload */}
       <div className="grid gap-2">
         <Label htmlFor="headerImageFile">Foto do Cabeçalho (Opcional)</Label>
         <div className="flex items-center gap-4">
            {imagePreview && (
               <div className="relative w-24 h-24 border rounded-md overflow-hidden">
                   <Image
                       src={imagePreview}
                       alt="Prévia da imagem do cabeçalho"
                       layout="fill"
                       objectFit="cover"
                       data-ai-hint="baby celebration banner"
                   />
                    <Button
                       type="button"
                       variant="destructive"
                       size="icon"
                       className="absolute top-1 right-1 h-6 w-6 z-10"
                       onClick={removeImage}
                       title="Remover Imagem"
                       disabled={isSubmitting}
                    >
                       <XCircle className="h-4 w-4" />
                    </Button>
               </div>
            )}
            <div className="flex-1">
                <Controller
                    name="headerImageFile"
                    control={control}
                    render={({ field: { onChange, value, ref, ...fieldProps } }) => ( // Destructure onChange etc.
                        <Input
                            id="headerImageFile"
                            type="file"
                            accept="image/png, image/jpeg, image/gif"
                            {...fieldProps} // Spread remaining field props
                            ref={ref}
                            onChange={(e) => {
                                onChange(e.target.files ? e.target.files[0] : null); // Pass file or null to RHF
                            }}
                            className={` ${errors.headerImageFile ? 'border-destructive' : ''} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90`}
                            disabled={isSubmitting}
                        />
                    )}
                />
                <p className="text-xs text-muted-foreground mt-1">Envie uma imagem (PNG, JPG, GIF). Recomendado: 1200x400px.</p>
                {errors.headerImageFile && <p className="text-sm text-destructive mt-1">{errors.headerImageFile.message}</p>}
            </div>
         </div>
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
