
'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, User, CalendarDays } from 'lucide-react';
import { revertSelection, type GiftItem } from '@/data/gift-store'; // Import store function
import { useToast } from '@/hooks/use-toast';

interface AdminSelectionViewerProps {
  selectedItems: GiftItem[]; // Items with 'selected' status
  onDataChange: () => void; // Callback to refresh data in parent
}

export default function AdminSelectionViewer({ selectedItems, onDataChange }: AdminSelectionViewerProps) {
  const { toast } = useToast();

  const handleRevert = async (item: GiftItem) => {
    if (!item.selectedBy) return; // Should always have selectedBy, but check anyway
    if (confirm(`Tem certeza que deseja reverter a seleção de "${item.name}" por ${item.selectedBy}? O item voltará a ficar disponível.`)) {
      try {
        await revertSelection(item.id);
        toast({ title: "Sucesso!", description: `Seleção do item "${item.name}" revertida.` });
        onDataChange(); // Refresh parent data
      } catch (error) {
        console.error("Error reverting selection:", error);
        toast({ title: "Erro!", description: `Falha ao reverter a seleção do item "${item.name}".`, variant: "destructive" });
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead><User className="inline-block mr-1 h-4 w-4" />Selecionado Por</TableHead>
              <TableHead className="hidden sm:table-cell"><CalendarDays className="inline-block mr-1 h-4 w-4" />Data</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  Nenhum item selecionado ainda.
                </TableCell>
              </TableRow>
            ) : (
              selectedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.selectedBy || 'Desconhecido'}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                     {item.selectionDate
                         ? new Date(item.selectionDate).toLocaleDateString('pt-BR', {
                            year: 'numeric', month: '2-digit', day: '2-digit'
                           })
                         : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevert(item)}
                      title="Reverter Seleção"
                      className="border-orange-500 text-orange-600 hover:bg-orange-500/10"
                    >
                      <RotateCcw className="mr-1 h-4 w-4" /> Reverter
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

    