
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Gift,
  Users,
  Settings,
  FileDown,
  Loader2,
  LogOut,
  Home,
  AlertTriangle, // Import AlertTriangle
  Frown, // Import Frown icon for 404
  ClipboardList, // Icon for Confirmations list
} from "lucide-react";
import {
  getGifts,
  getEventSettings,
  exportGiftsToCSV,
  getConfirmations,
  type GiftItem,
  type EventSettings,
  type Confirmation,
} from "@/data/gift-store"; // Ensure correct path
import AdminItemManagementTable from "@/components/admin/item-management-table";
import AdminSelectionViewer from "@/components/admin/selection-viewer";
import AdminEventSettingsForm from "@/components/admin/event-settings-form";
import AdminConfirmationsList from "@/components/admin/confirmations-list"; // Import new component
import useAuth from "@/hooks/useAuth"; // Import useAuth hook
import { ThemeToggle } from "@/components/theme-toggle"; // Import ThemeToggle
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { useRouter } from 'next/navigation'; // Import useRouter

export default function AdminPage() {
  const [gifts, setGifts] = useState<GiftItem[]>([]); // State for gifts
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]); // State for confirmations
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(
    null,
  );
  const [isDataLoading, setIsDataLoading] = useState(true); // Separate loading state for page data
  const [error, setError] = useState<string | null>(null); // State for page data errors
  const router = useRouter(); // Initialize router

  // Use the custom hook for authentication
  const { user, loading: authLoading, error: authError, logout } = useAuth();

  // Combine loading states: page is loading if auth is checking OR if data is fetching AFTER auth is confirmed
  const isLoading = authLoading || (user && isDataLoading);

  // Fetch data function using useCallback for stability
  const refreshData = useCallback(async (source?: string) => {
    console.log(`AdminPage: Refresh data triggered by ${source || "initial load"}`);
    setIsDataLoading(true);
    setError(null); // Clear previous errors

    try {
      // Only fetch data if the user is authenticated
      if (user) {
          console.log("AdminPage: User authenticated. Calling getGifts, getEventSettings, and getConfirmations...");
          // Fetch gifts, settings, AND confirmations in parallel
          const giftsPromise = getGifts();
          const settingsPromise = getEventSettings();
          const confirmationsPromise = getConfirmations(); // Fetch confirmations

          const [giftsData, settingsData, confirmationsData] = await Promise.all([
            giftsPromise,
            settingsPromise,
            confirmationsPromise, // Await confirmations
          ]);

          console.log(`AdminPage: Fetched ${giftsData?.length ?? 0} gifts.`);
          console.log("AdminPage: Fetched Event Settings:", settingsData ? "Data received" : "Null/Undefined");
          console.log(`AdminPage: Fetched ${confirmationsData?.length ?? 0} confirmations.`); // Log confirmations count
          // Log raw gifts data immediately after fetch
           console.log("AdminPage: Raw Gifts Data from getGifts:", giftsData ? giftsData.length : 'null');

          // Update state with fetched data, handling potential null/undefined
          // Log details of the first few gifts to verify data structure before setting state
          console.log("AdminPage: Sample gifts being set to state:", JSON.stringify(giftsData?.slice(0, 5), null, 2));
          setGifts(giftsData || []); // Set empty array if null/undefined
          setConfirmations(confirmationsData || []); // Set confirmations data
          setEventSettings(settingsData); // Set directly (can be null)

      } else {
          console.log("AdminPage: Skipping data fetch, user not authenticated.");
          // Clear data if user becomes unauthenticated during refresh
          setGifts([]);
          setConfirmations([]); // Clear confirmations
          setEventSettings(null);
      }
    } catch (err: any) {
      console.error("AdminPage: Error fetching data:", err);
      setError(`Erro ao carregar dados: ${err.message || "Erro desconhecido"}`);
       // Clear data on error
       setGifts([]);
       setConfirmations([]); // Clear confirmations on error
       setEventSettings(null);
    } finally {
      setIsDataLoading(false);
        console.log("AdminPage: Data fetching complete, loading set to false.");
    }
  // Dependency: user object. Refetch if user changes.
  }, [user]);

  // Fetch data on mount and when authentication status changes (user object changes)
  useEffect(() => {
    // Only trigger refreshData if user is definitively authenticated (not null)
    // and auth is no longer loading.
    if (user && !authLoading) {
      console.log("AdminPage: User authenticated, fetching data via useEffect.");
      refreshData("useEffect[user, authLoading]");
    } else if (!authLoading && !user) {
      console.log("AdminPage: User not authenticated or auth check complete. Clearing data.");
      // Clear data and loading state if user is not logged in after auth check
      setGifts([]);
      setConfirmations([]); // Clear confirmations
      setEventSettings(null);
      setIsDataLoading(false); // Ensure data loading stops if user isn't logged in
      setError(null); // Clear any previous data errors
    }
    // Dependency array includes user and authLoading to refetch when auth state is confirmed
  }, [user, authLoading, refreshData]);


  // Handle CSV Export
  const handleExport = async () => {
     if (isDataLoading || gifts.length === 0) return; // Prevent export if loading or no data
    console.log("AdminPage: Exporting CSV...");
    try {
      const csvData = await exportGiftsToCSV();
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `lista_presentes_${new Date().toISOString().split("T")[0]}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log("AdminPage: CSV downloaded successfully.");
    } catch (error) {
      console.error("AdminPage: Error exporting CSV:", error);
      setError("Erro ao gerar o arquivo CSV."); // Show error to user
    }
  };


  // Show initial loading state while authenticating
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">
          Verificando acesso...
        </p>
        {/* Optional: Skeleton loading for the layout */}
        <div className="mt-8 w-full max-w-4xl space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  // Handle Authentication Error or Unauthenticated User (after auth check)
  // Display a 404-like message instead of "Access Denied"
  if (authError || !user) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background">
            <Frown className="h-16 w-16 text-muted-foreground mb-4" />
            <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
            <p className="text-xl text-muted-foreground mb-6">
                Esta página não pôde ser encontrada.
            </p>
            {authError && ( // Optionally log the auth error internally but don't show it to the user
                <p className="text-xs text-destructive/70 mb-4">(Erro de autenticação: {authError})</p>
            )}
            <Link href="/admin/login">
                 <Button variant="default">Ir para Login</Button>
            </Link>
            <Link href="/">
                <Button variant="outline" className="mt-2">Voltar para a Página Inicial</Button>
            </Link>
        </div>
    );
}


  // Show data loading state *after* authentication is confirmed
  if (isLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">
          Carregando dados do painel...
        </p>
        {/* Skeleton loading for the layout */}
        <div className="mt-8 w-full max-w-4xl space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
     )
  }


  // Handle Data Loading Error after authentication
  if (error && !isDataLoading) { // Show error only if data loading finished with an error
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2 text-foreground">Erro ao Carregar Dados</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => refreshData("retry button")} variant="outline">
          Tentar Novamente
        </Button>
         <Link href="/" className="mt-4">
           <Button variant="link">Voltar para a Página Inicial</Button>
         </Link>
      </div>
    );
  }

  // Render the admin dashboard if authenticated and data loaded
  console.log(`AdminPage: Rendering dashboard. Passing ${gifts.length} gifts.`);
  console.log(`AdminPage: Rendering dashboard. Passing ${confirmations.length} confirmations.`); // Log confirmations count before render

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 bg-background text-foreground">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-3xl font-semibold">Painel de Administração</h1>
        <div className="flex items-center gap-2">
           <ThemeToggle />
           <Link href="/">
            <Button variant="outline" size="sm" title="Voltar para a Página Inicial">
              <Home className="h-4 w-4 mr-1" /> {/* Added mr-1 */}
              Início
            </Button>
          </Link>
          <Button onClick={logout} variant="outline" size="sm" title="Sair">
            <LogOut className="h-4 w-4 mr-1" /> {/* Added mr-1 */}
             Sair
          </Button>
        </div>
      </div>

      {/* Main content grid - Responsive: 1 column default, 2 columns on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">

        {/* Column 1: Item Management - Takes full width on smaller screens */}
        <Card className="lg:col-span-1 bg-card shadow-sm"> {/* Occupies one column on large screens */}
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift /> Gerenciar Itens da Lista
            </CardTitle>
            <CardDescription>
              Adicione, edite, remova ou altere o status dos itens.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <AdminItemManagementTable
              key={`item-table-${gifts.length}-${gifts[0]?.id || 'no-items'}`}
              gifts={gifts} // Pass the fetched gifts
              onDataChange={() => refreshData("item table change")} // More specific source
            />
          </CardContent>
        </Card>

        {/* Column 2: Contains Settings, Selections, Confirmations, Export */}
        <div className="lg:col-span-1 space-y-6"> {/* Occupies one column on large screens */}

          {/* Event Settings Card */}
           <Card className="bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings /> Configurações do Evento
              </CardTitle>
              <CardDescription>
                Atualizar detalhes do evento e mensagens personalizadas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminEventSettingsForm
                key={user ? `admin-settings-${eventSettings?.title || 'loading'}` : "no-settings"}
                initialSettings={eventSettings}
                onSave={() => refreshData("event settings save")} // More specific source
                isLoading={isDataLoading}
              />
            </CardContent>
          </Card>

          {/* Selection Viewer Card */}
          <Card className="bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users /> Visualizar Seleções de Presentes
              </CardTitle>
              <CardDescription>
                Ver quem selecionou quais itens e reverter seleções.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminSelectionViewer
                key={`selection-viewer-${gifts.filter(g => g && g.status === 'selected').length}`}
                selectedItems={gifts.filter(g => g && g.status === 'selected')}
                onDataChange={() => refreshData("selection viewer change")} // More specific source
              />
            </CardContent>
          </Card>

          {/* Confirmations List Card */}
          <Card className="bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList /> Lista de Presença Confirmada
              </CardTitle>
              <CardDescription>
                Veja quem confirmou presença no evento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminConfirmationsList
                confirmations={confirmations} // Pass the fetched confirmations
              />
            </CardContent>
          </Card>

          {/* Export Card */}
          <Card className="bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileDown /> Exportar Seleções de Presentes
              </CardTitle>
              <CardDescription>
                Baixar a lista completa de itens e status em formato CSV.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleExport}
                className="mt-4"
                disabled={isDataLoading || !gifts || gifts.length === 0} // Disable if data is loading or no gifts
              >
                Exportar CSV
              </Button>
            </CardContent>
          </Card>

        </div> {/* End of Column 2 */}
      </div> {/* End of main grid */}
    </div>
  );
}

    