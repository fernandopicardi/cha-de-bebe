'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Gift,
  Users,
  Settings,
  FileDown,
  Loader2,
  LogOut,
  Home,
  AlertTriangle,
  Frown,
  ClipboardList,
  UserCheck,
} from 'lucide-react';
import {
  getGifts,
  getEventSettings,
  exportGiftsToCSV,
  exportConfirmationsToCSV,
  getConfirmations,
  type GiftItem,
  type EventSettings,
  type Confirmation,
} from '@/data/gift-store'; // Ensure correct path
import AdminItemManagementTable from '@/components/admin/item-management-table';
import AdminSelectionViewer from '@/components/admin/selection-viewer';
import AdminEventSettingsForm from '@/components/admin/event-settings-form';
import AdminConfirmationsList from '@/components/admin/confirmations-list';
import useAuth from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/theme-toggle';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(
    null
  );
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const { user, loading: authLoading, error: authError, logout } = useAuth();

  const isLoading = authLoading || (user && isDataLoading);

  const refreshData = useCallback(
    async (source?: string) => {
      console.log(`AdminPage: refreshData triggered by ${source || 'initial load or manual refresh'}`);
      setIsDataLoading(true);
      setError(null);

      try {
        if (user) {
          console.log(
            'AdminPage: User authenticated. Fetching data (gifts, settings, confirmations)...'
          );
          const [giftsData, settingsData, confirmationsData] =
            await Promise.all([
              getGifts(),
              getEventSettings(),
              getConfirmations(),
            ]);

          console.log(`AdminPage: Fetched ${giftsData?.length ?? 0} gifts.`);
          console.log('AdminPage: Fetched Event Settings:', settingsData ? 'Data received' : 'Null/Undefined');
          console.log(`AdminPage: Fetched ${confirmationsData?.length ?? 0} confirmations.`);
          // console.log('AdminPage: Raw Gifts Data for debugging:', JSON.stringify(giftsData, null, 2));


          setGifts(giftsData || []);
          setConfirmations(confirmationsData || []);
          setEventSettings(settingsData);
        } else {
          console.log(
            'AdminPage: Skipping data fetch, user not authenticated.'
          );
          setGifts([]);
          setConfirmations([]);
          setEventSettings(null);
        }
      } catch (err: any) {
        console.error('AdminPage: Error fetching data:', err);
        setError(
          `Erro ao carregar dados: ${err.message || 'Erro desconhecido'}`
        );
        setGifts([]);
        setConfirmations([]);
        setEventSettings(null);
      } finally {
        setIsDataLoading(false);
        console.log('AdminPage: Data fetching complete.');
      }
    },
    [user]
  );

  useEffect(() => {
    if (user && !authLoading) {
      console.log(
        'AdminPage: User authenticated and auth check complete, initiating data fetch via useEffect.'
      );
      refreshData('useEffect[user, authLoading]');
    } else if (!authLoading && !user) {
      console.log(
        'AdminPage: Auth check complete, user not authenticated. Clearing data.'
      );
      setGifts([]);
      setConfirmations([]);
      setEventSettings(null);
      setIsDataLoading(false);
      setError(null);
    }
     // Add refreshData to dependency array if its definition might change, though useCallback should stabilize it.
  }, [user, authLoading, refreshData]);

  const triggerDownload = (csvData: string, baseFilename: string) => {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${baseFilename}_${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGiftExport = async () => {
    if (isDataLoading || gifts.length === 0) return;
    console.log('AdminPage: Exporting Gifts CSV...');
    try {
      const csvData = await exportGiftsToCSV();
      triggerDownload(csvData, 'lista_presentes');
      console.log('AdminPage: Gifts CSV downloaded successfully.');
    } catch (error) {
      console.error('AdminPage: Error exporting gifts CSV:', error);
      setError('Erro ao gerar o arquivo CSV de presentes.');
    }
  };

  const handleConfirmationExport = async () => {
    if (isDataLoading || confirmations.length === 0) return;
    console.log('AdminPage: Exporting Confirmations CSV...');
    try {
      const csvData = await exportConfirmationsToCSV();
      triggerDownload(csvData, 'lista_presenca');
      console.log('AdminPage: Confirmations CSV downloaded successfully.');
    } catch (error) {
      console.error('AdminPage: Error exporting confirmations CSV:', error);
      setError('Erro ao gerar o arquivo CSV de presença.');
    }
  };

  if (authLoading) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen p-4 text-center bg-background'>
        <Loader2 className='h-12 w-12 animate-spin text-primary mb-4' />
        <p className='text-lg text-muted-foreground'>Verificando acesso...</p>
        <div className='mt-8 w-full max-w-4xl space-y-6'>
          <Skeleton className='h-48 w-full' />
          <Skeleton className='h-64 w-full' />
          <Skeleton className='h-32 w-full' />
        </div>
      </div>
    );
  }

  if (authError || !user) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background'>
        <Frown className='h-16 w-16 text-muted-foreground mb-4' />
        <h1 className='text-4xl font-bold text-foreground mb-2'>404</h1>
        <p className='text-xl text-muted-foreground mb-6'>
          Esta página não pôde ser encontrada.
        </p>
        {authError && console.error('Auth Error:', authError)}
        <Link href='/admin/login'>
          <Button variant='default'>Ir para Login</Button>
        </Link>
        <Link href='/'>
          <Button variant='outline' className='mt-2'>
            Voltar para a Página Inicial
          </Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen p-4 text-center bg-background'>
        <Loader2 className='h-12 w-12 animate-spin text-primary mb-4' />
        <p className='text-lg text-muted-foreground'>
          Carregando dados do painel...
        </p>
        <div className='mt-8 w-full max-w-4xl space-y-6'>
          <Skeleton className='h-48 w-full' />
          <Skeleton className='h-64 w-full' />
          <Skeleton className='h-32 w-full' />
        </div>
      </div>
    );
  }

  if (error && !isDataLoading) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background'>
        <AlertTriangle className='h-12 w-12 text-destructive mb-4' />
        <h1 className='text-2xl font-semibold mb-2 text-foreground'>
          Erro ao Carregar Dados
        </h1>
        <p className='text-muted-foreground mb-6'>{error}</p>
        <Button onClick={() => refreshData('retry button')} variant='outline'>
          Tentar Novamente
        </Button>
        <Link href='/' className='mt-4'>
          <Button variant='link'>Voltar para a Página Inicial</Button>
        </Link>
      </div>
    );
  }

  console.log(
    `AdminPage: Rendering dashboard. Passing ${gifts.length} gifts to AdminItemManagementTable.`
  );
   console.log(
    `AdminPage: Rendering dashboard. Passing ${confirmations.length} confirmations to AdminConfirmationsList.`
  );


  return (
    <div className='container mx-auto p-4 md:p-8 space-y-8 bg-background text-foreground'>
      <div className='flex flex-wrap justify-between items-center gap-4'>
        <h1 className='text-3xl font-semibold'>Painel de Administração</h1>
        <div className='flex items-center gap-2'>
          <ThemeToggle />
          <Link href='/'>
            <Button
              variant='outline'
              size='sm'
              title='Voltar para a Página Inicial'
            >
              <Home className='h-4 w-4 mr-1' />
              Início
            </Button>
          </Link>
          <Button onClick={logout} variant='outline' size='sm' title='Sair'>
            <LogOut className='h-4 w-4 mr-1' />
            Sair
          </Button>
        </div>
      </div>
      <div className='space-y-6 lg:space-y-8 max-w-4xl mx-auto'>
        <Card className='bg-card shadow-sm'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Settings /> Configurações do Evento
            </CardTitle>
            <CardDescription>
              Atualizar detalhes do evento e mensagens personalizadas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminEventSettingsForm
              key={
                user
                  ? `admin-settings-${eventSettings?.title || 'loading'}`
                  : 'no-settings'
              }
              initialSettings={eventSettings}
              onSave={() => refreshData('event settings save')}
              isLoading={isDataLoading}
            />
          </CardContent>
        </Card>
        <Card className='bg-card shadow-sm'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <ClipboardList /> Lista de Presença Confirmada
            </CardTitle>
            <CardDescription>
              Veja quem confirmou presença no evento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminConfirmationsList
              confirmations={confirmations}
            />
          </CardContent>
        </Card>
        <Card className='bg-card shadow-sm'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Users /> Visualizar Seleções de Presentes
            </CardTitle>
            <CardDescription>
              Ver quem selecionou quais itens e reverter seleções.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminSelectionViewer
              key={`selection-viewer-${gifts.filter((g) => g && g.status === 'selected').length}`}
              selectedItems={gifts.filter(
                (g) =>
                  (g && g.status === 'selected') ||
                  (typeof g.selectedQuantity === 'number' &&
                    g.selectedQuantity > 0)
              )}
              onDataChange={() => refreshData('selection viewer change')}
            />
          </CardContent>
        </Card>
        <Card className='bg-card shadow-sm'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Gift /> Gerenciar Itens da Lista
            </CardTitle>
            <CardDescription>
              Adicione, edite, remova ou altere o status dos itens.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminItemManagementTable
              key={`item-table-${gifts.length}`} // Simplified key
              gifts={gifts} // Pass the fetched gifts
              onDataChange={() => refreshData('item table change')} // Pass stable refresh callback
            />
          </CardContent>
        </Card>
        <Card className='bg-card shadow-sm'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <FileDown /> Exportar Dados
            </CardTitle>
            <CardDescription>Baixar listas em formato CSV.</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-4'>
            <Button
              onClick={handleGiftExport}
              className='mt-4'
              disabled={isDataLoading || !gifts || gifts.length === 0}
            >
              <Gift className='mr-2 h-4 w-4' /> Exportar Presentes (CSV)
            </Button>
            <Button
              onClick={handleConfirmationExport}
              className='mt-4'
              variant='outline'
              disabled={
                isDataLoading || !confirmations || confirmations.length === 0
              }
            >
              <UserCheck className='mr-2 h-4 w-4' /> Exportar Presença (CSV)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
