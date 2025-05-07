'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image'; // Import next/image
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2, Image as ImageIcon, XCircle } from 'lucide-react'; // Added icons
import { updateEventSettings, type EventSettings } from '@/data/gift-store';

interface AdminEventSettingsFormProps {
  initialSettings: EventSettings | null; // Receive initial settings as prop
  onSave?: () => void; // Callback to trigger parent refresh
  isLoading?: boolean; // Add loading state prop
}

// Constants for file validation (used client-side)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

// Zod schema WITHOUT FileList validation
const settingsFormSchema = z.object({
  title: z
    .string()
    .min(5, 'Título muito curto.')
    .max(100, 'Título muito longo.'),
  babyName: z.string().optional().nullable().or(z.literal('')),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (AAAA-MM-DD).'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM).'),
  location: z
    .string()
    .min(3, 'Local muito curto.')
    .max(100, 'Local muito longo.'),
  address: z
    .string()
    .min(10, 'Endereço muito curto.')
    .max(200, 'Endereço muito longo.'),
  welcomeMessage: z
    .string()
    .min(10, 'Mensagem de boas-vindas muito curta.')
    .max(500, 'Mensagem muito longa.'),
  // Holds either the existing URL or the NEW data URI for upload, or null for removal
  headerImageUrl: z.string().optional().nullable(),
  // Field to capture the file input, not directly part of the final data object for updateEventSettings
  headerImageFile: z.any().optional().nullable(),
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;

export default function AdminEventSettingsForm({
  initialSettings,
  onSave,
  isLoading,
}: AdminEventSettingsFormProps) {
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (initialSettings) {
      console.log(
        'EventSettingsForm: Setting initial preview from prop:',
        initialSettings.headerImageUrl?.substring(0, 50) + '...'
      );
      setImagePreview(initialSettings.headerImageUrl || null);
    } else {
      console.log(
        'EventSettingsForm: No initial settings provided, clearing preview.'
      );
      setImagePreview(null);
    }
  }, [initialSettings]);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
    getValues, // Get getValues to access current form state
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: initialSettings
      ? {
          ...initialSettings,
          headerImageUrl: initialSettings.headerImageUrl || null, // Set initial URL
          headerImageFile: null, // File input is always reset
          babyName: initialSettings.babyName || '',
        }
      : {
          title: 'Chá de Bebê',
          babyName: '',
          date: '',
          time: '',
          location: '',
          address: '',
          welcomeMessage: '',
          headerImageUrl: null,
          headerImageFile: null,
        },
  });

  // Reset form if initialSettings prop changes after initial mount
  useEffect(() => {
    if (initialSettings && isClient) {
      console.log(
        'EventSettingsForm: Resetting form with new initialSettings prop.',
        initialSettings.title
      );
      reset({
        ...initialSettings,
        headerImageUrl: initialSettings.headerImageUrl || null, // Reset URL
        headerImageFile: null, // Always reset file input
        babyName: initialSettings.babyName || '',
      });
      setImagePreview(initialSettings.headerImageUrl || null); // Update preview as well
    }
  }, [initialSettings, reset, isClient]);

  // Watch the FileList from the input
  const watchedFileList = watch('headerImageFile');

  // Update preview and headerImageUrl when file selection changes
  useEffect(() => {
    if (!isClient) return;

    const fileList = watchedFileList as FileList | null | undefined;
    const file = fileList?.[0];

    if (file) {
      // Client-Side Validation
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: 'Erro de Arquivo',
          description: `Tamanho máximo ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          variant: 'destructive',
        });
        setValue('headerImageFile', null); // Clear invalid file
        // Revert preview and URL to the initial state *before* this file was selected
        const initialUrl = initialSettings?.headerImageUrl || null;
        setValue('headerImageUrl', initialUrl);
        setImagePreview(initialUrl);
        return;
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({
          title: 'Erro de Arquivo',
          description: 'Tipo inválido (JPG, PNG, GIF, WebP).',
          variant: 'destructive',
        });
        setValue('headerImageFile', null);
        const initialUrl = initialSettings?.headerImageUrl || null;
        setValue('headerImageUrl', initialUrl);
        setImagePreview(initialUrl);
        return;
      }

      // Generate data URI for preview and store it in headerImageUrl
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log('EventSettingsForm: Generated data URI preview.');
        // Set the data URI to headerImageUrl - this will be sent for upload on submit
        setValue('headerImageUrl', result, { shouldValidate: true });
        setImagePreview(result); // Update client-side preview state
      };
      reader.onerror = (err) => {
        console.error('useEffect: FileReader error:', err);
        toast({
          title: 'Erro',
          description: 'Falha ao ler imagem.',
          variant: 'destructive',
        });
        setValue('headerImageFile', null);
        const initialUrl = initialSettings?.headerImageUrl || null;
        setValue('headerImageUrl', initialUrl);
        setImagePreview(initialUrl);
      };
      reader.readAsDataURL(file);
    } else if (
      fileList === null ||
      (typeof fileList === 'object' && fileList?.length === 0)
    ) {
      // File was cleared, but don't necessarily clear the headerImageUrl yet.
      // If the user clears the file input *after* selecting a file, we want to revert
      // the preview/URL back to the *initial* state, not necessarily null.
      const initialUrl = initialSettings?.headerImageUrl || null;
      const currentRHFUrl = getValues('headerImageUrl');
      // Only revert if the current RHF URL is a data URI (meaning a file *was* staged)
      if (currentRHFUrl && currentRHFUrl.startsWith('data:')) {
        console.log(
          'EventSettingsForm: File selection cleared, reverting preview/URL to initial state:',
          initialUrl
        );
        setValue('headerImageUrl', initialUrl);
        setImagePreview(initialUrl);
      }
      // If no file was staged (currentRHFUrl is the initial URL or null), clearing the input doesn't change anything.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedFileList, isClient, setValue, toast, initialSettings, getValues]); // Add getValues dependency

  const removeImage = useCallback(() => {
    console.log('EventSettingsForm: Requesting image removal.');
    setValue('headerImageFile', null); // Clear the FileList in RHF state
    // Set headerImageUrl to null to signify removal on submit
    setValue('headerImageUrl', null, { shouldValidate: true });
    setImagePreview(null); // Clear the preview state
    // Manually clear the file input element itself
    const fileInput = document.getElementById(
      'headerImageFile'
    ) as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
  }, [setValue]);

  const onSubmit = async (data: SettingsFormData) => {
    console.log('EventSettingsForm: Submitting form data...', {
      ...data,
      headerImageUrl: data.headerImageUrl?.substring(0, 50) + '...',
    });

    // Prepare data for saving (excluding the FileList reference)
    // The headerImageUrl field now contains either:
    // 1. The original URL (if no change)
    // 2. A NEW data URI (if a file was selected) -> This will trigger upload in updateEventSettings
    // 3. null (if the remove button was clicked) -> This will trigger deletion in updateEventSettings
    const settingsToSave: Partial<EventSettings> = {
      title: data.title,
      babyName: data.babyName || null,
      date: data.date,
      time: data.time,
      location: data.location,
      address: data.address,
      welcomeMessage: data.welcomeMessage,
      // Pass the current value of headerImageUrl directly
      headerImageUrl: data.headerImageUrl,
    };

    console.log('EventSettingsForm: Calling updateEventSettings with:', {
      ...settingsToSave,
      headerImageUrl: settingsToSave.headerImageUrl?.substring(0, 50) + '...',
    });

    try {
      // updateEventSettings now handles image upload/deletion based on headerImageUrl
      const updatedSettings = await updateEventSettings(settingsToSave);
      console.log(
        'EventSettingsForm: updateEventSettings successful. Result:',
        updatedSettings
      );

      toast({
        title: 'Sucesso!',
        description: 'Detalhes do evento atualizados.',
      });

      // Clear the file input visually after successful save
      const fileInput = document.getElementById(
        'headerImageFile'
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';

      // Trigger parent refresh AFTER successful update
      console.log(
        'EventSettingsForm: Save successful, calling onSave callback.'
      );
      onSave?.(); // Parent will refetch and pass new initialSettings, triggering reset
    } catch (error) {
      console.error('Error saving event settings:', error);
      toast({
        title: 'Erro!',
        description: 'Falha ao salvar. Verifique o console.',
        variant: 'destructive',
      });
    }
  };

  // Show loader if parent indicates data is loading OR if initial settings haven't arrived yet on client
  if (isLoading || (!isClient && !initialSettings)) {
    console.log('EventSettingsForm: Initial loading state...');
    return (
      <div className='flex items-center justify-center p-8'>
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
        <p className='ml-2 text-muted-foreground'>Carregando...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
      {/* Title */}
      <div className='grid gap-2'>
        <Label htmlFor='title'>Título do Evento*</Label>
        <Input
          id='title'
          {...register('title')}
          className={errors.title ? 'border-destructive' : ''}
          maxLength={100}
          disabled={isSubmitting}
        />
        {errors.title && (
          <p className='text-sm text-destructive mt-1'>
            {errors.title.message}
          </p>
        )}
      </div>

      {/* Baby Name */}
      <div className='grid gap-2'>
        <Label htmlFor='babyName'>Nome do Bebê (Opcional)</Label>
        <Input
          id='babyName'
          {...register('babyName')}
          placeholder='Ex: da Maria, do João...'
          className={errors.babyName ? 'border-destructive' : ''}
          disabled={isSubmitting}
        />
        {errors.babyName && (
          <p className='text-sm text-destructive mt-1'>
            {errors.babyName.message}
          </p>
        )}
      </div>

      {/* Header Image Upload */}
      <div className='grid gap-2'>
        <Label htmlFor='headerImageFile'>Foto Cabeçalho (Opcional)</Label>
        <div className='flex items-center gap-4'>
          {/* Use client-side imagePreview state */}
          {imagePreview && (
            <div className='relative w-24 h-24 border rounded-md overflow-hidden shadow-inner bg-muted/50'>
              <Image
                key={imagePreview} // Use preview URL as key to force re-render
                src={imagePreview}
                alt='Prévia da imagem do cabeçalho'
                fill
                style={{ objectFit: 'cover' }}
                sizes='96px' // Fixed size for preview
                data-ai-hint='baby celebration banner'
                onError={(e) => {
                  console.error(
                    'Error loading image preview:',
                    imagePreview.substring(0, 50) + '...',
                    e
                  );
                  toast({
                    title: 'Erro',
                    description: 'Não foi possível carregar a prévia.',
                    variant: 'destructive',
                  });
                  setImagePreview(null); // Clear preview on error
                }}
                unoptimized={imagePreview.startsWith('data:')} // Disable optimization for data URIs or non-standard URLs
              />
              <Button
                type='button'
                variant='destructive'
                size='icon'
                className='absolute top-1 right-1 h-6 w-6 z-10 rounded-full opacity-70 hover:opacity-100'
                onClick={removeImage} // Use removeImage callback
                title='Remover Imagem'
                disabled={isSubmitting}
              >
                <XCircle className='h-4 w-4' />
              </Button>
            </div>
          )}
          <div className='flex-1'>
            {/* File input registered with RHF */}
            <Input
              id='headerImageFile'
              type='file'
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              {...register('headerImageFile')} // RHF handles the file input state
              className={`${errors.headerImageFile ? 'border-destructive' : ''} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer`}
              disabled={isSubmitting}
            />
            <p className='text-xs text-muted-foreground mt-1'>
              JPG, PNG, GIF, WebP. Máx 5MB.
            </p>
            {/* Display error for the file input itself (e.g., if validation was added) */}
            {errors.headerImageFile &&
              typeof errors.headerImageFile.message === 'string' && (
                <p className='text-sm text-destructive mt-1'>
                  {errors.headerImageFile.message}
                </p>
              )}
            {/* Display error for the URL field (less likely now, but good practice) */}
            {errors.headerImageUrl && (
              <p className='text-sm text-destructive mt-1'>
                {errors.headerImageUrl.message}
              </p>
            )}
            {/* Hint about existing image */}
            {!watchedFileList?.length &&
              imagePreview &&
              !imagePreview.startsWith('data:') && (
                <p className='text-xs text-muted-foreground mt-1 truncate'>
                  Usando imagem salva. Envie nova ou remova.
                </p>
              )}
          </div>
        </div>
      </div>

      {/* Date and Time */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='grid gap-2'>
          <Label htmlFor='date'>Data* (AAAA-MM-DD)</Label>
          <Input
            id='date'
            type='date'
            {...register('date')}
            className={errors.date ? 'border-destructive' : ''}
            disabled={isSubmitting}
          />
          {errors.date && (
            <p className='text-sm text-destructive mt-1'>
              {errors.date.message}
            </p>
          )}
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='time'>Hora* (HH:MM)</Label>
          <Input
            id='time'
            type='time'
            {...register('time')}
            className={errors.time ? 'border-destructive' : ''}
            disabled={isSubmitting}
          />
          {errors.time && (
            <p className='text-sm text-destructive mt-1'>
              {errors.time.message}
            </p>
          )}
        </div>
      </div>

      {/* Location */}
      <div className='grid gap-2'>
        <Label htmlFor='location'>Local*</Label>
        <Input
          id='location'
          {...register('location')}
          className={errors.location ? 'border-destructive' : ''}
          maxLength={100}
          disabled={isSubmitting}
        />
        {errors.location && (
          <p className='text-sm text-destructive mt-1'>
            {errors.location.message}
          </p>
        )}
      </div>

      {/* Address */}
      <div className='grid gap-2'>
        <Label htmlFor='address'>Endereço Completo*</Label>
        <Input
          id='address'
          {...register('address')}
          className={errors.address ? 'border-destructive' : ''}
          maxLength={200}
          disabled={isSubmitting}
        />
        {errors.address && (
          <p className='text-sm text-destructive mt-1'>
            {errors.address.message}
          </p>
        )}
      </div>

      {/* Welcome Message */}
      <div className='grid gap-2'>
        <Label htmlFor='welcomeMessage'>Mensagem de Boas-Vindas*</Label>
        <Textarea
          id='welcomeMessage'
          {...register('welcomeMessage')}
          className={errors.welcomeMessage ? 'border-destructive' : ''}
          rows={4}
          maxLength={500}
          disabled={isSubmitting}
        />
        {errors.welcomeMessage && (
          <p className='text-sm text-destructive mt-1'>
            {errors.welcomeMessage.message}
          </p>
        )}
      </div>

      {/* Save Button */}
      <div className='flex justify-end pt-2'>
        <Button type='submit' disabled={isSubmitting || isLoading}>
          {isSubmitting ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' /> Salvando...
            </>
          ) : (
            <>
              <Save className='mr-2 h-4 w-4' /> Salvar Detalhes
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
