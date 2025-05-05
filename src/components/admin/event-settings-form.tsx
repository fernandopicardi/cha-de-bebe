

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


interface AdminEventSettingsFormProps {
  onSave?: () => void; // Callback might still be useful for parent-specific logic, but not revalidation
}

// Refined schema for file handling
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

const settingsFormSchema = z.object({
  title: z.string().min(5, "Título muito curto.").max(100, "Título muito longo."), // Added max length
  babyName: z.string().optional().nullable().or(z.literal('')), // Allow empty string or null
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (AAAA-MM-DD)."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido (HH:MM)."),
  location: z.string().min(3, "Local muito curto.").max(100, "Local muito longo."), // Added max length
  address: z.string().min(10, "Endereço muito curto.").max(200, "Endereço muito longo."), // Added max length
  welcomeMessage: z.string().min(10, "Mensagem de boas-vindas muito curta.").max(500, "Mensagem muito longa."), // Increased max length
  headerImageUrl: z.string().optional().nullable(), // Allow string URL or data URI or null
  // Validate FileList provided by input type="file"
  headerImageFile: z
    .instanceof(FileList)
    .optional()
    .nullable()
    .refine(
      (fileList) => !fileList || fileList.length === 0 || fileList[0].size <= MAX_FILE_SIZE,
      `Tamanho máximo do arquivo é 5MB.`
    )
    .refine(
        (fileList) => !fileList || fileList.length === 0 || ACCEPTED_IMAGE_TYPES.includes(fileList[0].type),
      "Apenas arquivos .jpg, .jpeg, .png, .webp e .gif são aceitos."
    ),
}).refine(data => {
    // Skip URL validation if a file is being uploaded (headerImageUrl will be data URI or cleared later)
    if (data.headerImageFile && data.headerImageFile.length > 0) {
        return true;
    }
    // Validate existing URL if no file is being uploaded
    return !data.headerImageUrl || data.headerImageUrl.startsWith('data:image/') || data.headerImageUrl.startsWith('http');
}, {
    message: "URL da imagem inválido. Deve ser um URL http(s) ou uma imagem carregada.", // Custom validation message
    path: ["headerImageUrl"],
});


type SettingsFormData = z.infer<typeof settingsFormSchema>;


