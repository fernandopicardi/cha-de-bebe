/**
 * Renders a list of gift items, filterable by status and category.
 * Handles user interactions for selecting items and displaying details.
 * Features:
 * - Displays gift items in a responsive grid.
 * - Filters items based on 'filterStatus' (available, selected, not_needed) and 'filterCategory'.
 * - Allows users to select an item, opening a dialog for confirmation.
 * - Shows loading states and empty list messages.
 * - Uses ShadCN UI components for styling.
 * - Integrates with `gift-store.ts` for item selection logic.
 */
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image'; // Import next/image
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription, // Import CardDescription
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Gift,
  Check, // Icon for "Sugestões Disponíveis" badge
  X, // Icon for "Preferimos Não Utilizar" badge
  Hourglass,
  User, // Icon for "Presentes Já Escolhidos" badge
  Tag,
  Loader2,
  ImageIcon, // Placeholder icon
  Package, // Icon for quantity
  Star, // Icon for priority
} from 'lucide-react';
import SelectItemDialog from './select-item-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { selectGift, type GiftItem } from '@/data/gift-store'; // Ensure correct import
import { useToast } from '@/hooks/use-toast';

interface GiftListProps {
  items: GiftItem[] | null;
  filterStatus?: 'available' | 'selected' | 'not_needed';
  filterCategory?: string;
  onItemAction?: () => void;
}

