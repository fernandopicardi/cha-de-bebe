
/**
 * Manages gift items within the admin panel, allowing for CRUD operations.
 * Features:
 * - Displays a grid of existing gift items as cards.
 * - Allows adding new items via a dialog.
 * - Allows editing existing items via a dialog (opened by clicking a card).
 * - Handles image upload/preview/removal for items.
 * - Supports quantity-based items and single items.
 * - Provides actions to delete, revert selection, or mark items as not needed within the edit dialog.
 * - Uses Zod for form validation and React Hook Form for form management.
 * - Communicates with `gift-store.ts` for data persistence.
 */
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Trash2,
  Edit,
  PlusCircle,
  Save,
  Ban,
  RotateCcw,
  Loader2,
  Image as ImageIcon,
  XCircle,
  Package,
  Star,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  addGiftAdmin,
  updateGift,
  deleteGift,
  revertSelection,
  markGiftAsNotNeeded,
  type GiftItem,
} from '@/data/gift-store';
import * as z from 'zod';
import { useForm, Controller } from 'react-hook-form';

interface AdminItemManagementTableProps {
  gifts: GiftItem[];
  onDataChange?: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ACCEPTED_MEDIA_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'video/mp4',
  'video/quicktime',
  'image/webp',
  'image/gif',
];

const giftFormSchema = z.object({
  name: z
    .string()
    .min(3, 'Nome precisa ter pelo menos 3 caracteres.')
    .max(100, 'Nome muito longo'),
  description: z
    .string()
    .max(200, 'Descrição muito longa')
    .optional()
    .or(z.literal('')),
  category: z.string().min(1, 'Categoria é obrigatória.'),
  status: z.enum(['available', 'selected', 'not_needed']),
  selectedBy: z
    .string()
    .max(50, 'Nome do selecionador muito longo')
    .optional()
    .or(z.literal('')),
  imageUrl: z.string().optional().nullable(),
  imageFile: z.any().optional().nullable(),
  totalQuantity: z.preprocess(
    (val) => (val === '' || val === undefined ? null : Number(val)),
    z
      .number()
      .int()
      .positive('Quantidade deve ser um número positivo.')
      .nullable()
      .optional()
  ),
  priority: z.preprocess(
    (val) => {
      const numVal = Number(val);
      return isNaN(numVal) ? 0 : numVal;
    },
    z.number().int().min(0).max(2).default(0)
  ),
});

type GiftFormData = z.infer<typeof giftFormSchema>;

const categories = ['Roupas', 'Higiene', 'Brinquedos', 'Alimentação', 'Outros'];
const statuses: GiftItem['status'][] = ['available', 'selected', 'not_needed'];
const priorities = [
  { label: 'Baixa', value: 0 },
  { label: 'Média', value: 1 },
  { label: 'Alta', value: 2 },
];

