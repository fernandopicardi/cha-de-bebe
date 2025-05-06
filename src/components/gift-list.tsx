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
  Check,
  X,
  Hourglass,
  User,
  Tag,
  Loader2,
  ImageIcon, // Placeholder icon
  Package, // Icon for quantity
} from 'lucide-react';
import SelectItemDialog from './select-item-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { selectGift, type GiftItem } from '@/data/gift-store'; // Ensure correct import
import { useToast } from '@/hooks/use-toast';

interface GiftListProps {
  items: GiftItem[] | null;
  filterStatus?: 'all' | 'available' | 'selected' | 'not_needed';
  filterCategory?: string;
  onItemAction?: () => void;
}

export default function GiftList({
  items,
  filterStatus = 'all',
  filterCategory,
  onItemAction,
}: GiftListProps) {
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<GiftItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log(
      `GiftList (${filterStatus}): Received items prop update. Count: ${items?.length ?? 0}`
    );
  }, [items, filterStatus]);

  const filteredItems = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];
    console.log(
      `GiftList (${filterStatus}): Filtering ${safeItems.length} items based on prop...`
    );

    const result = safeItems.filter((item) => {
      if (!item || typeof item.status === 'undefined' || !item.id) {
        console.warn(
          `GiftList (${filterStatus}): Skipping invalid item during filtering:`,
          item
        );
        return false;
      }
      // Determine the effective status, considering quantity
      const isQuantityItem =
        item.totalQuantity !== null && item.totalQuantity > 0;
      let effectiveStatus = item.status;

      if (isQuantityItem && item.status !== 'not_needed') {
        effectiveStatus =
          (item.selectedQuantity ?? 0) >= item.totalQuantity
            ? 'selected'
            : 'available';
      }

      const statusMatch =
        filterStatus === 'all' || effectiveStatus === filterStatus;
      const categoryMatch =
        !filterCategory ||
        item.category?.toLowerCase() === filterCategory.toLowerCase();
      return statusMatch && categoryMatch;
    });
    console.log(
      `GiftList (${filterStatus}): Filtered down to ${result.length} items.`
    );
    return result;
  }, [items, filterStatus, filterCategory]);

  const handleSelectItemClick = (item: GiftItem) => {
    if (loadingItemId) return;
    // Ensure item is actually available before opening dialog
    const isQuantityItem =
      item.totalQuantity !== null && item.totalQuantity > 0;
    const isAvailable = isQuantityItem
      ? (item.selectedQuantity ?? 0) < item.totalQuantity
      : item.status === 'available';

    if (isAvailable && item.status !== 'not_needed') {
      setSelectedItem(item);
      setIsDialogOpen(true);
    } else {
      console.warn(`GiftList: Attempted to select unavailable item ${item.id}`);
      toast({
        title: 'Item Indisponível',
        description: 'Este item não está mais disponível para seleção.',
        variant: 'destructive',
      });
      // Optionally refresh data if status might be stale
      // onItemAction?.();
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedItem(null);
  };

  // Updated handleItemSelectionSuccess signature
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
      // Pass only necessary parameters to selectGift
      const updatedItem = await selectGift(itemId, guestName, quantity);

      if (updatedItem) {
        console.log(
          `GiftList (${filterStatus}): Item ${itemId} selected successfully. Triggering onItemAction.`
        );
        toast({
          title: 'Sucesso!',
          description: `Obrigado, ${guestName}! ${quantity > 1 ? `${quantity} unidades de` : ''} "${updatedItem.name}" ${quantity > 1 ? 'foram reservadas' : 'foi reservado'}!`,
          variant: 'default',
          className: 'bg-success text-success-foreground border-success',
        });
        onItemAction?.(); // Refresh UI from parent
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
        onItemAction?.(); // Refresh UI from parent
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
    let displayStatus: GiftItem['status'] = item.status;
    let quantityText = '';

    if (item.status === 'not_needed') {
      displayStatus = 'not_needed';
    } else if (isQuantityItem) {
      const selected = item.selectedQuantity ?? 0;
      const total = item.totalQuantity ?? 0;
      displayStatus = selected >= total ? 'selected' : 'available';
      quantityText = `(${selected}/${total})`; // Add quantity text
    }

    switch (displayStatus) {
      case 'available':
        return (
          <Badge
            variant='default'
            className='bg-success text-success-foreground'
          >
            <Check className='mr-1 h-3 w-3' /> Disponível {quantityText}
          </Badge>
        );
      case 'selected':
        return (
          <Badge
            variant='secondary'
            className='bg-secondary text-secondary-foreground'
          >
            <User className='mr-1 h-3 w-3' /> Selecionado {quantityText}
          </Badge>
        );
      case 'not_needed':
        return (
          <Badge
            variant='destructive'
            className='bg-destructive/80 text-destructive-foreground'
          >
            <X className='mr-1 h-3 w-3' /> Não Precisa
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
            index // Show more skeletons
          ) => (
            <Card
              key={index}
              className='flex flex-col justify-between shadow-md rounded-lg overflow-hidden bg-card'
            >
              <CardHeader className='p-4'>
                {' '}
                {/* Adjust padding */}
                <Skeleton className='h-40 w-full mb-4 rounded-md' />{' '}
                {/* Image skeleton */}
                <Skeleton className='h-6 w-3/4 mb-2' /> {/* Title */}
                <Skeleton className='h-4 w-1/2 mb-2' /> {/* Description */}
                <Skeleton className='h-4 w-1/4' /> {/* Category */}
              </CardHeader>
              <CardFooter className='flex items-center justify-between gap-2 p-4 border-t'>
                <Skeleton className='h-5 w-24' /> {/* Status badge */}
                <Skeleton className='h-9 w-28' /> {/* Button */}
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
    return (
      <div className='text-center py-16 text-muted-foreground'>
        <Gift className='mx-auto h-12 w-12 mb-4' />
        <p>A lista de presentes ainda está vazia.</p>
      </div>
    );
  }

  if (isFilteredListEmpty) {
    let emptyMessage = 'Nenhum item encontrado.';
    if (filterStatus === 'available')
      emptyMessage = 'Todos os presentes disponíveis já foram escolhidos.';
    if (filterStatus === 'selected')
      emptyMessage = 'Nenhum presente foi selecionado ainda.';
    if (filterStatus === 'not_needed')
      emptyMessage = "Nenhum item marcado como 'Não Precisa'.";
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
      {/* Responsive grid layout */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
        {filteredItems.map((item) => {
          const isQuantityItem =
            item.totalQuantity !== null && item.totalQuantity > 0;
          const effectiveStatus =
            isQuantityItem && item.status !== 'not_needed'
              ? (item.selectedQuantity ?? 0) >= item.totalQuantity
                ? 'selected'
                : 'available'
              : item.status;
          const isAvailableForSelection = effectiveStatus === 'available';

          return (
            <Card
              key={item.id}
              className='flex flex-col justify-between shadow-md rounded-lg overflow-hidden animate-fade-in bg-card transition-transform duration-200 hover:scale-[1.02]'
            >
              {/* Image Section - Takes significant portion */}
              <div className='relative aspect-[4/3] w-full bg-muted/50 overflow-hidden'>
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={`Imagem de ${item.name}`}
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw' // Adjusted sizes
                    priority={filterStatus === 'all'} // Prioritize images in 'all' tab might help LCP
                    unoptimized={item.imageUrl.startsWith('data:')} // Keep for data URIs if used
                    data-ai-hint='baby gift item'
                    onError={(e) => {
                      console.warn(`Failed to load image: ${item.imageUrl}`);
                      (e.target as HTMLImageElement).style.display = 'none';
                    }} // Hide broken image icon
                  />
                ) : (
                  <div className='flex items-center justify-center h-full w-full'>
                    <ImageIcon className='h-16 w-16 text-muted-foreground/30' />
                  </div>
                )}
              </div>

              {/* Content Section */}
              <div className='flex flex-col flex-grow p-4'>
                {' '}
                {/* Use flex-grow */}
                <CardHeader className='p-0 mb-2'>
                  {' '}
                  {/* Remove default padding */}
                  <CardTitle className='text-lg font-semibold leading-tight'>
                    {item.name}
                  </CardTitle>
                  {item.description && (
                    <CardDescription className='text-sm text-muted-foreground mt-1 line-clamp-2'>
                      {' '}
                      {/* Limit description lines */}
                      {item.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className='p-0 flex-grow'>
                  {' '}
                  {/* Remove padding, let flex handle space */}
                  <div className='flex items-center text-xs text-muted-foreground pt-1'>
                    <Tag className='mr-1 h-3 w-3' /> {item.category}
                  </div>
                </CardContent>
              </div>

              {/* Footer Section */}
              <CardFooter className='flex items-center justify-between gap-2 p-4 border-t mt-auto'>
                {' '}
                {/* Ensure footer is at bottom */}
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
          item={selectedItem} // Pass the full item including quantity info
          isOpen={isDialogOpen}
          onClose={handleDialogClose}
          onSuccess={handleItemSelectionSuccess}
        />
      )}
    </>
  );
}
