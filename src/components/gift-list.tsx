'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift, Check, X, Hourglass, User, Tag } from 'lucide-react'; // Added User and Tag icons
import SelectItemDialog from './select-item-dialog'; // Assume this component exists for selection dialog
import { Skeleton } from '@/components/ui/skeleton';

// Define interfaces for better type safety
interface GiftItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  status: 'available' | 'selected' | 'not_needed';
  selectedBy?: string; // Name of the guest who selected the item
}

// Placeholder data - Replace with actual Firestore fetching logic
const mockGiftItems: GiftItem[] = [
  { id: '1', name: 'Body Manga Curta (RN)', category: 'Roupas', status: 'available', description: 'Pacote com 3 unidades, cores neutras.' },
  { id: '2', name: 'Fraldas Pampers (P)', category: 'Higiene', status: 'available', description: 'Pacote grande.' },
  { id: '3', name: 'Mamadeira Anti-cólica', category: 'Alimentação', status: 'selected', selectedBy: 'Maria Silva' },
  { id: '4', name: 'Móbile Musical', category: 'Brinquedos', status: 'available' },
  { id: '5', name: 'Lenços Umedecidos', category: 'Higiene', status: 'selected', selectedBy: 'João Pereira' },
  { id: '6', name: 'Termômetro Digital', category: 'Higiene', status: 'not_needed' },
  { id: '7', name: 'Macacão Pijama (M)', category: 'Roupas', status: 'available', description: 'Algodão macio.' },
  { id: '8', name: 'Chupeta Calmante', category: 'Outros', status: 'available'},
  { id: '9', name: 'Cadeirinha de Descanso', category: 'Outros', status: 'selected', selectedBy: 'Ana Costa'},
  { id: '10', name: 'Pomada para Assaduras', category: 'Higiene', status: 'available', description: 'Marca Bepantol Baby ou similar.'},
];

interface GiftListProps {
  filterStatus?: 'all' | 'available' | 'selected' | 'not_needed';
  filterCategory?: string;
  showSelectedByName?: boolean; // New prop to control visibility of selector's name
}

export default function GiftList({
  filterStatus = 'all',
  filterCategory,
  showSelectedByName = false // Default to hiding the name
}: GiftListProps) {
  const [items, setItems] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<GiftItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Simulate fetching data from Firestore
  useEffect(() => {
    setLoading(true);
    // TODO: Replace with actual Firestore query
    // e.g., const unsubscribe = onSnapshot(collection(db, 'gifts'), (snapshot) => { ... });
    setTimeout(() => {
      setItems(mockGiftItems);
      setLoading(false);
    }, 1000); // Simulate network delay

    // Cleanup function for Firestore listener if implemented
    // return () => unsubscribe();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Filter out 'not_needed' items unless explicitly requested
      if (filterStatus !== 'all' && filterStatus !== 'not_needed' && item.status === 'not_needed') {
        return false;
      }
      const statusMatch = filterStatus === 'all' || item.status === filterStatus;
      const categoryMatch = !filterCategory || item.category.toLowerCase() === filterCategory.toLowerCase();
      return statusMatch && categoryMatch;
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

  // Function to update item status locally (simulate Firestore update)
  const handleItemSelectionSuccess = (itemId: string, guestName: string) => {
     // TODO: Add actual Firestore update logic here
     // await updateDoc(doc(db, 'gifts', itemId), { status: 'selected', selectedBy: guestName, selectionDate: serverTimestamp() });
     setItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, status: 'selected', selectedBy: guestName } : item
      )
    );
  };

  const getStatusBadge = (status: GiftItem['status'], selectedBy?: string) => {
    switch (status) {
      case 'available':
        return <Badge variant="default" className="bg-success text-success-foreground"><Check className="mr-1 h-3 w-3" /> Disponível</Badge>;
      case 'selected':
        // Conditionally display the name based on showSelectedByName prop
        const displayName = showSelectedByName && selectedBy ? ` por ${selectedBy}` : '';
        return (
          <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
            <User className="mr-1 h-3 w-3" /> Selecionado{displayName}
          </Badge>
        );
      case 'not_needed':
         // Optionally hide 'not_needed' badge or display differently if needed
         // For now, keep it as is unless filter handles hiding it.
        return <Badge variant="destructive" className="bg-destructive text-destructive-foreground"><X className="mr-1 h-3 w-3" /> Não Precisa</Badge>;
      default:
        return <Badge variant="outline"><Hourglass className="mr-1 h-3 w-3" /> Indefinido</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {[...Array(6)].map((_, index) => (
           <Card key={index} className="animate-pulse">
             <CardHeader>
               <Skeleton className="h-6 w-3/4" />
               <Skeleton className="h-4 w-1/2" />
             </CardHeader>
             <CardContent>
               <Skeleton className="h-4 w-full" />
             </CardContent>
             <CardFooter className="flex justify-between">
                <Skeleton className="h-8 w-1/4" />
               <Skeleton className="h-10 w-1/3" />
             </CardFooter>
           </Card>
        ))}
      </div>
    );
  }

  if (filteredItems.length === 0 && !loading) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Gift className="mx-auto h-12 w-12 mb-4" />
        <p>Nenhum item encontrado com os filtros selecionados.</p>
        {filterStatus !== 'all' && (
             <Button variant="link" onClick={() => {/* Implement filter reset logic, e.g., using query params or state management */ }}>
                Limpar filtros
            </Button>
        )}
      </div>
    );
  }


  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
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
               {/* Optional: Image placeholder */}
              {/* <Image src={`https://picsum.photos/seed/${item.id}/300/200`} alt={item.name} width={300} height={200} className="rounded-md mb-4" data-ai-hint="baby gift item"/> */}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-4 border-t">
              {/* Pass selectedBy only if showSelectedByName is true */}
              {getStatusBadge(item.status, showSelectedByName ? item.selectedBy : undefined)}
              {item.status === 'available' && (
                <Button
                   size="sm"
                   className="bg-accent text-accent-foreground hover:bg-accent/90 hover:animate-pulse-button"
                   onClick={() => handleSelectItemClick(item)}
                   aria-label={`Selecionar ${item.name}`}
                >
                  <Gift className="mr-2 h-4 w-4" /> Escolher este presente
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {selectedItem && (
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
