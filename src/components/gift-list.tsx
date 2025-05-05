
'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift, Check, X, Hourglass, User, Tag, Ban, Loader2 } from 'lucide-react';
import SelectItemDialog from './select-item-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { selectGift, type GiftItem } from '@/data/gift-store';
import { useToast } from '@/hooks/use-toast';

interface GiftListProps {
  items: GiftItem[]; // Accept items as prop
  filterStatus?: 'all' | 'available' | 'selected' | 'not_needed';
  filterCategory?: string;
  showSelectedByName?: boolean; // Keep this prop for admin/public differentiation if needed elsewhere
  // onClientAction prop removed
}

export default function GiftList({
  items, // Use passed items
  filterStatus = 'all',
  filterCategory,
  showSelectedByName = false, // By default, don't show name on public list
}: GiftListProps) {
  const [loading, setLoading] = useState(false); // Only for client-side actions like selection
  const [selectedItem, setSelectedItem] = useState<GiftItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Filter items based on props, now derived from the passed 'items' array
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filterStatus !== 'all' && item.status !== filterStatus) {
        return false;
      }
      if (filterCategory && item.category.toLowerCase() !== filterCategory.toLowerCase()) {
          return false;
      }
      return true;
    });
  }, [items, filterStatus, filterCategory]);


  const handleSelectItemClick = (item: GiftItem) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedItem(null);
  };

  // This function now performs the client-side action.
  // Revalidation is triggered inside the `selectGift` function in the data store.
  const handleItemSelectionSuccess = async (itemId: string, guestName: string) => {
     setLoading(true); // Indicate loading during the selection process
     try {
       // selectGift now handles revalidation internally
       const updatedItem = await selectGift(itemId, guestName);
       if (updatedItem) {
         toast({
            title: "Sucesso!",
            description: `Obrigado, ${guestName}! "${updatedItem.name}" foi reservado com sucesso!`,
            variant: "default",
         });
       } else {
         console.warn(`Failed to select item ${itemId}, it might have been selected by someone else.`);
         toast({ title: "Ops!", description: "Este item já foi selecionado. A lista será atualizada.", variant: "destructive" });
         // Revalidation is already triggered by selectGift, even on failure to find item
       }
     } catch (error) {
       console.error("Error selecting gift:", error);
       toast({ title: "Erro!", description: "Não foi possível selecionar o presente.", variant: "destructive" });
     } finally {
        setLoading(false); // Stop loading indicator
        handleDialogClose(); // Close dialog regardless of success/failure after action attempt
     }
  };


  const getStatusBadge = (status: GiftItem['status'], selectedBy?: string) => {
    switch (status) {
      case 'available':
        return <Badge variant="default" className="bg-success text-success-foreground"><Check className="mr-1 h-3 w-3" /> Disponível</Badge>;
      case 'selected':
        // Always hide the name on the public list as per the requirement
        return (
          <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
            <User className="mr-1 h-3 w-3" /> Selecionado
          </Badge>
        );
      case 'not_needed':
        return <Badge variant="destructive" className="bg-destructive/80 text-destructive-foreground"><Ban className="mr-1 h-3 w-3" /> Não Precisa</Badge>;
      default:
        return <Badge variant="outline"><Hourglass className="mr-1 h-3 w-3" /> Indefinido</Badge>;
    }
  };

  // Skeleton rendering is still useful if the parent component is loading initial data
  // but GiftList itself doesn't manage the initial loading state anymore.
  // The parent (Home page) should handle the overall loading state.
  // We keep a simpler loading state for the 'Choose' button interaction.


  if (filteredItems.length === 0) {
     let emptyMessage = "Nenhum item encontrado com os filtros selecionados.";
     if (filterStatus === 'available') emptyMessage = "Todos os presentes disponíveis já foram escolhidos ou marcados como 'Não Precisa'!";
     if (filterStatus === 'selected') emptyMessage = "Nenhum presente foi selecionado ainda.";
     if (filterStatus === 'not_needed') emptyMessage = "Nenhum item marcado como 'Não precisa'.";

    return (
      <div className="text-center pt-16 pb-10 text-muted-foreground">
        <Gift className="mx-auto h-12 w-12 mb-4" />
        <p>{emptyMessage}</p>
      </div>
    );
  }


  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {filteredItems.map((item) => (
          <Card key={item.id} className="flex flex-col justify-between shadow-md rounded-lg overflow-hidden animate-fade-in bg-card">
            <CardHeader>
              <CardTitle className="text-lg">{item.name}</CardTitle>
              {item.description && (
                <CardDescription>{item.description}</CardDescription>
              )}
              <div className="flex items-center text-sm text-muted-foreground pt-1">
                <Tag className="mr-1 h-4 w-4"/> {item.category}
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
               {/* Content area */}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-4 border-t">
               {getStatusBadge(item.status, item.selectedBy)}
               <div className="flex gap-2 flex-wrap justify-end">
                  {item.status === 'available' && (
                    <Button
                       size="sm"
                       className="bg-accent text-accent-foreground hover:bg-accent/90 hover:animate-pulse-button"
                       onClick={() => handleSelectItemClick(item)}
                       aria-label={`Selecionar ${item.name}`}
                       disabled={loading} // Disable button while an item is being selected
                    >
                      {loading && selectedItem?.id === item.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                          <Gift className="mr-2 h-4 w-4" />
                      )}
                       Escolher
                    </Button>
                  )}
                  {/* No buttons for 'selected' or 'not_needed' on public page */}
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Dialog remains the same, but uses the new handleItemSelectionSuccess */}
      {selectedItem && selectedItem.status === 'available' && (
        <SelectItemDialog
          item={selectedItem}
          isOpen={isDialogOpen}
          onClose={handleDialogClose}
          onSuccess={handleItemSelectionSuccess} // Pass the updated handler
        />
      )}
    </>
  );
}
