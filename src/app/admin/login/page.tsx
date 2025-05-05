
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import useAuth from "@/hooks/useAuth"; // Re-use the existing auth hook
import { Loader2, LogIn, AlertTriangle, Home } from "lucide-react";
import Link from "next/link";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading, loginWithEmail, error: authError } = useAuth(); // Use login function from hook

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      console.log("Admin Login: User already logged in, redirecting to /admin");
      router.replace("/admin");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLocalError(null); // Clear previous local errors

    console.log("Admin Login: Attempting login with email:", email);

    try {
        // Call the login function from the hook
        await loginWithEmail(email, password);
        // Successful login is handled by the useEffect redirecting
        console.log("Admin Login: loginWithEmail successful (redirect handled by effect).");
        toast({
            title: "Login Bem-sucedido!",
            description: "Redirecionando para o painel...",
        });
        // No need to manually redirect here, useEffect handles it based on user state change
    } catch (err: any) {
        console.error("Admin Login: Login failed.", err);
        // Use a more specific error message if available, otherwise generic
        const message = err.code === 'auth/invalid-credential'
            ? "E-mail ou senha inválidos."
            : err.message || "Falha no login. Verifique suas credenciais.";
        setLocalError(message);
        toast({
            title: "Erro no Login",
            description: message,
            variant: "destructive",
        });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading spinner while checking auth state initially
  if (authLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg text-muted-foreground">Verificando sessão...</p>
        </div>
      );
  }

  // If user becomes authenticated after initial check, useEffect will redirect
  // This prevents showing the login form briefly before redirecting
  if (user) {
     return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg text-muted-foreground">Redirecionando...</p>
        </div>
      );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Login Admin</CardTitle>
          <CardDescription>
            Use suas credenciais de administrador para acessar o painel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            {/* Display local or auth errors */}
            {(localError || authError) && (
              <div className="flex items-center p-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md">
                <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>{localError || authError}</span>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...
                </>
              ) : (
                 <>
                    <LogIn className="mr-2 h-4 w-4" /> Entrar
                 </>
              )}
            </Button>
          </form>
        </CardContent>
         <CardFooter className="flex flex-col items-center space-y-2 text-sm">
          <Link href="/" className="hover:underline text-muted-foreground hover:text-primary">
            <Button variant="link" size="sm" className="px-0">
                <Home className="mr-1 h-3 w-3" /> Voltar para a Página Inicial
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
