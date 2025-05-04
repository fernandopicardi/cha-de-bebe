'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Lightbulb, User } from 'lucide-react';
import { approveSuggestion, rejectSuggestion, type GiftItem } from '@/data/gift-store'; // Import store functions
import { useToast } from '@/hooks/use-toast';

interface AdminSuggestionApprovalListProps {
  suggestions: GiftItem[]; // Suggestions are GiftItems with 'pending_suggestion' status
  onDataChange: () => void; // Callback to refresh data in parent
}

export default function AdminSuggestionApprovalList({ suggestions, onDataChange }: AdminSuggestionApprovalListProps) {
  const { toast } = useToast();

  const handleApprove = async (suggestionId: string, suggestionName: string) => {
    try {
      await approveSuggestion(suggestionId);
      toast({ title: "Sucesso!", description: `Sugestão "${suggestionName}" aprovada e adicionada à lista.` });
      onDataChange(); // Refresh parent data
    } catch (error) {
      console.error("Error approving suggestion:", error);
      toast({ title: "Erro!", description: `Falha ao aprovar a sugestão "${suggestionName}".`, variant: "destructive" });
    }
  };

  const handleReject = async (suggestionId: string, suggestionName: string) => {
     if (confirm(`Tem certeza que deseja rejeitar a sugestão "${suggestionName}"? Ela será removida permanentemente.`)) {
         try {
             await rejectSuggestion(suggestionId);
             toast({ title: "Sucesso!", description: `Sugestão "${suggestionName}" rejeitada.` });
             onDataChange(); // Refresh parent data
         } catch (error) {
             console.error("Error rejecting suggestion:", error);
             toast({ title: "Erro!", description: `Falha ao rejeitar a sugestão "${suggestionName}".`, variant: "destructive" });
         }
     }
  };

  return (
    <div className="space-y-4">
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma sugestão pendente.</p>
      ) : (
        suggestions.map((suggestion) => (
          <Card key={suggestion.id} className="bg-muted/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-600" /> {suggestion.name}
               </CardTitle>
              {suggestion.description && (
                <CardDescription className="text-xs">{suggestion.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground pb-3">
               <div className="flex items-center gap-1">
                   <User className="h-3 w-3"/> Sugerido por: {suggestion.suggestedBy || 'Anônimo'}
               </div>
               {suggestion.suggestionDate && (
                    <div className="text-xs text-muted-foreground/80">
                         Em: {new Date(suggestion.suggestionDate).toLocaleDateString('pt-BR')}
                    </div>
               )}
            </CardContent>
            <CardFooter className="flex justify-end gap-2 border-t pt-3 pb-3">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => handleReject(suggestion.id, suggestion.name)}
                 className="border-destructive text-destructive hover:bg-destructive/10"
               >
                 <XCircle className="mr-1 h-4 w-4" /> Rejeitar
               </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleApprove(suggestion.id, suggestion.name)}
                className="border-success text-success-foreground hover:bg-success/10"
              >
                <CheckCircle2 className="mr-1 h-4 w-4" /> Aprovar
              </Button>
            </CardFooter>
          </Card>
        ))
      )}
    </div>
  );
}
