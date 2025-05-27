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
  Star, // Icon for Priority
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
  priority: z.preprocess(
    // Convert string from select to number, default to 0 (Low) if empty or invalid
    (val) => {
      const numVal = Number(val);
      return isNaN(numVal) ? 0 : numVal;
    },
    z.number().int().min(0).max(2).default(0) // 0: Low, 1: Medium, 2: High
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
      priority: 0, // Default priority
    },
  });

  const watchedStatus = watch('status');
  const watchedImageFile = watch('imageFile');
  const watchedTotalQuantity = watch('totalQuantity');

  useEffect(() => {
    if (!isClient) return;

    let fileList: FileList | null = null;
    // Check if FileList is defined (client-side) before using instanceof
    if (
      typeof FileList !== 'undefined' &&
      watchedImageFile instanceof FileList
    ) {
      fileList = watchedImageFile;
    } else if (watchedImageFile === null || watchedImageFile === undefined) {
      // Handle case where input is cleared or initially empty
      const initialUrl = editingItem?.imageUrl || null;
      const currentRHFUrl = getValues('imageUrl');
      // If a data URI was staged, revert to initial on clear
      if (currentRHFUrl && currentRHFUrl.startsWith('data:')) {
        setValue('imageUrl', initialUrl);
        setImagePreview(initialUrl);
      } else if (!currentRHFUrl && !initialUrl) { // Both are null/empty
        setImagePreview(null);
        setValue('imageUrl', null);
      }
      return; // Exit if not a FileList or if cleared
    } else {
      // If it's not a FileList and not null/undefined, it's an unexpected type
      console.warn("AdminItemManagementTable: Unexpected imageFile type. Clearing input.", watchedImageFile);
      const initialUrl = editingItem?.imageUrl || null;
      setValue('imageFile', null); // Clear the RHF field
      setValue('imageUrl', initialUrl); // Revert URL
      setImagePreview(initialUrl); // Revert preview
      return;
    }


    const file = fileList?.[0];

    if (file) {
      // Double-check if 'file' is actually a File object (it should be if fileList is FileList)
      if (typeof File !== 'undefined' && !(file instanceof File)) {
        console.warn("AdminItemManagementTable Dialog: Watched imageFile is not a File object (after FileList check):", file);
        setValue('imageFile', null); // Clear if not a File
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
    getValues, // Added getValues
  ]);

  const handleOpenAddDialog = () => {
    console.log('AdminItemManagementTable: handleOpenAddDialog called');
    reset({
      name: '',
      description: '',
      category: '',
      status: 'available',
      selectedBy: '',
      imageUrl: null,
      imageFile: null,
      totalQuantity: null,
      priority: 0, // Default priority for new items
    });
    setEditingItem(null);
    setImagePreview(null);
    setIsAddEditDialogOpen(true);
  };

  const handleOpenEditDialog = (item: GiftItem) => {
    console.log('AdminItemManagementTable: handleOpenEditDialog called for item:', item.id);
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
      priority: item.priority ?? 0, // Set existing priority or default
    });
    setImagePreview(item.imageUrl || null);
    setIsAddEditDialogOpen(true);
  };

  const handleDialogClose = () => {
    console.log('AdminItemManagementTable: handleDialogClose called');
    setIsAddEditDialogOpen(false);
    setEditingItem(null);
    setImagePreview(null);
    reset();
  };

  const removeImage = useCallback(() => {
    setValue('imageFile', null);
    setValue('imageUrl', null);
    setImagePreview(null);
    // Manually clear the file input element if it exists
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
    // Check for specific Firebase error messages if errorDetails is an Error object
    if (errorDetails instanceof Error) {
      if (errorDetails.message.includes('invalid data')) {
        description = `Dados inválidos fornecidos para ${operation.toLowerCase()} "${itemName}". Verifique os campos.`;
      } else if (errorDetails.message.includes('PERMISSION_DENIED')) {
        description = `Permissão negada para ${operation.toLowerCase()} "${itemName}". Verifique as regras do Firestore.`;
      }
    } else if (errorDetails?.code === 'permission-denied') { // Check for Firebase error code
        description = `Permissão negada para ${operation.toLowerCase()} "${itemName}". Verifique as regras do Firestore.`;
    }
    toast({ title: 'Erro!', description: description, variant: 'destructive' });
  };

  const onSubmit = async (data: GiftFormData) => {
    console.log('AdminItemManagementTable: onSubmit called with data:', data);
    const operation = editingItem ? 'atualizar' : 'adicionar';
    const itemName =
      data.name || (editingItem ? editingItem.name : 'Novo Item');

    const isQuantityItem =
      typeof data.totalQuantity === 'number' && data.totalQuantity > 0;

    // Validate 'selectedBy' for non-quantity items marked as 'selected'
    if (
      !isQuantityItem &&
      data.status === 'selected' &&
      (!data.selectedBy || data.selectedBy.trim() === '')
    ) {
      toast({
        title: 'Erro de Validação',
        description: 'Informe quem selecionou o item.',
        variant: 'destructive',
      });
      return;
    }

    // For quantity items, admin cannot manually set status to 'selected' directly.
    // It's derived based on selectedQuantity vs totalQuantity. Force 'available' if 'selected'.
    if (isQuantityItem && data.status === 'selected') {
      console.warn(
        "AdminItemManagementTable: Status 'selected' for quantity items is derived. Forcing 'available' for admin edit."
      );
      data.status = 'available';
    }

    const imageValue = data.imageUrl; // This holds existing URL, new data URI, or null

    // Construct the payload for Firestore
    const finalPayload: Partial<GiftItem> & {
      imageDataUri?: string | null; // For new image uploads
    } = {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      category: data.category,
      status: data.status,
      selectedBy: isQuantityItem
        ? null // For quantity items, selectedBy is usually managed per selection, not set globally here
        : data.status === 'selected' // For single items
          ? data.selectedBy?.trim() || 'Admin' // Default if empty
          : null,
      totalQuantity: isQuantityItem ? data.totalQuantity : null,
      priority: data.priority, // Include priority
      // Pass image data appropriately:
      // For new items, 'imageDataUri' will contain the data URI (or null).
      // For existing items, 'imageUrl' will contain the new data URI, existing URL, or null for removal.
      ...(editingItem
        ? { imageUrl: imageValue } // On update, imageUrl field itself is used by updateGift
        : { imageDataUri: imageValue }), // On add, use imageDataUri field for addGiftAdmin
    };

     // Initialize selectedQuantity to 0 for new items
    if (!editingItem) {
        finalPayload.selectedQuantity = 0;
    }


    try {
      if (editingItem) {
        await updateGift(editingItem.id, finalPayload);
        handleSuccess(`Item "${finalPayload.name}" atualizado.`);
      } else {
        // Ensure `addGiftAdmin` expects Omit<GiftItem, "id" | "createdAt" | "selectionDate">
        // and handles the imageDataUri.
        await addGiftAdmin(finalPayload as Omit<GiftItem, "id" | "createdAt" | "selectionDate"> & { imageDataUri?: string | null });
        handleSuccess(`Item "${finalPayload.name}" adicionado.`);
      }
    } catch (error) {
      handleError(operation, itemName, error);
    }
  };

  const handleDelete = async (item: GiftItem) => {
    console.log('AdminItemManagementTable: handleDelete called for item:', item.id);
    if (actionLoading) return; // Prevent multiple actions
    if (confirm(`Excluir "${item.name}"? Ação irreversível.`)) {
      setActionLoading(`delete-${item.id}`);
      try {
        const success = await deleteGift(item.id); // deleteGift handles image deletion
        if (success) {
          handleSuccess(`Item "${item.name}" excluído.`);
        } else {
          // This else block might not be reached if deleteGift throws on failure
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
    console.log('AdminItemManagementTable: handleRevert called for item:', item.id);
    if (actionLoading) return;
    if (item.status !== 'selected' && item.status !== 'not_needed') return; // Can only revert these

    // For now, disable revert for quantity items in admin as it's complex
    if (item.totalQuantity != null && item.totalQuantity > 0) {
      toast({
        title: 'Ação Indisponível',
        description:
          'Reversão de itens com quantidade não é suportada nesta interface.',
        variant: 'default',
      });
      return;
    }

    const actionText =
      item.status === 'selected' ? 'reverter seleção' : 'remover "Preferimos Não Utilizar"';
    const guestNameInfo = item.selectedBy ? ` por ${item.selectedBy}` : '';
    if (
      confirm(
        `Tem certeza que deseja ${actionText} de "${item.name}"${guestNameInfo}?`
      )
    ) {
      setActionLoading(`revert-${item.id}`);
      try {
        await revertSelection(item.id); // revertSelection handles Firestore update
        handleSuccess(`Item "${item.name}" revertido para disponível.`);
      } catch (error) {
        handleError('reverter', item.name, error);
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleMarkNotNeeded = async (item: GiftItem) => {
    console.log('AdminItemManagementTable: handleMarkNotNeeded called for item:', item.id);
    if (actionLoading) return;
    if (item.status === 'not_needed') return; // Already in this state
    if (confirm(`Marcar "${item.name}" como "Preferimos Não Utilizar"?`)) {
      setActionLoading(`mark-${item.id}`);
      try {
        await markGiftAsNotNeeded(item.id); // markGiftAsNotNeeded handles Firestore update
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

  const getStatusBadge = (item: GiftItem) => {
    // Determine effective status based on quantity, if applicable
    let statusToDisplay = item.status;
    if (item.totalQuantity && item.totalQuantity > 0 && item.selectedQuantity && item.selectedQuantity >= item.totalQuantity) {
        statusToDisplay = 'selected'; // Show as selected if fully selected
    }

    switch (statusToDisplay) {
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

  const getPriorityText = (priorityValue?: number | null) => {
    const foundPriority = priorities.find(p => p.value === priorityValue);
    return foundPriority ? foundPriority.label : 'Baixa';
  };


  const formatDateTime = (isoString: string | null | undefined): string => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return isNaN(date.getTime())
        ? '-'
        : date.toLocaleString('pt-BR', { // More complete date format
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
          aria-label="Adicionar Novo Item"
        >
          <PlusCircle className='mr-2 h-4 w-4' /> Adicionar Novo Item
        </Button>
      </div>
      <div className='rounded-md border overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-[60px] shrink-0'></TableHead> {/* Image col */}
              <TableHead>Nome</TableHead>
              <TableHead className='hidden lg:table-cell'>Descrição</TableHead>
              <TableHead className='hidden md:table-cell'>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead className='hidden xl:table-cell'>
                Selecionado Por
              </TableHead>
              <TableHead className='text-right min-w-[150px]'>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeGifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className='h-24 text-center'>
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
                  item.totalQuantity != null && // Ensure totalQuantity is not null
                  item.selectedQuantity >= item.totalQuantity
                    ? 'selected'
                    : item.status;
                const canRevert =
                  !isQuantityItem && // Only non-quantity items for now
                  (displayedStatus === 'selected' ||
                    displayedStatus === 'not_needed');

                return (
                  <TableRow
                    key={item.id}
                    className={
                      actionLoading?.endsWith(item.id) // Check if current item action is loading
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
                            sizes='40px' // Small fixed size for table view
                            unoptimized={item.imageUrl.startsWith('data:')} // No optimization for data URIs
                            onError={(e) => {
                              // More robust error handling for image display
                              (e.target as HTMLImageElement).style.display = 'none'; // Hide broken image
                              const parent = (e.target as HTMLImageElement).parentElement;
                              if (parent && !parent.querySelector('.placeholder-icon')) {
                                const placeholder = document.createElement('div');
                                placeholder.className = 'placeholder-icon flex items-center justify-center h-full w-full';
                                // Using a simpler, smaller SVG for table placeholder
                                placeholder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-off text-muted-foreground/50"><path d="M10.4 10.4A3 3 0 0 0 12 12a3 3 0 0 0 1.6-4.4Z"/><path d="m21 1-9.2 9.2"/><path d="M13.5 5.5C15 4.5 16.5 4 18 4c2.8 0 5 2.2 5 5c0 1.5-.5 3-1.5 4.5L19 16"/><path d="M3 3v18h18"/><path d="M12 12.7a4.8 4.8 0 0 0-5.1-4.9A5 5 0 0 0 2 12.5V13a5 5 0 0 0 5 5h1.5"/></svg>`;
                                parent.appendChild(placeholder);
                              }
                            }}
                          />
                        ) : (
                          <div className='flex items-center justify-center h-full w-full placeholder-icon'>
                            <ImageIcon className='h-5 w-5 text-muted-foreground/50' />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='font-medium'> {/* Removed whitespace-nowrap for better wrapping */}
                      {item.name}
                    </TableCell>
                    <TableCell className='hidden lg:table-cell text-muted-foreground text-sm max-w-xs truncate'>
                      {item.description || '-'}
                    </TableCell>
                    <TableCell className='hidden md:table-cell'>
                      {item.category}
                    </TableCell>
                    <TableCell>{getStatusBadge(item)}</TableCell>
                    <TableCell className='text-sm text-muted-foreground'>{getPriorityText(item.priority)}</TableCell>
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
                      {/* Display selectedBy if not a quantity item OR if a quantity item is fully selected */}
                      {(!isQuantityItem || displayedStatus === 'selected') &&
                      item.selectedBy ? (
                        <>
                          {item.selectedBy}
                          {item.selectionDate && ( // Ensure selectionDate is valid before formatting
                            <div className='text-[10px]'>
                              ({formatDateTime(item.selectionDate as string)}) {/* Cast as string, assuming giftFromDoc standardizes */}
                            </div>
                          )}
                        </>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className='text-right space-x-1 whitespace-nowrap'>
                      {/* Show loader if actionLoading matches current item's action */}
                      {actionLoading === `edit-${item.id}` || actionLoading === `delete-${item.id}` || actionLoading === `revert-${item.id}` || actionLoading === `mark-${item.id}` ? (
                        <Loader2 className='h-4 w-4 animate-spin inline-block text-muted-foreground' />
                      ) : (
                        <>
                          <Button
                            variant='ghost'
                            size='icon'
                            onClick={() => handleOpenEditDialog(item)}
                            title='Editar Item'
                            disabled={!!actionLoading} // Disable all actions if any action is loading
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
                          {/* Show "Mark as Not Needed" if item is available or selected (and not fully selected quantity item) */}
                          {(displayedStatus === 'available' ||
                            (displayedStatus === 'selected' && !isQuantityItem) || // For single selected items
                            (displayedStatus === 'selected' && isQuantityItem && (item.selectedQuantity ?? 0) < (item.totalQuantity ?? 0)) // For partially selected quantity items
                          ) && (
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
        <DialogContent className='sm:max-w-md md:max-w-lg'> {/* Adjusted max-width */}
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Item' : 'Adicionar Novo Item'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Modifique os detalhes.' : 'Preencha os detalhes.'}
            </DialogDescription>
          </DialogHeader>
          {/* Adjusted form grid for better responsiveness */}
          <form onSubmit={handleSubmit(onSubmit)} className='grid gap-y-3 sm:gap-y-4 py-4'>
            {/* Name */}
            <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-baseline'>
              <Label htmlFor='name-dialog' className='sm:text-right text-left sm:pt-1 font-medium'>
                Nome*
              </Label>
              <div className='sm:col-span-3'>
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
            {/* Description */}
            <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-baseline'>
              <Label htmlFor='description-dialog' className='sm:text-right text-left sm:pt-1 font-medium'>
                Descrição
              </Label>
              <div className='sm:col-span-3'>
                <Textarea
                  id='description-dialog'
                  {...register('description')}
                  rows={3}
                  maxLength={200}
                  disabled={isSubmitting}
                  className={errors.description ? 'border-destructive' : ''}
                />
                {errors.description && (
                  <p className='text-sm text-destructive mt-1'>
                    {errors.description.message}
                  </p>
                )}
              </div>
            </div>
            {/* Category */}
            <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-baseline'>
              <Label htmlFor='category-dialog' className='sm:text-right text-left sm:pt-1 font-medium'>
                Categoria*
              </Label>
              <div className='sm:col-span-3'>
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

            {/* Priority */}
            <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-baseline'>
              <Label htmlFor='priority-dialog' className='sm:text-right text-left sm:pt-1 font-medium'>
                Prioridade
              </Label>
              <div className='sm:col-span-3'>
                <Controller
                  name='priority'
                  control={control}
                  defaultValue={0}
                  render={({ field }) => (
                    <Select
                      // Ensure value passed to Select is string, and onChange converts back to number
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={String(field.value ?? 0)} // Convert number to string for Select
                      disabled={isSubmitting}
                    >
                      <SelectTrigger
                        id='priority-dialog'
                        className={errors.priority ? 'border-destructive' : ''}
                      >
                        <SelectValue placeholder='Selecione a prioridade' />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((p) => (
                          <SelectItem key={p.value} value={String(p.value)}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.priority && (
                  <p className='text-sm text-destructive mt-1'>
                    {errors.priority.message}
                  </p>
                )}
              </div>
            </div>


            {/* Total Quantity */}
            <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-baseline'>
              <Label htmlFor='totalQuantity-dialog' className='sm:text-right text-left sm:pt-1 font-medium'>
                Qtd. Total
              </Label>
              <div className='sm:col-span-3'>
                <Input
                  id='totalQuantity-dialog'
                  type='number'
                  placeholder='Deixe vazio para item único'
                  {...register('totalQuantity')}
                  className={errors.totalQuantity ? 'border-destructive' : ''}
                  min='1'
                  disabled={isSubmitting || watchedStatus === 'selected'} // Disable if status is selected (as it implies single item)
                />
                {errors.totalQuantity && (
                  <p className='text-sm text-destructive mt-1'>
                    {errors.totalQuantity.message}
                  </p>
                )}
                {/* Clarify when status will be auto-adjusted */}
                {watchedStatus === 'selected' && !!watchedTotalQuantity && watchedTotalQuantity > 0 && (
                  <p className='text-xs text-muted-foreground mt-1'>
                    Status 'Já Escolhido' para itens com quantidade é automático. Será 'Disponível'.
                  </p>
                )}
              </div>
            </div>

            {/* Image Upload */}
            <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-start'> {/* items-start for multi-line content */}
              <Label htmlFor='imageFile-dialog' className='sm:text-right text-left sm:pt-2 font-medium'>
                Imagem
              </Label>
              <div className='sm:col-span-3'>
                <div className='flex flex-col sm:flex-row items-start sm:items-center gap-4'> {/* Stack on mobile */}
                  {imagePreview && (
                    <div className='relative w-16 h-16 border rounded-md overflow-hidden shadow-inner bg-muted/50 flex-shrink-0'>
                      <Image
                        key={imagePreview} // Force re-render on change
                        src={imagePreview}
                        alt='Prévia da imagem'
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes='64px'
                        unoptimized={imagePreview.startsWith('data:')} // Disable optimization for data URIs
                        onError={(e) => {
                            console.error("Error loading image preview in dialog:", e);
                            setImagePreview(null); // Clear preview
                            // Optionally, revert RHF values if desired
                            setValue('imageFile', null);
                            setValue('imageUrl', editingItem?.imageUrl || null);
                        }}
                      />
                      <Button
                        type='button'
                        variant='destructive'
                        size='icon'
                        className='absolute top-0.5 right-0.5 h-5 w-5 z-10 rounded-full opacity-70 hover:opacity-100'
                        onClick={removeImage}
                        title='Remover Imagem'
                        disabled={isSubmitting}
                        aria-label="Remover Imagem"
                      >
                        <XCircle className='h-3 w-3' />
                      </Button>
                    </div>
                  )}
                  <div className='flex-1 w-full'> {/* Ensure input takes full width */}
                    <Input
                      id='imageFile-dialog'
                      type='file'
                      accept={ACCEPTED_MEDIA_TYPES.join(',')}
                      {...register('imageFile')}
                      className={`${
                        errors.imageFile ? 'border-destructive' : ''
                      } file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer w-full`}
                      disabled={isSubmitting}
                    />
                    <p className='text-xs text-muted-foreground mt-1'>
                      JPG, PNG, GIF, WebP, MP4, MOV (Máx 50MB).
                    </p>
                    {/* Show RHF errors for imageFile if they exist and are strings */}
                    {errors.imageFile &&
                      typeof errors.imageFile.message === 'string' && (
                        <p className='text-sm text-destructive mt-1'>
                          {errors.imageFile.message}
                        </p>
                      )}
                    {/* Show RHF errors for imageUrl (less likely now, but for completeness) */}
                    {errors.imageUrl && (
                      <p className='text-sm text-destructive mt-1'>
                        {errors.imageUrl.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-baseline'>
              <Label htmlFor='status-dialog' className='sm:text-right text-left sm:pt-1 font-medium'>
                Status*
              </Label>
              <div className='sm:col-span-3'>
                <Controller
                  name='status'
                  control={control}
                  defaultValue={editingItem?.status || 'available'} // Default to available
                  rules={{ required: 'Status é obrigatório.' }}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || 'available'} // Ensure a default value for Select
                      disabled={
                        isSubmitting ||
                        (!!watchedTotalQuantity && watchedTotalQuantity > 0) // Disable if quantity item
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
                            // Disable 'selected' status if it's a quantity item
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
                    id='status-error' // Add id for aria-describedby if needed
                    className='text-sm text-destructive mt-1'
                  >
                    {errors.status.message}
                  </p>
                )}
                {/* Message if status is disabled due to quantity */}
                {!!watchedTotalQuantity && watchedTotalQuantity > 0 && (
                  <p className='text-xs text-muted-foreground mt-1'>
                    Status é definido automaticamente para itens com quantidade.
                  </p>
                )}
              </div>
            </div>

            {/* Selected By (Conditional) */}
            {watchedStatus === 'selected' &&
              (!watchedTotalQuantity || watchedTotalQuantity <= 0) && ( // Only for single items
                <div className='grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 sm:gap-y-2 sm:items-baseline animate-fade-in'>
                  <Label htmlFor='selectedBy-dialog' className='sm:text-right text-left sm:pt-1 font-medium'>
                    Selecionado Por*
                  </Label>
                  <div className='sm:col-span-3'>
                    <Input
                      id='selectedBy-dialog'
                      {...register('selectedBy')}
                      className={errors.selectedBy ? 'border-destructive' : ''}
                      placeholder='Nome de quem selecionou'
                      maxLength={50}
                      disabled={isSubmitting}
                    />
                    {/* Show specific RHF error or a generic one if field is empty */}
                    {errors.selectedBy ? (
                      <p className='text-sm text-destructive mt-1'>
                        {errors.selectedBy.message}
                      </p>
                    ) : (
                      // This custom check is for when zod validation passes (optional field) but UI requires it conditionally
                      watchedStatus === 'selected' &&
                      !watch('selectedBy') && (
                        <p className='text-sm text-destructive mt-1'>
                          Nome obrigatório para itens selecionados.
                        </p>
                      )
                    )}
                  </div>
                </div>
              )}

            <DialogFooter className='mt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0'>
              <DialogClose asChild>
                <Button type='button' variant='outline' disabled={isSubmitting} className='w-full sm:w-auto'>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type='submit' disabled={isSubmitting} className='w-full sm:w-auto'>
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
