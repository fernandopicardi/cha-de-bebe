
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
} from "lucide-react";
import {
  getGifts, // Import getGifts
  getEventSettings,
  exportGiftsToCSV,
  type GiftItem,
  type EventSettings,
} from "@/data/gift-store"; // Updated import path
import AdminItemManagementTable from "@/components/admin/item-management-table";
import AdminSelectionViewer from "@/components/admin/selection-viewer";
import AdminEventSettingsForm from "@/components/admin/event-settings-form";
import useAuth from "@/hooks/useAuth"; // Import useAuth hook
import { ThemeToggle } from "@/components/theme-toggle"; // Import ThemeToggle
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { useRouter } from 'next/navigation'; // Import useRouter

export default function AdminPage() {
  const [gifts, setGifts] = useState<GiftItem[]>([]); // State for gifts
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
          // Fetch gifts AND settings in parallel
          const giftsPromise = getGifts();
          const settingsPromise = getEventSettings();

          const [giftsData, settingsData] = await Promise.all([
            giftsPromise,
            settingsPromise,
          ]);

          console.log(`AdminPage: Fetched ${giftsData?.length ?? 0} gifts.`); // Use optional chaining
          console.log("AdminPage: Fetched Event Settings:", !!settingsData);

          // Update state with fetched data, handling potential null/undefined
          // Log details of the first few gifts to verify data structure
          console.log("AdminPage: Sample gifts being set to state:", giftsData?.slice(0, 5));
          setGifts(giftsData || []); // Set empty array if null/undefined
          setEventSettings(settingsData); // Set directly (can be null)

      } else {
          console.log("AdminPage: Skipping data fetch, user not authenticated.");
          // Clear data if user becomes unauthenticated during refresh
          setGifts([]);
          setEventSettings(null);
      }
    } catch (err: any) {
      console.error("AdminPage: Error fetching data:", err);
      setError(`Erro ao carregar dados: ${err.message || "Erro desconhecido"}`);
       // Clear data on error
       setGifts([]);
       setEventSettings(null);
    } finally {
      setIsDataLoading(false);
        console.log("AdminPage: Data fetching complete.");
    }
  // Dependency: user object. Refetch if user changes.
  }, [user]);

  // Fetch data on mount and when authentication status changes (user object changes)
  useEffect(() => {
    // Only trigger refreshData if user is definitively authenticated (not null)
    // and auth is no longer loading.
    if (user && !authLoading) {
      console.log("AdminPage: User authenticated, fetching data.");
      refreshData("useEffect[user, authLoading]");
    } else if (!authLoading && !user) {
      console.log("AdminPage: User not authenticated or auth check complete.");
      // Clear data and loading state if user is not logged in after auth check
      setGifts([]);
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
  // Add log just before render to check final state
  console.log(`AdminPage: Rendering with ${gifts.length} gifts in state.`);

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

      {/* Main content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column (Item Management) */}
        <Card className="md:col-span-2 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift /> Gerenciar Itens da Lista
            </CardTitle>
            <CardDescription>
              Adicione, edite, remova ou altere o status dos itens.
            </CardDescription>
          </CardHeader>
          <CardContent>
             {/* Pass gifts and refresh callback */}
            <AdminItemManagementTable
              gifts={gifts} // Pass the fetched gifts
              onDataChange={refreshData} // Pass stable refresh callback
            />
          </CardContent>
        </Card>

        {/* Right Column (Selections, Settings, Export) */}
        <div className="space-y-6">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users /> Visualizar Seleções
              </CardTitle>
              <CardDescription>
                Ver quem selecionou quais itens e reverter seleções se
                necessário.
              </CardDescription>
            </CardHeader>
            <CardContent>
               {/* Filter gifts before passing */}
               {/* Ensure selectedItems are passed correctly here */}
              <AdminSelectionViewer
                selectedItems={gifts.filter(g => g && g.status === 'selected')}
                onDataChange={refreshData} // Pass stable refresh callback
              />
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings /> Configurações do Evento
              </CardTitle>
              <CardDescription>
                Atualizar detalhes do evento e mensagens personalizadas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Pass settings if available and stable refresh callback */}
              {/* Pass isLoading to show a loader within the form itself */}
              <AdminEventSettingsForm
                key={user ? `admin-settings-${eventSettings?.title || 'loading'}` : "no-settings"} // Use user existence and maybe settings key for re-render
                initialSettings={eventSettings} // Pass fetched settings
                onSave={refreshData} // Pass refresh callback
                isLoading={isDataLoading} // Pass loading state for internal loader
              />
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileDown /> Exportar Seleções
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
        </div>
      </div>
    </div>
  );
}
