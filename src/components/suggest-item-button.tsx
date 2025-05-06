'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import SuggestItemDialog from './suggest-item-dialog'; // Import the new dialog component

interface SuggestItemButtonProps {
  onSuggestionAdded?: () => void; // Callback to notify parent (passed down to dialog)
}

export default function SuggestItemButton({
  onSuggestionAdded,
}: SuggestItemButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const handleSuccess = () => {
    // Close dialog is handled inside SuggestItemDialog on success
    onSuggestionAdded?.(); // Notify parent to refresh data
  };

  return (
    <>
      <Button
        variant='outline'
        className='border-accent text-accent-foreground hover:bg-accent/10'
        onClick={handleOpenDialog}
      >
        <PlusCircle className='mr-2 h-4 w-4' /> Adicionar um Item
      </Button>

      <SuggestItemDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSuccess={handleSuccess}
      />
    </>
  );
}
