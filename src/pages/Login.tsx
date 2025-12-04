import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { Code } from "lucide-react";
const Login = () => {
  const navigate = useNavigate();
  const {
    user,
    role
  } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [identifier, setIdentifier] = useState(""); // Can be email or username
  const [password, setPassword] = useState("");
  useEffect(() => {
    // Redirect if already logged in
    if (user && role) {
      if (role === "admin") {
        navigate("/admin");
      } else if (role === "gerente") {
        navigate("/gerente");
      }
    }
  }, [user, role, navigate]);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      let emailToUse = identifier;

      // If identifier doesn't look like an email, try to find email by username
      if (!identifier.includes('@')) {
        const {
          data: emailData,
          error: emailError
        } = await supabase.functions.invoke('get-email-by-username', {
          body: {
            username: identifier
          }
        });
        if (emailError || !emailData?.found || !emailData?.email) {
          toast({
            title: "Usuário não encontrado",
            description: "Verifique o ID de acesso informado",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
        emailToUse = emailData.email;
      }
      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password
      });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Erro ao fazer login",
            description: "Email ou senha incorretos",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Erro ao fazer login",
            description: error.message,
            variant: "destructive"
          });
        }
        return;
      }

      // Fetch user role to redirect appropriately
      const {
        data: roleData
      } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle();
      toast({
        title: "Login realizado",
        description: "Bem-vindo de volta!"
      });

      // Redirect based on role
      if (roleData?.role === "admin") {
        navigate("/admin");
      } else if (roleData?.role === "gerente") {
        navigate("/gerente");
      } else {
        // Default redirect if no role found
        navigate("/dashboard");
      }
    } catch (error) {
      toast({
        title: "Erro inesperado",
        description: "Tente novamente mais tarde",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  return <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md shadow-lg">
        <div className="rounded-xl border bg-card p-8">
          <div className="mb-6 text-center space-y-4">
            <img alt="Meta Simples" className="w-full max-w-full h-auto object-contain drop-shadow-md" src="/lovable-uploads/55a6a00a-4734-48a3-8221-c5c663c545fd.png" />
            
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-identifier">Email ou ID de acesso</Label>
              <Input id="login-identifier" type="text" placeholder="Digite seu ID ou email cadastrado" value={identifier} onChange={e => setIdentifier(e.target.value)} required disabled={isLoading} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Senha</Label>
              <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required disabled={isLoading} />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          {/* Aviso de desenvolvimento */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-6 pt-4 border-t border-border/50">
            <Code className="h-3 w-3" />
            <span>Aplicativo em desenvolvimento</span>
          </div>

          {/* Crédito do desenvolvedor */}
          <div className="text-center mt-3">
            <span className="text-[10px] text-primary">
              by{" "}
              <a href="https://tecsperts.com" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground hover:underline transition-colors">
                tecsperts
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>;
};
export default Login;