export default function AdminEventSettingsForm({ onSave }: AdminEventSettingsFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null); // State for client-side preview

  const { control, register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue, getValues } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: async () => {
       setIsLoading(true);
       try {
         const settings = await getEventSettings();
         setImagePreview(settings.headerImageUrl || null); // Set initial preview
         return {
             ...settings,
             headerImageUrl: settings.headerImageUrl || null, // RHF state holds the initial URL
             headerImageFile: null, // Initialize file input as null FileList
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

   // Watch the FileList from the input
   const watchedFileList = watch('headerImageFile');

   // Update preview and RHF URL field when file selection changes
   useEffect(() => {
     const file = watchedFileList?.[0]; // Get the first file from the FileList

     if (file) {
       // Validation is now handled by Zod schema

       // Generate data URI for preview and store it in headerImageUrl
       const reader = new FileReader();
       reader.onloadend = () => {
         const result = reader.result as string;
         setValue('headerImageUrl', result, { shouldValidate: true }); // Store data URI in headerImageUrl
         setImagePreview(result); // Update client-side preview state
       };
       reader.onerror = (err) => {
         console.error("useEffect: FileReader error:", err);
         toast({ title: "Erro", description: "Falha ao ler o arquivo de imagem.", variant: "destructive" });
         // Clear states if reading fails
         setValue('headerImageFile', null, { shouldValidate: true });
         setValue('headerImageUrl', null, { shouldValidate: true });
         setImagePreview(null);
       };
       reader.readAsDataURL(file);
     } else if (watchedFileList === null) {
        // File was explicitly cleared (e.g., by removeImage or resetting the form)
        // `removeImage` handles clearing the URL and preview as well.
     } else {
        // No file selected or FileList is undefined (initial state)
        // Restore preview from potentially existing URL in RHF state if file is cleared implicitly
        const currentUrl = getValues('headerImageUrl');
        if (currentUrl && currentUrl.startsWith('http')) {
           setImagePreview(currentUrl);
        } else if (!currentUrl) {
           setImagePreview(null); // Ensure preview is clear if no file and no URL
        }
        // Don't update preview if currentUrl is a data URI (means previous upload hasn't been saved yet)
     }

   }, [watchedFileList, setValue, toast, getValues]);


   const removeImage = useCallback(async () => {
      setValue('headerImageFile', null, { shouldValidate: true }); // Clear the FileList in RHF state
      setValue('headerImageUrl', null, { shouldValidate: true }); // Clear the URL in RHF state
      setImagePreview(null); // Clear the preview state
       // Manually clear the file input element itself
       const fileInput = document.getElementById('headerImageFile') as HTMLInputElement | null;
       if (fileInput) {
           fileInput.value = '';
       }
   }, [setValue]);


   const onSubmit = async (data: SettingsFormData) => {

     // headerImageUrl already contains data URI if a file was selected and read successfully,
     // or the initial URL, or null if removed/cleared.

     // Prepare data for saving (excluding the FileList)
     const settingsToSave: Partial<EventSettings> = {
       title: data.title,
       babyName: data.babyName || null,
       date: data.date,
       time: data.time,
       location: data.location,
       address: data.address,
       welcomeMessage: data.welcomeMessage,
       headerImageUrl: data.headerImageUrl, // This holds the data URI, original URL, or null
     };

    try {
      await updateEventSettings(settingsToSave); // This now handles revalidation internally

      toast({ title: "Sucesso!", description: "Detalhes do evento atualizados." });

      // Re-fetch settings to update the form state with saved data
      try {
        const latestSettings = await getEventSettings();
        reset({
          ...latestSettings,
          headerImageUrl: latestSettings.headerImageUrl || null,
          headerImageFile: null, // Clear FileList input after successful save
          babyName: latestSettings.babyName || '',
        });
        setImagePreview(latestSettings.headerImageUrl || null); // Update preview with saved URL
        // Clear the actual file input element
        const fileInput = document.getElementById('headerImageFile') as HTMLInputElement | null;
        if (fileInput) fileInput.value = '';
      } catch (fetchError) {
        console.error("Error re-fetching settings after save:", fetchError);
        toast({ title: "Aviso", description: "Configurações salvas, mas houve um erro ao recarregar o formulário.", variant: "default" });
      }

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
             {/* Use client-side imagePreview state */}
            {imagePreview && (
               <div className="relative w-24 h-24 border rounded-md overflow-hidden shadow-inner bg-muted/50">
                   <Image
                       key={imagePreview} // Use preview URL as key
                       src={imagePreview}
                       alt="Prévia da imagem do cabeçalho"
                       fill
                       style={{ objectFit: 'cover' }}
                       sizes="96px" // Fixed size for preview
                       data-ai-hint="baby celebration banner"
                       onError={(e) => {
                         console.error("Error loading image preview:", imagePreview.substring(0, 50) + "...", e);
                         toast({ title: "Erro", description: "Não foi possível carregar a prévia da imagem.", variant: "destructive" });
                         setImagePreview(null); // Clear preview on error
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
                 {/* Let react-hook-form handle the file input directly */}
                 <Input
                     id="headerImageFile"
                     type="file"
                     accept={ACCEPTED_IMAGE_TYPES.join(",")} // Use defined constants
                     {...register('headerImageFile')} // Register directly
                     className={` ${errors.headerImageFile ? 'border-destructive' : ''} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer`}
                     disabled={isSubmitting}
                 />
                 <p className="text-xs text-muted-foreground mt-1">Envie uma imagem (JPG, PNG, GIF, WebP). Máx 5MB.</p>
                 {/* Display error from RHF validation */}
                 {errors.headerImageFile && <p className="text-sm text-destructive mt-1">{errors.headerImageFile.message}</p>}
                 {/* Display error for the URL field (less likely now but keep for robustness) */}
                 {errors.headerImageUrl && <p className="text-sm text-destructive mt-1">{errors.headerImageUrl.message}</p>}
                 {/* Display hint about existing image only if no file is staged and there's a non-data URL */}
                 {!watchedFileList?.length && imagePreview && !imagePreview.startsWith('data:') && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">Usando imagem salva anteriormente. Envie nova para substituir ou clique em remover.</p>
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