export default function GiftList({
  items,
  filterStatus = 'available',
  filterCategory,
  onItemAction,
}: GiftListProps) {
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<GiftItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log(
      `GiftList (${filterStatus}): Received items prop update. Count: ${
        items?.length ?? 0
      }`
    );
  }, [items, filterStatus]);

  const getEffectiveStatus = (item: GiftItem): GiftItem['status'] => {
    if (!item) return 'available'; // Default for safety, though item should always be defined here

    const isQuantityItem =
      item.totalQuantity !== null && item.totalQuantity > 0;

    if (item.status === 'not_needed') {
      return 'not_needed';
    }
    if (isQuantityItem) {
      return (item.selectedQuantity ?? 0) >= item.totalQuantity
        ? 'selected'
        : 'available';
    }
    return item.status;
  };

  const filteredItems = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];
    console.log(
      `GiftList (${filterStatus}): Filtering ${safeItems.length} items based on prop...`
    );

    const initiallyFiltered = safeItems.filter((item) => {
      if (!item || typeof item.status === 'undefined' || !item.id) {
        console.warn(
          `GiftList (${filterStatus}): Skipping invalid item during filtering:`,
          item
        );
        return false;
      }
      const effectiveStatus = getEffectiveStatus(item);

      const statusMatch = effectiveStatus === filterStatus;
      const categoryMatch =
        !filterCategory ||
        item.category?.toLowerCase() === filterCategory.toLowerCase();
      return statusMatch && categoryMatch;
    });

    // Sort items:
    // 1. By priority (descending: High (2) > Medium (1) > Low (0)/null)
    // 2. Then by name (ascending)
    initiallyFiltered.sort((a, b) => {
      const priorityA = a.priority ?? -1; // Treat null/undefined priority as lowest
      const priorityB = b.priority ?? -1;

      if (priorityB !== priorityA) {
        return priorityB - priorityA; // Higher priority number comes first
      }
      return a.name.localeCompare(b.name); // Secondary sort by name
    });


    console.log(
      `GiftList (${filterStatus}): Final filtered/sorted count: ${initiallyFiltered.length} items.`
    );
    return initiallyFiltered;
  }, [items, filterStatus, filterCategory]);

  const handleSelectItemClick = (item: GiftItem) => {
    if (loadingItemId) return;
    const effectiveStatus = getEffectiveStatus(item);

    if (effectiveStatus === 'available') {
      setSelectedItem(item);
      setIsDialogOpen(true);
    } else {
      console.warn(`GiftList: Attempted to select unavailable item ${item.id}`);
      toast({
        title: 'Item Indisponível',
        description: 'Este item não está mais disponível para seleção.',
        variant: 'destructive',
      });
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedItem(null);
  };

  const handleItemSelectionSuccess = async (
    itemId: string,
    guestName: string,
    quantity: number
  ) => {
    console.log(
      `GiftList (${filterStatus}): Attempting to select item ${itemId} for ${guestName}, Qty: ${quantity}...`
    );
    setLoadingItemId(itemId);
    try {
      const updatedItem = await selectGift(itemId, guestName, quantity);

      if (updatedItem) {
        console.log(
          `GiftList (${filterStatus}): Item ${itemId} selected successfully. Triggering onItemAction.`
        );
        toast({
          title: 'Sucesso!',
          description: `Obrigado, ${guestName}! ${
            quantity > 1 ? `${quantity} unidades de` : ''
          } "${updatedItem.name}" ${
            quantity > 1 ? 'foram reservadas' : 'foi reservado'
          }!`,
          variant: 'default',
          className: 'bg-success text-success-foreground border-success',
        });
        onItemAction?.();
      } else {
        console.warn(
          `GiftList (${filterStatus}): Failed to select item ${itemId} (likely unavailable). Triggering refresh.`
        );
        toast({
          title: 'Ops!',
          description:
            'Item não disponível ou quantidade insuficiente. Atualizando lista.',
          variant: 'destructive',
        });
        onItemAction?.();
      }
    } catch (error: any) {
      console.error(
        `GiftList (${filterStatus}): Error during selectGift call for item ${itemId}:`,
        error
      );
      toast({
        title: 'Erro!',
        description: error.message || 'Não foi possível selecionar.',
        variant: 'destructive',
      });
    } finally {
      setLoadingItemId(null);
      handleDialogClose();
      console.log(
        `GiftList (${filterStatus}): Selection process finished for item ${itemId}.`
      );
    }
  };

  const getStatusBadge = (item: GiftItem) => {
    const isQuantityItem =
      item.totalQuantity !== null && item.totalQuantity > 0;
    const displayStatus = getEffectiveStatus(item);
    let quantityText = '';

    if (isQuantityItem && displayStatus !== 'not_needed') {
      const selected = item.selectedQuantity ?? 0;
      const total = item.totalQuantity ?? 0;
      quantityText = `(${selected}/${total})`;
    }

    switch (displayStatus) {
      case 'available':
        return (
          <Badge
            variant='default'
            className='bg-success text-success-foreground'
          >
            <Check className='mr-1 h-3 w-3' /> Sugestão Disponível{' '}
            {quantityText}
          </Badge>
        );
      case 'selected':
        return (
          <Badge
            variant='secondary'
            className='bg-secondary text-secondary-foreground'
          >
            <User className='mr-1 h-3 w-3' /> Já Escolhido {quantityText}
          </Badge>
        );
      case 'not_needed':
        return (
          <Badge
            variant='destructive'
            className='bg-destructive/80 text-destructive-foreground'
          >
            <X className='mr-1 h-3 w-3' /> Preferimos Não Utilizar
          </Badge>
        );
      default:
        return (
          <Badge variant='outline'>
            <Hourglass className='mr-1 h-3 w-3' /> Indefinido
          </Badge>
        );
    }
  };

  const getPriorityIndicator = (priority?: number | null) => {
    if (priority === 2) { // High
      return <Star className="h-5 w-5 text-destructive fill-destructive" aria-label="Prioridade alta" />;
    }
    if (priority === 1) { // Medium
      return <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" aria-label="Prioridade média" />;
    }
    // Low (0) or null/undefined will not show an icon for a cleaner look unless specified otherwise.
    return null;
  };


  const isInitialLoad = items === null;
  const hasLoadedItems = Array.isArray(items);
  const hasNoItemsInDatabase = hasLoadedItems && items.length === 0;
  const isFilteredListEmpty =
    hasLoadedItems && filteredItems.length === 0 && !hasNoItemsInDatabase;

  console.log(
    `GiftList (${filterStatus}): Rendering check - isInitialLoad: ${isInitialLoad}, hasLoadedItems: ${hasLoadedItems}, hasNoItemsInDatabase: ${hasNoItemsInDatabase}, isFilteredListEmpty: ${isFilteredListEmpty}`
  );

  if (isInitialLoad) {
    console.log(`GiftList (${filterStatus}): Rendering loader.`);
    return (
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
        {[...Array(8)].map(
          (
            _,
            index
          ) => (
            <Card
              key={index}
              className='flex flex-col justify-between shadow-md rounded-lg overflow-hidden bg-card'
            >
              <CardHeader className='p-4'>
                <Skeleton className='h-40 w-full mb-4 rounded-md' />
                <Skeleton className='h-6 w-3/4 mb-2' />
                <Skeleton className='h-4 w-1/2 mb-2' />
                <Skeleton className='h-4 w-1/4' />
              </CardHeader>
              <CardFooter className='flex items-center justify-between gap-2 p-4 border-t'>
                <Skeleton className='h-5 w-24' />
                <Skeleton className='h-9 w-28' />
              </CardFooter>
            </Card>
          )
        )}
      </div>
    );
  }

  if (hasNoItemsInDatabase) {
    console.log(
      `GiftList (${filterStatus}): Rendering empty state (database has no items).`
    );
    let message = "A lista de presentes ainda está vazia.";
    if (filterStatus === 'available') message = "Nenhuma sugestão de presente adicionada ainda.";
    else if (filterStatus === 'selected') message = "Nenhum presente foi escolhido ainda.";
    else if (filterStatus === 'not_needed') message = "Nenhum item foi marcado como 'Preferimos Não Utilizar'.";
    
    return (
      <div className='text-center py-16 text-muted-foreground'>
        <Gift className='mx-auto h-12 w-12 mb-4' />
        <p>{message}</p>
        {filterStatus === 'available' && (
             <p className='text-sm mt-2'>
              Use o botão "Adicionar um Item" acima para sugerir algo!
           </p>
        )}
      </div>
    );
  }

  if (isFilteredListEmpty) {
    let emptyMessage = 'Nenhum item encontrado para esta seleção.';
    if (filterStatus === 'available')
      emptyMessage = 'Nenhuma sugestão disponível no momento.';
    if (filterStatus === 'selected')
      emptyMessage = 'Nenhum presente foi escolhido ainda.';
    if (filterStatus === 'not_needed')
      emptyMessage = "Nenhum item marcado como 'Preferimos Não Utilizar'.";
    console.log(
      `GiftList (${filterStatus}): Rendering specific empty message: ${emptyMessage}`
    );
    return (
      <div className='text-center py-16 text-muted-foreground'>
        <Gift className='mx-auto h-12 w-12 mb-4' />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  console.log(
    `GiftList (${filterStatus}): Rendering ${filteredItems.length} items.`
  );
  return (
    <>
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
        {filteredItems.map((item) => {
          const effectiveStatus = getEffectiveStatus(item);
          const isAvailableForSelection = effectiveStatus === 'available';
          const priorityIndicator = getPriorityIndicator(item.priority);

          return (
            <Card
              key={item.id}
              className='flex flex-col justify-between shadow-md rounded-lg overflow-hidden animate-fade-in bg-card transition-transform duration-200 hover:scale-[1.02]'
            >
              <div className='relative aspect-[4/3] w-full bg-muted/50 overflow-hidden'>
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={`Imagem de ${item.name}`}
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw'
                    priority={filterStatus === 'available'}
                    data-ai-hint='baby gift item'
                    onError={(e) => {
                      console.warn(`Failed to load image: ${item.imageUrl}`);
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement)
                        .parentElement;
                      if (
                        parent &&
                        !parent.querySelector('.placeholder-icon')
                      ) {
                        const placeholder = document.createElement('div');
                        placeholder.className =
                          'placeholder-icon flex items-center justify-center h-full w-full';
                        placeholder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-off text-muted-foreground/30"><path d="M10.4 10.4A3 3 0 0 0 12 12a3 3 0 0 0 1.6-4.4Z"/><path d="m21 1-9.2 9.2"/><path d="M13.5 5.5C15 4.5 16.5 4 18 4c2.8 0 5 2.2 5 5c0 1.5-.5 3-1.5 4.5L19 16"/><path d="M3 3v18h18"/><path d="M12 12.7a4.8 4.8 0 0 0-5.1-4.9A5 5 0 0 0 2 12.5V13a5 5 0 0 0 5 5h1.5"/></svg>`;
                        parent.appendChild(placeholder);
                      }
                    }}
                  />
                ) : (
                  <div className='flex items-center justify-center h-full w-full'>
                    <ImageIcon className='h-16 w-16 text-muted-foreground/30' />
                  </div>
                )}
                {priorityIndicator && (
                  <div className="absolute top-2 right-2 bg-background/70 p-1 rounded-full shadow-md" title={item.priority === 2 ? "Prioridade Alta" : "Prioridade Média"}>
                    {priorityIndicator}
                  </div>
                )}
              </div>

              <div className='flex flex-col flex-grow p-4'>
                <CardHeader className='p-0 mb-2'>
                  <CardTitle className='text-lg font-semibold leading-tight'>
                    {item.name}
                  </CardTitle>
                  {item.description && (
                    <CardDescription className='text-sm text-muted-foreground mt-1 line-clamp-2'>
                      {item.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className='p-0 flex-grow'>
                  <div className='flex items-center text-xs text-muted-foreground pt-1'>
                    <Tag className='mr-1 h-3 w-3' /> {item.category}
                  </div>
                </CardContent>
              </div>

              <CardFooter className='flex items-center justify-between gap-2 p-4 border-t mt-auto'>
                {getStatusBadge(item)}
                {isAvailableForSelection && (
                  <Button
                    size='sm'
                    className='bg-primary text-primary-foreground hover:bg-primary/90 transition-transform duration-150 hover:scale-105'
                    onClick={() => handleSelectItemClick(item)}
                    aria-label={`Selecionar ${item.name}`}
                    disabled={!!loadingItemId}
                  >
                    {loadingItemId === item.id ? (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    ) : (
                      <Gift className='mr-2 h-4 w-4' />
                    )}
                    Escolher
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {selectedItem && isDialogOpen && (
        <SelectItemDialog
          item={selectedItem}
          isOpen={isDialogOpen}
          onClose={handleDialogClose}
          onSuccess={handleItemSelectionSuccess}
        />
      )}
    </>
  );
}
