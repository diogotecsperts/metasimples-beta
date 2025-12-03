import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { MetaDiariaHeader } from "@/components/gerente/MetaDiariaHeader";
import { TimelineSlot } from "@/components/gerente/TimelineSlot";
import { LancamentoDialog } from "@/components/gerente/LancamentoDialog";
import { DiasPendentes } from "@/components/gerente/DiasPendentes";
import { LancamentoRetroativoDialog } from "@/components/gerente/LancamentoRetroativoDialog";
import { SalesEvolutionChart } from "@/components/gerente/SalesEvolutionChart";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { generateSalesReport } from "@/lib/generateSalesReport";
import { registrarAuditLog } from "@/lib/auditLog";

type Loja = {
  id: string;
  nome: string;
  possui_fechamento_tardio: boolean;
  tipo_operacional: "A" | "B";
};

type LancamentoMes = {
  id: string;
  data: string;
  horario: string;
  valor_acumulado: number;
};

type DiaRetroativoState = {
  data: Date;
  lancamentos: LancamentoMes[];
} | null;

type MetaMensal = {
  id: string;
  meta_diaria_calculada: number;
};

type Lancamento = {
  id: string;
  horario: string;
  valor_acumulado: number;
};

const HORARIOS_BASE = ["10:00", "14:00", "16:00", "19:00"];
const HORARIO_TARDIO = "23:00";

