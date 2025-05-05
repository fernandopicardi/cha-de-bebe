
'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
import { revalidateAdminPage, revalidateHomePage } from '@/actions/revalidate'; // Import revalidation actions


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
  headerImageUrl: z.string().optional().nullable(), // Allow string URL or data URI or null
  headerImageFile: z.instanceof(File, { message: "Entrada inválida. Esperado um arquivo." }).optional().nullable(), // For file input handling
}).refine(data => !data.headerImageUrl || data.headerImageUrl.startsWith('data:image/') || data.headerImageUrl.startsWith('http'), {
    message: "URL da imagem inválido. Deve ser um URL http(s) ou uma imagem carregada.", // Custom validation message
    path: ["headerImageUrl"],
});


type SettingsFormData = z.infer<typeof settingsFormSchema>;


export default function AdminEventSettingsForm({ onSave }: AdminEventSettingsFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  // Removed imagePreview and initialImageUrl states - rely on RHF state

  const { control, register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue, getValues } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: async () => {
       setIsLoading(true);
       try {
         const settings = await getEventSettings();
         console.log("Initial settings fetched:", settings); // Debug log
         // No need to set separate preview/initial state here
         return {
             ...settings,
             headerImageUrl: settings.headerImageUrl || null, // RHF state holds the initial URL
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

   // Use watch to react to file input changes
   const watchedFile = watch('headerImageFile');
   // Watch the URL field to determine the preview source
   const watchedImageUrl = watch('headerImageUrl');

   // Handle file selection, preview generation, and updating headerImageUrl
   useEffect(() => {
     const currentFile = watchedFile;
     const currentImageUrl = getValues('headerImageUrl'); // Get the current URL stored in RHF

     console.log("useEffect triggered. Current File:", currentFile, "Current URL:", currentImageUrl?.substring(0, 30));

     if (currentFile instanceof File) {
       console.log("useEffect: Detected File instance", currentFile.name, currentFile.size);
       // Basic size validation (e.g., 5MB limit)
       if (currentFile.size > 5 * 1024 * 1024) {
         toast({
           title: "Erro!",
           description: "Arquivo de imagem muito grande. O limite é 5MB.",
           variant: "destructive"
         });
         setValue('headerImageFile', null, { shouldValidate: true }); // Clear invalid file in RHF
         // When file is invalid, revert headerImageUrl to the *initial* URL
         // We need to fetch initial settings again or store it separately if needed,
         // for now, let's just clear it or revert to what it was *before* this effect ran
         // This part is tricky without storing the initial URL separately.
         // Simplest approach: Clear the URL field as well.
         setValue('headerImageUrl', null, { shouldValidate: true });
         console.log("useEffect: File too large, cleared RHF state for file and URL.");
         const fileInput = document.getElementById('headerImageFile') as HTMLInputElement | null;
         if (fileInput) fileInput.value = '';
         return;
       }

       // Generate data URI and store it in headerImageUrl
       const reader = new FileReader();
       reader.onloadend = () => {
         const result = reader.result as string;
         console.log("useEffect: FileReader finished, setting RHF URL to data URI.");
         setValue('headerImageUrl', result, { shouldValidate: true }); // Store data URI in headerImageUrl
       };
       reader.onerror = (err) => {
         console.error("useEffect: FileReader error:", err);
         toast({ title: "Erro", description: "Falha ao ler o arquivo de imagem.", variant: "destructive" });
         setValue('headerImageFile', null, { shouldValidate: true }); // Clear file in RHF
         setValue('headerImageUrl', null, { shouldValidate: true }); // Clear URL as well
       };
       reader.readAsDataURL(currentFile);
     } else if (currentFile === null) {
       // This case happens when the file is explicitly cleared (e.g., by removeImage)
       // If the file is cleared, we *might* want to revert to the initial URL,
       // but for simplicity now, we just ensure headerImageUrl is also cleared if the intention was to remove.
       // The `removeImage` function already handles setting headerImageUrl to null.
       console.log("useEffect: File is null (cleared).");
     } else if (currentFile === undefined && !currentImageUrl) {
        // Initial load with no image, or both file and URL are cleared. Do nothing.
        console.log("useEffect: File undefined, URL is empty. Initial or cleared state.");
     }
     // If currentFile is undefined BUT currentImageUrl exists, it means we are likely in the initial state
     // with a pre-existing image URL, or the file input was cleared but the URL wasn't (e.g., by browser back button).
     // In this scenario, the watchedImageUrl will correctly reflect the existing URL for the preview.

   }, [watchedFile, setValue, toast, getValues]);

   const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
       const file = event.target.files ? event.target.files[0] : null;
       console.log("handleFileChange: File selected:", file);
       // Update RHF state for the file input. The useEffect will handle preview/URL logic.
       setValue('headerImageFile', file, { shouldValidate: true });
   };

   const removeImage = useCallback(() => {
      console.log("removeImage called.");
      setValue('headerImageFile', null, { shouldValidate: true }); // Clear the file in RHF state
      setValue('headerImageUrl', null, { shouldValidate: true }); // Clear the URL in RHF state
       // Manually clear the file input element itself
       const fileInput = document.getElementById('headerImageFile') as HTMLInputElement | null;
       if (fileInput) {
           fileInput.value = '';
       }
   }, [setValue]);


   const onSubmit = async (data: SettingsFormData) => {
     console.log("onSubmit started. Raw form data:", data);

     // The headerImageUrl already contains either the data URI (if new file selected)
     // or the original URL (if no file selected) or null (if removed).
     // The validation ensures it's in a valid format before submission.

    try {
      const settingsToSave: Partial<EventSettings> = {
        title: data.title,
        babyName: data.babyName || null, // Store null if empty string
        date: data.date,
        time: data.time,
        location: data.location,
        address: data.address,
        welcomeMessage: data.welcomeMessage,
        headerImageUrl: data.headerImageUrl, // This holds the data URI, original URL, or null
      };

      console.log("Submitting data to updateEventSettings:", settingsToSave); // Debug log before saving

      await updateEventSettings(settingsToSave);

      // Trigger revalidation for relevant pages
      await revalidateAdminPage();
      await revalidateHomePage();

      toast({ title: "Sucesso!", description: "Detalhes do evento atualizados." });

      // Re-fetch the latest settings AFTER successful save and reset the form
      try {
        const latestSettings = await getEventSettings();
        console.log("Refetched settings after save:", latestSettings); // Debug log
        // Reset form with fresh data, ensuring correct types
        reset({
          ...latestSettings,
          headerImageUrl: latestSettings.headerImageUrl || null,
          headerImageFile: null, // Always clear the file input field itself after submit
          babyName: latestSettings.babyName || '',
        });
         // Manually clear the file input element itself
         const fileInput = document.getElementById('headerImageFile') as HTMLInputElement | null;
         if (fileInput) {
             fileInput.value = '';
         }
      } catch (fetchError) {
          console.error("Error re-fetching settings after save:", fetchError);
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
            {/* Use watchedImageUrl for the preview */}
            {watchedImageUrl && (
               <div className="relative w-24 h-24 border rounded-md overflow-hidden shadow-inner bg-muted/50">
                   <Image
                       key={watchedImageUrl} // Use URL as key
                       src={watchedImageUrl}
                       alt="Prévia da imagem do cabeçalho"
                       fill
                       style={{ objectFit: 'cover' }}
                       sizes="(max-width: 768px) 96px, 96px"
                       data-ai-hint="baby celebration banner"
                       onError={(e) => {
                         console.error("Error loading image preview:", watchedImageUrl.substring(0, 50) + "...", e);
                         toast({ title: "Erro", description: "Não foi possível carregar a prévia da imagem.", variant: "destructive" });
                         // Consider clearing the URL if preview fails?
                         // setValue('headerImageUrl', null);
                       }}
                   />
                    <Button
                       type="button"
                       variant="destructive"
                       size="icon"
                       className="absolute top-1 right-1 h-6 w-6 z-10 rounded-full opacity-70 hover:opacity-100"
                       onClick={removeImage}
                       title="Remover Imagem"
                       disabled={isSubmitting}
                    >
                       <XCircle className="h-4 w-4" />
                    </Button>
               </div>
            )}
            <div className="flex-1">
                 <Input
                     id="headerImageFile"
                     type="file"
                     accept="image/png, image/jpeg, image/gif, image/webp"
                     // Use register but override onChange to use custom handler
                     {...register('headerImageFile', { onChange: handleFileChange })}
                     className={` ${errors.headerImageFile ? 'border-destructive' : ''} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer`}
                     disabled={isSubmitting}
                 />
                <p className="text-xs text-muted-foreground mt-1">Envie uma imagem (PNG, JPG, GIF, WebP). Máx 5MB.</p>
                {errors.headerImageFile && <p className="text-sm text-destructive mt-1">{errors.headerImageFile.message}</p>}
                {/* Display error for the URL field */}
                {errors.headerImageUrl && <p className="text-sm text-destructive mt-1">{errors.headerImageUrl.message}</p>}
                 {/* Display existing URL hint only if file input is empty */}
                 {!watchedFile && watchedImageUrl && !watchedImageUrl.startsWith('data:') && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">Usando imagem salva anteriormente. Envie nova para substituir.</p>
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