export default function AdminItemManagementTable({
  gifts: giftsFromParent,
  onDataChange,
}: AdminItemManagementTableProps) {
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GiftItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // Now for dialog actions
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const safeGifts = useMemo(() => {
    const result = Array.isArray(giftsFromParent) ? giftsFromParent : [];
    result.sort((a, b) => {
      const priorityA = a.priority ?? -1;
      const priorityB = b.priority ?? -1;
      if (priorityB !== priorityA) {
        return priorityB - priorityA;
      }
      return a.name.localeCompare(b.name);
    });
    return result;
  }, [giftsFromParent]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting: isFormSubmitting }, // Renamed isSubmitting to avoid conflict
  } = useForm<GiftFormData>({
    resolver: zodResolver(giftFormSchema),
    defaultValues: {
      name: '',
      description: '',
      category: '',
      status: 'available',
      selectedBy: '',
      imageUrl: null,
      imageFile: null,
      totalQuantity: null,
      priority: 0,
    },
  });

  const watchedStatus = watch('status');
  const watchedImageFile = watch('imageFile');
  const watchedTotalQuantity = watch('totalQuantity');

  useEffect(() => {
    if (!isClient) return;
    let fileList: FileList | null = null;
    if (
      typeof FileList !== 'undefined' &&
      watchedImageFile instanceof FileList
    ) {
      fileList = watchedImageFile;
    } else if (watchedImageFile === null || watchedImageFile === undefined) {
      const initialUrl = editingItem?.imageUrl || null;
      const currentRHFUrl = getValues('imageUrl');
      if (currentRHFUrl && currentRHFUrl.startsWith('data:')) {
        setValue('imageUrl', initialUrl);
        setImagePreview(initialUrl);
      } else if (!currentRHFUrl && !initialUrl) {
        setImagePreview(null);
        setValue('imageUrl', null);
      }
      return;
    } else {
      console.warn("AdminItemManagementTable: Unexpected imageFile type. Clearing input.", watchedImageFile);
      const initialUrl = editingItem?.imageUrl || null;
      setValue('imageFile', null);
      setValue('imageUrl', initialUrl);
      setImagePreview(initialUrl);
      return;
    }

    const file = fileList?.[0];
    if (file) {
      if (typeof File !== 'undefined' && !(file instanceof File)) {
        console.warn("AdminItemManagementTable Dialog: Watched imageFile is not a File object (after FileList check):", file);
        setValue('imageFile', null);
        const initialUrl = editingItem?.imageUrl || null;
        setValue('imageUrl', initialUrl);
        setImagePreview(initialUrl);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: 'Erro de Arquivo', description: `Máx ${MAX_FILE_SIZE / 1024 / 1024}MB.`, variant: 'destructive' });
        setValue('imageFile', null); const initialUrl = editingItem?.imageUrl || null; setValue('imageUrl', initialUrl); setImagePreview(initialUrl); return;
      }
      if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
        toast({ title: 'Erro de Arquivo', description: 'Tipo inválido (JPG, PNG, GIF, WebP, MP4, MOV).', variant: 'destructive' });
        setValue('imageFile', null); const initialUrl = editingItem?.imageUrl || null; setValue('imageUrl', initialUrl); setImagePreview(initialUrl); return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string; setValue('imageUrl', result); setImagePreview(result);
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err); toast({ title: 'Erro ao Ler Arquivo', description: 'Não foi possível carregar a prévia.', variant: 'destructive' });
        const initialUrl = editingItem?.imageUrl || null; setValue('imageFile', null); setValue('imageUrl', initialUrl); setImagePreview(initialUrl);
      };
      reader.readAsDataURL(file);
    }
  }, [watchedImageFile, isClient, setValue, toast, editingItem, getValues]);

  const handleOpenAddDialog = () => {
    reset({ name: '', description: '', category: '', status: 'available', selectedBy: '', imageUrl: null, imageFile: null, totalQuantity: null, priority: 0 });
    setEditingItem(null); setImagePreview(null); setIsAddEditDialogOpen(true);
  };

  const handleOpenEditDialog = (item: GiftItem) => {
    setEditingItem(item);
    reset({ name: item.name, description: item.description || '', category: item.category, status: item.status, selectedBy: item.selectedBy || '', imageUrl: item.imageUrl || null, imageFile: null, totalQuantity: item.totalQuantity ?? null, priority: item.priority ?? 0 });
    setImagePreview(item.imageUrl || null); setIsAddEditDialogOpen(true);
  };

  const handleDialogClose = () => { setIsAddEditDialogOpen(false); setEditingItem(null); setImagePreview(null); reset(); };
  const removeImage = useCallback(() => {
    setValue('imageFile', null); setValue('imageUrl', null); setImagePreview(null);
    const fileInput = document.getElementById('imageFile-dialog') as HTMLInputElement | null; if (fileInput) fileInput.value = '';
  }, [setValue]);

  const handleSuccess = (message: string) => { toast({ title: 'Sucesso!', description: message }); onDataChange?.(); handleDialogClose(); };
  const handleError = (op: string, name: string, err?: any) => { console.error(`Error ${op} "${name}":`, err); toast({ title: 'Erro!', description: `Falha ${op} "${name}". ${err?.message || ''}`, variant: 'destructive' }); };

  const onSubmit = async (data: GiftFormData) => {
    const operation = editingItem ? 'atualizar' : 'adicionar';
    const itemName = data.name || (editingItem ? editingItem.name : 'Novo Item');
    const isQuantityItem = typeof data.totalQuantity === 'number' && data.totalQuantity > 0;
    if (!isQuantityItem && data.status === 'selected' && (!data.selectedBy || data.selectedBy.trim() === '')) {
      toast({ title: 'Erro de Validação', description: 'Informe quem selecionou o item.', variant: 'destructive' }); return;
    }
    if (isQuantityItem && data.status === 'selected') data.status = 'available';

    const imageValue = data.imageUrl;
    const finalPayload: Partial<GiftItem> & { imageDataUri?: string | null; } = {
      name: data.name.trim(), description: data.description?.trim() || null, category: data.category, status: data.status,
      selectedBy: isQuantityItem ? null : (data.status === 'selected' ? (data.selectedBy?.trim() || 'Admin') : null),
      totalQuantity: isQuantityItem ? data.totalQuantity : null, priority: data.priority,
      ...(editingItem ? { imageUrl: imageValue } : { imageDataUri: imageValue }),
    };
    if (!editingItem) finalPayload.selectedQuantity = 0;

    setActionLoading('save'); // Set loading for save operation
    try {
      if (editingItem) await updateGift(editingItem.id, finalPayload);
      else await addGiftAdmin(finalPayload as Omit<GiftItem, "id" | "createdAt" | "selectionDate"> & { imageDataUri?: string | null });
      handleSuccess(`Item "${finalPayload.name}" ${operation === 'adicionar' ? 'adicionado' : 'atualizado'}.`);
    } catch (error) { handleError(operation, itemName, error); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!editingItem || actionLoading) return;
    if (confirm(`Excluir "${editingItem.name}"? Ação irreversível.`)) {
      setActionLoading(`delete-${editingItem.id}`);
      try {
        await deleteGift(editingItem.id);
        handleSuccess(`Item "${editingItem.name}" excluído.`);
      } catch (error) { handleError('excluir', editingItem.name, error); }
      finally { setActionLoading(null); }
    }
  };

  const handleRevert = async () => {
    if (!editingItem || actionLoading) return;
    if (editingItem.status !== 'selected' && editingItem.status !== 'not_needed') return;
    if (editingItem.totalQuantity != null && editingItem.totalQuantity > 0) {
      toast({ title: 'Ação Indisponível', description: 'Reversão de itens com quantidade não é suportada aqui.', variant: 'default' }); return;
    }
    const actionText = editingItem.status === 'selected' ? 'reverter seleção' : 'remover "Preferimos Não Utilizar"';
    if (confirm(`Tem certeza que deseja ${actionText} de "${editingItem.name}"?`)) {
      setActionLoading(`revert-${editingItem.id}`);
      try {
        await revertSelection(editingItem.id);
        handleSuccess(`Item "${editingItem.name}" revertido para disponível.`);
      } catch (error) { handleError('reverter', editingItem.name, error); }
      finally { setActionLoading(null); }
    }
  };

  const handleMarkNotNeeded = async () => {
    if (!editingItem || actionLoading) return;
    if (editingItem.status === 'not_needed') return;
    if (confirm(`Marcar "${editingItem.name}" como "Preferimos Não Utilizar"?`)) {
      setActionLoading(`mark-${editingItem.id}`);
      try {
        await markGiftAsNotNeeded(editingItem.id);
        handleSuccess(`Item "${editingItem.name}" marcado como "Preferimos Não Utilizar".`);
      } catch (error) { handleError('marcar como "Preferimos Não Utilizar"', editingItem.name, error); }
      finally { setActionLoading(null); }
    }
  };

  const getStatusBadge = (item: GiftItem) => {
    let statusToDisplay = item.status;
    if (item.totalQuantity && item.totalQuantity > 0 && item.selectedQuantity && item.selectedQuantity >= item.totalQuantity) statusToDisplay = 'selected';
    const commonClasses = "text-xs px-2 py-0.5";
    switch (statusToDisplay) {
      case 'available': return <Badge variant='default' className={`bg-success text-success-foreground ${commonClasses}`}>Sugestão Disponível</Badge>;
      case 'selected': return <Badge variant='secondary' className={`bg-secondary text-secondary-foreground ${commonClasses}`}>Já Escolhido</Badge>;
      case 'not_needed': return <Badge variant='destructive' className={`bg-destructive/80 text-destructive-foreground ${commonClasses}`}>Preferimos Não Utilizar</Badge>;
      default: return <Badge variant='outline' className={commonClasses}>Indefinido</Badge>;
    }
  };

  const getPriorityTextAndColor = (priorityValue?: number | null) => {
    const p = priorities.find(p => p.value === priorityValue);
    let colorClass = 'text-gray-500'; // Default for Low or undefined
    if (p?.value === 1) colorClass = 'text-yellow-500'; // Medium
    if (p?.value === 2) colorClass = 'text-red-500'; // High
    return { text: p ? p.label : 'Baixa', colorClass };
  };

  return (
    <div className='space-y-6'>
      <div className='flex justify-end'>
        <Button onClick={handleOpenAddDialog} size='sm' disabled={isFormSubmitting || !!actionLoading} aria-label="Adicionar Novo Item">
          <PlusCircle className='mr-2 h-4 w-4' /> Adicionar Novo Item
        </Button>
      </div>

      {safeGifts.length === 0 ? (
        <div className='text-center py-10 text-muted-foreground'>
          <Package className="mx-auto h-12 w-12 mb-4 text-gray-400" />
          <p>Nenhum item na lista ainda.</p>
          <p className="text-sm">Clique em &quot;Adicionar Novo Item&quot; para começar.</p>
        </div>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
          {safeGifts.map((item) => {
            const isQuantityItem = item.totalQuantity !== null && item.totalQuantity > 0;
            const { text: priorityText, colorClass: priorityColorClass } = getPriorityTextAndColor(item.priority);

            return (
              <Card
                key={item.id}
                className='flex flex-col overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-shadow duration-200 cursor-pointer h-full'
                onClick={() => handleOpenEditDialog(item)}
              >
                <CardHeader className='p-0 relative'>
                  <div className='aspect-[4/3] w-full bg-muted/30 flex items-center justify-center'>
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={`Imagem de ${item.name}`}
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes='(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw'
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent && !parent.querySelector('.placeholder-icon')) {
                            const placeholder = document.createElement('div');
                            placeholder.className = 'placeholder-icon flex items-center justify-center h-full w-full';
                            placeholder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-off text-muted-foreground/30"><path d="M10.4 10.4A3 3 0 0 0 12 12a3 3 0 0 0 1.6-4.4Z"/><path d="m21 1-9.2 9.2"/><path d="M13.5 5.5C15 4.5 16.5 4 18 4c2.8 0 5 2.2 5 5c0 1.5-.5 3-1.5 4.5L19 16"/><path d="M3 3v18h18"/><path d="M12 12.7a4.8 4.8 0 0 0-5.1-4.9A5 5 0 0 0 2 12.5V13a5 5 0 0 0 5 5h1.5"/></svg>`;
                            parent.appendChild(placeholder);
                          }
                        }}
                      />
                    ) : (
                      <div className='flex items-center justify-center h-full w-full placeholder-icon'>
                        <ImageIcon className='h-12 w-12 text-muted-foreground/30' />
                      </div>
                    )}
                  </div>
                   {item.priority !== null && item.priority > 0 && (
                     <div className={`absolute top-2 right-2 p-1.5 rounded-full shadow-md bg-background/80`} title={`Prioridade: ${priorityText}`}>
                        <Star className={`h-4 w-4 ${priorityColorClass} ${item.priority === 2 ? 'fill-red-500' : item.priority === 1 ? 'fill-yellow-500' : '' }`} />
                     </div>
                   )}
                </CardHeader>
                <CardContent className='p-3 flex-grow space-y-1.5'>
                  <CardTitle className='text-base font-semibold leading-tight line-clamp-2'>{item.name}</CardTitle>
                  {item.description && (
                    <CardDescription className='text-xs text-muted-foreground line-clamp-2'>
                      {item.description}
                    </CardDescription>
                  )}
                  <div className='flex items-center text-xs text-muted-foreground pt-1'>
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5">{item.category}</Badge>
                  </div>
                </CardContent>
                <CardFooter className='p-3 border-t mt-auto flex flex-col items-start space-y-1.5'>
                  {getStatusBadge(item)}
                  {isQuantityItem && (
                    <div className='text-xs text-muted-foreground'>
                      <Package className="inline-block mr-1 h-3 w-3" />
                      <span>
                        {item.selectedQuantity ?? 0} / {item.totalQuantity ?? 0} selecionados
                      </span>
                    </div>
                  )}
                   <div className={`text-xs font-medium ${priorityColorClass}`}>
                     Prioridade: {priorityText}
                   </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isAddEditDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className='sm:max-w-md md:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Item' : 'Adicionar Novo Item'}</DialogTitle>
            <DialogDescription>{editingItem ? 'Modifique os detalhes.' : 'Preencha os detalhes.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className='grid gap-y-3 sm:gap-y-4 py-4'>
            <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-baseline'>
              <Label htmlFor='name-dialog' className='sm:text-right text-left sm:pt-1 font-medium'>Nome*</Label>
              <div className='sm:col-span-3'>
                <Input id='name-dialog' {...register('name')} className={errors.name ? 'border-destructive' : ''} maxLength={100} disabled={isFormSubmitting || !!actionLoading} />
                {errors.name && <p className='text-sm text-destructive mt-1'>{errors.name.message}</p>}
              </div>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-baseline'>
              <Label htmlFor='description-dialog' className='sm:text-right text-left sm:pt-1 font-medium'>Descrição</Label>
              <div className='sm:col-span-3'>
                <Textarea id='description-dialog' {...register('description')} rows={3} maxLength={200} disabled={isFormSubmitting || !!actionLoading} className={errors.description ? 'border-destructive' : ''} />
                {errors.description && <p className='text-sm text-destructive mt-1'>{errors.description.message}</p>}
              </div>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-baseline'>
              <Label htmlFor='category-dialog' className='sm:text-right text-left sm:pt-1 font-medium'>Categoria*</Label>
              <div className='sm:col-span-3'>
                <Controller name='category' control={control} rules={{ required: 'Categoria é obrigatória.' }}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} defaultValue='' disabled={isFormSubmitting || !!actionLoading}>
                      <SelectTrigger id='category-dialog' className={errors.category ? 'border-destructive' : ''}><SelectValue placeholder='Selecione uma categoria' /></SelectTrigger>
                      <SelectContent>{categories.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent>
                    </Select>
                  )} />
                {errors.category && <p className='text-sm text-destructive mt-1'>{errors.category.message}</p>}
              </div>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-baseline'>
              <Label htmlFor='priority-dialog' className='sm:text-right text-left sm:pt-1 font-medium'>Prioridade</Label>
              <div className='sm:col-span-3'>
                <Controller name='priority' control={control} defaultValue={0}
                  render={({ field }) => (
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={String(field.value ?? 0)} disabled={isFormSubmitting || !!actionLoading}>
                      <SelectTrigger id='priority-dialog' className={errors.priority ? 'border-destructive' : ''}><SelectValue placeholder='Selecione a prioridade' /></SelectTrigger>
                      <SelectContent>{priorities.map((p) => (<SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>))}</SelectContent>
                    </Select>
                  )} />
                {errors.priority && <p className='text-sm text-destructive mt-1'>{errors.priority.message}</p>}
              </div>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-baseline'>
              <Label htmlFor='totalQuantity-dialog' className='sm:text-right text-left sm:pt-1 font-medium'>Qtd. Total</Label>
              <div className='sm:col-span-3'>
                <Input id='totalQuantity-dialog' type='number' placeholder='Deixe vazio para item único' {...register('totalQuantity')} className={errors.totalQuantity ? 'border-destructive' : ''} min='1' disabled={isFormSubmitting || !!actionLoading || watchedStatus === 'selected'} />
                {errors.totalQuantity && <p className='text-sm text-destructive mt-1'>{errors.totalQuantity.message}</p>}
                {watchedStatus === 'selected' && !!watchedTotalQuantity && watchedTotalQuantity > 0 && (<p className='text-xs text-muted-foreground mt-1'>Status 'Já Escolhido' para itens com quantidade é automático. Será 'Disponível'.</p>)}
              </div>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-start'>
              <Label htmlFor='imageFile-dialog' className='sm:text-right text-left sm:pt-2 font-medium'>Imagem</Label>
              <div className='sm:col-span-3'>
                <div className='flex flex-col sm:flex-row items-start sm:items-center gap-4'>
                  {imagePreview && (
                    <div className='relative w-16 h-16 border rounded-md overflow-hidden shadow-inner bg-muted/50 flex-shrink-0'>
                      <Image key={imagePreview} src={imagePreview} alt='Prévia da imagem' fill style={{ objectFit: 'cover' }} sizes='64px' unoptimized={imagePreview.startsWith('data:')}
                        onError={(e) => { console.error("Error loading image preview in dialog:", e); setImagePreview(null); setValue('imageFile', null); setValue('imageUrl', editingItem?.imageUrl || null); }} />
                      <Button type='button' variant='destructive' size='icon' className='absolute top-0.5 right-0.5 h-5 w-5 z-10 rounded-full opacity-70 hover:opacity-100' onClick={removeImage} title='Remover Imagem' disabled={isFormSubmitting || !!actionLoading} aria-label="Remover Imagem"><XCircle className='h-3 w-3' /></Button>
                    </div>
                  )}
                  <div className='flex-1 w-full'>
                    <Input id='imageFile-dialog' type='file' accept={ACCEPTED_MEDIA_TYPES.join(',')} {...register('imageFile')}
                      className={`${errors.imageFile ? 'border-destructive' : ''} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer w-full`} disabled={isFormSubmitting || !!actionLoading} />
                    <p className='text-xs text-muted-foreground mt-1'>JPG, PNG, GIF, WebP, MP4, MOV (Máx 50MB).</p>
                    {errors.imageFile && typeof errors.imageFile.message === 'string' && <p className='text-sm text-destructive mt-1'>{errors.imageFile.message}</p>}
                    {errors.imageUrl && <p className='text-sm text-destructive mt-1'>{errors.imageUrl.message}</p>}
                  </div>
                </div>
              </div>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-baseline'>
              <Label htmlFor='status-dialog' className='sm:text-right text-left sm:pt-1 font-medium'>Status*</Label>
              <div className='sm:col-span-3'>
                <Controller name='status' control={control} defaultValue={editingItem?.status || 'available'} rules={{ required: 'Status é obrigatório.' }}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || 'available'} disabled={isFormSubmitting || !!actionLoading || (!!watchedTotalQuantity && watchedTotalQuantity > 0)}>
                      <SelectTrigger id='status-dialog' className={errors.status ? 'border-destructive' : ''}><SelectValue placeholder='Selecione um status' /></SelectTrigger>
                      <SelectContent>{statuses.map((stat) => (<SelectItem key={stat} value={stat} disabled={stat === 'selected' && !!watchedTotalQuantity && watchedTotalQuantity > 0}>
                        {stat === 'available' && 'Sugestão Disponível'}
                        {stat === 'selected' && 'Já Escolhido'}
                        {stat === 'not_needed' && 'Preferimos Não Utilizar'}
                      </SelectItem>))}</SelectContent>
                    </Select>
                  )} />
                {errors.status && <p id='status-error' className='text-sm text-destructive mt-1'>{errors.status.message}</p>}
                {!!watchedTotalQuantity && watchedTotalQuantity > 0 && <p className='text-xs text-muted-foreground mt-1'>Status é definido automaticamente para itens com quantidade.</p>}
              </div>
            </div>
            {watchedStatus === 'selected' && (!watchedTotalQuantity || watchedTotalQuantity <= 0) && (
              <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-baseline animate-fade-in'>
                <Label htmlFor='selectedBy-dialog' className='sm:text-right text-left sm:pt-1 font-medium'>Selecionado Por*</Label>
                <div className='sm:col-span-3'>
                  <Input id='selectedBy-dialog' {...register('selectedBy')} className={errors.selectedBy ? 'border-destructive' : ''} placeholder='Nome de quem selecionou' maxLength={50} disabled={isFormSubmitting || !!actionLoading} />
                  {errors.selectedBy ? <p className='text-sm text-destructive mt-1'>{errors.selectedBy.message}</p> : (watchedStatus === 'selected' && !watch('selectedBy') && <p className='text-sm text-destructive mt-1'>Nome obrigatório para itens selecionados.</p>)}
                </div>
              </div>
            )}
            <DialogFooter className='mt-4 grid grid-cols-2 sm:flex sm:flex-row sm:justify-end gap-2 pt-4 border-t'>
              <DialogClose asChild><Button type='button' variant='outline' disabled={isFormSubmitting || !!actionLoading} className="w-full sm:w-auto col-span-2 sm:col-auto">Cancelar</Button></DialogClose>
              <Button type='submit' disabled={isFormSubmitting || !!actionLoading} className='w-full sm:w-auto col-span-2 sm:col-auto'>
                {isFormSubmitting && actionLoading === 'save' ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <Save className='mr-2 h-4 w-4' />}
                {editingItem ? 'Salvar Alterações' : 'Adicionar Item'}
              </Button>
              {editingItem && (
                <>
                  <Button type="button" variant="outline" onClick={handleRevert} disabled={isFormSubmitting || !!actionLoading || editingItem.status === 'available' || (editingItem.totalQuantity !== null && editingItem.totalQuantity > 0) } className="w-full sm:w-auto">
                    {actionLoading === `revert-${editingItem.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4 text-orange-500" />}
                    Reverter
                  </Button>
                  <Button type="button" variant="outline" onClick={handleMarkNotNeeded} disabled={isFormSubmitting || !!actionLoading || editingItem.status === 'not_needed'} className="w-full sm:w-auto">
                     {actionLoading === `mark-${editingItem.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4 text-yellow-500" />}
                    Não Precisa
                  </Button>
                  <Button type="button" variant="destructive" onClick={handleDelete} disabled={isFormSubmitting || !!actionLoading} className="w-full sm:w-auto">
                    {actionLoading === `delete-${editingItem.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Excluir
                  </Button>
                </>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