const Gerente = () => {
  const [selectedHorario, setSelectedHorario] = useState<string | null>(null);
  const [gerenteLojaId, setGerenteLojaId] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [diaRetroativo, setDiaRetroativo] = useState<DiaRetroativoState>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const hoje = new Date();
  const dataHoje = format(hoje, "yyyy-MM-dd");
  const inicioMes = format(startOfMonth(hoje), "yyyy-MM-dd");
  const fimMes = format(endOfMonth(hoje), "yyyy-MM-dd");

  // Buscar perfil do gerente
  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para acessar esta página.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("loja_id")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Erro ao buscar perfil:", error);
        toast({
          title: "Erro ao carregar perfil",
          description: "Não foi possível carregar suas informações.",
          variant: "destructive",
        });
        return;
      }

      if (!data?.loja_id) {
        toast({
          title: "Loja não vinculada",
          description: "Seu perfil não está vinculado a nenhuma loja. Entre em contato com o administrador.",
          variant: "destructive",
        });
      }

      setGerenteLojaId(data?.loja_id || null);
    };

    fetchProfile();
  }, [toast]);

  // Buscar dados da loja
  const { data: loja } = useQuery({
    queryKey: ["loja", gerenteLojaId],
    queryFn: async () => {
      if (!gerenteLojaId) return null;

      const { data, error } = await supabase
        .from("lojas")
        .select("id, nome, possui_fechamento_tardio, tipo_operacional")
        .eq("id", gerenteLojaId)
        .single();

      if (error) throw error;
      return data as Loja;
    },
    enabled: !!gerenteLojaId,
  });

  // Buscar meta mensal
  const { data: metaMensal } = useQuery({
    queryKey: ["meta-mensal", gerenteLojaId],
    queryFn: async () => {
      if (!gerenteLojaId) return null;

      const hoje = new Date();
      const mes = hoje.getMonth() + 1;
      const ano = hoje.getFullYear();

      const { data, error } = await supabase
        .from("metas_mensais")
        .select("id, meta_diaria_calculada")
        .eq("loja_id", gerenteLojaId)
        .eq("mes", mes)
        .eq("ano", ano)
        .maybeSingle();

      if (error) throw error;
      return data as MetaMensal | null;
    },
    enabled: !!gerenteLojaId,
  });

  // Buscar lançamentos do dia
  const { data: lancamentos = [] } = useQuery({
    queryKey: ["lancamentos", gerenteLojaId, dataHoje],
    queryFn: async () => {
      if (!gerenteLojaId) return [];

      const { data, error } = await supabase
        .from("lancamentos_diarios")
        .select("id, horario, valor_acumulado")
        .eq("loja_id", gerenteLojaId)
        .eq("data", dataHoje);

      if (error) throw error;
      return data as Lancamento[];
    },
    enabled: !!gerenteLojaId,
  });

  // Buscar lançamentos do mês (para calcular dias pendentes)
  const { data: lancamentosMes = [] } = useQuery({
    queryKey: ["lancamentos-mes", gerenteLojaId, inicioMes],
    queryFn: async () => {
      if (!gerenteLojaId) return [];

      const { data, error } = await supabase
        .from("lancamentos_diarios")
        .select("id, data, horario, valor_acumulado")
        .eq("loja_id", gerenteLojaId)
        .gte("data", inicioMes)
        .lte("data", fimMes);

      if (error) throw error;
      return data as LancamentoMes[];
    },
    enabled: !!gerenteLojaId,
  });

  // Mutation para salvar/atualizar lançamento (dia atual)
  const saveLancamentoMutation = useMutation({
    mutationFn: async ({
      horario,
      valor,
    }: {
      horario: string;
      valor: number;
    }) => {
      if (!gerenteLojaId) throw new Error("Loja não identificada");

      const lancamentoExistente = lancamentos.find(
        (l) => l.horario === horario
      );
      const isUpdate = !!lancamentoExistente;

      if (lancamentoExistente) {
        const { error } = await supabase
          .from("lancamentos_diarios")
          .update({ valor_acumulado: valor })
          .eq("id", lancamentoExistente.id);
        if (error) throw error;
        return { isUpdate, lancamentoId: lancamentoExistente.id, horario, valor, dataLanc: dataHoje };
      } else {
        const { data, error } = await supabase.from("lancamentos_diarios").insert([{
          loja_id: gerenteLojaId,
          data: dataHoje,
          horario: horario as "10:00" | "14:00" | "16:00" | "19:00" | "23:00",
          valor_acumulado: valor,
        }]).select().single();
        if (error) throw error;
        return { isUpdate, lancamentoId: data.id, horario, valor, dataLanc: dataHoje };
      }
    },
    onSuccess: async ({ isUpdate, lancamentoId, horario, valor, dataLanc }) => {
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user?.id).single();
      await registrarAuditLog({
        userId: user?.id || "",
        userNome: profile?.nome || "Gerente",
        userRole: "gerente",
        action: isUpdate ? "update" : "create",
        entity: "lancamento",
        entityId: lancamentoId,
        entityName: `${loja?.nome} - ${horario} (${dataLanc})`,
        details: { valor, horario, data: dataLanc },
      });

      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      setSelectedHorario(null);
      toast({
        title: "Lançamento salvo",
        description: "O valor foi registrado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar lançamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para salvar lançamento retroativo (dias anteriores)
  const saveRetroativoMutation = useMutation({
    mutationFn: async ({
      horario,
      valor,
      dataLancamento,
    }: {
      horario: string;
      valor: number;
      dataLancamento: string;
    }) => {
      if (!gerenteLojaId) throw new Error("Loja não identificada");

      const { data, error } = await supabase.from("lancamentos_diarios").insert([{
        loja_id: gerenteLojaId,
        data: dataLancamento,
        horario: horario as "10:00" | "14:00" | "16:00" | "19:00" | "23:00",
        valor_acumulado: valor,
      }]).select().single();
      
      if (error) throw error;
      return { lancamentoId: data.id, horario, valor, dataLancamento };
    },
    onSuccess: async ({ lancamentoId, horario, valor, dataLancamento }) => {
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user?.id).single();
      await registrarAuditLog({
        userId: user?.id || "",
        userNome: profile?.nome || "Gerente",
        userRole: "gerente",
        action: "create",
        entity: "lancamento",
        entityId: lancamentoId,
        entityName: `${loja?.nome} - ${horario} (${dataLancamento})`,
        details: { valor, horario, data: dataLancamento, retroativo: true },
      });

      // Invalidar queries para atualizar a lista de dias pendentes
      queryClient.invalidateQueries({ queryKey: ["lancamentos-mes"] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      
      // Atualizar o estado local do dialog retroativo
      if (diaRetroativo) {
        const novoLancamento: LancamentoMes = {
          id: lancamentoId,
          data: dataLancamento,
          horario,
          valor_acumulado: valor,
        };
        setDiaRetroativo({
          ...diaRetroativo,
          lancamentos: [...diaRetroativo.lancamentos, novoLancamento],
        });
      }

      toast({
        title: "Lançamento retroativo salvo",
        description: `Valor registrado para ${format(new Date(dataLancamento + "T12:00:00"), "dd/MM/yyyy")} às ${horario}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar lançamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmitLancamento = async (valor: number) => {
    if (!selectedHorario) return;
    await saveLancamentoMutation.mutateAsync({
      horario: selectedHorario,
      valor,
    });
  };

  const horarios = loja?.possui_fechamento_tardio
    ? [...HORARIOS_BASE, HORARIO_TARDIO]
    : HORARIOS_BASE;

  const totalVendido =
    lancamentos.length > 0
      ? Math.max(...lancamentos.map((l) => l.valor_acumulado))
      : 0;

  const getLancamentoByHorario = (horario: string) => {
    return lancamentos.find((l) => l.horario === horario);
  };

  const isHorarioAtrasado = (horario: string): boolean => {
    const agora = new Date();
    const [hora, minuto] = horario.split(':').map(Number);
    
    const horarioSlot = new Date();
    horarioSlot.setHours(hora, minuto + 1, 0, 0); // +1 minuto de tolerância
    
    return agora > horarioSlot;
  };

  const isHorarioProximoDeVencer = (horario: string): boolean => {
    const agora = new Date();
    const [hora, minuto] = horario.split(':').map(Number);
    
    const horarioSlot = new Date();
    horarioSlot.setHours(hora, minuto, 0, 0);
    
    const diferencaMinutos = (horarioSlot.getTime() - agora.getTime()) / (1000 * 60);
    
    // Retorna true se faltam entre 0 e 5 minutos
    return diferencaMinutos > 0 && diferencaMinutos <= 5;
  };

  const isHorarioBloqueado = (horario: string): boolean => {
    const indexHorario = horarios.indexOf(horario);
    
    // Primeiro horário nunca está bloqueado
    if (indexHorario === 0) return false;
    
    // Verificar se todos os horários anteriores foram preenchidos
    for (let i = 0; i < indexHorario; i++) {
      const horarioAnterior = horarios[i];
      const lancamentoAnterior = getLancamentoByHorario(horarioAnterior);
      
      if (!lancamentoAnterior) {
        return true; // Bloqueado - horário anterior não preenchido
      }
    }
    
    return false; // Liberado - todos os anteriores preenchidos
  };

  const handleExportPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      await generateSalesReport({
        lojaName: loja?.nome || '',
        data: dataHoje,
        metaDiaria: metaMensal?.meta_diaria_calculada || 0,
        totalVendido,
        percentualAtingimento: metaMensal?.meta_diaria_calculada 
          ? (totalVendido / metaMensal.meta_diaria_calculada) * 100 
          : 0,
        lancamentos,
        horarios,
      }, chartRef);
      
      toast({
        title: "PDF gerado com sucesso",
        description: "O relatório foi baixado para seu dispositivo.",
      });
    } catch (error) {
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o relatório.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const handleSelectDiaPendente = (data: Date, lancamentosDia: LancamentoMes[]) => {
    setDiaRetroativo({
      data,
      lancamentos: lancamentosDia,
    });
  };

  const handleSubmitRetroativo = async (horario: string, valor: number) => {
    if (!diaRetroativo) return;
    const dataLancamento = format(diaRetroativo.data, "yyyy-MM-dd");
    await saveRetroativoMutation.mutateAsync({
      horario,
      valor,
      dataLancamento,
    });
  };

  if (!gerenteLojaId || !loja) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Carregando..." showLogout={false} />
        <PageContainer>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={loja.nome}
        subtitle={new Date().toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        onLogout={handleLogout}
        showLogo={true}
      />

      <PageContainer maxWidth="lg">
        <div className="space-y-6">
          <MetaDiariaHeader
            metaDiaria={metaMensal?.meta_diaria_calculada || 0}
            totalVendido={totalVendido}
            lojaName={loja.nome}
          />

          <SalesEvolutionChart
            ref={chartRef}
            lancamentos={lancamentos}
            metaDiaria={metaMensal?.meta_diaria_calculada || 0}
            horarios={horarios}
          />

          {!metaMensal && (
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 shadow-sm">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Atenção:</strong> Nenhuma meta mensal cadastrada para este mês. 
                Entre em contato com o administrador.
              </p>
            </div>
          )}

          {/* Seção de Dias Pendentes */}
          <DiasPendentes
            lancamentosMes={lancamentosMes}
            tipoOperacional={loja.tipo_operacional}
            possuiFechamentoTardio={loja.possui_fechamento_tardio}
            onSelectDia={handleSelectDiaPendente}
          />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Lançamentos do Dia</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={isGeneratingPDF || lancamentos.length === 0}
                className="gap-2"
              >
                <FileDown className="h-4 w-4" />
                {isGeneratingPDF ? "Gerando..." : "Exportar PDF"}
              </Button>
            </div>
            <div className={cn(
              "grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4",
              loja.possui_fechamento_tardio ? "lg:grid-cols-5" : "lg:grid-cols-4"
            )}>
              {horarios.map((horario) => {
                const lancamento = getLancamentoByHorario(horario);
                return (
                  <TimelineSlot
                    key={horario}
                    horario={horario}
                    valor={lancamento?.valor_acumulado}
                    isPendente={!lancamento}
                    isAtrasado={!lancamento && isHorarioAtrasado(horario)}
                    isProximoDeVencer={!lancamento && !isHorarioAtrasado(horario) && isHorarioProximoDeVencer(horario)}
                    isBlocked={!lancamento && isHorarioBloqueado(horario)}
                    onClick={() => setSelectedHorario(horario)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </PageContainer>

      {selectedHorario && (
        <LancamentoDialog
          isOpen={!!selectedHorario}
          onClose={() => setSelectedHorario(null)}
          horario={selectedHorario}
          valorAtual={getLancamentoByHorario(selectedHorario)?.valor_acumulado}
          onSubmit={handleSubmitLancamento}
          isSubmitting={saveLancamentoMutation.isPending}
        />
      )}

      {diaRetroativo && (
        <LancamentoRetroativoDialog
          isOpen={!!diaRetroativo}
          onClose={() => setDiaRetroativo(null)}
          data={diaRetroativo.data}
          lancamentosDia={diaRetroativo.lancamentos}
          horarios={horarios}
          onSubmit={handleSubmitRetroativo}
          isSubmitting={saveRetroativoMutation.isPending}
        />
      )}
    </div>
  );
};

export default Gerente;
