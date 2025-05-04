
'use client';

import React, { useState } from 'react';
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Edit, PlusCircle, Save, Ban, RotateCcw } from 'lucide-react'; // Removed XCircle, CheckCircle2 etc.
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { addGift, updateGift, deleteGift, revertSelection, type GiftItem } from '@/data/gift-store'; // revertSelection remains useful

interface AdminItemManagementTableProps {
  gifts: GiftItem[];
  onDataChange: () => void; // Callback to refresh data in parent
}

// Validation Schema for the Add/Edit Form
const giftFormSchema = z.object({
  name: z.string().min(3, "Nome precisa ter pelo menos 3 caracteres."),
  description: z.string().optional(),
  category: z.string().min(1, "Categoria é obrigatória."),
  status: z.enum(['available', 'selected', 'not_needed']).optional(), // Removed 'pending_suggestion'
});

type GiftFormData = z.infer<typeof giftFormSchema>;

// Available categories (could be fetched or configured elsewhere) - Removed 'Sugestão'
const categories = ['Roupas', 'Higiene', 'Brinquedos', 'Alimentação', 'Outros'];
const statuses: GiftItem['status'][] = ['available', 'selected', 'not_needed']; // Removed 'pending_suggestion'


export default function AdminItemManagementTable({ gifts, onDataChange }: AdminItemManagementTableProps) {
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GiftItem | null>(null);
  const { toast } = useToast();

  const { control, register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<GiftFormData>({
    resolver: zodResolver(giftFormSchema),
    defaultValues: {
      name: '',
      description: '',
      category: '',
    }
  });

   const handleOpenAddDialog = () => {
    reset({ name: '', description: '', category: '', status: 'available' }); // Reset for add
    setEditingItem(null);
    setIsAddEditDialogOpen(true);
  };

   const handleOpenEditDialog = (item: GiftItem) => {
       setEditingItem(item);
       reset({ // Populate form with item data
           name: item.name,
           description: item.description || '',
           category: item.category,
           status: item.status
       });
       setIsAddEditDialogOpen(true);
   };

  const handleDialogClose = () => {
    setIsAddEditDialogOpen(false);
    setEditingItem(null);
    reset(); // Clear form on close
  };

  const onSubmit = async (data: GiftFormData) => {
    try {
      if (editingItem) {
        // Update existing item
        await updateGift(editingItem.id, {
             name: data.name,
             description: data.description,
             category: data.category,
             // Status can be updated here if needed, or use dedicated actions
             // status: data.status // Be careful allowing direct status changes here
        });
        toast({ title: "Sucesso!", description: `Item "${data.name}" atualizado.` });
      } else {
        // Add new item
        await addGift({
             name: data.name,
             description: data.description,
             category: data.category,
             // Default status is 'available' for new items added by admin
        });
        toast({ title: "Sucesso!", description: `Item "${data.name}" adicionado.` });
      }
      onDataChange(); // Refresh parent data
      handleDialogClose();
    } catch (error) {
      console.error("Error saving item:", error);
      toast({ title: "Erro!", description: `Falha ao salvar o item "${data.name}".`, variant: "destructive" });
    }
  };

  const handleDelete = async (item: GiftItem) => {
      if (confirm(`Tem certeza que deseja excluir o item "${item.name}"? Esta ação não pode ser desfeita.`)) {
          try {
              await deleteGift(item.id);
              toast({ title: "Sucesso!", description: `Item "${item.name}" excluído.` });
              onDataChange();
          } catch (error) {
              console.error("Error deleting item:", error);
              toast({ title: "Erro!", description: `Falha ao excluir o item "${item.name}".`, variant: "destructive" });
          }
      }
  };

   const handleRevert = async (item: GiftItem) => {
       if (item.status !== 'selected' && item.status !== 'not_needed') return; // Only revert selected or not_needed items
       const actionText = item.status === 'selected' ? 'reverter a seleção' : 'remover a marcação "Não Precisa"';
       const guestNameInfo = item.selectedBy ? ` por ${item.selectedBy}` : '';
       if (confirm(`Tem certeza que deseja ${actionText} do item "${item.name}"${guestNameInfo}? O item voltará a ficar disponível.`)) {
           try {
               await revertSelection(item.id); // This function now handles both cases
               toast({ title: "Sucesso!", description: `Item "${item.name}" revertido para disponível.` });
               onDataChange();
           } catch (error) {
               console.error("Error reverting item:", error);
               toast({ title: "Erro!", description: `Falha ao reverter o item "${item.name}".`, variant: "destructive" });
           }
       }
   };

    const handleMarkNotNeeded = async (item: GiftItem) => {
        if (item.status === 'not_needed') return; // Already marked
        if (confirm(`Tem certeza que deseja marcar o item "${item.name}" como "Não Precisa"?`)) {
            try {
                // Use updateGift for consistency, ensuring selection info is cleared
                await updateGift(item.id, { status: 'not_needed', selectedBy: undefined, selectionDate: undefined });
                toast({ title: "Sucesso!", description: `Item "${item.name}" marcado como "Não Precisa".` });
                onDataChange();
            } catch (error) {
                console.error("Error marking as not needed:", error);
                toast({ title: "Erro!", description: `Falha ao marcar o item "${item.name}" como "Não Precisa".`, variant: "destructive" });
            }
        }
    };


  const getStatusBadge = (status: GiftItem['status']) => {
     switch (status) {
      case 'available': return <Badge variant="default" className="bg-success text-success-foreground">Disponível</Badge>;
      case 'selected': return <Badge variant="secondary" className="bg-secondary text-secondary-foreground">Selecionado</Badge>;
      case 'not_needed': return <Badge variant="destructive" className="bg-destructive/80 text-destructive-foreground">Não Precisa</Badge>;
      // Removed 'pending_suggestion' case
      default: return <Badge variant="outline">Indefinido</Badge>;
    }
  };

  return (
    <div className="space-y-4">
        <div className="flex justify-end">
            <Button onClick={handleOpenAddDialog} size="sm">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Novo Item
            </Button>
        </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">Descrição</TableHead>
              <TableHead className="hidden sm:table-cell">Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Nenhum item na lista ainda.
                </TableCell>
              </TableRow>
            ) : (
              gifts.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{item.description || '-'}</TableCell>
                  <TableCell className="hidden sm:table-cell">{item.category}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-right space-x-1">
                     <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(item)} title="Editar Item">
                         <Edit className="h-4 w-4" />
                     </Button>
                     {(item.status === 'selected' || item.status === 'not_needed') && ( // Allow reverting 'selected' and 'not_needed'
                         <Button variant="ghost" size="icon" onClick={() => handleRevert(item)} title="Reverter para Disponível">
                             <RotateCcw className="h-4 w-4 text-orange-600" />
                         </Button>
                     )}
                     {item.status === 'available' && ( // Only show 'Mark Not Needed' for available items
                         <Button variant="ghost" size="icon" onClick={() => handleMarkNotNeeded(item)} title="Marcar como Não Precisa">
                             <Ban className="h-4 w-4 text-yellow-600" />
                         </Button>
                     )}
                     <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} title="Excluir Item">
                         <Trash2 className="h-4 w-4 text-destructive" />
                     </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

       {/* Add/Edit Dialog */}
      <Dialog open={isAddEditDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Item' : 'Adicionar Novo Item'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Modifique os detalhes do item.' : 'Preencha os detalhes do novo item para a lista.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
             {/* Name */}
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="name" className="text-right text-sm font-medium">Nome*</label>
              <div className="col-span-3">
                <Input id="name" {...register('name')} className={errors.name ? 'border-destructive' : ''} />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>
            </div>
             {/* Description */}
            <div className="grid grid-cols-4 items-start gap-4">
              <label htmlFor="description" className="text-right text-sm font-medium pt-2">Descrição</label>
              <div className="col-span-3">
                 <Textarea id="description" {...register('description')} />
                 {/* No validation needed for optional field */}
              </div>
            </div>
             {/* Category */}
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="category" className="text-right text-sm font-medium">Categoria*</label>
              <div className="col-span-3">
                 <Controller
                     name="category"
                     control={control}
                     render={({ field }) => (
                         <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <SelectTrigger className={errors.category ? 'border-destructive' : ''}>
                                <SelectValue placeholder="Selecione uma categoria" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                         </Select>
                     )}
                 />
                {errors.category && <p className="text-sm text-destructive mt-1">{errors.category.message}</p>}
              </div>
            </div>

            {/* Status - Optionally allow editing status here for admin */}
            {editingItem && ( // Only show status edit for existing items
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="status" className="text-right text-sm font-medium">Status</label>
                  <div className="col-span-3">
                     <Controller
                         name="status"
                         control={control}
                         render={({ field }) => (
                             <Select onValueChange={field.onChange} value={field.value} >
                                <SelectTrigger className={errors.status ? 'border-destructive' : ''}>
                                    <SelectValue placeholder="Selecione um status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {statuses.map(stat => (
                                        <SelectItem key={stat} value={stat}>
                                          {stat === 'available' && 'Disponível'}
                                          {stat === 'selected' && 'Selecionado'}
                                          {stat === 'not_needed' && 'Não Precisa'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                             </Select>
                         )}
                     />
                    {errors.status && <p className="text-sm text-destructive mt-1">{errors.status.message}</p>}
                  </div>
                </div>
            )}


          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : <><Save className="mr-2 h-4 w-4" /> Salvar Item</>}
            </Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
