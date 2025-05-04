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
import { Loader2, PartyPopper, Send } from 'lucide-react'; // Added PartyPopper and Send

interface GiftItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  status: 'available' | 'selected' | 'not_needed';
}

interface SelectItemDialogProps {
  item: GiftItem;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (itemId: string, guestName: string) => void; // Callback on successful selection
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
      // Simulate API call / Firestore update
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Call the success callback passed from the parent
      onSuccess(item.id, data.guestName);

      toast({
        title: ( <div className="flex items-center gap-2"> <PartyPopper className="h-5 w-5 text-success-foreground" /> Sucesso! </div> ),
        description: `Obrigado, ${data.guestName}! "${item.name}" vai alegrar o dia do nosso bebê!`,
        variant: 'default', // Use default which can be styled for success via CSS potentially or add a success variant
        className: 'bg-success text-success-foreground border-success', // Direct styling for success
      });
      reset(); // Reset form fields
      onClose(); // Close the dialog
    } catch (error) {
      console.error("Erro ao selecionar item:", error);
      toast({
        title: 'Ops! Algo deu errado.',
        description: 'Não foi possível registrar sua seleção. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form when dialog closes or item changes
  React.useEffect(() => {
    if (!isOpen) {
        reset();
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
