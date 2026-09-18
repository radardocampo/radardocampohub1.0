import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Radar do Campo" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (!isLoading && session) {
      navigate({ to: "/" });
    }
  }, [session, isLoading, navigate]);

  const handleGoogleLogin = async () => {
    try {
      setIsLoggingIn(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Ocorreu um erro ao tentar fazer login com o Google.");
      setIsLoggingIn(false);
    }
  };

  // Se estiver carregando a sessão inicialmente ou já logado (aguardando redirect), mostramos nada ou loader.
  if (isLoading || session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background"></div>
      
      <div className="z-10 w-full max-w-md space-y-8 rounded-2xl border border-border/50 bg-background/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-lg mb-6">
            <Radar className="size-8" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Radar do Campo</h2>
          <p className="mt-2 text-sm text-muted-foreground font-medium">
            Acesso exclusivo ao Hub de Conteúdo
          </p>
        </div>

        <div className="mt-8">
          <Button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full h-12 text-base font-semibold shadow-md transition-all hover:shadow-lg flex items-center justify-center gap-3 bg-white text-black hover:bg-gray-100 dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            {isLoggingIn ? (
              <div className="size-5 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
            ) : (
              <svg className="size-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            {isLoggingIn ? "Conectando..." : "Entrar com o Google"}
          </Button>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground/80">
          Apenas para usuários autorizados.
        </p>
      </div>
    </div>
  );
}
