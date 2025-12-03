import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type ReportData = {
  lojaName: string;
  data: string;
  metaDiaria: number;
  totalVendido: number;
  percentualAtingimento: number;
  lancamentos: { horario: string; valor_acumulado: number }[];
  horarios: string[];
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const getAtingimentoColor = (percentual: number): [number, number, number] => {
  if (percentual >= 100) return [34, 197, 94]; // Verde
  if (percentual >= 80) return [234, 179, 8]; // Amarelo
  return [239, 68, 68]; // Vermelho
};

export async function generateSalesReport(
  data: ReportData,
  chartRef?: React.RefObject<HTMLDivElement>
): Promise<void> {
  const pdf = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  
  // Header
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Meta Simples', pageWidth / 2, 20, { align: 'center' });
  
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Relatório de Vendas Diário', pageWidth / 2, 28, { align: 'center' });
  
  // Informações da loja
  pdf.setFontSize(12);
  pdf.text(`Loja: ${data.lojaName}`, 20, 45);
  pdf.text(`Data: ${new Date(data.data + 'T00:00:00').toLocaleDateString('pt-BR')}`, 20, 52);
  pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 20, 59);
  
  // Linha separadora
  pdf.setDrawColor(200);
  pdf.line(20, 65, pageWidth - 20, 65);
  
  // Resumo financeiro
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Resumo do Dia', 20, 75);
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Meta Diária: ${formatCurrency(data.metaDiaria)}`, 20, 85);
  pdf.text(`Total Vendido: ${formatCurrency(data.totalVendido)}`, 20, 92);
  
  // Atingimento com cor
  const atColor = getAtingimentoColor(data.percentualAtingimento);
  pdf.setTextColor(...atColor);
  pdf.text(`Atingimento: ${data.percentualAtingimento.toFixed(1)}%`, 20, 99);
  pdf.setTextColor(0, 0, 0);
  
  // Tabela de lançamentos
  let yPos = 115;
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Lançamentos por Horário', 20, yPos);
  yPos += 10;
  
  // Cabeçalho da tabela
  pdf.setFontSize(10);
  pdf.setFillColor(240, 240, 240);
  pdf.rect(20, yPos - 5, pageWidth - 40, 8, 'F');
  pdf.text('Horário', 25, yPos);
  pdf.text('Valor Acumulado', 80, yPos);
  pdf.text('Status', 140, yPos);
  yPos += 10;
  
  // Linhas da tabela
  pdf.setFont('helvetica', 'normal');
  data.horarios.forEach(horario => {
    const lancamento = data.lancamentos.find(l => l.horario === horario);
    pdf.text(horario, 25, yPos);
    pdf.text(lancamento ? formatCurrency(lancamento.valor_acumulado) : '—', 80, yPos);
    pdf.text(lancamento ? '[OK] Preenchido' : 'Pendente', 140, yPos);
    yPos += 8;
  });
  
  // Capturar gráfico se disponível
  if (chartRef?.current) {
    try {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - 40;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      yPos += 10;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Evolução das Vendas', 20, yPos);
      yPos += 5;
      pdf.addImage(imgData, 'PNG', 20, yPos, imgWidth, imgHeight);
    } catch (error) {
      console.error('Erro ao capturar gráfico:', error);
    }
  }
  
  // Rodapé
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.setFontSize(8);
  pdf.setTextColor(150);
  pdf.text('Meta Simples - Sistema de Gestão de Metas', pageWidth / 2, pageHeight - 10, { align: 'center' });
  
  // Salvar PDF
  const fileName = `relatorio-vendas-${data.lojaName.toLowerCase().replace(/\s+/g, '-')}-${data.data}.pdf`;
  pdf.save(fileName);
}
