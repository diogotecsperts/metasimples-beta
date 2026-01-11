import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AuditLog } from '@/components/admin/AuditLogList';
import { ACTION_LABELS, ENTITY_LABELS } from './auditLog';

type FilterInfo = {
  periodo: string;
  acao: string;
  loja: string;
  usuario: string;
  busca: string;
};

export async function generateAuditReport(logs: AuditLog[], filters: FilterInfo): Promise<void> {
  const pdf = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Header
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Meta Simples', pageWidth / 2, 15, { align: 'center' });

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Relatório de Auditoria', pageWidth / 2, 23, { align: 'center' });

  // Info dos filtros
  pdf.setFontSize(9);
  pdf.text(`Período: ${filters.periodo}`, 20, 35);
  pdf.text(`Ação: ${filters.acao}`, 80, 35);
  pdf.text(`Loja: ${filters.loja}`, 140, 35);
  pdf.text(`Usuário: ${filters.usuario}`, 200, 35);
  pdf.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 20, 42);
  pdf.text(`Total de registros: ${logs.length}`, 140, 42);
  if (filters.busca) {
    pdf.text(`Busca: "${filters.busca}"`, 200, 42);
  }

  // Resumo por tipo
  const contadores: Record<string, number> = { lancamento: 0, meta: 0, meta_ajuste: 0, gerente: 0, admin: 0, loja: 0 };
  logs.forEach(log => {
    if (log.entity in contadores) contadores[log.entity]++;
  });

  let yPos = 52;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Resumo:', 20, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(
    `Lançamentos: ${contadores.lancamento} | Metas: ${contadores.meta} | Ajustes: ${contadores.meta_ajuste} | Gerentes: ${contadores.gerente} | Admins: ${contadores.admin} | Lojas: ${contadores.loja}`,
    50,
    yPos
  );

  // Tabela
  yPos = 62;
  const colWidths = [30, 35, 25, 22, 35, 70, 60];
  const headers = ['Data/Hora', 'Usuário', 'Função', 'Ação', 'Tipo', 'Entidade', 'Detalhes'];

  // Cabeçalho com fundo
  pdf.setFillColor(30, 58, 95);
  pdf.setTextColor(255, 255, 255);
  pdf.rect(15, yPos - 5, pageWidth - 30, 8, 'F');

  let xPos = 20;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  headers.forEach((header, i) => {
    pdf.text(header, xPos, yPos);
    xPos += colWidths[i];
  });

  // Linhas
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  yPos += 10;

  const maxRows = 100; // Limitar para PDF legível
  logs.slice(0, maxRows).forEach((log, index) => {
    if (yPos > pageHeight - 20) {
      pdf.addPage();
      yPos = 20;
    }

    // Alternar cor de fundo
    if (index % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(15, yPos - 4, pageWidth - 30, 7, 'F');
    }

    xPos = 20;
    const row = [
      format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }),
      log.user_nome.substring(0, 18),
      log.user_role === 'admin' ? 'Admin' : 'Gerente',
      (ACTION_LABELS[log.action] || log.action).substring(0, 8),
      (ENTITY_LABELS[log.entity] || log.entity).substring(0, 15),
      (log.entity_name || '-').substring(0, 35),
      JSON.stringify(log.details).substring(0, 30),
    ];

    row.forEach((cell, i) => {
      pdf.text(cell, xPos, yPos);
      xPos += colWidths[i];
    });

    yPos += 7;
  });

  if (logs.length > maxRows) {
    yPos += 5;
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`... e mais ${logs.length - maxRows} registros (exportar CSV para lista completa)`, 20, yPos);
  }

  // Rodapé
  pdf.setFontSize(7);
  pdf.setTextColor(150, 150, 150);
  pdf.text('Meta Simples - Sistema de Gestão de Metas', pageWidth / 2, pageHeight - 8, { align: 'center' });

  pdf.save(`auditoria-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
