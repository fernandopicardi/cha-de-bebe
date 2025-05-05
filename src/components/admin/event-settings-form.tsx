
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
  title: z.string().min(5, "Título muito curto.").max(100, "Título muito longo."), // Added max length
  babyName: z.string().optional().nullable().or(z.literal('')), // Allow empty string or null
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (AAAA-MM-DD)."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido (HH:MM)."),
  location: z.string().min(3, "Local muito curto.").max(100, "Local muito longo."), // Added max length
  address: z.string().min(10, "Endereço muito curto.").max(200, "Endereço muito longo."), // Added max length
  welcomeMessage: z.string().min(10, "Mensagem de boas-vindas muito curta.").max(500, "Mensagem muito longa."), // Increased max length
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
             headerImageUrl: settings.headerImageUrl || null, // Ensure null if undefined
             headerImageFile: null, // Initialize file input as null
             babyName: settings.babyName || '', // Ensure empty string if null/undefined
         };
       } catch (error) {
         console.error("Error fetching event settings:", error);
         toast({ title: "Erro!", description: "Falha ao carregar configurações do evento.", variant: "destructive" });
         // Provide sensible defaults on error
         return {
            title: 'Chá de Bebê',
            babyName: '',
            date: '',
            time: '',
            location: '',
            address: '',
            welcomeMessage: '',
            headerImageUrl: null,
            headerImageFile: null,
         };
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
              const result = reader.result as string;
              setImagePreview(result);
              setValue('headerImageUrl', result); // Store as data URI string
          };
           // Basic size validation (e.g., 5MB limit)
          if (headerImageFile.size > 5 * 1024 * 1024) {
              toast({
                  title: "Erro!",
                  description: "Arquivo de imagem muito grande. O limite é 5MB.",
                  variant: "destructive"
              });
              setValue('headerImageFile', null); // Clear invalid file
              return;
          }
          reader.readAsDataURL(headerImageFile);
      } else if (headerImageFile === null) { // Handle removal by button click
          // Check if the form currently holds an image URL (could be initial or previously saved)
          const currentImageUrl = watch('headerImageUrl');
          if (currentImageUrl) {
              setImagePreview(null);
              setValue('headerImageUrl', null); // Clear the URL in the form state
          }
      }
      // Note: Don't reset preview if headerImageFile is undefined (initial load or no file selected)

   }, [headerImageFile, setValue, toast, watch]); // Added watch dependency

   const removeImage = () => {
      setValue('headerImageFile', null); // Clear the file input value in RHF state
      // The useEffect above will handle clearing the preview and URL
   };

   const onSubmit = async (data: SettingsFormData) => {
    try {
      // Prepare data for saving (remove the temporary file object)
      // Ensure babyName is stored as null if empty string
      const { headerImageFile, babyName, ...settingsToSave } = data;
      const finalSettings: Partial<EventSettings> = {
        ...settingsToSave,
        babyName: babyName || null, // Store null if empty string
        headerImageUrl: imagePreview, // Use the preview which holds the data URI or existing URL or null
      };

      await updateEventSettings(finalSettings);

      toast({ title: "Sucesso!", description: "Detalhes do evento atualizados." });

      // Re-fetch the latest settings and reset the form to reflect the saved state
      try {
        const latestSettings = await getEventSettings();
        reset({
            ...latestSettings,
            headerImageUrl: latestSettings.headerImageUrl || null, // Reset URL from latest data
            headerImageFile: null, // Always reset file input
            babyName: latestSettings.babyName || '', // Reset baby name
        });
        setImagePreview(latestSettings.headerImageUrl || null); // Update preview too
      } catch (fetchError) {
          console.error("Error re-fetching settings after save:", fetchError);
          // Form won't reset to latest, but save was successful
          toast({ title: "Aviso", description: "Configurações salvas, mas houve um erro ao recarregar o formulário.", variant: "default" });
      }


      onSave?.(); // Call parent callback if provided
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
       <div className="grid gap-2">
         <Label htmlFor="title">Título do Evento*</Label>
         <Input id="title" {...register('title')} className={errors.title ? 'border-destructive' : ''} maxLength={100} />
         {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
       </div>

       <div className="grid gap-2">
         <Label htmlFor="babyName">Nome do Bebê (Opcional)</Label>
         <Input id="babyName" {...register('babyName')} placeholder="Ex: da Maria, do João..." className={errors.babyName ? 'border-destructive' : ''} />
         {errors.babyName && <p className="text-sm text-destructive mt-1">{errors.babyName.message}</p>}
       </div>

       {/* Header Image Upload */}
       <div className="grid gap-2">
         <Label htmlFor="headerImageFile">Foto do Cabeçalho (Opcional)</Label>
         <div className="flex items-center gap-4">
            {imagePreview && (
               <div className="relative w-24 h-24 border rounded-md overflow-hidden shadow-inner bg-muted/50">
                   <Image
                       src={imagePreview}
                       alt="Prévia da imagem do cabeçalho"
                       fill // Use fill instead of layout
                       style={{ objectFit: 'cover' }} // Ensure image covers the area
                       sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // Provide sizes hint
                       data-ai-hint="baby celebration banner"
                       onError={() => {
                         // Handle potential image loading errors (e.g., invalid data URI)
                         toast({ title: "Erro", description: "Não foi possível carregar a prévia da imagem.", variant: "destructive" });
                         setImagePreview(null); // Clear broken preview
                       }}
                   />
                    <Button
                       type="button"
                       variant="destructive"
                       size="icon"
                       className="absolute top-1 right-1 h-6 w-6 z-10 rounded-full" // Make round
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
                            accept="image/png, image/jpeg, image/gif, image/webp" // Added webp
                            {...fieldProps} // Spread remaining field props
                            ref={ref}
                            onChange={(e) => {
                                onChange(e.target.files ? e.target.files[0] : null); // Pass file or null to RHF
                            }}
                            className={` ${errors.headerImageFile ? 'border-destructive' : ''} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer`}
                            disabled={isSubmitting}
                        />
                    )}
                />
                <p className="text-xs text-muted-foreground mt-1">Envie uma imagem (PNG, JPG, GIF, WebP). Máx 5MB.</p>
                {errors.headerImageFile && <p className="text-sm text-destructive mt-1">{errors.headerImageFile.message}</p>}
                 {/* Display existing URL if no preview and no file selected */}
                 {!imagePreview && watch('headerImageUrl') && !watch('headerImageFile') && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">Imagem atual: {watch('headerImageUrl')?.substring(0, 30)}...</p>
                )}
            </div>
         </div>
       </div>


       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
         <Input id="location" {...register('location')} className={errors.location ? 'border-destructive' : ''} maxLength={100}/>
         {errors.location && <p className="text-sm text-destructive mt-1">{errors.location.message}</p>}
       </div>

       <div className="grid gap-2">
         <Label htmlFor="address">Endereço Completo*</Label>
         <Input id="address" {...register('address')} className={errors.address ? 'border-destructive' : ''} maxLength={200}/>
         {errors.address && <p className="text-sm text-destructive mt-1">{errors.address.message}</p>}
       </div>

       <div className="grid gap-2">
         <Label htmlFor="welcomeMessage">Mensagem de Boas-Vindas*</Label>
         <Textarea
            id="welcomeMessage"
            {...register('welcomeMessage')}
            className={errors.welcomeMessage ? 'border-destructive' : ''}
            rows={4} // Set default rows
            maxLength={500}
         />
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

    