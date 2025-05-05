'use client';

import React, { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PartyPopper, Send } from 'lucide-react';
import type { GiftItem } from '@/data/gift-store'; // Import type
import { revalidateAdminPage } from '@/actions/revalidate'; // Import admin page revalidation

// Interface now uses the imported type
interface SelectItemDialogProps {
  item: GiftItem; // Use imported type
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (itemId: string, guestName: string) => Promise<void>; // Callback now expected to be async
}

// Define validation schema
const FormSchema = z.object({
  guestName: z.string().min(2, { message: 'Por favor, insira seu nome (mínimo 2 caracteres).' }).max(50, { message: 'Nome muito longo (máximo 50 caracteres).' }),
});

type FormData = z.infer<typeof FormSchema>;

export default function SelectItemDialog({ item, isOpen, onClose, onSuccess }: SelectItemDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsSubmitting(true);
    try {
      // Call the success callback passed from the parent (which now handles the async logic and home page revalidation)
      await onSuccess(item.id, data.guestName);
      // Also explicitly revalidate admin page here for consistency
      await revalidateAdminPage();

      // Toast is now handled within the onSuccess callback in gift-list.tsx after revalidation
      // toast({
      //   title: ( <div className="flex items-center gap-2"> <PartyPopper className="h-5 w-5 text-success-foreground" /> Sucesso! </div> ),
      //   description: `Obrigado, ${data.guestName}! "${item.name}" foi reservado com sucesso!`,
      //   variant: 'default',
      //   className: 'bg-success text-success-foreground border-success',
      // });
      reset(); // Reset form fields
      onClose(); // Close the dialog
    } catch (error) {
      console.error("Erro ao selecionar item:", error);
      toast({
        title: 'Ops! Algo deu errado.',
        description: 'Não foi possível registrar sua seleção. Pode ser que alguém já tenha escolhido. Tente atualizar a página ou escolher outro item.', // More informative error
        variant: 'destructive',
      });
      // Keep dialog open on error? Optional. onClose(); could be removed from finally.
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form when dialog closes or item changes
  React.useEffect(() => {
    if (!isOpen) {
        reset({ guestName: '' }); // Ensure reset clears the field
    }
  }, [isOpen, reset]);


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-card">
        <DialogHeader>
          <DialogTitle>Confirmar Seleção</DialogTitle>
          <DialogDescription>
            Você escolheu o presente: <strong>{item.name}</strong>. Por favor, insira seu nome para confirmar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="guestName" className="text-right">
              Seu Nome
            </Label>
            <div className="col-span-3">
              <Input
                id="guestName"
                {...register('guestName')}
                className={`col-span-3 ${errors.guestName ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                disabled={isSubmitting}
                aria-invalid={errors.guestName ? "true" : "false"}
                aria-describedby="guestName-error"
              />
              {errors.guestName && (
                <p id="guestName-error" className="text-sm text-destructive mt-1">{errors.guestName.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
             <DialogClose asChild>
               <Button type="button" variant="outline" disabled={isSubmitting}>
                 Cancelar
               </Button>
             </DialogClose>
            <Button type="submit" disabled={isSubmitting} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Confirmar Presente
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
