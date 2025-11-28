import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const Bootstrap = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [canShowForm, setCanShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");

  useEffect(() => {
    checkIfAdminExists();
  }, []);

  const checkIfAdminExists = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-admin-exists');
      
      if (error) {
        console.error('Error checking admin:', error);
        // Redirecionar para login em caso de erro (fail-safe)
        navigate('/login');
        return;
      }

      if (data.adminExists) {
        // Admin already exists, redirect to login
        navigate('/login');
      } else {
        // Não existe admin, pode mostrar o formulário
        setCanShowForm(true);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      // Redirecionar para login em caso de erro inesperado
      navigate('/login');
    } finally {
      setIsCheckingAdmin(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-first-admin', {
        body: { email, password, nome },
      });

      if (error) {
        toast({
          title: "Erro ao criar administrador",
          description: error.message || "Tente novamente mais tarde",
          variant: "destructive",
        });
        return;
      }

      if (data.error) {
        toast({
          title: "Erro ao criar administrador",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Administrador criado",
        description: "Agora você pode fazer login com suas credenciais",
      });

      // Redirect to login
      navigate('/login');
    } catch (error) {
      toast({
        title: "Erro inesperado",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAdmin || !canShowForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Verificando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md shadow-lg">
        <div className="rounded-xl border bg-card p-8">
          <div className="mb-6 text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
              <div className="text-3xl font-bold text-primary">MS</div>
            </div>
            <h1 className="text-3xl font-bold">Primeiro Acesso</h1>
            <p className="text-base text-muted-foreground">
              Configure o primeiro administrador do sistema
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                type="text"
                placeholder="Seu nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                disabled={isLoading}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Criando..." : "Criar Administrador"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Bootstrap;
