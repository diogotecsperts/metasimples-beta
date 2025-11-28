const Gerente = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold">Gerente - Meta Simples</h1>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Área do Gerente</h2>
          <p className="text-muted-foreground">
            Estrutura preparada para funcionalidades de gerenciamento
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-32 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-card flex items-center justify-center"
            >
              <span className="text-sm text-muted-foreground">
                Card funcional {item}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Gerente;
