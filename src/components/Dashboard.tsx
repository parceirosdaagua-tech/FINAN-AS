import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Wallet, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter,
  RefreshCw,
  Car,
  BellRing,
  HandCoins,
  Save,
  Undo,
  Repeat,
  DollarSign,
  Home,
  GlassWater,
  Users,
  MoreHorizontal,
  Check,
  Database,
  Copy
} from "lucide-react";
import { Receita, Despesa, FaturaCartao, AlertNotification, PagamentoDiario, DividaOutros, Prestacao } from "../types";
import NotificationManager from "./NotificationManager";

interface DashboardProps {
  activeView?: "painel" | "entradas" | "saidas";
}

export default function Dashboard({ activeView = "painel" }: DashboardProps) {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [originalDespesas, setOriginalDespesas] = useState<Despesa[]>([]);
  const [unsavedDespesaIds, setUnsavedDespesaIds] = useState<string[]>([]);
  const [savingDespesaIds, setSavingDespesaIds] = useState<string[]>([]);
  const [faturas, setFaturas] = useState<FaturaCartao[]>([]);
  const [pagamentosDiarios, setPagamentosDiarios] = useState<PagamentoDiario[]>([]);
  const [dividasOutros, setDividasOutros] = useState<DividaOutros[]>([]);
  const [prestacoes, setPrestacoes] = useState<Prestacao[]>([]);
  const [originalPrestacoes, setOriginalPrestacoes] = useState<Prestacao[]>([]);
  const [unsavedPrestacaoIds, setUnsavedPrestacaoIds] = useState<string[]>([]);
  const [savingPrestacaoIds, setSavingPrestacaoIds] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Quick adds loading states
  const [addingReceita, setAddingReceita] = useState(false);
  const [addingDespesa, setAddingDespesa] = useState(false);
  const [addingFatura, setAddingFatura] = useState(false);
  const [addingPagamento, setAddingPagamento] = useState(false);
  const [addingDivida, setAddingDivida] = useState(false);
  const [addingPrestacao, setAddingPrestacao] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [payQuantities, setPayQuantities] = useState<Record<string, number>>({});

  // Sub-tabs for Entradas and Saídas
  const [subTabEntradas, setSubTabEntradas] = useState<"salario" | "carros" | "alugueis" | "bar_agua" | "devedores" | "outros">("salario");
  const [subTabSaidas, setSubTabSaidas] = useState<"alugueis" | "cartoes" | "dividas" | "outros">("alugueis");

  // Active Category filter
  const [activeTab, setActiveTab] = useState<"all" | "receitas" | "despesas" | "faturas">("all");
  
  // Database connection status state
  const [dbStatus, setDbStatus] = useState<{
    supabaseConnected: boolean;
    tableExists: boolean;
    syncError: string | null;
    mode: "supabase" | "supabase_missing_table" | "local_file";
  } | null>(null);

  const [showDbGuide, setShowDbGuide] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resRec, resDes, resFat, resPag, resDiv, resPres, resDbStatus] = await Promise.all([
        fetch("/api/receitas"),
        fetch("/api/despesas"),
        fetch("/api/faturas"),
        fetch("/api/pagamentos-diarios"),
        fetch("/api/dividas-outros"),
        fetch("/api/prestacoes"),
        fetch("/api/database-status").catch(() => null)
      ]);
      
      const recData = await resRec.json();
      const desData = await resDes.json();
      const fatData = await resFat.json();
      const pagData = await resPag.json();
      const divData = await resDiv.json();
      const presData = await resPres.json();
      
      setReceitas(recData);
      setDespesas(desData);
      setOriginalDespesas(JSON.parse(JSON.stringify(desData)));
      setFaturas(fatData);
      setPagamentosDiarios(pagData);
      setDividasOutros(divData);
      setPrestacoes(presData);
      setOriginalPrestacoes(JSON.parse(JSON.stringify(presData)));

      if (resDbStatus && resDbStatus.ok) {
        const dbStatusData = await resDbStatus.json();
        setDbStatus(dbStatusData);
      }
      
      setError(null);
    } catch (err) {
      console.error("Erro ao carregar dados do banco:", err);
      setError("Não foi possível carregar as informações do servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Inline Grid Saving Helpers ---
  const saveReceita = async (id: string, updatedFields: Partial<Receita>) => {
    // Optimistic UI Update
    setReceitas(prev => prev.map(r => r.id === id ? { ...r, ...updatedFields } as Receita : r));
    try {
      await fetch(`/api/receitas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields)
      });
    } catch (err) {
      console.error("Erro ao atualizar receita:", err);
    }
  };

  const getNextMonthDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString().split("T")[0];
    const [year, month, day] = dateStr.split("-").map(Number);
    let targetMonth = month + 1;
    let targetYear = year;
    if (targetMonth > 12) {
      targetMonth = 1;
      targetYear += 1;
    }
    
    const lastDayOfTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const targetDay = Math.min(day, lastDayOfTargetMonth);
    
    const y = targetYear;
    const m = String(targetMonth).padStart(2, '0');
    const d = String(targetDay).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleMarkAsPaidAndRollover = async (rec: Receita) => {
    const nextMonthDate = getNextMonthDate(rec.data);
    const tempStaticId = "temp-paid-" + Date.now();
    
    const staticPaidRec: Receita = {
      id: tempStaticId,
      descricao: rec.descricao,
      placa_modelo: rec.placa_modelo,
      valor: rec.valor,
      data: rec.data, // original date so it counts in the current month statistics
      status_recebimento: "recebido",
      recorrente: false,
      categoria: rec.categoria
    };

    setReceitas(prev => [
      ...prev.map(r => r.id === rec.id ? { ...r, data: nextMonthDate, status_recebimento: "pendente" } as Receita : r),
      staticPaidRec
    ]);

    try {
      await fetch(`/api/receitas/${rec.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: nextMonthDate,
          status_recebimento: "pendente"
        })
      });

      const res = await fetch("/api/receitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: staticPaidRec.descricao,
          placa_modelo: staticPaidRec.placa_modelo,
          valor: staticPaidRec.valor,
          data: staticPaidRec.data,
          status_recebimento: staticPaidRec.status_recebimento,
          categoria: staticPaidRec.categoria,
          recorrente: false
        })
      });

      if (res.ok) {
        const savedPaidRec = await res.json();
        setReceitas(prev => prev.map(r => r.id === tempStaticId ? savedPaidRec : r));
      }
    } catch (err) {
      console.error("Erro ao registrar pagamento e avançar data:", err);
    }
  };

  const updateDespesaLocally = (id: string, updatedFields: Partial<Despesa>) => {
    setDespesas(prev => prev.map(d => d.id === id ? { ...d, ...updatedFields } as Despesa : d));
    setUnsavedDespesaIds(prev => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  };

  const cancelDespesaChanges = (id: string) => {
    const original = originalDespesas.find(d => d.id === id);
    if (original) {
      setDespesas(prev => prev.map(d => d.id === id ? JSON.parse(JSON.stringify(original)) : d));
    }
    setUnsavedDespesaIds(prev => prev.filter(x => x !== id));
  };

  const handleSaveDespesa = async (id: string) => {
    const currentItem = despesas.find(d => d.id === id);
    if (!currentItem) return;

    setSavingDespesaIds(prev => [...prev, id]);
    try {
      const res = await fetch(`/api/despesas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentItem)
      });
      if (res.ok) {
        setOriginalDespesas(prev => prev.map(d => d.id === id ? JSON.parse(JSON.stringify(currentItem)) : d));
        setUnsavedDespesaIds(prev => prev.filter(x => x !== id));
      } else {
        console.error("Falha ao salvar despesa no servidor");
      }
    } catch (err) {
      console.error("Erro ao salvar despesa:", err);
    } finally {
      setSavingDespesaIds(prev => prev.filter(x => x !== id));
    }
  };

  const saveFatura = async (id: string, updatedFields: Partial<FaturaCartao>) => {
    // Optimistic UI Update
    setFaturas(prev => prev.map(f => {
      if (f.id === id) {
        const merged = { ...f, ...updatedFields };
        const lt = merged.limite_total ?? 0;
        const gt = merged.gastos_totais ?? 0;
        merged.limite_atual = lt - gt;
        return merged;
      }
      return f;
    }));
    try {
      await fetch(`/api/faturas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields)
      });
    } catch (err) {
      console.error("Erro ao atualizar fatura:", err);
    }
  };

  const savePagamentoDiario = async (id: string, updatedFields: Partial<PagamentoDiario>) => {
    let finalMergedItem: PagamentoDiario | null = null;

    setPagamentosDiarios(prev => prev.map(p => {
      if (p.id === id) {
        const merged = { ...p, ...updatedFields } as PagamentoDiario;
        const valPar = merged.valor_parcela !== undefined && merged.valor_parcela !== null ? merged.valor_parcela : 100;
        merged.valor_parcela = valPar;

        if (
          updatedFields.parcela_atual !== undefined ||
          updatedFields.parcela_total !== undefined ||
          updatedFields.valor_parcela !== undefined
        ) {
          merged.valor_pago = merged.parcela_atual * valPar;
          merged.valor_saldo = Math.max(0, (merged.parcela_total - merged.parcela_atual) * valPar);
        } else if (updatedFields.valor_pago !== undefined) {
          merged.valor_saldo = Math.max(0, (merged.parcela_total * valPar) - merged.valor_pago);
        } else if (updatedFields.valor_saldo !== undefined) {
          merged.valor_pago = Math.max(0, (merged.parcela_total * valPar) - merged.valor_saldo);
        }

        if (merged.parcela_atual >= merged.parcela_total) {
          merged.status = "recebido";
        } else {
          merged.status = "pendente";
        }

        finalMergedItem = merged;
        return merged;
      }
      return p;
    }));

    try {
      // Small tick to ensure setPagamentosDiarios mapping completes and finalMergedItem is defined
      setTimeout(async () => {
        if (finalMergedItem) {
          await fetch(`/api/pagamentos-diarios/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalMergedItem)
          });
        }
      }, 0);
    } catch (err) {
      console.error("Erro ao atualizar pagamento diário:", err);
    }
  };

  const saveDividaOutros = async (id: string, updatedFields: Partial<DividaOutros>) => {
    let finalMergedItem: DividaOutros | null = null;

    setDividasOutros(prev => prev.map(d => {
      if (d.id === id) {
        const merged = { ...d, ...updatedFields } as DividaOutros;
        
        const parTotal = merged.parcela_total !== undefined && merged.parcela_total !== null ? merged.parcela_total : 12;
        const parAtual = merged.parcela_atual !== undefined && merged.parcela_atual !== null ? merged.parcela_atual : 0;
        const valPar = merged.valor_parcela !== undefined && merged.valor_parcela !== null ? merged.valor_parcela : (merged.valor_total || 0);

        merged.parcela_total = parTotal;
        merged.parcela_atual = parAtual;
        merged.valor_parcela = valPar;

        merged.valor_total = parTotal * valPar;
        merged.valor_pago = parAtual * valPar;
        merged.saldo_devedor = Math.max(0, (parTotal - parAtual) * valPar);

        if (parAtual >= parTotal) {
          merged.status = "pago";
        } else {
          merged.status = "pendente";
        }

        finalMergedItem = merged;
        return merged;
      }
      return d;
    }));

    try {
      setTimeout(async () => {
        if (finalMergedItem) {
          await fetch(`/api/dividas-outros/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalMergedItem)
          });
        }
      }, 0);
    } catch (err) {
      console.error("Erro ao atualizar dívida:", err);
    }
  };

  const handlePayDividaAndRollover = async (div: DividaOutros) => {
    const nextMonthDate = getNextMonthDate(div.data_vencimento);
    const parTotal = div.parcela_total !== undefined && div.parcela_total !== null ? div.parcela_total : 12;
    const parAtual = div.parcela_atual !== undefined && div.parcela_atual !== null ? div.parcela_atual : 0;
    const valPar = div.valor_parcela !== undefined && div.valor_parcela !== null ? div.valor_parcela : (div.valor_total || 0);

    const nextParcelaAtual = Math.min(parTotal, parAtual + 1);
    const addedValue = nextParcelaAtual > parAtual ? valPar : 0;
    const currentPagoMes = div.valor_pago_mes || 0;

    const updatedFields: Partial<DividaOutros> = {
      parcela_atual: nextParcelaAtual,
      valor_pago_mes: currentPagoMes + addedValue,
      data_vencimento: nextMonthDate,
      status: nextParcelaAtual >= parTotal ? "pago" : "pendente"
    };

    await saveDividaOutros(div.id, updatedFields);
  };

  const updatePrestacaoLocally = (id: string, updatedFields: Partial<Prestacao>) => {
    setPrestacoes(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, ...updatedFields } as Prestacao;
        // Auto-complete status to "pago" if paid installments match total installments
        if (updated.parcelas_pagas === updated.parcelas_totais) {
          updated.status = "pago";
        }
        return updated;
      }
      return p;
    }));
    
    setUnsavedPrestacaoIds(prev => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  };

  const cancelPrestacaoChanges = (id: string) => {
    const original = originalPrestacoes.find(p => p.id === id);
    if (original) {
      setPrestacoes(prev => prev.map(p => p.id === id ? JSON.parse(JSON.stringify(original)) : p));
    }
    setUnsavedPrestacaoIds(prev => prev.filter(x => x !== id));
  };

  const handleSavePrestacao = async (id: string) => {
    const currentItem = prestacoes.find(p => p.id === id);
    if (!currentItem) return;

    setSavingPrestacaoIds(prev => [...prev, id]);
    try {
      const res = await fetch(`/api/prestacoes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentItem)
      });
      if (res.ok) {
        // Commit change to baseline original copy
        setOriginalPrestacoes(prev => prev.map(p => p.id === id ? JSON.parse(JSON.stringify(currentItem)) : p));
        setUnsavedPrestacaoIds(prev => prev.filter(x => x !== id));
      } else {
        console.error("Falha ao salvar prestação no servidor");
      }
    } catch (err) {
      console.error("Erro ao salvar prestação:", err);
    } finally {
      setSavingPrestacaoIds(prev => prev.filter(x => x !== id));
    }
  };

  // --- Add Line Helpers (CRUD Inline Core) ---
  const handleAddReceita = async (categoria: string = "outros") => {
    const tempId = "temp-rec-" + Date.now();
    let defaultDesc = "Nova Receita";
    if (categoria === "salario") defaultDesc = "Novo Salário";
    if (categoria === "carros") defaultDesc = "Ganhos Veículo / Frota";
    if (categoria === "bar_agua") defaultDesc = "Ganhos Bar & Água";
    if (categoria === "alugueis") defaultDesc = "Novo Aluguel Recebido";
    if (categoria === "outros") defaultDesc = "Outros Recebimentos";

    const newRec: Receita = {
      id: tempId,
      descricao: defaultDesc,
      placa_modelo: "",
      valor: 0,
      data: new Date().toISOString().split("T")[0],
      status_recebimento: "pendente",
      recorrente: false,
      categoria: categoria
    };
    
    setReceitas(prev => [...prev, newRec]);
    setAddingReceita(true);
    try {
      const res = await fetch("/api/receitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: newRec.descricao,
          valor: newRec.valor,
          data: newRec.data,
          status_recebimento: newRec.status_recebimento,
          categoria: categoria
        })
      });
      if (res.ok) {
        const savedRec = await res.json();
        setReceitas(prev => prev.map(r => r.id === tempId ? savedRec : r));
      } else {
        throw new Error("Erro de resposta do servidor");
      }
    } catch (err) {
      console.error("Erro ao adicionar receita, mantendo localmente:", err);
      setReceitas(prev => prev.map(r => r.id === tempId ? { ...r, id: "rec-" + Date.now() } : r));
    } finally {
      setAddingReceita(false);
    }
  };

  const handleAddDespesa = async (categoria: string = "outros") => {
    const tempId = "temp-des-" + Date.now();
    let defaultDesc = "Nova Despesa";
    if (categoria === "alugueis") defaultDesc = "Aluguel Pago";
    if (categoria === "outros") defaultDesc = "Nova Despesa Outros";

    const newDes: Despesa = {
      id: tempId,
      descricao: defaultDesc,
      valor: 0,
      data_vencimento: new Date().toISOString().split("T")[0],
      status_pagamento: "pendente",
      tipo: "geral",
      recorrente: false,
      categoria: categoria
    };

    setDespesas(prev => [...prev, newDes]);
    setOriginalDespesas(prev => [...prev, JSON.parse(JSON.stringify(newDes))]);
    setAddingDespesa(true);
    try {
      const res = await fetch("/api/despesas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: newDes.descricao,
          valor: newDes.valor,
          data_vencimento: newDes.data_vencimento,
          status_pagamento: newDes.status_pagamento,
          tipo: "geral",
          categoria: categoria
        })
      });
      if (res.ok) {
        const savedDes = await res.json();
        setDespesas(prev => prev.map(d => d.id === tempId ? savedDes : d));
        setOriginalDespesas(prev => prev.map(d => d.id === tempId ? JSON.parse(JSON.stringify(savedDes)) : d));
      } else {
        throw new Error("Erro de resposta do servidor");
      }
    } catch (err) {
      console.error("Erro ao adicionar despesa, mantendo localmente:", err);
      setDespesas(prev => prev.map(d => d.id === tempId ? { ...d, id: "des-" + Date.now() } : d));
      setOriginalDespesas(prev => prev.map(d => d.id === tempId ? { ...d, id: "des-" + Date.now() } : d));
    } finally {
      setAddingDespesa(false);
    }
  };

  const handleAddFatura = async () => {
    const tempId = "temp-fat-" + Date.now();
    const newFat: FaturaCartao = {
      id: tempId,
      nome_cartao: "Novo Cartão",
      finais_cartao: "0000",
      limite_total: 5000,
      gastos_totais: 0,
      limite_atual: 5000,
      melhor_dia_compra: 10,
      valor_total: 0,
      data_vencimento: new Date().toISOString().split("T")[0],
      status_pagamento: "pendente"
    };

    setFaturas(prev => [...prev, newFat]);
    setAddingFatura(true);
    try {
      const res = await fetch("/api/faturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFat)
      });
      if (res.ok) {
        const savedFat = await res.json();
        setFaturas(prev => prev.map(f => f.id === tempId ? savedFat : f));
      } else {
        throw new Error("Erro de resposta do servidor");
      }
    } catch (err) {
      console.error("Erro ao adicionar fatura, mantendo localmente:", err);
      setFaturas(prev => prev.map(f => f.id === tempId ? { ...f, id: "fat-" + Date.now() } : f));
    } finally {
      setAddingFatura(false);
    }
  };

  const handleAddPagamentoDiario = async () => {
    const tempId = "temp-pag-" + Date.now();
    const newPag: PagamentoDiario = {
      id: tempId,
      descricao: "Novo Motorista",
      veiculo: "Modelo / Placa",
      parcela_atual: 0,
      parcela_total: 12,
      valor_parcela: 150,
      valor_pago: 0,
      valor_saldo: 1800,
      segunda_a_sexta: false,
      data: new Date().toISOString().split("T")[0],
      status: "pendente",
      valor_pago_mes: 0
    };

    setPagamentosDiarios(prev => [...prev, newPag]);
    setAddingPagamento(true);
    try {
      const res = await fetch("/api/pagamentos-diarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPag)
      });
      if (res.ok) {
        const savedPag = await res.json();
        setPagamentosDiarios(prev => prev.map(p => p.id === tempId ? savedPag : p));
      } else {
        throw new Error("Erro de resposta do servidor");
      }
    } catch (err) {
      console.error("Erro ao adicionar pagamento diário, mantendo localmente:", err);
      setPagamentosDiarios(prev => prev.map(p => p.id === tempId ? { ...p, id: "pag-" + Date.now() } : p));
    } finally {
      setAddingPagamento(false);
    }
  };

  const handleAddDividaOutros = async (tipo: 'aluguel' | 'divida' | 'outros' = 'divida') => {
    const tempId = "temp-div-" + Date.now();
    let defaultDevedor = "Novo Devedor";
    if (tipo === "aluguel") defaultDevedor = "Inquilino (Aluguel)";
    
    const newDiv: DividaOutros = {
      id: tempId,
      devedor: defaultDevedor,
      tipo: tipo,
      valor_total: 0,
      valor_pago: 0,
      saldo_devedor: 0,
      data_vencimento: new Date().toISOString().split("T")[0],
      status: "pendente",
      recorrente: false
    };

    setDividasOutros(prev => [...prev, newDiv]);
    setAddingDivida(true);
    try {
      const res = await fetch("/api/dividas-outros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          devedor: newDiv.devedor,
          tipo: newDiv.tipo,
          valor_total: newDiv.valor_total,
          valor_pago: newDiv.valor_pago,
          data_vencimento: newDiv.data_vencimento,
          status: newDiv.status
        })
      });
      if (res.ok) {
        const savedDiv = await res.json();
        setDividasOutros(prev => prev.map(d => d.id === tempId ? savedDiv : d));
      } else {
        throw new Error("Erro de resposta do servidor");
      }
    } catch (err) {
      console.error("Erro ao adicionar dívida, mantendo localmente:", err);
      setDividasOutros(prev => prev.map(d => d.id === tempId ? { ...d, id: "div-" + Date.now() } : d));
    } finally {
      setAddingDivida(false);
    }
  };

  const handleAddPrestacao = async () => {
    const tempId = "temp-pres-" + Date.now();
    const newPres: Prestacao = {
      id: tempId,
      descricao: "Nova Prestação",
      valor_parcela: 0,
      parcelas_pagas: 0,
      parcelas_totais: 12,
      data_vencimento: new Date().toISOString().split("T")[0],
      status: "pendente"
    };

    setPrestacoes(prev => [...prev, newPres]);
    setOriginalPrestacoes(prev => [...prev, JSON.parse(JSON.stringify(newPres))]);
    setAddingPrestacao(true);
    try {
      const res = await fetch("/api/prestacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPres)
      });
      if (res.ok) {
        const savedPres = await res.json();
        setPrestacoes(prev => prev.map(p => p.id === tempId ? savedPres : p));
        setOriginalPrestacoes(prev => prev.map(p => p.id === tempId ? JSON.parse(JSON.stringify(savedPres)) : p));
      } else {
        throw new Error("Erro de resposta do servidor");
      }
    } catch (err) {
      console.error("Erro ao adicionar prestação, mantendo localmente:", err);
      setPrestacoes(prev => prev.map(p => p.id === tempId ? { ...p, id: "pres-" + Date.now() } : p));
      setOriginalPrestacoes(prev => prev.map(p => p.id === tempId ? { ...p, id: "pres-" + Date.now() } : p));
    } finally {
      setAddingPrestacao(false);
    }
  };

  // --- Delete Helpers ---
  const handleDeleteReceita = async (id: string) => {
    setReceitas(prev => prev.filter(r => r.id !== id));
    try {
      await fetch(`/api/receitas/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDespesa = async (id: string) => {
    setDespesas(prev => prev.filter(d => d.id !== id));
    setOriginalDespesas(prev => prev.filter(d => d.id !== id));
    setUnsavedDespesaIds(prev => prev.filter(x => x !== id));
    setSavingDespesaIds(prev => prev.filter(x => x !== id));
    try {
      await fetch(`/api/despesas/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFatura = async (id: string) => {
    setFaturas(prev => prev.filter(f => f.id !== id));
    try {
      await fetch(`/api/faturas/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePagamentoDiario = async (id: string) => {
    setPagamentosDiarios(prev => prev.filter(p => p.id !== id));
    try {
      await fetch(`/api/pagamentos-diarios/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDividaOutros = async (id: string) => {
    setDividasOutros(prev => prev.filter(d => d.id !== id));
    try {
      await fetch(`/api/dividas-outros/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePrestacao = async (id: string) => {
    setPrestacoes(prev => prev.filter(p => p.id !== id));
    try {
      await fetch(`/api/prestacoes/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error(err);
    }
  };

  // --- Mathematical Formulas & Dashboard Stats ---
  const saldoAtual = receitas
    .filter(r => r.status_recebimento === "recebido")
    .reduce((acc, curr) => acc + curr.valor, 0) +
    pagamentosDiarios
    .reduce((acc, curr) => acc + (curr.valor_pago_mes || 0), 0) +
    dividasOutros
    .reduce((acc, curr) => acc + (curr.status === "pago" ? curr.valor_pago : (curr.valor_pago_mes || 0)), 0);

  const entradasPrevistas = receitas
    .filter(r => r.status_recebimento === "pendente")
    .reduce((acc, curr) => acc + curr.valor, 0) +
    pagamentosDiarios
    .filter(p => p.status === "pendente" || p.parcela_atual < p.parcela_total)
    .reduce((acc, curr) => acc + (curr.valor_saldo || 0), 0) +
    dividasOutros
    .filter(d => d.status !== "pago")
    .reduce((acc, curr) => acc + (curr.saldo_devedor !== undefined ? curr.saldo_devedor : (curr.valor_total - curr.valor_pago)), 0);

  const totalContasMes = despesas.reduce((acc, curr) => acc + curr.valor, 0) +
                         faturas.reduce((acc, curr) => acc + curr.valor_total, 0) +
                         prestacoes
                           .filter(p => p.status === "pendente")
                           .reduce((acc, curr) => acc + curr.valor_parcela, 0);

  const saldoGeralCalculado = (entradasPrevistas + saldoAtual) - totalContasMes;

  // Real-time timezone-safe dates
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = tomorrowObj.toLocaleDateString("en-CA"); // YYYY-MM-DD local

  const urgentAlerts: AlertNotification[] = [];

  // 1. Alertas de Despesas/Boletos (Amanhã, Hoje, Vencido)
  despesas.forEach((d) => {
    if (d.status_pagamento === "pendente") {
      if (d.data_vencimento === tomorrowStr) {
        urgentAlerts.push({
          id: `des-tom-${d.id}`,
          title: "Conta Vence Amanhã",
          message: `O boleto "${d.descricao}" de R$ ${d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vence amanhã!`,
          date: d.data_vencimento,
          type: "warning"
        });
      } else if (d.data_vencimento === todayStr) {
        urgentAlerts.push({
          id: `des-tod-${d.id}`,
          title: "Conta Vence HOJE 🚨",
          message: `O boleto "${d.descricao}" de R$ ${d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vence hoje! Regularize o pagamento.`,
          date: d.data_vencimento,
          type: "warning"
        });
      } else if (d.data_vencimento < todayStr) {
        urgentAlerts.push({
          id: `des-over-${d.id}`,
          title: "Conta Vencida / Atrasada",
          message: `O boleto "${d.descricao}" de R$ ${d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} está atrasado.`,
          date: d.data_vencimento,
          type: "warning"
        });
      }
    }
  });

  // 2. Alertas de Faturas (Amanhã, Hoje, Vencido)
  faturas.forEach((f) => {
    if (f.status_pagamento === "pendente") {
      if (f.data_vencimento === tomorrowStr) {
        urgentAlerts.push({
          id: `fat-tom-${f.id}`,
          title: "Fatura Vence Amanhã",
          message: `A fatura "${f.nome_cartao}" de R$ ${f.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vence amanhã!`,
          date: f.data_vencimento,
          type: "warning"
        });
      } else if (f.data_vencimento === todayStr) {
        urgentAlerts.push({
          id: `fat-tod-${f.id}`,
          title: "Fatura Vence HOJE 🚨",
          message: `A fatura "${f.nome_cartao}" de R$ ${f.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vence hoje! Efetue o fechamento/pagamento.`,
          date: f.data_vencimento,
          type: "warning"
        });
      } else if (f.data_vencimento < todayStr) {
        urgentAlerts.push({
          id: `fat-over-${f.id}`,
          title: "Fatura Vencida / Atrasada",
          message: `A fatura "${f.nome_cartao}" de R$ ${f.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} está vencida.`,
          date: f.data_vencimento,
          type: "warning"
        });
      }
    }
  });

  // 3. Alertas de Aluguéis / Dívidas de Terceiros (Amanhã, Hoje, Vencido)
  dividasOutros.forEach((d) => {
    if (d.status !== "pago") {
      const saldoRestante = d.valor_total - d.valor_pago;
      if (d.data_vencimento === tomorrowStr) {
        urgentAlerts.push({
          id: `div-tom-${d.id}`,
          title: "Recebível Vence Amanhã",
          message: `O aluguel/dívida de "${d.devedor}" no valor de R$ ${saldoRestante.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vence amanhã!`,
          date: d.data_vencimento,
          type: "info"
        });
      } else if (d.data_vencimento === todayStr) {
        urgentAlerts.push({
          id: `div-tod-${d.id}`,
          title: "Recebível Vence HOJE 🚨",
          message: `O aluguel/dívida de "${d.devedor}" no valor de R$ ${saldoRestante.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vence hoje!`,
          date: d.data_vencimento,
          type: "info"
        });
      } else if (d.data_vencimento < todayStr) {
        urgentAlerts.push({
          id: `div-over-${d.id}`,
          title: "Recebível Atrasado",
          message: `A cobrança de "${d.devedor}" de R$ ${saldoRestante.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} está atrasada.`,
          date: d.data_vencimento,
          type: "warning"
        });
      }
    }
  });

  // 4. Alertas de Prestações / Financiamentos (Amanhã, Hoje, Vencido)
  prestacoes.forEach((p) => {
    if (p.status === "pendente") {
      const numParcela = p.parcelas_pagas + 1;
      if (p.data_vencimento === tomorrowStr) {
        urgentAlerts.push({
          id: `pres-tom-${p.id}`,
          title: "Prestação Vence Amanhã",
          message: `A parcela ${numParcela}/${p.parcelas_totais} de "${p.descricao}" de R$ ${p.valor_parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vence amanhã!`,
          date: p.data_vencimento,
          type: "warning"
        });
      } else if (p.data_vencimento === todayStr) {
        urgentAlerts.push({
          id: `pres-tod-${p.id}`,
          title: "Prestação Vence HOJE 🚨",
          message: `A parcela ${numParcela}/${p.parcelas_totais} de "${p.descricao}" de R$ ${p.valor_parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vence hoje!`,
          date: p.data_vencimento,
          type: "warning"
        });
      } else if (p.data_vencimento < todayStr) {
        urgentAlerts.push({
          id: `pres-over-${p.id}`,
          title: "Prestação Vencida / Atrasada",
          message: `A parcela ${numParcela}/${p.parcelas_totais} de "${p.descricao}" de R$ ${p.valor_parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} está atrasada.`,
          date: p.data_vencimento,
          type: "warning"
        });
      }
    }
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-24 font-sans text-slate-200">
      
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight text-white flex items-center gap-2 uppercase">
            {activeView === "painel" && "CARTEIRA FINANCEIRA"}
            {activeView === "entradas" && "ENTRADAS & RECEBIMENTOS"}
            {activeView === "saidas" && "SAÍDAS & PAGAMENTOS"}
            <span className="text-[10px] font-mono font-normal px-2 py-0.5 border border-indigo-500/30 text-indigo-400 rounded">
              {activeView === "painel" ? "Carteira" : activeView.toUpperCase()}
            </span>
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">
            {activeView === "painel" && "Visão geral consolidada de todas as entradas, saídas e saldos"}
            {activeView === "entradas" && "Registro de salários, ganhos de frota, aluguéis recebidos, bar e água, devedores e outros"}
            {activeView === "saidas" && "Controle de despesas gerais, faturas de cartões, prestações e outros"}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 self-start sm:self-center bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-4 py-2 rounded border border-slate-800 hover:border-slate-700 transition-all duration-200 font-mono text-xs uppercase tracking-wider cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${loading ? "animate-spin" : ""}`} />
          Sincronizar
        </button>
      </div>

      {/* Indicador de Status do Banco de Dados */}
      {dbStatus && (
        <div className={`border rounded-xl p-4 transition-all duration-300 ${
          dbStatus.mode === "supabase" 
            ? "bg-emerald-950/10 border-emerald-500/20 text-emerald-400"
            : dbStatus.mode === "supabase_missing_table"
            ? "bg-amber-950/10 border-amber-500/30 text-amber-300"
            : "bg-rose-950/10 border-rose-500/20 text-rose-300"
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-mono font-bold text-xs uppercase tracking-wider">
                  {dbStatus.mode === "supabase" && "🟢 BANCO DE DADOS EM NUVEM (SUPABASE) CONECTADO"}
                  {dbStatus.mode === "supabase_missing_table" && "⚠️ SUPABASE CONECTADO - TABELA NÃO ENCONTRADA"}
                  {dbStatus.mode === "local_file" && "🔴 MODO DE ARMAZENAMENTO LOCAL TEMPORÁRIO"}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {dbStatus.mode === "supabase" && "Seu aplicativo está totalmente integrado ao Supabase. Todos os seus dados, lançamentos e alterações estão seguros e salvos permanentemente na nuvem."}
                  {dbStatus.mode === "supabase_missing_table" && "Suas chaves do Supabase estão configuradas, mas a tabela 'vortex_finance' ainda não foi criada. Crie a tabela usando o script SQL abaixo para começar a salvar permanentemente."}
                  {dbStatus.mode === "local_file" && "Seus dados estão sendo guardados de forma temporária na memória do servidor. Eles SUMIRÃO quando o servidor reiniciar ou quando você atualizar/recompilar o aplicativo. Para salvar para sempre, você precisa configurar as variáveis de ambiente e criar a tabela no Supabase."}
                </p>
                {dbStatus.syncError && (
                  <p className="text-[10px] font-mono text-rose-400 mt-1 uppercase">Erro do servidor: {dbStatus.syncError}</p>
                )}
              </div>
            </div>
            
            {dbStatus.mode !== "supabase" && (
              <button
                onClick={() => setShowDbGuide(!showDbGuide)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 px-3 py-1.5 rounded border border-slate-800 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all self-start md:self-center cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                {showDbGuide ? "Ocultar Instruções" : "Como Salvar Permanente?"}
              </button>
            )}
          </div>

          {/* Guia de Configuração e SQL */}
          {showDbGuide && (
            <div className="mt-4 border-t border-slate-800 pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 text-xs text-slate-300">
                  <p className="font-bold text-white uppercase tracking-wider font-mono text-[10px]">1. Configurar Variáveis de Ambiente no Host (Vercel ou outro):</p>
                  <p>Defina as seguintes variáveis com as credenciais do seu projeto Supabase:</p>
                  <ul className="list-disc pl-4 space-y-1 font-mono text-[10px] text-slate-400 bg-slate-950/50 p-2.5 rounded border border-slate-850">
                    <li>SUPABASE_URL = <span className="text-cyan-400">https://seu-projeto.supabase.co</span></li>
                    <li>SUPABASE_ANON_KEY = <span className="text-indigo-400 font-bold">sua-chave-anon-key-aqui</span></li>
                  </ul>
                  <p className="text-[10px] text-slate-400">Isso fará o aplicativo se conectar automaticamente ao seu banco de dados Supabase.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-white uppercase tracking-wider font-mono text-[10px]">2. Executar no SQL Editor do Supabase:</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`-- Criar a tabela vortex_finance para persistência de dados
CREATE TABLE IF NOT EXISTS vortex_finance (
    id TEXT PRIMARY KEY,
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir o registro padrão caso não exista
INSERT INTO vortex_finance (id, data, updated_at)
VALUES ('default', '{"receitas": [], "despesas": [], "faturas": [], "pagamentos_diarios": [], "dividas_outros": [], "prestacoes": [], "subscriptions": [], "passkeys": []}'::jsonb, now())
ON CONFLICT (id) DO NOTHING;`);
                        setSqlCopied(true);
                        setTimeout(() => setSqlCopied(false), 2000);
                      }}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono text-[10px] uppercase cursor-pointer"
                    >
                      {sqlCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {sqlCopied ? "Copiado!" : "Copiar SQL"}
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-slate-400 bg-slate-950 p-3 rounded border border-slate-900 overflow-x-auto max-h-36 leading-relaxed select-all">
{`-- Criar a tabela vortex_finance para persistência de dados
CREATE TABLE IF NOT EXISTS vortex_finance (
    id TEXT PRIMARY KEY,
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir o registro padrão caso não exista
INSERT INTO vortex_finance (id, data, updated_at)
VALUES ('default', '{"receitas": [], "despesas": [], "faturas": [], "pagamentos_diarios": [], "dividas_outros": [], "prestacoes": [], "subscriptions": [], "passkeys": []}'::jsonb, now())
ON CONFLICT (id) DO NOTHING;`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RENDER VIEW: PAINEL */}
      {activeView === "painel" && (
        <div className="space-y-6">
          {/* 1. Alertas Visuais no Topo */}
          {urgentAlerts.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2 text-indigo-400">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-orange-400" />
                <h3 className="font-mono uppercase font-bold text-xs tracking-wider">Alertas do Sistema de Vencimentos ({urgentAlerts.length})</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {urgentAlerts.map(alert => (
                  <div key={alert.id} className="bg-slate-950/80 border border-slate-800 p-3 rounded flex items-start gap-2.5 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0 animate-ping" />
                    <div>
                      <p className="font-bold text-slate-200 uppercase text-[10px] tracking-wider font-mono text-orange-400">{alert.title}</p>
                      <p className="text-slate-300 mt-1 leading-relaxed font-mono text-[11px]">{alert.message}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-1 uppercase">Prazo: {alert.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 2. Dashboard de Saldo Geral */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Saldo Geral Formula Card */}
            <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-4 relative overflow-hidden shadow-lg col-span-1 sm:col-span-2 lg:col-span-1">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Wallet className="w-20 h-20 text-indigo-400" />
              </div>
              <div className="text-[10px] font-mono font-bold tracking-widest text-indigo-400 uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Saldo Geral Previsto
              </div>
              <div className="text-2xl font-mono font-bold text-white mt-2">
                R$ {saldoGeralCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[9px] text-indigo-300/70 mt-3 font-mono uppercase tracking-wider leading-relaxed">
                fórmula: (recebidos + pendentes) - contas/faturas
              </p>
            </div>

            {/* Saldo Atual */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden shadow-lg">
              <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Saldo Recebido (Mês)
              </div>
              <div className="text-2xl font-mono font-bold text-emerald-400 mt-2">
                R$ {saldoAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-slate-500 mt-3 font-mono uppercase tracking-wider">
                Total já compensado em conta
              </p>
            </div>

            {/* Valor Diário Ativo */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden shadow-lg">
              <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> Valor Diário Ativo
              </div>
              <div className="text-2xl font-mono font-bold text-indigo-400 mt-2">
                R$ {pagamentosDiarios
                  .filter(p => p.status === "pendente" || p.parcela_atual < p.parcela_total)
                  .reduce((acc, curr) => acc + (curr.valor_parcela || 0), 0)
                  .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-slate-500 mt-3 font-mono uppercase tracking-wider">
                Soma das parcelas diárias ativas
              </p>
            </div>

            {/* Entradas Previstas */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden shadow-lg">
              <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-orange-400" /> Entradas Previstas
              </div>
              <div className="text-2xl font-mono font-bold text-orange-400 mt-2">
                R$ {entradasPrevistas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-slate-500 mt-3 font-mono uppercase tracking-wider">
                Valores a compensar neste período
              </p>
            </div>

            {/* Despesas + Faturas */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden shadow-lg">
              <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> Compromissos (Mês)
              </div>
              <div className="text-2xl font-mono font-bold text-rose-400 mt-2">
                R$ {totalContasMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-slate-500 mt-3 font-mono uppercase tracking-wider">
                Soma de boletos e faturas
              </p>
            </div>
          </div>

          {/* Central de Notificações & Simulação de Alertas */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-indigo-400" />
                <h3 className="font-mono font-bold text-[10px] text-slate-200 uppercase tracking-wider">Serviços de Alertas & Notificações Push</h3>
              </div>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/20 bg-slate-950 px-2.5 py-1 rounded transition-all duration-200 cursor-pointer"
              >
                {showNotifications ? "Ocultar Painel" : "Configurar Alertas"}
              </button>
            </div>
            
            <p className="text-[10px] text-slate-500 leading-relaxed font-mono uppercase">
              Configure o envio de alertas nativos via Web Push e teste o motor pg_cron de varredura automática de faturas e despesas com vencimento em 1 dia.
            </p>
            
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="pt-2 border-t border-slate-800"
              >
                <NotificationManager />
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Lendo tabelas de dados...</p>
        </div>
      )}

      {/* Interactive Data Grids */}
      {!loading && (
        <div className="space-y-6">
          
          {/* TABELA: RECEITAS (ENTRADAS) */}
          {activeView === "entradas" && (
            <div className="space-y-6 w-full">
              {/* Horizontal Scrollable Subtabs selector for ENTRADAS */}
              <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-800 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                <button
                  onClick={() => setSubTabEntradas("salario")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono uppercase tracking-wider border whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    subTabEntradas === "salario"
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                  Salário
                  <span className="ml-1.5 bg-slate-950 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
                    R$ {receitas.filter(r => r.categoria === "salario").reduce((acc, c) => acc + c.valor, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </button>

                <button
                  onClick={() => setSubTabEntradas("carros")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono uppercase tracking-wider border whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    subTabEntradas === "carros"
                      ? "bg-indigo-500/10 border-indigo-500 text-indigo-400 font-bold"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <Car className="w-3.5 h-3.5 text-indigo-400" />
                  Carros
                  <span className="ml-1.5 bg-slate-950 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
                    R$ {(
                      receitas.filter(r => r.categoria === "carros").reduce((acc, c) => acc + c.valor, 0) +
                      pagamentosDiarios.reduce((acc, c) => acc + (c.valor_pago_mes || 0), 0)
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </button>

                <button
                  onClick={() => setSubTabEntradas("alugueis")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono uppercase tracking-wider border whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    subTabEntradas === "alugueis"
                      ? "bg-cyan-500/10 border-cyan-500 text-cyan-400 font-bold"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <Home className="w-3.5 h-3.5 text-cyan-400" />
                  Aluguéis
                  <span className="ml-1.5 bg-slate-950 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
                    R$ {(
                      receitas.filter(r => r.categoria === "alugueis").reduce((acc, c) => acc + c.valor, 0) +
                      dividasOutros.filter(d => d.tipo === "aluguel").reduce((acc, c) => acc + (c.status === "pago" ? c.valor_pago : (c.valor_pago_mes || 0)), 0)
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </button>

                <button
                  onClick={() => setSubTabEntradas("bar_agua")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono uppercase tracking-wider border whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    subTabEntradas === "bar_agua"
                      ? "bg-blue-500/10 border-blue-500 text-blue-400 font-bold"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <GlassWater className="w-3.5 h-3.5 text-blue-400" />
                  Bar e Água
                  <span className="ml-1.5 bg-slate-950 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
                    R$ {receitas.filter(r => r.categoria === "bar_agua").reduce((acc, c) => acc + c.valor, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </button>

                <button
                  onClick={() => setSubTabEntradas("devedores")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono uppercase tracking-wider border whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    subTabEntradas === "devedores"
                      ? "bg-amber-500/10 border-amber-500 text-amber-400 font-bold"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  Devedores
                  <span className="ml-1.5 bg-slate-950 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
                    R$ {dividasOutros.filter(d => d.tipo === "divida").reduce((acc, c) => acc + (c.status === "pago" ? c.valor_pago : (c.valor_pago_mes || 0)), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </button>

                <button
                  onClick={() => setSubTabEntradas("outros")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono uppercase tracking-wider border whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    subTabEntradas === "outros"
                      ? "bg-purple-500/10 border-purple-500 text-purple-400 font-bold"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <MoreHorizontal className="w-3.5 h-3.5 text-purple-400" />
                  Outros
                  <span className="ml-1.5 bg-slate-950 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
                    R$ {receitas.filter(r => r.categoria === "outros" || !r.categoria).reduce((acc, c) => acc + c.valor, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </button>
              </div>

              {/* RENDER SUBTAB: SALARIO, BAR_AGUA, OUTROS, ALUGUEIS (Receitas) */}
              {(subTabEntradas === "salario" || subTabEntradas === "bar_agua" || subTabEntradas === "outros" || subTabEntradas === "alugueis") && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg"
                >
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <h2 className="font-mono text-xs uppercase tracking-wider font-bold text-slate-200">
                        {subTabEntradas === "salario" && "Registro de Salário"}
                        {subTabEntradas === "alugueis" && "Aluguéis Recebidos (Receitas)"}
                        {subTabEntradas === "bar_agua" && "Ganhos do Bar & Água"}
                        {subTabEntradas === "outros" && "Outras Receitas"}
                      </h2>
                    </div>
                    <button
                      onClick={() => handleAddReceita(subTabEntradas)}
                      disabled={addingReceita}
                      className="bg-emerald-600 hover:bg-emerald-750 text-white px-2.5 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all duration-300 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Lançamento
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/50 text-[10px] uppercase text-slate-500 font-mono sticky top-0">
                          <th className="p-3">Descrição</th>
                          {subTabEntradas === "carros" && <th className="p-3">Veículo / Placa</th>}
                          <th className="p-3 font-mono">Data</th>
                          <th className="p-3 font-mono">Valor (R$)</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-center">Recorrente</th>
                          <th className="p-3 w-12 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-mono divide-y divide-slate-800/40">
                        {receitas.filter(r => r.categoria === subTabEntradas || (subTabEntradas === "outros" && (!r.categoria || r.categoria === "outros"))).length === 0 ? (
                          <tr>
                            <td colSpan={subTabEntradas === "carros" ? 7 : 6} className="text-center py-6 text-slate-600 font-mono text-[11px] uppercase">
                              Nenhum registro encontrado nesta categoria.
                            </td>
                          </tr>
                        ) : (
                          receitas.filter(r => r.categoria === subTabEntradas || (subTabEntradas === "outros" && (!r.categoria || r.categoria === "outros"))).map(rec => (
                            <tr key={rec.id} className="hover:bg-slate-850/30 group transition-colors duration-150">
                              {/* Descricao */}
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={rec.descricao}
                                  onChange={(e) => saveReceita(rec.id, { descricao: e.target.value })}
                                  className="w-full bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 text-slate-200 focus:outline-none"
                                />
                              </td>
                              {/* Placa/Modelo */}
                              {subTabEntradas === "carros" && (
                                <td className="p-2">
                                  <div className="flex items-center gap-1 bg-transparent hover:bg-slate-950/50 border border-transparent rounded focus-within:bg-slate-950 focus-within:border-slate-700 transition-all">
                                    <Car className="w-3.5 h-3.5 text-slate-600 pl-1" />
                                    <input
                                      type="text"
                                      placeholder="Placa / Modelo"
                                      value={rec.placa_modelo || ""}
                                      onChange={(e) => saveReceita(rec.id, { placa_modelo: e.target.value || null })}
                                      className="w-full bg-transparent border-none py-1 px-1 text-slate-300 focus:outline-none placeholder:text-slate-700 text-xs"
                                    />
                                  </div>
                                </td>
                              )}
                              {/* Data */}
                              <td className="p-2">
                                <input
                                  type="date"
                                  value={rec.data}
                                  onChange={(e) => saveReceita(rec.id, { data: e.target.value })}
                                  className="bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 text-slate-300 focus:outline-none font-mono text-xs"
                                />
                              </td>
                              {/* Valor */}
                              <td className="p-2">
                                <div className="flex items-center gap-1 bg-transparent hover:bg-slate-950/50 border border-transparent rounded focus-within:bg-slate-950 focus-within:border-slate-700 transition-all px-2">
                                  <span className="text-slate-600">R$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={rec.valor || ""}
                                    onChange={(e) => saveReceita(rec.id, { valor: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-transparent border-none py-1 focus:outline-none text-emerald-400 font-bold"
                                  />
                                </div>
                              </td>
                              {/* Status */}
                              <td className="p-2">
                                <div className="flex items-center gap-1.5 justify-start">
                                  <button
                                    onClick={() => saveReceita(rec.id, { 
                                      status_recebimento: rec.status_recebimento === "recebido" ? "pendente" : "recebido" 
                                    })}
                                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition-all duration-150 cursor-pointer border ${
                                      rec.status_recebimento === "recebido"
                                        ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                                        : "bg-orange-500/5 border-orange-500/20 text-orange-400"
                                    }`}
                                  >
                                    {rec.status_recebimento === "recebido" ? "RECB" : "PEND"}
                                  </button>
                                  
                                  {rec.status_recebimento === "pendente" && (
                                    <button
                                      onClick={() => handleMarkAsPaidAndRollover(rec)}
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1 shadow-sm active:scale-95 border border-emerald-500/30"
                                      title="Receber este mês (registra na carteira) e avançar data para o próximo mês"
                                    >
                                      <Check className="w-2.5 h-2.5" /> Pago
                                    </button>
                                  )}
                                </div>
                              </td>
                              {/* Recorrente */}
                              <td className="p-2 text-center">
                                <button
                                  onClick={() => saveReceita(rec.id, { recorrente: !rec.recorrente })}
                                  className={`p-1.5 rounded transition-all duration-150 cursor-pointer ${
                                    rec.recorrente 
                                      ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20" 
                                      : "text-slate-600 hover:text-slate-400 hover:bg-slate-800"
                                  }`}
                                  title={rec.recorrente ? "Receita Recorrente Ativa (Todo mês entra)" : "Ativar Receita Recorrente"}
                                >
                                  <Repeat className="w-3.5 h-3.5" />
                                </button>
                              </td>
                              {/* Delete */}
                              <td className="p-2 text-center">
                                <button
                                  onClick={() => handleDeleteReceita(rec.id)}
                                  className="text-slate-600 hover:text-rose-400 p-1 rounded hover:bg-rose-500/5 transition-all duration-200 cursor-pointer"
                                  title="Deletar receita"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {/* CARROS EXTRA TABLE: PAGAMENTOS DIÁRIOS & PRESTAÇÕES DO VEÍCULO (FATURAMENTO DE VEÍCULOS) */}
              {subTabEntradas === "carros" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg mt-6"
                >
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <h2 className="font-mono text-xs uppercase tracking-wider font-bold text-slate-200">Faturamento de Veículos</h2>
                    </div>
                    <button
                      onClick={handleAddPagamentoDiario}
                      disabled={addingPagamento}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all duration-300 cursor-pointer font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Lançamento
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/50 text-[10px] uppercase text-slate-500 font-mono sticky top-0">
                          <th className="p-3">Nome</th>
                          <th className="p-3">Veículo</th>
                          <th className="p-3 text-center">Quantidade de Parcelas</th>
                          <th className="p-3 text-center">Parcelas Pagas</th>
                          <th className="p-3 font-mono text-center">Valor Parcela (R$)</th>
                          <th className="p-3 font-mono">Valor Pago</th>
                          <th className="p-3 font-mono">Valor Restante</th>
                          <th className="p-3 font-mono text-center">Último Pagamento Data</th>
                          <th className="p-3 text-center">Registrar Pagamento</th>
                          <th className="p-3 w-12 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-mono divide-y divide-slate-800/40">
                        {pagamentosDiarios.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="text-center py-6 text-slate-600 font-mono text-[11px] uppercase">Nenhum faturamento de veículo registrado.</td>
                          </tr>
                        ) : (
                          pagamentosDiarios.map(pag => {
                            const valParcela = pag.valor_parcela !== undefined && pag.valor_parcela !== null ? pag.valor_parcela : 100;
                            const valPagoMes = pag.valor_pago_mes !== undefined ? pag.valor_pago_mes : 0;
                            
                            const handleQuickPay = (increments: number) => {
                               const newParcelaAtual = Math.min(pag.parcela_total, pag.parcela_atual + increments);
                               const addedValue = (newParcelaAtual - pag.parcela_atual) * valParcela;
                               
                               savePagamentoDiario(pag.id, {
                                 parcela_atual: newParcelaAtual,
                                 valor_pago_mes: valPagoMes + addedValue,
                                 data: new Date().toISOString().split("T")[0]
                               });
                            };

                            return (
                              <tr key={pag.id} className="hover:bg-slate-850/30 group transition-colors duration-150">
                                {/* Nome */}
                                <td className="p-2 min-w-[150px]">
                                  <input
                                    type="text"
                                    value={pag.descricao}
                                    onChange={(e) => savePagamentoDiario(pag.id, { descricao: e.target.value })}
                                    className="w-full bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 text-slate-200 focus:outline-none"
                                  />
                                </td>
                                
                                {/* Veiculo */}
                                <td className="p-2 min-w-[150px]">
                                  <div className="flex items-center gap-1 bg-transparent hover:bg-slate-950/50 border border-transparent rounded focus-within:bg-slate-950 focus-within:border-slate-700 transition-all">
                                    <Car className="w-3.5 h-3.5 text-slate-600 pl-1" />
                                    <input
                                      type="text"
                                      placeholder="Modelo / Placa"
                                      value={pag.veiculo || ""}
                                      onChange={(e) => savePagamentoDiario(pag.id, { veiculo: e.target.value })}
                                      className="w-full bg-transparent border-none py-1 px-1 text-slate-300 focus:outline-none placeholder:text-slate-750 text-xs font-mono"
                                    />
                                  </div>
                                </td>

                                {/* Quantidade de Parcelas */}
                                <td className="p-2 text-center">
                                  <input
                                    type="number"
                                    value={pag.parcela_total}
                                    onChange={(e) => savePagamentoDiario(pag.id, { parcela_total: parseInt(e.target.value) || 0 })}
                                    className="w-16 bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 text-center text-slate-300 focus:outline-none font-bold font-mono"
                                  />
                                </td>

                                {/* Parcelas Pagas */}
                                <td className="p-2 text-center">
                                  <input
                                    type="number"
                                    value={pag.parcela_atual}
                                    onChange={(e) => savePagamentoDiario(pag.id, { parcela_atual: parseInt(e.target.value) || 0 })}
                                    className="w-16 bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 text-center text-emerald-400 focus:outline-none font-bold font-mono"
                                  />
                                </td>

                                {/* Valor Parcela */}
                                <td className="p-2">
                                  <div className="flex items-center justify-center gap-1 bg-slate-950/50 hover:bg-slate-950 border border-slate-800/60 rounded px-2 py-0.5 mx-auto max-w-[110px]">
                                    <span className="text-slate-500 text-[10px] font-bold">R$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={valParcela}
                                      onChange={(e) => savePagamentoDiario(pag.id, { valor_parcela: parseFloat(e.target.value) || 0 })}
                                      className="flex-1 min-w-0 bg-transparent border-none py-1 focus:outline-none text-slate-200 font-bold text-xs font-mono"
                                    />
                                  </div>
                                </td>

                                {/* Valor Pago */}
                                <td className="p-3 text-emerald-400 font-bold text-xs whitespace-nowrap">
                                  R$ {(pag.valor_pago ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                {/* Valor Restante */}
                                <td className="p-3 text-rose-400 font-bold text-xs whitespace-nowrap">
                                  R$ {(pag.valor_saldo ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                {/* Ultimo Pagamento Data */}
                                <td className="p-2 text-center">
                                  <input
                                    type="date"
                                    value={pag.data}
                                    onChange={(e) => savePagamentoDiario(pag.id, { data: e.target.value })}
                                    className="bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 text-slate-300 focus:outline-none font-mono text-xs"
                                  />
                                </td>

                                {/* Registrar Pagamento (BOTAO RAPIDO PAGAR) */}
                                <td className="p-2 text-center min-w-[110px]">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input
                                      type="number"
                                      min={1}
                                      max={pag.parcela_total - pag.parcela_atual}
                                      value={payQuantities[pag.id] ?? 1}
                                      onChange={(e) => {
                                        const val = Math.max(1, parseInt(e.target.value) || 1);
                                        setPayQuantities(prev => ({ ...prev, [pag.id]: val }));
                                      }}
                                      className="w-9 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-center text-white text-xs font-bold font-mono focus:outline-none"
                                    />
                                    <button
                                      onClick={() => {
                                        const qty = payQuantities[pag.id] ?? 1;
                                        handleQuickPay(qty);
                                        setPayQuantities(prev => ({ ...prev, [pag.id]: 1 }));
                                      }}
                                      disabled={pag.parcela_atual >= pag.parcela_total}
                                      className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-mono text-[10px] font-bold px-2.5 py-1.5 rounded uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1 shadow-md active:scale-95"
                                      title="Registrar pagamento rápido"
                                    >
                                      <Check className="w-3 h-3" /> Pagar
                                    </button>
                                  </div>
                                </td>

                                {/* Ações */}
                                <td className="p-2 text-center">
                                  <button
                                    onClick={() => handleDeletePagamentoDiario(pag.id)}
                                    className="text-slate-600 hover:text-rose-400 p-1.5 rounded hover:bg-rose-500/5 transition-all duration-200 cursor-pointer"
                                    title="Excluir lançamento"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {/* ALUGUÉIS / DEVEDORES / OUTROS: TABLE FOR DIVIDAS_OUTROS */}
              {(subTabEntradas === "alugueis" || subTabEntradas === "devedores" || subTabEntradas === "outros") && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg mt-6"
                >
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      <h2 className="font-mono text-xs uppercase tracking-wider font-bold text-slate-200">
                        {subTabEntradas === "alugueis" && "Aluguéis de Imóveis & Cobrança de Terceiros"}
                        {subTabEntradas === "devedores" && "Dívidas de Terceiros & Devedores Ativos"}
                        {subTabEntradas === "outros" && "Outras Pendências Ativas de Terceiros"}
                      </h2>
                    </div>
                    <button
                      onClick={() => handleAddDividaOutros(subTabEntradas === "alugueis" ? "aluguel" : subTabEntradas === "devedores" ? "divida" : "outros")}
                      disabled={addingDivida}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white px-2.5 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all duration-300 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Cobrança
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/50 text-[10px] uppercase text-slate-500 font-mono sticky top-0">
                          <th className="p-3">Devedor / Nome</th>
                          <th className="p-3 font-mono">Valor Parcela (R$)</th>
                          <th className="p-3 font-mono text-center w-24">Prestações Pagas</th>
                          <th className="p-3 font-mono text-center w-24">Total Prestações</th>
                          <th className="p-3 font-mono">Restante (R$)</th>
                          <th className="p-3">Vencimento</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-center">Pagar</th>
                          <th className="p-3 w-12 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-mono divide-y divide-slate-800/40">
                        {dividasOutros.filter(d => 
                          (subTabEntradas === "alugueis" && d.tipo === "aluguel") ||
                          (subTabEntradas === "devedores" && d.tipo === "divida") ||
                          (subTabEntradas === "outros" && (d.tipo === "outros" || !d.tipo))
                        ).length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-6 text-slate-600 font-mono text-[11px] uppercase">Nenhum registro ativo.</td>
                          </tr>
                        ) : (
                          dividasOutros.filter(d => 
                            (subTabEntradas === "alugueis" && d.tipo === "aluguel") ||
                            (subTabEntradas === "devedores" && d.tipo === "divida") ||
                            (subTabEntradas === "outros" && (d.tipo === "outros" || !d.tipo))
                          ).map(div => {
                            const valParcela = div.valor_parcela !== undefined ? div.valor_parcela : (div.valor_total || 0);
                            const parcPagas = div.parcela_atual !== undefined ? div.parcela_atual : 0;
                            const parcTotal = div.parcela_total !== undefined ? div.parcela_total : 12;
                            const remaining = Math.max(0, (parcTotal - parcPagas) * valParcela);

                            return (
                              <tr key={div.id} className="hover:bg-slate-850/30 group transition-colors duration-150">
                                {/* Nome / Devedor */}
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={div.devedor}
                                    onChange={(e) => saveDividaOutros(div.id, { devedor: e.target.value })}
                                    className="w-full bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 text-slate-200 focus:outline-none"
                                  />
                                </td>

                                {/* Valor da Parcela */}
                                <td className="p-2">
                                  <div className="flex items-center gap-1 bg-transparent hover:bg-slate-950/50 border border-transparent rounded focus-within:bg-slate-950 focus-within:border-slate-700 transition-all px-2">
                                    <span className="text-slate-600">R$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={valParcela}
                                      onChange={(e) => saveDividaOutros(div.id, { valor_parcela: parseFloat(e.target.value) || 0 })}
                                      className="w-full bg-transparent border-none py-1 focus:outline-none text-cyan-400 font-bold"
                                    />
                                  </div>
                                </td>

                                {/* Prestações Pagas */}
                                <td className="p-2 w-24">
                                  <input
                                    type="number"
                                    min={0}
                                    max={parcTotal}
                                    value={parcPagas}
                                    onChange={(e) => saveDividaOutros(div.id, { parcela_atual: Math.min(parcTotal, Math.max(0, parseInt(e.target.value) || 0)) })}
                                    className="w-full bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 text-center text-indigo-400 font-bold focus:outline-none"
                                  />
                                </td>

                                {/* Total Prestações */}
                                <td className="p-2 w-24">
                                  <input
                                    type="number"
                                    min={1}
                                    value={parcTotal}
                                    onChange={(e) => saveDividaOutros(div.id, { parcela_total: Math.max(1, parseInt(e.target.value) || 1) })}
                                    className="w-full bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 text-center text-slate-300 font-bold focus:outline-none"
                                  />
                                </td>

                                {/* Restante */}
                                <td className="p-3 font-bold text-amber-400 text-xs whitespace-nowrap">
                                  R$ {remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                {/* Vencimento */}
                                <td className="p-2">
                                  <input
                                    type="date"
                                    value={div.data_vencimento}
                                    onChange={(e) => saveDividaOutros(div.id, { data_vencimento: e.target.value })}
                                    className="bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 text-slate-300 focus:outline-none font-mono text-xs"
                                  />
                                </td>

                                {/* Status */}
                                <td className="p-2 text-center">
                                  <button
                                    onClick={() => saveDividaOutros(div.id, { 
                                      status: div.status === "pago" ? "pendente" : "pago" 
                                    })}
                                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition-all duration-150 cursor-pointer border ${
                                      div.status === "pago"
                                        ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                                        : "bg-orange-500/5 border-orange-500/20 text-orange-400"
                                    }`}
                                  >
                                    {div.status === "pago" ? "PAGO" : "PEND"}
                                  </button>
                                </td>

                                {/* Botão Pagar & Avançar Data */}
                                <td className="p-2 text-center">
                                  <button
                                    onClick={() => handlePayDividaAndRollover(div)}
                                    disabled={parcPagas >= parcTotal}
                                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-mono text-[9px] font-bold px-2.5 py-1 rounded uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 shadow-sm active:scale-95 border border-emerald-500/30 mx-auto"
                                    title="Receber parcela, avançar data para o próximo mês e deixar como pendente"
                                  >
                                    <Check className="w-2.5 h-2.5" /> Pagar
                                  </button>
                                </td>

                                {/* Ações */}
                                <td className="p-2 text-center">
                                  <button
                                    onClick={() => handleDeleteDividaOutros(div.id)}
                                    className="text-slate-600 hover:text-rose-400 p-1 rounded hover:bg-rose-500/5 transition-all duration-200 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* TABELA: DESPESAS (SAÍDAS) */}
          {activeView === "saidas" && (
            <div className="space-y-6 w-full">
              {/* Horizontal Scrollable Subtabs selector for SAÍDAS */}
              <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-800 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                <button
                  onClick={() => setSubTabSaidas("alugueis")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono uppercase tracking-wider border whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    subTabSaidas === "alugueis"
                      ? "bg-rose-500/10 border-rose-500 text-rose-400 font-bold"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <Home className="w-3.5 h-3.5 text-rose-400" />
                  Aluguéis
                  <span className="ml-1.5 bg-slate-950 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
                    R$ {despesas.filter(d => d.categoria === "alugueis").reduce((acc, c) => acc + c.valor, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </button>

                <button
                  onClick={() => setSubTabSaidas("cartoes")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono uppercase tracking-wider border whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    subTabSaidas === "cartoes"
                      ? "bg-indigo-500/10 border-indigo-500 text-indigo-400 font-bold"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                  Cartões
                  <span className="ml-1.5 bg-slate-950 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
                    R$ {faturas.reduce((acc, c) => acc + (c.gastos_totais || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </button>

                <button
                  onClick={() => setSubTabSaidas("dividas")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono uppercase tracking-wider border whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    subTabSaidas === "dividas"
                      ? "bg-amber-500/10 border-amber-500 text-amber-400 font-bold"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <HandCoins className="w-3.5 h-3.5 text-amber-400" />
                  Dívidas
                  <span className="ml-1.5 bg-slate-950 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
                    R$ {prestacoes.filter(p => p.status === "pendente").reduce((acc, c) => acc + c.valor_parcela, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </button>

                <button
                  onClick={() => setSubTabSaidas("outros")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono uppercase tracking-wider border whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    subTabSaidas === "outros"
                      ? "bg-purple-500/10 border-purple-500 text-purple-400 font-bold"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <MoreHorizontal className="w-3.5 h-3.5 text-purple-400" />
                  Outros
                  <span className="ml-1.5 bg-slate-950 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
                    R$ {despesas.filter(d => d.categoria === "outros" || !d.categoria).reduce((acc, c) => acc + c.valor, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </button>
              </div>

              {/* RENDER SUBTAB: ALUGUEIS E OUTROS (DESPESAS GERAIS) */}
              {(subTabSaidas === "alugueis" || subTabSaidas === "outros") && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg"
                >
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <h2 className="font-mono text-xs uppercase tracking-wider font-bold text-slate-200">
                      {subTabSaidas === "alugueis" ? "Compromissos de Aluguel (Saídas)" : "Despesas & Compromissos Diversos"}
                    </h2>
                  </div>
                  <button
                    onClick={() => handleAddDespesa(subTabSaidas)}
                    disabled={addingDespesa}
                    className="bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-500/20 px-2.5 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all duration-300 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Despesa
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/50 text-[10px] uppercase text-slate-500 font-mono sticky top-0">
                        <th className="p-3">Descrição do Gasto</th>
                        <th className="p-3">Vencimento</th>
                        <th className="p-3 font-mono">Valor (R$)</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-center">Recorrente</th>
                        <th className="p-3 w-12 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-mono divide-y divide-slate-800/40">
                      {despesas.filter(d => d.categoria === subTabSaidas || (subTabSaidas === "outros" && (!d.categoria || d.categoria === "outros"))).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-slate-600 font-mono text-[11px] uppercase font-bold">Nenhuma despesa registrada nesta categoria.</td>
                        </tr>
                      ) : (
                        despesas.filter(d => d.categoria === subTabSaidas || (subTabSaidas === "outros" && (!d.categoria || d.categoria === "outros"))).map(des => {
                          const hasChanges = unsavedDespesaIds.includes(des.id);
                          const isSaving = savingDespesaIds.includes(des.id);
                          return (
                            <tr 
                              key={des.id} 
                              className={`transition-colors duration-150 ${
                                hasChanges 
                                  ? "bg-indigo-950/5 hover:bg-indigo-950/10 border-l-2 border-indigo-500" 
                                  : "hover:bg-slate-850/30"
                              }`}
                            >
                              {/* Descricao */}
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={des.descricao}
                                  onChange={(e) => updateDespesaLocally(des.id, { descricao: e.target.value })}
                                  className="w-full bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 text-slate-200 focus:outline-none"
                                />
                              </td>
                              {/* Data Vencimento */}
                              <td className="p-2">
                                <input
                                  type="date"
                                  value={des.data_vencimento}
                                  onChange={(e) => updateDespesaLocally(des.id, { data_vencimento: e.target.value })}
                                  className={`bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 focus:outline-none font-mono text-xs text-slate-300`}
                                />
                              </td>
                              {/* Valor */}
                              <td className="p-2">
                                <div className="flex items-center gap-1 bg-transparent hover:bg-slate-950/50 border border-transparent rounded focus-within:bg-slate-950 focus-within:border-slate-700 transition-all px-2">
                                  <span className="text-slate-600">R$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={des.valor || ""}
                                    onChange={(e) => updateDespesaLocally(des.id, { valor: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-transparent border-none py-1 focus:outline-none text-rose-400 font-bold"
                                  />
                                </div>
                              </td>
                              {/* Status */}
                              <td className="p-2">
                                <button
                                  onClick={() => updateDespesaLocally(des.id, { 
                                    status_pagamento: des.status_pagamento === "pago" ? "pendente" : "pago" 
                                  })}
                                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition-all duration-150 cursor-pointer border ${
                                    des.status_pagamento === "pago"
                                      ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                                      : "bg-rose-500/5 border-rose-500/20 text-rose-400"
                                  }`}
                                >
                                  {des.status_pagamento === "pago" ? "PAGO" : "PEND"}
                                </button>
                              </td>
                              {/* Recorrente */}
                              <td className="p-2 text-center">
                                <button
                                  onClick={() => updateDespesaLocally(des.id, { recorrente: !des.recorrente })}
                                  className={`p-1.5 rounded transition-all duration-150 cursor-pointer ${
                                    des.recorrente 
                                      ? "text-rose-400 bg-rose-500/10 hover:bg-rose-500/20" 
                                      : "text-slate-600 hover:text-slate-400 hover:bg-slate-800"
                                  }`}
                                  title={des.recorrente ? "Pagamento Recorrente Ativo (Todo mês entra)" : "Ativar Pagamento Recorrente"}
                                >
                                  <Repeat className="w-3.5 h-3.5" />
                                </button>
                              </td>
                              {/* Ações */}
                              <td className="p-2 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {hasChanges && (
                                    <>
                                      <button
                                        onClick={() => handleSaveDespesa(des.id)}
                                        disabled={isSaving}
                                        className="text-emerald-400 hover:text-emerald-300 p-1.5 rounded hover:bg-emerald-500/10 transition-all duration-200 cursor-pointer flex items-center justify-center relative group"
                                        title="Salvar alterações"
                                      >
                                        {isSaving ? (
                                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Save className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                      
                                      <button
                                        onClick={() => cancelDespesaChanges(des.id)}
                                        className="text-orange-400 hover:text-orange-300 p-1.5 rounded hover:bg-orange-500/10 transition-all duration-200 cursor-pointer flex items-center justify-center relative group"
                                        title="Desfazer alterações"
                                      >
                                        <Undo className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => handleDeleteDespesa(des.id)}
                                    className="text-slate-600 hover:text-rose-400 p-1.5 rounded hover:bg-rose-500/5 transition-all duration-200 cursor-pointer flex items-center justify-center"
                                    title="Deletar despesa"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* TABELA: FATURAS CARTOES */}
            {subTabSaidas === "cartoes" && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-400" />
                  <h2 className="font-mono text-xs uppercase tracking-wider font-bold text-slate-200">Meus Cartões Corporativos</h2>
                </div>
                <button
                  onClick={handleAddFatura}
                  disabled={addingFatura}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all duration-300 cursor-pointer shadow-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Cartão
                </button>
              </div>

              {/* Responsive container: horizontal scroll on mobile, responsive grid on desktop */}
              <div className="flex flex-row overflow-x-auto gap-5 pb-5 pt-1 px-1 snap-x snap-mandatory lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:overflow-x-visible scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                {faturas.length === 0 ? (
                  <div className="w-full text-center py-12 text-slate-500 font-mono text-xs uppercase border border-dashed border-slate-800 rounded-xl bg-slate-900/40">
                    Nenhum cartão corporativo registrado.
                  </div>
                ) : (
                  faturas.map((fat, idx) => {
                    const limite_atual = (fat.limite_total ?? 0) - (fat.gastos_totais ?? 0);
                    // Cycle through nice visual gradients for cards
                    const gradients = [
                      "from-slate-900 via-indigo-950 to-slate-900",
                      "from-slate-900 via-purple-950 to-slate-900",
                      "from-slate-900 via-slate-950 to-indigo-950",
                      "from-slate-900 via-blue-950 to-slate-900"
                    ];
                    const cardGrad = gradients[idx % gradients.length];
                    
                    return (
                      <motion.div
                        key={fat.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`w-[325px] xs:w-[350px] md:w-auto h-[260px] flex-shrink-0 snap-center rounded-2xl p-5 overflow-hidden shadow-2xl border border-white/10 flex flex-col justify-between relative bg-gradient-to-br ${cardGrad} text-white`}
                      >
                        {/* Soft glowing ambient light inside card */}
                        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
                        <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

                        {/* Top section: Card Name and Final Digits & Actions */}
                        <div className="flex items-start justify-between z-10">
                          <div className="flex flex-col">
                            <input
                              type="text"
                              value={fat.nome_cartao}
                              onChange={(e) => saveFatura(fat.id, { nome_cartao: e.target.value })}
                              className="bg-transparent border-b border-transparent focus:border-white/20 text-sm font-bold uppercase tracking-widest text-slate-100 hover:bg-white/5 px-1 py-0.5 rounded focus:outline-none focus:bg-slate-950/60 transition-all w-36"
                              placeholder="Nome do Cartão"
                            />
                            <span className="text-[8px] font-mono tracking-widest uppercase text-slate-500 mt-0.5">Vortex Corporate</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => saveFatura(fat.id, { 
                                status_pagamento: fat.status_pagamento === "pago" ? "pendente" : "pago" 
                              })}
                              className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-all duration-150 border cursor-pointer ${
                                fat.status_pagamento === "pago"
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                  : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                              }`}
                            >
                              {fat.status_pagamento === "pago" ? "PAGO" : "PEND"}
                            </button>
                            <button
                              onClick={() => handleDeleteFatura(fat.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-white/5 transition-all cursor-pointer"
                              title="Remover Cartão"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Middle Section: Chip, Contactless Signal, and final 4 digits */}
                        <div className="flex items-center justify-between z-10 mt-2">
                          <div className="flex items-center gap-2.5">
                            {/* Golden Chip */}
                            <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 border border-amber-600/30 flex flex-col justify-between p-1 opacity-80 shadow">
                              <div className="flex justify-between h-1">
                                <div className="w-2 h-full bg-slate-900/20 rounded-sm" />
                                <div className="w-2 h-full bg-slate-900/20 rounded-sm" />
                              </div>
                              <div className="h-px bg-slate-900/10 w-full" />
                              <div className="flex justify-between h-1">
                                <div className="w-2 h-full bg-slate-900/20 rounded-sm" />
                                <div className="w-2 h-full bg-slate-900/20 rounded-sm" />
                              </div>
                            </div>
                            {/* Contactless symbol (Wi-fi-like arcs) */}
                            <div className="flex gap-0.5 items-center">
                              <span className="w-0.5 h-2.5 bg-slate-400/80 rounded-full" />
                              <span className="w-0.5 h-3.5 bg-slate-400/80 rounded-full" />
                              <span className="w-0.5 h-4 bg-slate-400/80 rounded-full" />
                            </div>
                          </div>

                          {/* Final 4 digits of the card */}
                          <div className="flex items-center gap-1 font-mono text-sm tracking-wider text-slate-300">
                            <span className="text-xs text-slate-500">•••• •••• ••••</span>
                            <input
                              type="text"
                              maxLength={4}
                              placeholder="0000"
                              value={fat.finais_cartao || ""}
                              onChange={(e) => saveFatura(fat.id, { finais_cartao: e.target.value })}
                              className="w-12 bg-transparent text-center border-b border-transparent focus:border-indigo-500 hover:bg-white/5 py-0.5 rounded focus:outline-none font-bold text-white text-xs font-mono"
                            />
                          </div>
                        </div>

                        {/* Limits section: Total, Gastos & Available */}
                        <div className="grid grid-cols-2 gap-2 z-10 mt-1">
                          {/* Limit input */}
                          <div className="bg-slate-950/40 border border-white/5 rounded-lg px-2 py-1 flex flex-col">
                            <span className="text-[8px] text-slate-400 font-mono uppercase">Limite Total</span>
                            <div className="flex items-center gap-0.5">
                              <span className="text-[9px] text-slate-600 font-mono font-bold">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={fat.limite_total || ""}
                                onChange={(e) => saveFatura(fat.id, { limite_total: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-transparent border-none text-white text-[11px] font-mono font-bold focus:outline-none py-0.5"
                              />
                            </div>
                          </div>

                          {/* Spent input */}
                          <div className="bg-slate-950/40 border border-white/5 rounded-lg px-2 py-1 flex flex-col">
                            <span className="text-[8px] text-rose-300/80 font-mono uppercase">Gastos Atuais</span>
                            <div className="flex items-center gap-0.5">
                              <span className="text-[9px] text-rose-500/50 font-mono font-bold">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={fat.gastos_totais || ""}
                                onChange={(e) => saveFatura(fat.id, { gastos_totais: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-transparent border-none text-rose-400 text-[11px] font-mono font-bold focus:outline-none py-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Remaining Available Limit Glow Indicator */}
                        <div className="flex items-center justify-between z-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg px-2.5 py-1 text-[10px] font-mono uppercase font-bold tracking-wider">
                          <span>Limite Disponível</span>
                          <span>R$ {limite_atual.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>

                        {/* Bottom Metadata: Melhor Dia, Vencimento, Valor Fatura */}
                        <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-2 mt-1 z-10 text-[9px] text-slate-400 font-mono">
                          <div className="flex flex-col items-center">
                            <span className="uppercase text-[7px] text-slate-500">Comp. Dia</span>
                            <input
                              type="number"
                              min={1}
                              max={31}
                              value={fat.melhor_dia_compra || ""}
                              onChange={(e) => saveFatura(fat.id, { melhor_dia_compra: parseInt(e.target.value) || undefined })}
                              className="w-10 bg-transparent text-center text-slate-200 border-b border-transparent focus:border-white/20 focus:outline-none focus:bg-slate-950 font-mono mt-0.5"
                              placeholder="Dia"
                            />
                          </div>

                          <div className="flex flex-col items-center">
                            <span className="uppercase text-[7px] text-slate-500">Vencimento</span>
                            <input
                              type="date"
                              value={fat.data_vencimento}
                              onChange={(e) => saveFatura(fat.id, { data_vencimento: e.target.value })}
                              className="bg-transparent text-slate-200 text-center font-mono border-b border-transparent focus:border-white/20 focus:outline-none focus:bg-slate-950 w-20 max-w-full text-[9px] mt-0.5"
                            />
                          </div>

                          <div className="flex flex-col items-center">
                            <span className="uppercase text-[7px] text-indigo-400 font-bold">Fatura R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={fat.valor_total || ""}
                              onChange={(e) => saveFatura(fat.id, { valor_total: parseFloat(e.target.value) || 0 })}
                              className="w-16 bg-transparent text-center text-indigo-300 font-bold border-b border-transparent focus:border-white/20 focus:outline-none focus:bg-slate-950 font-mono text-[10px] mt-0.5"
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {/* TABELA: ALUGUÉIS & DÍVIDAS DOS OUTROS COMIGO */}
          {false && (
            <div className="space-y-6">
              {/* Resumo Stats Topo da Aba de Aluguéis */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4">
                  <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    Total a Receber (Saldo Devedor)
                  </div>
                  <div className="text-xl font-mono font-bold text-orange-400 mt-2">
                    R$ {dividasOutros
                      .filter(d => d.status !== "pago")
                      .reduce((acc, curr) => acc + (curr.valor_total - curr.valor_pago), 0)
                      .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    Compensado / Recebido de Terceiros
                  </div>
                  <div className="text-xl font-mono font-bold text-emerald-400 mt-2">
                    R$ {dividasOutros
                      .reduce((acc, curr) => acc + curr.valor_pago, 0)
                      .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    Contratos Ativos / Registros
                  </div>
                  <div className="text-xl font-mono font-bold text-white mt-2">
                    {dividasOutros.length} registros
                  </div>
                </div>
              </div>

              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg"
              >
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                  <div className="flex items-center gap-2">
                    <HandCoins className="w-4 h-4 text-indigo-400" />
                    <h2 className="font-mono text-xs uppercase tracking-wider font-bold text-slate-200">Aluguéis e Dívidas de Terceiros</h2>
                  </div>
                  <button
                    onClick={handleAddDividaOutros}
                    disabled={addingDivida}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all duration-300 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Registro
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/50 text-[10px] uppercase text-slate-500 font-mono sticky top-0">
                        <th className="p-3">Devedor / Inquilino</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3 font-mono">Valor Total (R$)</th>
                        <th className="p-3 font-mono">Valor Pago (R$)</th>
                        <th className="p-3 font-mono">Saldo Devedor (R$)</th>
                        <th className="p-3">Vencimento</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-center">Recorrente</th>
                        <th className="p-3 w-12 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-mono divide-y divide-slate-800/40">
                      {dividasOutros.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-6 text-slate-600 font-mono text-[11px] uppercase">Nenhum registro de aluguéis ou dívidas ativas.</td>
                        </tr>
                      ) : (
                        dividasOutros.map(div => (
                          <tr key={div.id} className="hover:bg-slate-850/30 group transition-colors duration-150">
                            {/* Devedor */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={div.devedor}
                                onChange={(e) => saveDividaOutros(div.id, { devedor: e.target.value })}
                                className="w-full bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 text-slate-200 focus:outline-none"
                              />
                            </td>
                            {/* Tipo */}
                            <td className="p-2">
                              <select
                                value={div.tipo}
                                onChange={(e) => saveDividaOutros(div.id, { tipo: e.target.value as any })}
                                className="bg-slate-950 border border-slate-850 rounded px-1.5 py-1 text-slate-300 focus:outline-none focus:border-slate-700 text-xs font-mono uppercase"
                              >
                                <option value="aluguel">Aluguel</option>
                                <option value="divida">Dívida</option>
                                <option value="outros">Outros</option>
                              </select>
                            </td>
                            {/* Valor Total */}
                            <td className="p-2">
                              <div className="flex items-center gap-1 bg-transparent hover:bg-slate-950/50 border border-transparent rounded focus-within:bg-slate-950 focus-within:border-slate-700 transition-all px-2">
                                <span className="text-slate-600">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={div.valor_total || ""}
                                  onChange={(e) => {
                                    const vt = parseFloat(e.target.value) || 0;
                                    saveDividaOutros(div.id, { 
                                      valor_total: vt,
                                      saldo_devedor: vt - div.valor_pago 
                                    });
                                  }}
                                  className="w-full bg-transparent border-none py-1 focus:outline-none text-slate-300 font-bold"
                                />
                              </div>
                            </td>
                            {/* Valor Pago */}
                            <td className="p-2">
                              <div className="flex items-center gap-1 bg-transparent hover:bg-slate-950/50 border border-transparent rounded focus-within:bg-slate-950 focus-within:border-slate-700 transition-all px-2">
                                <span className="text-slate-600">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={div.valor_pago || ""}
                                  onChange={(e) => {
                                    const vp = parseFloat(e.target.value) || 0;
                                    saveDividaOutros(div.id, { 
                                      valor_pago: vp,
                                      saldo_devedor: div.valor_total - vp 
                                    });
                                  }}
                                  className="w-full bg-transparent border-none py-1 focus:outline-none text-emerald-400 font-bold"
                                />
                              </div>
                            </td>
                            {/* Saldo Devedor */}
                            <td className="p-2 text-slate-400 font-bold px-3">
                              R$ {(div.valor_total - div.valor_pago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            {/* Vencimento */}
                            <td className="p-2">
                              <input
                                type="date"
                                value={div.data_vencimento}
                                onChange={(e) => saveDividaOutros(div.id, { data_vencimento: e.target.value })}
                                className="bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 text-slate-300 focus:outline-none font-mono text-xs"
                              />
                            </td>
                            {/* Status */}
                            <td className="p-2">
                              <select
                                value={div.status}
                                onChange={(e) => saveDividaOutros(div.id, { status: e.target.value as any })}
                                className={`px-1.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition-all duration-150 cursor-pointer border bg-slate-950 focus:outline-none ${
                                  div.status === "pago"
                                    ? "border-emerald-500/20 text-emerald-400"
                                    : "border-orange-500/20 text-orange-400"
                                }`}
                              >
                                <option value="pendente">Pendente</option>
                                <option value="pago">Pago</option>
                                <option value="atrasado">Atrasado</option>
                              </select>
                            </td>
                            {/* Recorrente */}
                            <td className="p-2 text-center">
                              <button
                                onClick={() => saveDividaOutros(div.id, { recorrente: !div.recorrente })}
                                className={`p-1.5 rounded transition-all duration-150 cursor-pointer ${
                                  div.recorrente 
                                    ? "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20" 
                                    : "text-slate-600 hover:text-slate-400 hover:bg-slate-800"
                                }`}
                                title={div.recorrente ? "Pagamento Recorrente Ativo (Todo mês entra)" : "Ativar Pagamento Recorrente"}
                              >
                                <Repeat className="w-3.5 h-3.5" />
                              </button>
                            </td>
                            {/* Delete */}
                            <td className="p-2 text-center">
                              <button
                                onClick={() => handleDeleteDividaOutros(div.id)}
                                className="text-slate-600 hover:text-rose-400 p-1 rounded hover:bg-rose-500/5 transition-all duration-200 cursor-pointer"
                                title="Deletar registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
          )}

          {/* TABELA: PRESTAÇÕES, FINANCIAMENTOS E CARNÊS */}
          {subTabSaidas === "dividas" && (
            <div className="space-y-6">
              {/* Resumo Stats Topo da Aba de Prestações */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4">
                  <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    Total Restante Geral (Todos os Contratos)
                  </div>
                  <div className="text-xl font-mono font-bold text-orange-400 mt-2">
                    R$ {prestacoes
                      .reduce((acc, curr) => acc + ((curr.parcelas_totais - curr.parcelas_pagas) * curr.valor_parcela), 0)
                      .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    Comprometido do Mês (Parcelas Pendentes)
                  </div>
                  <div className="text-xl font-mono font-bold text-rose-400 mt-2">
                    R$ {prestacoes
                      .filter(p => p.status === "pendente")
                      .reduce((acc, curr) => acc + curr.valor_parcela, 0)
                      .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    Contratos de Financiamento Ativos
                  </div>
                  <div className="text-xl font-mono font-bold text-white mt-2">
                    {prestacoes.length} contratos
                  </div>
                </div>
              </div>

              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg"
              >
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                  <div className="flex items-center gap-2">
                    <HandCoins className="w-4 h-4 text-indigo-400" />
                    <h2 className="font-mono text-xs uppercase tracking-wider font-bold text-slate-200">Prestações, Financiamentos & Carnês</h2>
                  </div>
                  <button
                    onClick={handleAddPrestacao}
                    disabled={addingPrestacao}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all duration-300 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Contrato
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/50 text-[10px] uppercase text-slate-500 font-mono sticky top-0">
                        <th className="p-3">Descrição do Contrato</th>
                        <th className="p-3 font-mono">Valor da Parcela (R$)</th>
                        <th className="p-3">Progresso (Pagas/Totais)</th>
                        <th className="p-3 text-center">Faltam (Parcelas)</th>
                        <th className="p-3 font-mono">Restante a Pagar (R$)</th>
                        <th className="p-3">Próximo Vencimento</th>
                        <th className="p-3">Status do Mês</th>
                        <th className="p-3 w-12 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-mono divide-y divide-slate-800/40">
                      {prestacoes.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-6 text-slate-600 font-mono text-[11px] uppercase">Nenhum contrato de prestação ou carnê registrado.</td>
                        </tr>
                      ) : (
                        prestacoes.map(pres => {
                          const parcelasRestantes = Math.max(0, pres.parcelas_totais - pres.parcelas_pagas);
                          const valorRestante = parcelasRestantes * pres.valor_parcela;
                          const hasChanges = unsavedPrestacaoIds.includes(pres.id);
                          const isSaving = savingPrestacaoIds.includes(pres.id);

                          return (
                            <tr 
                              key={pres.id} 
                              className={`transition-colors duration-150 ${
                                hasChanges 
                                  ? "bg-indigo-950/5 hover:bg-indigo-950/10 border-l-2 border-indigo-500" 
                                  : "hover:bg-slate-850/30"
                              }`}
                            >
                              {/* Descrição */}
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={pres.descricao}
                                  onChange={(e) => updatePrestacaoLocally(pres.id, { descricao: e.target.value })}
                                  className="w-full bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 text-slate-200 focus:outline-none"
                                />
                              </td>
                              {/* Valor da Parcela */}
                              <td className="p-2">
                                <div className="flex items-center gap-1 bg-transparent hover:bg-slate-950/50 border border-transparent rounded focus-within:bg-slate-950 focus-within:border-slate-700 transition-all px-2">
                                  <span className="text-slate-600">R$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={pres.valor_parcela || ""}
                                    onChange={(e) => updatePrestacaoLocally(pres.id, { valor_parcela: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-transparent border-none py-1 focus:outline-none text-rose-400 font-bold"
                                  />
                                </div>
                              </td>
                              {/* Progresso (Pagas/Totais) */}
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      max={pres.parcelas_totais}
                                      value={pres.parcelas_pagas}
                                      onChange={(e) => {
                                        const pagas = Math.min(pres.parcelas_totais, Math.max(0, parseInt(e.target.value) || 0));
                                        updatePrestacaoLocally(pres.id, { 
                                          parcelas_pagas: pagas,
                                          status: pagas === pres.parcelas_totais ? "pago" : pres.status 
                                        });
                                      }}
                                      className="w-12 bg-slate-950/60 border border-slate-850 focus:border-slate-700 rounded px-1.5 py-0.5 text-center text-slate-300 font-bold focus:outline-none"
                                    />
                                    <span className="text-slate-600">/</span>
                                    <input
                                      type="number"
                                      min="1"
                                      value={pres.parcelas_totais}
                                      onChange={(e) => {
                                        const totais = Math.max(1, parseInt(e.target.value) || 1);
                                        updatePrestacaoLocally(pres.id, { 
                                          parcelas_totais: totais,
                                          status: pres.parcelas_pagas === totais ? "pago" : pres.status
                                        });
                                      }}
                                      className="w-12 bg-slate-950/60 border border-slate-850 focus:border-slate-700 rounded px-1.5 py-0.5 text-center text-slate-500 focus:outline-none"
                                    />
                                  </div>
                                  {/* Progresso visual */}
                                  <div className="hidden lg:block w-20 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                                    <div 
                                      className="bg-indigo-500 h-full transition-all duration-300"
                                      style={{ width: `${(pres.parcelas_pagas / pres.parcelas_totais) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              {/* Parcelas que Faltam */}
                              <td className="p-2 text-center font-mono">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                  parcelasRestantes > 0 
                                    ? "text-amber-400 bg-amber-500/5 border border-amber-500/10" 
                                    : "text-emerald-400 bg-emerald-500/5 border border-emerald-500/10"
                                }`}>
                                  {parcelasRestantes} {parcelasRestantes === 1 ? "parcela" : "parcelas"}
                                </span>
                              </td>
                              {/* Restante a Pagar */}
                              <td className="p-2 text-slate-400 font-bold px-3">
                                R$ {valorRestante.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </td>
                              {/* Vencimento */}
                              <td className="p-2">
                                <input
                                  type="date"
                                  value={pres.data_vencimento}
                                  onChange={(e) => updatePrestacaoLocally(pres.id, { data_vencimento: e.target.value })}
                                  className="bg-transparent hover:bg-slate-950/50 focus:bg-slate-950 focus:border-slate-700 border border-transparent rounded px-2 py-1 text-slate-300 focus:outline-none font-mono text-xs"
                                />
                              </td>
                              {/* Status do Mês */}
                              <td className="p-2">
                                <select
                                  value={pres.status}
                                  disabled={pres.parcelas_pagas === pres.parcelas_totais}
                                  onChange={(e) => updatePrestacaoLocally(pres.id, { status: e.target.value as any })}
                                  className={`px-1.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition-all duration-150 cursor-pointer border bg-slate-950 focus:outline-none ${
                                    pres.parcelas_pagas === pres.parcelas_totais
                                      ? "border-emerald-500/20 text-emerald-400"
                                      : pres.status === "pago"
                                      ? "border-emerald-500/20 text-emerald-400"
                                      : pres.status === "atrasado"
                                      ? "border-rose-500/20 text-rose-400 animate-pulse"
                                      : "border-orange-500/20 text-orange-400"
                                  }`}
                                >
                                  {pres.parcelas_pagas === pres.parcelas_totais ? (
                                    <option value="pago">Quitado</option>
                                  ) : (
                                    <>
                                      <option value="pendente">Pendente</option>
                                      <option value="pago">Pago</option>
                                      <option value="atrasado">Atrasado</option>
                                    </>
                                  )}
                                </select>
                              </td>
                              {/* Ações (Salvar, Desfazer, Deletar) */}
                              <td className="p-2 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {hasChanges && (
                                    <>
                                      <button
                                        onClick={() => handleSavePrestacao(pres.id)}
                                        disabled={isSaving}
                                        className="text-emerald-400 hover:text-emerald-300 p-1.5 rounded hover:bg-emerald-500/10 transition-all duration-200 cursor-pointer flex items-center justify-center relative group"
                                        title="Salvar alterações"
                                      >
                                        {isSaving ? (
                                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Save className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                      
                                      <button
                                        onClick={() => cancelPrestacaoChanges(pres.id)}
                                        className="text-orange-400 hover:text-orange-300 p-1.5 rounded hover:bg-orange-500/10 transition-all duration-200 cursor-pointer flex items-center justify-center relative group"
                                        title="Desfazer alterações"
                                      >
                                        <Undo className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}

                                  <button
                                    onClick={() => handleDeletePrestacao(pres.id)}
                                    className="text-slate-600 hover:text-rose-400 p-1.5 rounded hover:bg-rose-500/5 transition-all duration-200 cursor-pointer flex items-center justify-center"
                                    title="Deletar contrato"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
          )}

          </div>
        )}

        </div>
      )}
    </div>
  );
}
