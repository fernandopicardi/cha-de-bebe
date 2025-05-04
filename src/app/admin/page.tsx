// **SECURITY WARNING:** This login system is highly insecure and uses hardcoded credentials.
// It is **NOT SUITABLE** for production environments.
// Replace with a proper authentication provider (e.g., Firebase Authentication) before deployment.
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import { ShieldCheck, ListPlus, CheckSquare, Users, FileDown, Settings, LogOut, AlertCircle } from 'lucide-react';

// Hardcoded allowed admin emails and password (INSECURE!)
const ALLOWED_EMAILS = ['fernandopicardi@gmail.com', 'naiaralofgren@gmail.com'];
const ADMIN_PASSWORD = 'Safiras7!'; // Extremely insecure

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    // Simulate network delay/processing
    setTimeout(() => {
      if (ALLOWED_EMAILS.includes(email) && password === ADMIN_PASSWORD) {
        setIsAuthenticated(true);
      } else {
        setError('E-mail ou senha inválidos.');
      }
      setLoading(false);
      // Clear password field after attempt
      setPassword('');
    }, 500);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setEmail('');
    setPassword('');
    setError(null);
  };

  const handleExport = () => {
    console.log("Export clicked");
    // TODO: Implement CSV export logic using Firestore data
    alert("Funcionalidade de exportação ainda não implementada.");
  };

  // Login Form Component
   const AdminLogin = () => (
      <Card className="w-full max-w-md mx-auto animate-fade-in">
        <CardHeader>
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>Acesse o painel de administração.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
             {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erro de Login</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
           <p className="mt-4 text-xs text-center text-muted-foreground">
             Use as credenciais fornecidas para acesso.
           </p>
        </CardContent>
      </Card>
  );

  // Render Login Form if not authenticated
  if (!isAuthenticated) {
     return (
       <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-screen bg-gradient-to-br from-background to-muted/30">
         <AdminLogin />
       </div>
     );
  }

  // Render Admin Dashboard if authenticated
  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-semibold flex items-center gap-2">
          <ShieldCheck className="h-8 w-8 text-primary" /> Painel de Administração
        </h1>
        <Button onClick={handleLogout} variant="outline">
          <LogOut className="mr-2 h-4 w-4"/> Sair
        </Button>
      </header>

        {/* SECURITY WARNING DISPLAYED TO LOGGED-IN ADMIN */}
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Aviso de Segurança</AlertTitle>
            <AlertDescription>
              Este painel está usando um método de login inseguro (senha fixa). Substitua por Firebase Authentication ou outro método seguro antes de usar em produção.
            </AlertDescription>
        </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Item Management Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListPlus /> Gerenciar Itens</CardTitle>
            <CardDescription>Adicionar, editar, remover e atualizar status dos presentes.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* TODO: Placeholder for ItemManagementTable component */}
            {/* Replace this p tag with the actual ItemManagementTable component when implemented */}
            <p className="text-muted-foreground">[Tabela de Gerenciamento de Itens aqui]</p>
             <Button className="mt-4">Gerenciar</Button> {/* This button might trigger a modal or navigate */}
          </CardContent>
        </Card>

        {/* Suggestion Approval Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckSquare /> Aprovar Sugestões</CardTitle>
            <CardDescription>Aprovar ou rejeitar itens sugeridos pelos convidados.</CardDescription>
          </CardHeader>
          <CardContent>
             {/* TODO: Placeholder for SuggestionApprovalList component */}
             {/* Replace this p tag with the actual SuggestionApprovalList component */}
            <p className="text-muted-foreground">[Lista de Sugestões Pendentes aqui]</p>
             <Button className="mt-4">Ver Sugestões</Button>
          </CardContent>
        </Card>

        {/* View/Revert Selections Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users /> Visualizar Seleções</CardTitle>
            <CardDescription>Ver quem selecionou quais itens e reverter seleções se necessário.</CardDescription>
          </CardHeader>
          <CardContent>
             {/* TODO: Placeholder for SelectionViewer component */}
             {/* Replace this p tag with the actual SelectionViewer component */}
            <p className="text-muted-foreground">[Visualizador de Seleções aqui]</p>
             <Button className="mt-4">Ver Seleções</Button>
          </CardContent>
        </Card>

         {/* Event Details & Messages Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings /> Configurações do Evento</CardTitle>
            <CardDescription>Atualizar detalhes do evento e mensagens personalizadas.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* TODO: Placeholder for EventSettingsForm component */}
            {/* Replace this p tag with the actual EventSettingsForm component */}
            <p className="text-muted-foreground">[Formulário de Configurações aqui]</p>
             <Button className="mt-4">Editar Detalhes</Button>
          </CardContent>
        </Card>

         {/* Export Selections Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileDown /> Exportar Seleções</CardTitle>
            <CardDescription>Baixar a lista de itens selecionados e quem os selecionou em formato CSV.</CardDescription>
          </CardHeader>
          <CardContent>
             <Button onClick={handleExport} className="mt-4">Exportar CSV</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
