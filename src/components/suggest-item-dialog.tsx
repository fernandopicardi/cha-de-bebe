'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Image from 'next/image'; // Import Image
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
// Removed Checkbox import
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Image as ImageIcon, XCircle } from 'lucide-react';
import { addSuggestion, type SuggestionData } from '@/data/gift-store'; // Uses updated function

// Constants for file validation
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_MEDIA_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
];
// Define validation schema for adding an item, without email fields
const AddItemSchema = z.object({
  itemName: z
    .string()
    .min(3, 'Nome curto demais.')
    .max(100, 'Nome longo demais.'),
  itemDescription: z.string().max(200, 'Descrição longa demais.').optional(),
  suggesterName: z
    .string()
    .min(2, 'Nome curto demais.')
    .max(50, 'Nome longo demais.'),
  // Field to store the data URI temporarily for upload
  imageDataUri: z.string().optional().nullable(),
  // Field for the file input itself - allow FileList or null
  imageFile: z.any().optional().nullable(),
});
// Removed email validation logic

type AddItemFormData = z.infer<typeof AddItemSchema>;

interface SuggestItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // Callback to notify parent
}

export default function SuggestItemDialog({
  isOpen,
  onClose,
  onSuccess,
}: SuggestItemDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    register,
    handleSubmit,
    watch, // Watch for conditional rendering
    formState: { errors },
    reset,
    setValue,
    getValues, // Needed to check current imageDataUri
  } = useForm<AddItemFormData>({
    resolver: zodResolver(AddItemSchema),
    defaultValues: {
      itemName: '',
      itemDescription: '',
      suggesterName: '',
      imageDataUri: null,
      imageFile: null,
    },
  });

  const watchedImageFile = watch('imageFile');

  // Handle image preview updates and store data URI
  useEffect(() => {
    if (!isClient || !watchedImageFile) return; // Exit if not client or no file input value

    const fileList = watchedImageFile as FileList | null; // Type cast
    const file = fileList?.[0];

    if (file) {
      // Ensure it's a File object
      if (!(file instanceof File)) {
        console.warn(
          'SuggestItemDialog: imageFile is not a File object.',
          file
        );
        setValue('imageFile', null);
        setValue('imageDataUri', null);
        setImagePreview(null);
        return;
      }
      // Validation
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: 'Erro',
          description: `Máx ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          variant: 'destructive',
        });
        setValue('imageFile', null);
        setValue('imageDataUri', null); // Clear data URI if file invalid
        setImagePreview(null);
        return;
      }
      if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
        toast({
          title: 'Erro',
          description: 'Tipo inválido (JPG, PNG, etc).',
          variant: 'destructive',
        });
        setValue('imageFile', null);
        setValue('imageDataUri', null);
        setImagePreview(null);
        return;
      }

      // Generate preview and store data URI
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setValue('imageDataUri', result, { shouldValidate: true }); // Store data URI
        setImagePreview(result);
      };
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        toast({
          title: 'Erro ao Ler Imagem',
          description: 'Não foi possível carregar a prévia da imagem.',
          variant: 'destructive',
        });
        setValue('imageFile', null);
        setValue('imageDataUri', null);
        setImagePreview(null);
      };
      reader.readAsDataURL(file);
    } else {
      // File explicitly cleared or no file selected initially
      const currentDataUri = getValues('imageDataUri');
      if (currentDataUri) {
        // Only clear if one was set
        setValue('imageDataUri', null);
        setImagePreview(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedImageFile, isClient, setValue, toast, getValues]);

  const removeImage = useCallback(() => {
    setValue('imageFile', null);
    setValue('imageDataUri', null); // Clear stored data URI
    setImagePreview(null);
    const fileInput = document.getElementById(
      'imageFile-suggest'
    ) as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
  }, [setValue]);

  const onSubmit: SubmitHandler<AddItemFormData> = async (data) => {
    setIsSubmitting(true);
    console.log('SuggestItemDialog: Submitting suggestion...');
    try {
      // Prepare data for addSuggestion, without email fields
      const suggestionPayload: SuggestionData = {
        itemName: data.itemName,
        itemDescription: data.itemDescription,
        suggesterName: data.suggesterName,
        imageDataUri: data.imageDataUri,
        // Removed email fields
        // sendReminderEmail: data.sendReminderEmail,
        // guestEmail: data.guestEmail,
      };

      // Pass data including the imageDataUri to the backend function
      const newItem = await addSuggestion(suggestionPayload);

      if (newItem) {
        console.log(
          'SuggestItemDialog: Suggestion added successfully:',
          newItem
        );
        toast({
          title: 'Item Adicionado!',
          description: `Obrigado, ${data.suggesterName}! "${data.itemName}" adicionado e escolhido.`,
          variant: 'default', // Use default or success if available
          className: 'bg-success text-success-foreground border-success', // Example success styling
        });
        onSuccess(); // Call parent callback
        reset();
        setImagePreview(null);
        onClose(); // Close the dialog
      } else {
        // Handle case where addSuggestion returns null (e.g., validation error server-side)
        console.error(
          'SuggestItemDialog: Failed to add suggestion (backend returned null).'
        );
        toast({
          title: 'Erro',
          description: 'Não foi possível adicionar. Tente novamente.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      toast({
        title: 'Ops!',
        description: 'Não foi possível adicionar. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) {
      reset(); // Reset form when dialog is closed
      setImagePreview(null);
    }
  }, [isOpen, reset]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='sm:max-w-lg bg-card p-6'>
        {' '}
        {/* Adjusted max-width and padding */}
        <DialogHeader>
          <DialogTitle>Adicionar Novo Item</DialogTitle>
          <DialogDescription>
            Adicione um item à lista. Ele será marcado como escolhido por você.
          </DialogDescription>
        </DialogHeader>
        {/* Use space-y for vertical spacing */}
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4 py-4'>
          {/* Item Name */}
          <div className='grid gap-2'>
            {' '}
            {/* Simplified grid for single column */}
            <Label htmlFor='itemName-suggest'>Nome*</Label>
            <Input
              id='itemName-suggest'
              {...register('itemName')}
              className={`${errors.itemName ? 'border-destructive' : ''}`}
              disabled={isSubmitting}
            />
            {errors.itemName && (
              <p className='text-sm text-destructive mt-1'>
                {errors.itemName.message}
              </p>
            )}
          </div>

          {/* Item Description */}
          <div className='grid gap-2'>
            <Label htmlFor='itemDescription-suggest'>Descrição</Label>
            <Textarea
              id='itemDescription-suggest'
              placeholder='Ex: Marca, cor, link...'
              {...register('itemDescription')}
              className={`${errors.itemDescription ? 'border-destructive' : ''}`}
              disabled={isSubmitting}
              rows={3} // Reduced rows
            />
            {errors.itemDescription && (
              <p className='text-sm text-destructive mt-1'>
                {errors.itemDescription.message}
              </p>
            )}
          </div>

          {/* Image Upload */}
          <div className='grid gap-2'>
            <Label htmlFor='imageFile-suggest'>Imagem (Opc.)</Label>
            <div className='flex items-center gap-4'>
              {imagePreview && (
                <div className='relative w-16 h-16 border rounded-md overflow-hidden shadow-inner bg-muted/50 flex-shrink-0'>
                  <Image
                    key={imagePreview}
                    src={imagePreview}
                    alt='Prévia'
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes='64px'
                    unoptimized // Data URIs don't need optimization
                    onError={() => setImagePreview(null)}
                  />
                  <Button
                    type='button'
                    variant='destructive'
                    size='icon'
                    className='absolute top-0.5 right-0.5 h-5 w-5 z-10 rounded-full opacity-70 hover:opacity-100'
                    onClick={removeImage}
                    title='Remover'
                    disabled={isSubmitting}
                  >
                    <XCircle className='h-3 w-3' />
                  </Button>
                </div>
              )}
              <div className='flex-1'>
                <Input
                  id='imageFile-suggest'
                  type='file'
                  accept={ACCEPTED_MEDIA_TYPES.join(',')}
                  {...register('imageFile')} // Register file input
                  className={` ${errors.imageFile ? 'border-destructive' : ''} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer`}
                  disabled={isSubmitting}
                />
                <p className='text-xs text-muted-foreground mt-1'>
                  JPG, PNG, GIF, WebP, MP4, MOV (Máx 50MB).
                </p>
                {errors.imageFile &&
                  typeof errors.imageFile.message === 'string' && (
                    <p className='text-sm text-destructive mt-1'>
                      {errors.imageFile.message}
                    </p>
                  )}
                {errors.imageDataUri && (
                  <p className='text-sm text-destructive mt-1'>
                    {errors.imageDataUri.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Suggester Name */}
          <div className='grid gap-2'>
            <Label htmlFor='suggesterName-suggest'>Seu Nome*</Label>
            <Input
              id='suggesterName-suggest'
              {...register('suggesterName')}
              className={`${errors.suggesterName ? 'border-destructive' : ''}`}
              disabled={isSubmitting}
            />
            {errors.suggesterName && (
              <p className='text-sm text-destructive mt-1'>
                {errors.suggesterName.message}
              </p>
            )}
          </div>

          {/* Removed Email Reminder Section */}

          {/* Footer buttons */}
          <DialogFooter className='mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0'>
            {' '}
            {/* Adjust footer layout */}
            <DialogClose asChild>
              <Button
                type='button'
                variant='outline'
                disabled={isSubmitting}
                className='w-full sm:w-auto'
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type='submit'
              disabled={isSubmitting}
              className='bg-accent text-accent-foreground hover:bg-accent/90 w-full sm:w-auto'
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />{' '}
                  Adicionando...
                </>
              ) : (
                <>
                  <Send className='mr-2 h-4 w-4' /> Adicionar e Escolher
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
