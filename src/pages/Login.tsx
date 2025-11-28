const Login = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-md">
        <div className="rounded-lg border bg-card p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-foreground">Meta Simples</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sistema de gestão empresarial
            </p>
          </div>
          
          {/* Estrutura preparada para formulário de login */}
          <div className="space-y-4">
            <div className="h-20 rounded border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Campo de e-mail</span>
            </div>
            <div className="h-20 rounded border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Campo de senha</span>
            </div>
            <div className="h-10 rounded border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Botão de login</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
