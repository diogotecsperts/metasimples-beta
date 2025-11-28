import { describe, it, expect } from "vitest";
import { calcularMetaDiaria } from "./calcularMetaDiaria";

describe("calcularMetaDiaria", () => {
  describe("Tipo A (Domingo a Domingo)", () => {
    it("deve calcular meta diária para mês com 31 dias", () => {
      // Janeiro 2024 tem 31 dias
      const resultado = calcularMetaDiaria(31000, "A", 1, 2024);
      expect(resultado).toBe(1000.00);
    });

    it("deve calcular meta diária para mês com 30 dias", () => {
      // Abril 2024 tem 30 dias
      const resultado = calcularMetaDiaria(30000, "A", 4, 2024);
      expect(resultado).toBe(1000.00);
    });

    it("deve calcular meta diária para fevereiro com 29 dias (ano bissexto)", () => {
      // Fevereiro 2024 tem 29 dias (ano bissexto)
      const resultado = calcularMetaDiaria(29000, "A", 2, 2024);
      expect(resultado).toBe(1000.00);
    });

    it("deve calcular meta diária para fevereiro com 28 dias (ano não-bissexto)", () => {
      // Fevereiro 2023 tem 28 dias
      const resultado = calcularMetaDiaria(28000, "A", 2, 2023);
      expect(resultado).toBe(1000.00);
    });

    it("deve arredondar para 2 casas decimais", () => {
      // 10000 / 31 = 322.58064...
      const resultado = calcularMetaDiaria(10000, "A", 1, 2024);
      expect(resultado).toBe(322.58);
    });
  });

  describe("Tipo B (Segunda a Sábado)", () => {
    it("deve calcular meta diária excluindo domingos", () => {
      // Janeiro 2024 tem 31 dias e 4 domingos (dias 7, 14, 21, 28)
      // 31 - 4 = 27 dias úteis
      const resultado = calcularMetaDiaria(27000, "B", 1, 2024);
      expect(resultado).toBe(1000.00);
    });

    it("deve calcular corretamente para mês com 5 domingos", () => {
      // Dezembro 2024 tem 31 dias e 5 domingos (dias 1, 8, 15, 22, 29)
      // 31 - 5 = 26 dias úteis
      const resultado = calcularMetaDiaria(26000, "B", 12, 2024);
      expect(resultado).toBe(1000.00);
    });

    it("deve calcular para fevereiro não-bissexto", () => {
      // Fevereiro 2023 tem 28 dias e 4 domingos
      // 28 - 4 = 24 dias úteis
      const resultado = calcularMetaDiaria(24000, "B", 2, 2023);
      expect(resultado).toBe(1000.00);
    });

    it("deve arredondar para 2 casas decimais", () => {
      // Janeiro 2024: 31 dias - 4 domingos = 27 dias úteis
      // 10000 / 27 = 370.37037...
      const resultado = calcularMetaDiaria(10000, "B", 1, 2024);
      expect(resultado).toBe(370.37);
    });
  });

  describe("Validações", () => {
    it("deve lançar erro para meta mensal negativa", () => {
      expect(() => calcularMetaDiaria(-1000, "A", 1, 2024)).toThrow(
        "Meta mensal não pode ser negativa"
      );
    });

    it("deve lançar erro para mês inválido (menor que 1)", () => {
      expect(() => calcularMetaDiaria(10000, "A", 0, 2024)).toThrow(
        "Mês deve estar entre 1 e 12"
      );
    });

    it("deve lançar erro para mês inválido (maior que 12)", () => {
      expect(() => calcularMetaDiaria(10000, "A", 13, 2024)).toThrow(
        "Mês deve estar entre 1 e 12"
      );
    });

    it("deve lançar erro para tipo operacional inválido", () => {
      expect(() => calcularMetaDiaria(10000, "C" as any, 1, 2024)).toThrow(
        "Tipo operacional deve ser 'A' ou 'B'"
      );
    });
  });

  describe("Casos reais diversos", () => {
    it("deve calcular meta para meta mensal de 50000 tipo A em março 2024", () => {
      // Março 2024 tem 31 dias
      const resultado = calcularMetaDiaria(50000, "A", 3, 2024);
      expect(resultado).toBe(1612.90);
    });

    it("deve calcular meta para meta mensal de 75000 tipo B em junho 2024", () => {
      // Junho 2024 tem 30 dias e 5 domingos (dias 2, 9, 16, 23, 30)
      // 30 - 5 = 25 dias úteis
      const resultado = calcularMetaDiaria(75000, "B", 6, 2024);
      expect(resultado).toBe(3000.00);
    });

    it("deve calcular meta zero corretamente", () => {
      const resultado = calcularMetaDiaria(0, "A", 1, 2024);
      expect(resultado).toBe(0.00);
    });
  });
});
