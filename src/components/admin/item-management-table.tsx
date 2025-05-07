/**
 * Manages gift items within the admin panel, allowing for CRUD operations.
 * Features:
 * - Displays a table of existing gift items.
 * - Allows adding new items via a dialog.
 * - Allows editing existing items via a dialog.
 * - Handles image upload/preview/removal for items.
 * - Supports quantity-based items and single items.
 * - Provides actions to delete, revert selection, or mark items as not needed.
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
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
});

type GiftFormData = z.infer<typeof giftFormSchema>;

const categories = ['Roupas', 'Higiene', 'Brinquedos', 'Alimentação', 'Outros'];
const statuses: GiftItem['status'][] = ['available', 'selected', 'not_needed'];

export default function AdminItemManagementTable({
  gifts: giftsFromParent,
  onDataChange,
}: AdminItemManagementTableProps) {
  const [isAddEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GiftItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const safeGifts = useMemo(() => {
    const result = Array.isArray(giftsFromParent) ? giftsFromParent : [];
    console.log(
      `AdminItemManagementTable: Memoized safeGifts. Count: ${result.length}. Sample:`, result.slice(0,3)
    );
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
    trigger,
    formState: { errors, isSubmitting },
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
    },
  });

  const watchedStatus = watch('status');
  const watchedImageFile = watch('imageFile');
  const watchedTotalQuantity = watch('totalQuantity');

  useEffect(() => {
    if (!isClient) return;

    let fileList: FileList | null = null;
    // Check if FileList is defined and if watchedImageFile is an instance of it
    if (
      typeof FileList !== 'undefined' &&
      watchedImageFile instanceof FileList
    ) {
      fileList = watchedImageFile;
    } else if (watchedImageFile === null || watchedImageFile === undefined) {
      // Handle case where input is cleared or initially empty
      const initialUrl = editingItem?.imageUrl || null;
      const currentRHFUrl = getValues('imageUrl');
      // Only revert if a data URI was staged (meaning user selected a file then cleared)
      if (currentRHFUrl && currentRHFUrl.startsWith('data:')) {
        setValue('imageUrl', initialUrl);
        setImagePreview(initialUrl);
      } else if (!currentRHFUrl && !initialUrl) {
        // If both current RHF and initial are null/empty, ensure preview is also cleared
        setImagePreview(null);
        setValue('imageUrl', null); // Ensure RHF state is also null
      }
      return; // Exit early if no file or FileList object
    } else {
      // If watchedImageFile is not a FileList and not null/undefined, it's unexpected.
      // Clear the input and revert to initial state to be safe.
      console.warn("AdminItemManagementTable: Unexpected imageFile type. Clearing input.", watchedImageFile);
      const initialUrl = editingItem?.imageUrl || null;
      setValue('imageFile', null); // Clear the RHF file state
      setValue('imageUrl', initialUrl); // Revert URL
      setImagePreview(initialUrl); // Revert preview
      return;
    }


    const file = fileList?.[0];

    if (file) {
      if (!(file instanceof File)) {
        console.warn("AdminItemManagementTable Dialog: Watched imageFile is not a File object (after FileList check):", file);
        setValue('imageFile', null);
        const initialUrl = editingItem?.imageUrl || null;
        setValue('imageUrl', initialUrl);
        setImagePreview(initialUrl);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: 'Erro de Arquivo',
          description: `Máx ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          variant: 'destructive',
        });
        setValue('imageFile', null);
        const initialUrl = editingItem?.imageUrl || null;
        setValue('imageUrl', initialUrl);
        setImagePreview(initialUrl);
        return;
      }
      if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
        toast({
          title: 'Erro de Arquivo',
          description: 'Tipo inválido (JPG, PNG, GIF, WebP, MP4, MOV).',
          variant: 'destructive',
        });
        setValue('imageFile', null);
        const initialUrl = editingItem?.imageUrl || null;
        setValue('imageUrl', initialUrl);
        setImagePreview(initialUrl);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setValue('imageUrl', result);
        setImagePreview(result);
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        toast({
            title: 'Erro ao Ler Arquivo',
            description: 'Não foi possível carregar a prévia.',
            variant: 'destructive',
        });
        // Revert to initial state on error
        const initialUrl = editingItem?.imageUrl || null;
        setValue('imageFile', null);
        setValue('imageUrl', initialUrl);
        setImagePreview(initialUrl);
      };
      reader.readAsDataURL(file);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    watchedImageFile,
    isClient,
    setValue,
    toast,
    editingItem,
    getValues,
    trigger,
  ]);

  const handleOpenAddDialog = () => {
    reset({
      name: '',
      description: '',
      category: '',
      status: 'available',
      selectedBy: '',
      imageUrl: null,
      imageFile: null,
      totalQuantity: null,
    });
    setEditingItem(null);
    setImagePreview(null);
    // setIsAddEditDialogOpen(true); // State removed
  };

  const handleOpenEditDialog = (item: GiftItem) => {
    setEditingItem(item);
    reset({
      name: item.name,
      description: item.description || '',
      category: item.category,
      status: item.status,
      selectedBy: item.selectedBy || '',
      imageUrl: item.imageUrl || null,
      imageFile: null,
      totalQuantity: item.totalQuantity ?? null,
    });
    setImagePreview(item.imageUrl || null);
    // setIsAddEditDialogOpen(true); // State removed
  };

  const handleDialogClose = () => {
    // setIsAddEditDialogOpen(false); // State removed
    setEditingItem(null);
    setImagePreview(null);
    reset();
  };

  const removeImage = useCallback(() => {
    setValue('imageFile', null);
    setValue('imageUrl', null);
    setImagePreview(null);
    const fileInput = document.getElementById(
      'imageFile-dialog'
    ) as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
  }, [setValue]);

  const handleSuccess = (message: string) => {
    toast({ title: 'Sucesso!', description: message });
    onDataChange?.();
    handleDialogClose();
  };

  const handleError = (
    operation: string,
    itemName: string,
    errorDetails?: any
  ) => {
    console.error(
      `AdminItemManagementTable: Error during ${operation} for "${itemName}":`,
      errorDetails
    );
    let description = `Falha ao ${operation.toLowerCase()} o item "${itemName}". Verifique o console.`;
    if (errorDetails instanceof Error) {
      if (errorDetails.message.includes('invalid data')) {
        description = `Dados inválidos fornecidos para ${operation.toLowerCase()} "${itemName}". Verifique os campos.`;
      } else if (errorDetails.message.includes('PERMISSION_DENIED')) {
        description = `Permissão negada para ${operation.toLowerCase()} "${itemName}". Verifique as regras do Firestore.`;
      }
    } else if (errorDetails?.code === 'permission-denied') {
      description = `Permissão negada para ${operation.toLowerCase()} "${itemName}". Verifique as regras do Firestore.`;
    }
    toast({ title: 'Erro!', description: description, variant: 'destructive' });
  };

  const onSubmit = async (data: GiftFormData) => {
    const operation = editingItem ? 'atualizar' : 'adicionar';
    const itemName =
      data.name || (editingItem ? editingItem.name : 'Novo Item');

    const isQuantityItem =
      typeof data.totalQuantity === 'number' && data.totalQuantity > 0;

    if (
      !isQuantityItem &&
      data.status === 'selected' &&
      (!data.selectedBy || data.selectedBy.trim() === '')
    ) {
      toast({
        title: 'Erro de Validação',
        description: 'Informe quem selecionou.',
        variant: 'destructive',
      });
      return;
    }

    if (isQuantityItem && data.status === 'selected') {
      data.status = 'available';
    }

    const imageValue = data.imageUrl;

    const finalPayload: Partial<GiftItem> & {
      imageDataUri?: string | null;
    } = {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      category: data.category,
      status: data.status,
      selectedBy: isQuantityItem
        ? null
        : data.status === 'selected'
          ? data.selectedBy?.trim() || 'Admin'
          : null,
      totalQuantity: isQuantityItem ? data.totalQuantity : null,
      ...(editingItem
        ? { imageUrl: imageValue } // For updates, use imageUrl (can be existing URL, new data URI, or null for removal)
        : { imageDataUri: imageValue }), // For adds, pass as imageDataUri (can be new data URI or null)
    };

    if (!editingItem) {
      finalPayload.selectedQuantity = 0;
    }


    try {
      if (editingItem) {
        await updateGift(editingItem.id, finalPayload);
        handleSuccess(`Item "${finalPayload.name}" atualizado.`);
      } else {
        // Pass the correct type to addGiftAdmin
        await addGiftAdmin(finalPayload as Omit<GiftItem, "id" | "createdAt" | "selectionDate"> & { imageDataUri?: string | null });
        handleSuccess(`Item "${finalPayload.name}" adicionado.`);
      }
    } catch (error) {
      handleError(operation, itemName, error);
    }
  };

  const handleDelete = async (item: GiftItem) => {
    if (actionLoading) return;
    if (confirm(`Excluir "${item.name}"? Ação irreversível.`)) {
      setActionLoading(`delete-${item.id}`);
      try {
        const success = await deleteGift(item.id);
        if (success) {
          handleSuccess(`Item "${item.name}" excluído.`);
        } else {
          handleError('excluir', item.name, 'Delete operation failed.');
        }
      } catch (error) {
        handleError('excluir', item.name, error);
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleRevert = async (item: GiftItem) => {
    if (actionLoading) return;
    if (item.status !== 'selected' && item.status !== 'not_needed') return;
    if (item.totalQuantity != null && item.totalQuantity > 0) {
      toast({
        title: 'Ação Indisponível',
        description:
          'Reversão de itens com quantidade não suportada nesta versão.',
        variant: 'default',
      });
      return;
    }

    const actionText =
      item.status === 'selected' ? 'reverter seleção' : 'remover "Não Precisa"';
    const guestNameInfo = item.selectedBy ? ` por ${item.selectedBy}` : '';
    if (
      confirm(
        `Tem certeza que deseja ${actionText} de "${item.name}"${guestNameInfo}?`
      )
    ) {
      setActionLoading(`revert-${item.id}`);
      try {
        await revertSelection(item.id);
        handleSuccess(`Item "${item.name}" revertido para disponível.`);
      } catch (error) {
        handleError('reverter', item.name, error);
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleMarkNotNeeded = async (item: GiftItem) => {
    if (actionLoading) return;
    if (item.status === 'not_needed') return;
    if (confirm(`Marcar "${item.name}" como "Preferimos Não Utilizar"?`)) {
      setActionLoading(`mark-${item.id}`);
      try {
        await markGiftAsNotNeeded(item.id);
        handleSuccess(
          `Item "${item.name}" marcado como "Preferimos Não Utilizar".`
        );
      } catch (error) {
        handleError('marcar como "Preferimos Não Utilizar"', item.name, error);
      } finally {
        setActionLoading(null);
      }
    }
  };

  const getStatusBadge = (status: GiftItem['status']) => {
    switch (status) {
      case 'available':
        return (
          <Badge
            variant='default'
            className='bg-success text-success-foreground'
          >
            Sugestão Disponível
          </Badge>
        );
      case 'selected':
        return (
          <Badge
            variant='secondary'
            className='bg-secondary text-secondary-foreground'
          >
            Já Escolhido
          </Badge>
        );
      case 'not_needed':
        return (
          <Badge
            variant='destructive'
            className='bg-destructive/80 text-destructive-foreground'
          >
            Preferimos Não Utilizar
          </Badge>
        );
      default:
        return <Badge variant='outline'>Indefinido</Badge>;
    }
  };

  const formatDateTime = (isoString: string | null | undefined): string => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return isNaN(date.getTime())
        ? '-'
        : date.toLocaleString('pt-BR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
    } catch (e) {
      return '-';
    }
  };

  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <Button
          onClick={handleOpenAddDialog}
          size='sm'
          disabled={isSubmitting || !!actionLoading}
        >
          <PlusCircle className='mr-2 h-4 w-4' /> Adicionar Novo Item
        </Button>
      </div>
      <div className='rounded-md border overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-[60px]'></TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className='hidden lg:table-cell'>Descrição</TableHead>
              <TableHead className='hidden md:table-cell'>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead className='hidden xl:table-cell'>
                Selecionado Por
              </TableHead>
              <TableHead className='text-right'>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeGifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className='h-24 text-center'>
                  Nenhum item na lista ainda. Adicione um item acima.
                </TableCell>
              </TableRow>
            ) : (
              safeGifts.map((item) => {
                const isQuantityItem =
                  item.totalQuantity !== null && item.totalQuantity > 0;
                const displayedStatus =
                  isQuantityItem &&
                  item.selectedQuantity !== undefined &&
                  item.totalQuantity != null &&
                  item.selectedQuantity >= item.totalQuantity
                    ? 'selected'
                    : item.status;
                const canRevert =
                  !isQuantityItem &&
                  (displayedStatus === 'selected' ||
                    displayedStatus === 'not_needed');

                return (
                  <TableRow
                    key={item.id}
                    className={
                      actionLoading?.endsWith(item.id)
                        ? 'opacity-50 pointer-events-none'
                        : ''
                    }
                  >
                    <TableCell>
                      <div className='relative h-10 w-10 rounded-md overflow-hidden border bg-muted/50 flex-shrink-0'>
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={`Imagem de ${item.name}`}
                            fill
                            style={{ objectFit: 'cover' }}
                            sizes='40px'
                            unoptimized={item.imageUrl.startsWith('data:')}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '';
                              (e.target as HTMLImageElement).style.display =
                                'none';
                            }}
                          />
                        ) : (
                          <div className='flex items-center justify-center h-full w-full'>
                            <ImageIcon className='h-5 w-5 text-muted-foreground' />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='font-medium whitespace-nowrap'>
                      {item.name}
                    </TableCell>
                    <TableCell className='hidden lg:table-cell text-muted-foreground text-sm max-w-xs truncate'>
                      {item.description || '-'}
                    </TableCell>
                    <TableCell className='hidden md:table-cell'>
                      {item.category}
                    </TableCell>
                    <TableCell>{getStatusBadge(displayedStatus)}</TableCell>
                    <TableCell className='text-center text-sm'>
                      {isQuantityItem ? (
                        <span className='whitespace-nowrap'>
                          {item.selectedQuantity ?? 0} /{' '}
                          {item.totalQuantity ?? 0}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className='hidden xl:table-cell text-xs text-muted-foreground'>
                      {(!isQuantityItem || displayedStatus === 'selected') &&
                      item.selectedBy ? (
                        <>
                          {item.selectedBy}
                          {item.selectionDate && (
                            <div className='text-[10px]'>
                              ({formatDateTime(item.selectionDate)})
                            </div>
                          )}
                        </>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className='text-right space-x-1 whitespace-nowrap'>
                      {actionLoading?.endsWith(item.id) ? (
                        <Loader2 className='h-4 w-4 animate-spin inline-block text-muted-foreground' />
                      ) : (
                        <>
                          <Button
                            variant='ghost'
                            size='icon'
                            onClick={() => handleOpenEditDialog(item)}
                            title='Editar Item'
                            disabled={!!actionLoading}
                            aria-label={`Editar ${item.name}`}
                          >
                            <Edit className='h-4 w-4' />
                          </Button>
                          {canRevert && (
                            <Button
                              variant='ghost'
                              size='icon'
                              onClick={() => handleRevert(item)}
                              title='Reverter para Disponível'
                              disabled={!!actionLoading}
                              aria-label={`Reverter ${item.name}`}
                            >
                              <RotateCcw className='h-4 w-4 text-orange-600' />
                            </Button>
                          )}
                          {(displayedStatus === 'available' ||
                            displayedStatus === 'selected') && (
                            <Button
                              variant='ghost'
                              size='icon'
                              onClick={() => handleMarkNotNeeded(item)}
                              title='Marcar como Preferimos Não Utilizar'
                              disabled={!!actionLoading}
                              aria-label={`Marcar ${item.name} como não precisa`}
                            >
                              <Ban className='h-4 w-4 text-yellow-600' />
                            </Button>
                          )}
                          <Button
                            variant='ghost'
                            size='icon'
                            onClick={() => handleDelete(item)}
                            title='Excluir Item'
                            disabled={!!actionLoading}
                            aria-label={`Excluir ${item.name}`}
                          >
                            <Trash2 className='h-4 w-4 text-destructive' />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAddEditDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className='sm:max-w-[480px]'>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Item' : 'Adicionar Novo Item'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Modifique os detalhes.' : 'Preencha os detalhes.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className='grid gap-4 py-4'>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='name-dialog' className='text-right'>
                Nome*
              </Label>
              <div className='col-span-3'>
                <Input
                  id='name-dialog'
                  {...register('name')}
                  className={errors.name ? 'border-destructive' : ''}
                  maxLength={100}
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className='text-sm text-destructive mt-1'>
                    {errors.name.message}
                  </p>
                )}
              </div>
            </div>
            <div className='grid grid-cols-4 items-start gap-4'>
              <Label htmlFor='description-dialog' className='text-right pt-2'>
                Descrição
              </Label>
              <div className='col-span-3'>
                <Textarea
                  id='description-dialog'
                  {...register('description')}
                  rows={3}
                  maxLength={200}
                  disabled={isSubmitting}
                />
                {errors.description && (
                  <p className='text-sm text-destructive mt-1'>
                    {errors.description.message}
                  </p>
                )}
              </div>
            </div>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='category-dialog' className='text-right'>
                Categoria*
              </Label>
              <div className='col-span-3'>
                <Controller
                  name='category'
                  control={control}
                  rules={{ required: 'Categoria é obrigatória.' }}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      defaultValue=''
                      disabled={isSubmitting}
                    >
                      <SelectTrigger
                        id='category-dialog'
                        className={errors.category ? 'border-destructive' : ''}
                      >
                        <SelectValue placeholder='Selecione uma categoria' />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.category && (
                  <p className='text-sm text-destructive mt-1'>
                    {errors.category.message}
                  </p>
                )}
              </div>
            </div>

            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='totalQuantity-dialog' className='text-right'>
                Qtd. Total
              </Label>
              <div className='col-span-3'>
                <Input
                  id='totalQuantity-dialog'
                  type='number'
                  placeholder='Deixe vazio para item único'
                  {...register('totalQuantity')}
                  className={errors.totalQuantity ? 'border-destructive' : ''}
                  min='1'
                  disabled={isSubmitting || watchedStatus === 'selected'}
                />
                {errors.totalQuantity && (
                  <p className='text-sm text-destructive mt-1'>
                    {errors.totalQuantity.message}
                  </p>
                )}
                {watchedStatus === 'selected' && (
                  <p className='text-xs text-muted-foreground mt-1'>
                    Status 'Selecionado' não pode ter quantidade.
                  </p>
                )}
              </div>
            </div>

            <div className='grid grid-cols-4 items-start gap-4'>
              <Label htmlFor='imageFile-dialog' className='text-right pt-2'>
                Imagem
              </Label>
              <div className='col-span-3'>
                <div className='flex items-center gap-4'>
                  {imagePreview && (
                    <div className='relative w-16 h-16 border rounded-md overflow-hidden shadow-inner bg-muted/50 flex-shrink-0'>
                      <Image
                        key={imagePreview}
                        src={imagePreview}
                        alt='Prévia da imagem'
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes='64px'
                        unoptimized={imagePreview.startsWith('data:')}
                        onError={() => setImagePreview(null)}
                      />
                      <Button
                        type='button'
                        variant='destructive'
                        size='icon'
                        className='absolute top-0.5 right-0.5 h-5 w-5 z-10 rounded-full opacity-70 hover:opacity-100'
                        onClick={removeImage}
                        title='Remover Imagem'
                        disabled={isSubmitting}
                      >
                        <XCircle className='h-3 w-3' />
                      </Button>
                    </div>
                  )}
                  <div className='flex-1'>
                    <Input
                      id='imageFile-dialog'
                      type='file'
                      accept={ACCEPTED_MEDIA_TYPES.join(',')}
                      {...register('imageFile')}
                      className={`${
                        errors.imageFile ? 'border-destructive' : ''
                      } file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer`}
                      disabled={isSubmitting}
                    />
                    <p className='text-xs text-muted-foreground mt-1'>
                      JPG, PNG, GIF, WebP (Máx 50MB).
                    </p>
                     <p className='text-xs text-muted-foreground mt-1'>
                      Vídeos (MP4, MOV) também são aceitos.
                    </p>
                    {errors.imageFile &&
                      typeof errors.imageFile.message === 'string' && (
                        <p className='text-sm text-destructive mt-1'>
                          {errors.imageFile.message}
                        </p>
                      )}
                    {errors.imageUrl && (
                      <p className='text-sm text-destructive mt-1'>
                        {errors.imageUrl.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='status-dialog' className='text-right'>
                Status*
              </Label>
              <div className='col-span-3'>
                <Controller
                  name='status'
                  control={control}
                  defaultValue={editingItem?.status || 'available'}
                  rules={{ required: 'Status é obrigatório.' }}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || 'available'}
                      disabled={
                        isSubmitting ||
                        (!!watchedTotalQuantity && watchedTotalQuantity > 0)
                      }
                    >
                      <SelectTrigger
                        id='status-dialog'
                        className={errors.status ? 'border-destructive' : ''}
                      >
                        <SelectValue placeholder='Selecione um status' />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((stat) => (
                          <SelectItem
                            key={stat}
                            value={stat}
                            disabled={
                              stat === 'selected' &&
                              !!watchedTotalQuantity &&
                              watchedTotalQuantity > 0
                            }
                          >
                            {stat === 'available' && 'Sugestão Disponível'}
                            {stat === 'selected' && 'Já Escolhido'}
                            {stat === 'not_needed' && 'Preferimos Não Utilizar'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.status && (
                  <p
                    id='status-error'
                    className='text-sm text-destructive mt-1'
                  >
                    {errors.status.message}
                  </p>
                )}
                {!!watchedTotalQuantity && watchedTotalQuantity > 0 && (
                  <p className='text-xs text-muted-foreground mt-1'>
                    Status é definido automaticamente para itens com quantidade.
                  </p>
                )}
              </div>
            </div>

            {watchedStatus === 'selected' &&
              (!watchedTotalQuantity || watchedTotalQuantity <= 0) && (
                <div className='grid grid-cols-4 items-center gap-4 animate-fade-in'>
                  <Label htmlFor='selectedBy-dialog' className='text-right'>
                    Selecionado Por*
                  </Label>
                  <div className='col-span-3'>
                    <Input
                      id='selectedBy-dialog'
                      {...register('selectedBy')}
                      className={errors.selectedBy ? 'border-destructive' : ''}
                      placeholder='Nome de quem selecionou'
                      maxLength={50}
                      disabled={isSubmitting}
                    />
                    {errors.selectedBy ? (
                      <p className='text-sm text-destructive mt-1'>
                        {errors.selectedBy.message}
                      </p>
                    ) : (
                      watchedStatus === 'selected' &&
                      !watch('selectedBy') && (
                        <p className='text-sm text-destructive mt-1'>
                          Nome obrigatório.
                        </p>
                      )
                    )}
                  </div>
                </div>
              )}

            <DialogFooter className='mt-4'>
              <DialogClose asChild>
                <Button type='button' variant='outline' disabled={isSubmitting}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />{' '}
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className='mr-2 h-4 w-4' /> Salvar Item
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
