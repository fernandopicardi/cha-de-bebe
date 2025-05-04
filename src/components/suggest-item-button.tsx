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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Import Textarea
import { Label } from '@/components/ui/label';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lightbulb, Send } from 'lucide-react'; // Added Lightbulb and Send

// Define validation schema for suggestion
const SuggestionSchema = z.object({
  itemName: z.string().min(3, { message: 'Nome do item muito curto (mínimo 3 caracteres).' }).max(100, { message: 'Nome do item muito longo (máximo 100 caracteres).' }),
  itemDescription: z.string().max(200, { message: 'Descrição muito longa (máximo 200 caracteres).' }).optional(),
  suggesterName: z.string().min(2, { message: 'Por favor, insira seu nome (mínimo 2 caracteres).' }).max(50, { message: 'Nome muito longo (máximo 50 caracteres).' }),
});

type SuggestionFormData = z.infer<typeof SuggestionSchema>;

export default function SuggestItemButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<SuggestionFormData>({
    resolver: zodResolver(SuggestionSchema),
  });

  const onSubmit: SubmitHandler<SuggestionFormData> = async (data) => {
    setIsSubmitting(true);
    try {
      // Simulate API call / Firestore update to add suggestion
      console.log("Suggestion Data:", data); // Log data for debugging
      await new Promise(resolve => setTimeout(resolve, 1000));
      // TODO: Implement actual Firestore logic to add suggestion
      // await addDoc(collection(db, 'suggestions'), { ...data, status: 'pending', submittedAt: serverTimestamp() });


      toast({
        title: ( <div className="flex items-center gap-2"> <Lightbulb className="h-5 w-5 text-success-foreground" /> Sugestão Enviada! </div> ),
        description: `Obrigado pela sua sugestão, ${data.suggesterName}! Vamos analisar "${data.itemName}".`,
        variant: 'default',
        className: 'bg-success text-success-foreground border-success',
      });
      reset(); // Reset form fields
      setIsOpen(false); // Close the dialog
    } catch (error) {
      console.error("Erro ao enviar sugestão:", error);
      toast({
        title: 'Ops! Algo deu errado.',
        description: 'Não foi possível enviar sua sugestão. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-accent text-accent-foreground hover:bg-accent/10">
          <Lightbulb className="mr-2 h-4 w-4" />
          Sugerir um Item
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] bg-card">
        <DialogHeader>
          <DialogTitle>Sugerir um Novo Item</DialogTitle>
          <DialogDescription>
            Não encontrou o que procurava? Sugira um item para a lista! Sua sugestão será analisada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          {/* Item Name */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="itemName" className="text-right pt-2">
              Nome do Item*
            </Label>
            <div className="col-span-3">
              <Input
                id="itemName"
                {...register('itemName')}
                className={`${errors.itemName ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                disabled={isSubmitting}
                aria-invalid={errors.itemName ? "true" : "false"}
              />
              {errors.itemName && <p className="text-sm text-destructive mt-1">{errors.itemName.message}</p>}
            </div>
          </div>

          {/* Item Description (Optional) */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="itemDescription" className="text-right pt-2">
              Descrição
            </Label>
            <div className="col-span-3">
              <Textarea
                id="itemDescription"
                placeholder="Ex: Marca específica, cor, tamanho, link..."
                {...register('itemDescription')}
                className={`${errors.itemDescription ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                disabled={isSubmitting}
                 aria-invalid={errors.itemDescription ? "true" : "false"}
              />
              {errors.itemDescription && <p className="text-sm text-destructive mt-1">{errors.itemDescription.message}</p>}
            </div>
          </div>

          {/* Suggester Name */}
           <div className="grid grid-cols-4 items-center gap-4">
             <Label htmlFor="suggesterName" className="text-right">
               Seu Nome*
             </Label>
            <div className="col-span-3">
               <Input
                 id="suggesterName"
                 {...register('suggesterName')}
                 className={`${errors.suggesterName ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                 disabled={isSubmitting}
                 aria-invalid={errors.suggesterName ? "true" : "false"}
               />
              {errors.suggesterName && <p className="text-sm text-destructive mt-1">{errors.suggesterName.message}</p>}
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
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Sugestão
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
