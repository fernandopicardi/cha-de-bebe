
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
  headerImageUrl: z.string().url("URL da imagem inválido.").optional().nullable(), // Allow string URL or null (will store data URI here too temporarily)
  headerImageFile: z.instanceof(File, { message: "Entrada inválida. Esperado um arquivo." }).optional().nullable(), // For file input handling
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;


export default function AdminEventSettingsForm({ onSave }: AdminEventSettingsFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null); // State for image preview (data URI or URL)
  const [initialImageUrl, setInitialImageUrl] = useState<string | null>(null); // Store initially loaded image URL

  const { control, register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue, getValues } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: async () => {
       setIsLoading(true);
       try {
         const settings = await getEventSettings();
         console.log("Initial settings fetched:", settings); // Debug log
         setImagePreview(settings.headerImageUrl || null); // Set initial preview
         setInitialImageUrl(settings.headerImageUrl || null); // Store initial URL
         return {
             ...settings,
             headerImageUrl: settings.headerImageUrl || null, // Ensure null if undefined/empty
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

   // Handle file selection, preview generation, and validation
   useEffect(() => {
      // No need to watch 'headerImageFile' directly in dependency array if using watch() inside
      // const currentFile = watch('headerImageFile'); // Get the current file state directly
      const currentFile = watchedFile; // Use the watched value

      console.log("useEffect triggered. Current File:", currentFile);

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
              setImagePreview(initialImageUrl); // Revert preview to initial state
              setValue('headerImageUrl', initialImageUrl); // Revert URL in RHF state
              console.log("useEffect: File too large, cleared RHF state and reverted preview/URL.");
              // Manually clear the file input element itself
              const fileInput = document.getElementById('headerImageFile') as HTMLInputElement | null;
              if (fileInput) {
                  fileInput.value = '';
              }
              return;
          }

          // Generate preview
          const reader = new FileReader();
          reader.onloadend = () => {
              const result = reader.result as string;
              console.log("useEffect: FileReader finished, setting preview and RHF URL to data URI.");
              setImagePreview(result);
              setValue('headerImageUrl', result, { shouldValidate: true }); // Store data URI in headerImageUrl field for submission
          };
          reader.onerror = (err) => {
              console.error("useEffect: FileReader error:", err);
              toast({ title: "Erro", description: "Falha ao ler o arquivo de imagem.", variant: "destructive" });
              setValue('headerImageFile', null, { shouldValidate: true }); // Clear file in RHF
              setImagePreview(initialImageUrl); // Revert preview
              setValue('headerImageUrl', initialImageUrl); // Revert URL
          };
          reader.readAsDataURL(currentFile);
      } else if (currentFile === null) {
          // This case happens when the file is explicitly cleared (e.g., by removeImage or validation failure)
          console.log("useEffect: File is null. Clearing preview and RHF URL.");
          setImagePreview(null);
          setValue('headerImageUrl', null, { shouldValidate: true });
      } else if (currentFile === undefined) {
         // This is the initial state or when the input is cleared without explicit null setting
         console.log("useEffect: File is undefined (initial state or cleared). Reverting preview/URL to initial.");
         setImagePreview(initialImageUrl);
         setValue('headerImageUrl', initialImageUrl, { shouldValidate: true });
      } else {
          console.warn("useEffect: Unexpected value for headerImageFile:", currentFile);
          // Handle unexpected type if necessary, maybe revert?
          setImagePreview(initialImageUrl);
          setValue('headerImageUrl', initialImageUrl, { shouldValidate: true });
      }

   }, [watchedFile, setValue, toast, initialImageUrl]); // Depend on watchedFile

   const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
       const file = event.target.files ? event.target.files[0] : null;
       console.log("handleFileChange: File selected:", file);
       // Update RHF state for the file input. The useEffect will handle preview/URL logic.
       setValue('headerImageFile', file, { shouldValidate: true });
   };

   const removeImage = useCallback(() => {
      console.log("removeImage called.");
      setValue('headerImageFile', null, { shouldValidate: true }); // Clear the file in RHF state
      setImagePreview(null); // Clear preview immediately
      setValue('headerImageUrl', null, { shouldValidate: true }); // Clear the URL in RHF state
       // Manually clear the file input element itself
       const fileInput = document.getElementById('headerImageFile') as HTMLInputElement | null;
       if (fileInput) {
           fileInput.value = '';
       }
   }, [setValue]);


   const onSubmit = async (data: SettingsFormData) => {
     console.log("onSubmit started. Raw form data:", data);
     // Check the type right before submission attempt
     if (data.headerImageFile !== null && !(data.headerImageFile instanceof File)) {
        console.error("onSubmit Error: headerImageFile is not null and not a File instance!", data.headerImageFile);
        toast({ title: "Erro Interno", description: "Houve um problema com o upload da imagem. Tente selecionar novamente.", variant: "destructive" });
        return; // Prevent submission
     }

    try {
      // If a file was selected, its data URI is already in headerImageUrl thanks to useEffect
      // If no new file was selected, headerImageUrl holds the initialImageUrl or null if it was removed.
      const settingsToSave: Partial<EventSettings> = {
        title: data.title,
        babyName: data.babyName || null, // Store null if empty string
        date: data.date,
        time: data.time,
        location: data.location,
        address: data.address,
        welcomeMessage: data.welcomeMessage,
        headerImageUrl: data.headerImageUrl, // This now holds the data URI or the original URL or null
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
        setImagePreview(latestSettings.headerImageUrl || null); // Update preview based on the *actual* saved data
        setInitialImageUrl(latestSettings.headerImageUrl || null); // Update initial URL state
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
            {imagePreview && (
               <div className="relative w-24 h-24 border rounded-md overflow-hidden shadow-inner bg-muted/50">
                   <Image
                       key={imagePreview} // Add key to force re-render on src change
                       src={imagePreview}
                       alt="Prévia da imagem do cabeçalho"
                       fill // Use fill instead of layout
                       style={{ objectFit: 'cover' }} // Ensure image covers the area
                       sizes="(max-width: 768px) 96px, 96px" // Size based on w-24
                       data-ai-hint="baby celebration banner"
                       onError={(e) => {
                         // Handle potential image loading errors (e.g., invalid data URI)
                         console.error("Error loading image preview:", imagePreview.substring(0, 50) + "...", e);
                         toast({ title: "Erro", description: "Não foi possível carregar a prévia da imagem.", variant: "destructive" });
                         setImagePreview(null); // Clear broken preview
                         setValue('headerImageUrl', null); // Clear URL in form state too
                       }}
                   />
                    <Button
                       type="button"
                       variant="destructive"
                       size="icon"
                       className="absolute top-1 right-1 h-6 w-6 z-10 rounded-full opacity-70 hover:opacity-100" // Make round and slightly transparent
                       onClick={removeImage}
                       title="Remover Imagem"
                       disabled={isSubmitting}
                    >
                       <XCircle className="h-4 w-4" />
                    </Button>
               </div>
            )}
            <div className="flex-1">
                {/* Use register but pass the onChange to the custom handler */}
                 <Input
                     id="headerImageFile"
                     type="file"
                     accept="image/png, image/jpeg, image/gif, image/webp"
                     {...register('headerImageFile')} // Keep register for RHF link
                     onChange={handleFileChange} // Use custom handler to trigger setValue
                     className={` ${errors.headerImageFile ? 'border-destructive' : ''} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer`}
                     disabled={isSubmitting}
                 />
                <p className="text-xs text-muted-foreground mt-1">Envie uma imagem (PNG, JPG, GIF, WebP). Máx 5MB.</p>
                {errors.headerImageFile && <p className="text-sm text-destructive mt-1">{errors.headerImageFile.message}</p>}
                 {/* Display existing URL hint */}
                 {!imagePreview && initialImageUrl && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">Imagem atual salva. Envie nova para substituir.</p>
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

