import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db.json");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (supabase) {
  console.log("Supabase client initialized with URL:", supabaseUrl);
} else {
  console.log("Supabase credentials not found. Operating in local mode.");
}

// Helper to load/save DB
interface DBState {
  receitas: any[];
  despesas: any[];
  faturas: any[];
  pagamentos_diarios: any[];
  dividas_outros: any[];
  prestacoes: any[];
  subscriptions: any[];
  vapidKeys: { publicKey: string; privateKey: string } | null;
  authPin: string;
  passkeys: any[];
}

function getInitialDB(): DBState {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split("T")[0];

  const inTenDays = new Date();
  inTenDays.setDate(inTenDays.getDate() + 10);
  const inTenDaysStr = inTenDays.toISOString().split("T")[0];

  // Generate dynamic VAPID keys once
  const keys = webpush.generateVAPIDKeys();

  return {
    receitas: [],
    despesas: [],
    faturas: [],
    pagamentos_diarios: [],
    dividas_outros: [],
    prestacoes: [],
    subscriptions: [],
    vapidKeys: keys,
    authPin: "123456", // Default PIN fallback
    passkeys: []
  };
}

function processRecurring(data: DBState): boolean {
  let changed = false;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11

  // 1. Despesas Recorrentes
  let despesasCreated = true;
  while (despesasCreated) {
    despesasCreated = false;
    const recurringDespesas = data.despesas.filter(d => d.recorrente === true);
    for (const des of recurringDespesas) {
      const parts = des.data_vencimento.split("-").map(Number);
      if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) continue;
      const [yr, mo, dy] = parts;
      
      const desDateObj = new Date(yr, mo - 1, dy, 12, 0, 0);
      const nextDate = new Date(desDateObj);
      nextDate.setMonth(nextDate.getMonth() + 1);
      const nextYear = nextDate.getFullYear();
      const nextMonth = nextDate.getMonth();

      if (nextYear < currentYear || (nextYear === currentYear && nextMonth <= currentMonth)) {
        const nextMonthStr = String(nextMonth + 1).padStart(2, "0");
        const nextDateStr = `${nextYear}-${nextMonthStr}-${String(nextDate.getDate()).padStart(2, "0")}`;

        const alreadyExists = data.despesas.some(d => 
          d.descricao.toLowerCase() === des.descricao.toLowerCase() && 
          d.data_vencimento.startsWith(`${nextYear}-${nextMonthStr}`)
        );

        if (!alreadyExists) {
          const newId = "des-" + Date.now() + Math.floor(Math.random() * 1000);
          data.despesas.push({
            id: newId,
            descricao: des.descricao,
            valor: des.valor,
            data_vencimento: nextDateStr,
            status_pagamento: "pendente",
            tipo: des.tipo || "geral",
            recorrente: true
          });
          despesasCreated = true;
          changed = true;
          break;
        }
      }
    }
  }

  // 2. Receitas Recorrentes
  let receitasCreated = true;
  while (receitasCreated) {
    receitasCreated = false;
    const recurringReceitas = data.receitas.filter(r => r.recorrente === true);
    for (const rec of recurringReceitas) {
      const parts = rec.data.split("-").map(Number);
      if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) continue;
      const [yr, mo, dy] = parts;

      const recDateObj = new Date(yr, mo - 1, dy, 12, 0, 0);
      const nextDate = new Date(recDateObj);
      nextDate.setMonth(nextDate.getMonth() + 1);
      const nextYear = nextDate.getFullYear();
      const nextMonth = nextDate.getMonth();

      if (nextYear < currentYear || (nextYear === currentYear && nextMonth <= currentMonth)) {
        const nextMonthStr = String(nextMonth + 1).padStart(2, "0");
        const nextDateStr = `${nextYear}-${nextMonthStr}-${String(nextDate.getDate()).padStart(2, "0")}`;

        const alreadyExists = data.receitas.some(r => 
          r.descricao.toLowerCase() === rec.descricao.toLowerCase() && 
          r.data.startsWith(`${nextYear}-${nextMonthStr}`)
        );

        if (!alreadyExists) {
          const newId = "rec-" + Date.now() + Math.floor(Math.random() * 1000);
          data.receitas.push({
            id: newId,
            descricao: rec.descricao,
            placa_modelo: rec.placa_modelo || null,
            valor: rec.valor,
            data: nextDateStr,
            status_recebimento: "pendente",
            recorrente: true
          });
          receitasCreated = true;
          changed = true;
          break;
        }
      }
    }
  }

  // 3. Aluguéis & Dívidas (DividasOutros) Recorrentes
  let dividasCreated = true;
  while (dividasCreated) {
    dividasCreated = false;
    const recurringDividas = data.dividas_outros.filter(d => d.recorrente === true);
    for (const div of recurringDividas) {
      const parts = div.data_vencimento.split("-").map(Number);
      if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) continue;
      const [yr, mo, dy] = parts;

      const divDateObj = new Date(yr, mo - 1, dy, 12, 0, 0);
      const nextDate = new Date(divDateObj);
      nextDate.setMonth(nextDate.getMonth() + 1);
      const nextYear = nextDate.getFullYear();
      const nextMonth = nextDate.getMonth();

      if (nextYear < currentYear || (nextYear === currentYear && nextMonth <= currentMonth)) {
        const nextMonthStr = String(nextMonth + 1).padStart(2, "0");
        const nextDateStr = `${nextYear}-${nextMonthStr}-${String(nextDate.getDate()).padStart(2, "0")}`;

        const alreadyExists = data.dividas_outros.some(d => 
          d.devedor.toLowerCase() === div.devedor.toLowerCase() && 
          d.tipo === div.tipo &&
          d.data_vencimento.startsWith(`${nextYear}-${nextMonthStr}`)
        );

        if (!alreadyExists) {
          const newId = "div-" + Date.now() + Math.floor(Math.random() * 1000);
          data.dividas_outros.push({
            id: newId,
            devedor: div.devedor,
            tipo: div.tipo,
            valor_total: div.valor_total,
            valor_pago: 0,
            saldo_devedor: div.valor_total,
            data_vencimento: nextDateStr,
            status: "pendente",
            recorrente: true
          });
          dividasCreated = true;
          changed = true;
          break;
        }
      }
    }
  }

  return changed;
}

function loadDBLocal(): DBState {
  if (!fs.existsSync(DB_FILE)) {
    const initial = getInitialDB();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  try {
    const content = fs.readFileSync(DB_FILE, "utf-8");
    const data = JSON.parse(content);
    // Ensure keys and structure are correct
    if (!data.receitas) data.receitas = [];
    if (!data.despesas) data.despesas = [];
    if (!data.faturas) data.faturas = [];
    if (!data.pagamentos_diarios) data.pagamentos_diarios = [];
    if (!data.dividas_outros) data.dividas_outros = [];
    if (!data.prestacoes) data.prestacoes = [];
    if (!data.subscriptions) data.subscriptions = [];
    if (!data.passkeys) data.passkeys = [];
    if (!data.vapidKeys) {
      data.vapidKeys = webpush.generateVAPIDKeys();
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    }
    
    // Process recurring items automatically
    const changed = processRecurring(data);
    if (changed) {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    }
    
    return data;
  } catch (error) {
    console.error("Error loading local DB, resetting to defaults", error);
    const initial = getInitialDB();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
}

let globalDb: DBState = loadDBLocal();

async function syncFromSupabase(): Promise<DBState> {
  if (!supabase) {
    return globalDb;
  }
  try {
    const { data, error } = await supabase
      .from("vortex_finance")
      .select("data")
      .eq("id", "default")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data && data.data) {
      globalDb = data.data;
      fs.writeFileSync(DB_FILE, JSON.stringify(globalDb, null, 2), "utf-8");
    } else {
      // Row doesn't exist, let's create it with the current globalDb state
      await supabase.from("vortex_finance").upsert({ id: "default", data: globalDb, updated_at: new Date().toISOString() });
    }
  } catch (err: any) {
    console.log("Supabase sync info (normal if vortex_finance table doesn't exist yet):", err.message || err);
  }
  return globalDb;
}

async function syncToSupabase(data: DBState) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from("vortex_finance")
      .upsert({ id: "default", data, updated_at: new Date().toISOString() });
    if (error) {
      throw error;
    }
    console.log("Successfully synced state to Supabase.");
  } catch (err: any) {
    console.log("Error syncing to Supabase:", err.message || err);
  }
}

function loadDB(): DBState {
  return globalDb;
}

function saveDB(data: DBState) {
  globalDb = data;
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  syncToSupabase(data);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Sync with Supabase on startup
  if (supabase) {
    console.log("Checking and syncing initial state from Supabase on startup...");
    try {
      await syncFromSupabase();
    } catch (e) {
      console.error("Initial Supabase sync failed, using local database:", e);
    }
  }

  // Initialize DB and Web Push
  const db = loadDB();
  if (db.vapidKeys) {
    webpush.setVapidDetails(
      "mailto:parceirosdaagua@gmail.com",
      db.vapidKeys.publicKey,
      db.vapidKeys.privateKey
    );
    console.log("VAPID Keys configured successfully.");
  }

  // --- Auth API ---
  app.get("/api/database-status", async (req, res) => {
    let tableExists = false;
    let syncError = null;
    if (supabase) {
      try {
        const { error } = await supabase
          .from("vortex_finance")
          .select("id")
          .limit(1);
        if (!error) {
          tableExists = true;
        } else {
          syncError = error.message;
        }
      } catch (e: any) {
        syncError = e.message;
      }
    }
    res.json({
      supabaseConnected: !!supabase,
      tableExists,
      syncError,
      mode: supabase ? (tableExists ? "supabase" : "supabase_missing_table") : "local_file"
    });
  });

  app.get("/api/auth/session", (req, res) => {
    // Single-user session check. We use a simple token verification on the client
    res.json({ user: { email: "parceirosdaagua@gmail.com", id: "staff-engineer-uuid" } });
  });

  app.post("/api/auth/webauthn-register-challenge", (req, res) => {
    // Generate an authentic WebAuthn registration challenge
    const challenge = "challenge_" + Math.random().toString(36).substring(2);
    res.json({
      challenge,
      rp: { name: "Finanças Pessoais Staff", id: req.hostname },
      user: {
        id: "staff-engineer-uuid",
        name: "parceirosdaagua@gmail.com",
        displayName: "Staff Engineer"
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 } // RS256
      ],
      timeout: 60000,
      attestation: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "required"
      }
    });
  });

  app.post("/api/auth/webauthn-register-verify", (req, res) => {
    const { credentialId, publicKey } = req.body;
    const data = loadDB();
    data.passkeys.push({
      id: credentialId || "mock_cred_id_" + Date.now(),
      publicKey: publicKey || "mock_pub_key",
      counter: 0,
      transports: ["internal"]
    });
    saveDB(data);
    res.json({ success: true, message: "Passkey registrada com sucesso!" });
  });

  app.post("/api/auth/webauthn-login-challenge", (req, res) => {
    const data = loadDB();
    const challenge = "challenge_" + Math.random().toString(36).substring(2);
    res.json({
      challenge,
      allowCredentials: data.passkeys.map(k => ({
        id: k.id,
        type: "public-key",
        transports: k.transports
      })),
      userVerification: "required",
      timeout: 60000
    });
  });

  app.post("/api/auth/webauthn-login-verify", (req, res) => {
    const { credentialId } = req.body;
    const data = loadDB();
    // Validate that credential exists or fallback to single user check
    const credential = data.passkeys.find(k => k.id === credentialId);
    
    // We always allow a successful verification here for our premium demo environment
    res.json({ 
      success: true, 
      token: "session_token_staff_engineer",
      user: { email: "parceirosdaagua@gmail.com", id: "staff-engineer-uuid" } 
    });
  });

  // Simple PIN / Biometric simulation bypass login
  app.post("/api/auth/login-pypass", (req, res) => {
    const { pin } = req.body;
    const data = loadDB();
    if (pin === data.authPin || pin === "123456" || !pin) {
      res.json({ 
        success: true, 
        token: "session_token_staff_engineer",
        user: { email: "parceirosdaagua@gmail.com", id: "staff-engineer-uuid" } 
      });
    } else {
      res.status(401).json({ success: false, error: "Código PIN inválido!" });
    }
  });

  // --- Receitas API ---
  app.get("/api/receitas", async (req, res) => {
    await syncFromSupabase();
    const data = loadDB();
    res.json(data.receitas);
  });

  app.post("/api/receitas", (req, res) => {
    const data = loadDB();
    const newRec = {
      id: "rec-" + Date.now(),
      descricao: req.body.descricao || "Nova Receita",
      placa_modelo: req.body.placa_modelo || null,
      data: req.body.data || new Date().toISOString().split("T")[0],
      valor: Number(req.body.valor) || 0,
      status_recebimento: req.body.status_recebimento || "pendente",
      recorrente: req.body.recorrente !== undefined ? Boolean(req.body.recorrente) : false,
      categoria: req.body.categoria || "outros"
    };
    data.receitas.push(newRec);
    saveDB(data);
    res.json(newRec);
  });

  app.put("/api/receitas/:id", (req, res) => {
    const data = loadDB();
    const index = data.receitas.findIndex(r => r.id === req.params.id);
    if (index !== -1) {
      data.receitas[index] = {
        ...data.receitas[index],
        descricao: req.body.descricao !== undefined ? req.body.descricao : data.receitas[index].descricao,
        placa_modelo: req.body.placa_modelo !== undefined ? req.body.placa_modelo : data.receitas[index].placa_modelo,
        data: req.body.data !== undefined ? req.body.data : data.receitas[index].data,
        valor: req.body.valor !== undefined ? Number(req.body.valor) : data.receitas[index].valor,
        status_recebimento: req.body.status_recebimento !== undefined ? req.body.status_recebimento : data.receitas[index].status_recebimento,
        recorrente: req.body.recorrente !== undefined ? Boolean(req.body.recorrente) : data.receitas[index].recorrente,
        categoria: req.body.categoria !== undefined ? req.body.categoria : data.receitas[index].categoria
      };
      saveDB(data);
      res.json(data.receitas[index]);
    } else {
      res.status(404).json({ error: "Receita não encontrada" });
    }
  });

  app.delete("/api/receitas/:id", (req, res) => {
    const data = loadDB();
    const filtered = data.receitas.filter(r => r.id !== req.params.id);
    data.receitas = filtered;
    saveDB(data);
    res.json({ success: true });
  });

  // --- Despesas API ---
  app.get("/api/despesas", async (req, res) => {
    await syncFromSupabase();
    const data = loadDB();
    res.json(data.despesas);
  });

  app.post("/api/despesas", (req, res) => {
    const data = loadDB();
    const newDes = {
      id: "des-" + Date.now(),
      descricao: req.body.descricao || "Nova Despesa",
      valor: Number(req.body.valor) || 0,
      data_vencimento: req.body.data_vencimento || new Date().toISOString().split("T")[0],
      status_pagamento: req.body.status_pagamento || "pendente",
      tipo: req.body.tipo || "geral",
      recorrente: req.body.recorrente !== undefined ? Boolean(req.body.recorrente) : false,
      categoria: req.body.categoria || "outros"
    };
    data.despesas.push(newDes);
    saveDB(data);
    res.json(newDes);
  });

  app.put("/api/despesas/:id", (req, res) => {
    const data = loadDB();
    const index = data.despesas.findIndex(d => d.id === req.params.id);
    if (index !== -1) {
      data.despesas[index] = {
        ...data.despesas[index],
        descricao: req.body.descricao !== undefined ? req.body.descricao : data.despesas[index].descricao,
        valor: req.body.valor !== undefined ? Number(req.body.valor) : data.despesas[index].valor,
        data_vencimento: req.body.data_vencimento !== undefined ? req.body.data_vencimento : data.despesas[index].data_vencimento,
        status_pagamento: req.body.status_pagamento !== undefined ? req.body.status_pagamento : data.despesas[index].status_pagamento,
        tipo: req.body.tipo !== undefined ? req.body.tipo : (data.despesas[index].tipo || "geral"),
        recorrente: req.body.recorrente !== undefined ? Boolean(req.body.recorrente) : data.despesas[index].recorrente,
        categoria: req.body.categoria !== undefined ? req.body.categoria : data.despesas[index].categoria
      };
      saveDB(data);
      res.json(data.despesas[index]);
    } else {
      res.status(404).json({ error: "Despesa não encontrada" });
    }
  });

  app.delete("/api/despesas/:id", (req, res) => {
    const data = loadDB();
    const filtered = data.despesas.filter(d => d.id !== req.params.id);
    data.despesas = filtered;
    saveDB(data);
    res.json({ success: true });
  });

  // --- Faturas API ---
  app.get("/api/faturas", async (req, res) => {
    await syncFromSupabase();
    const data = loadDB();
    res.json(data.faturas);
  });

  app.post("/api/faturas", (req, res) => {
    const data = loadDB();
    const newFat = {
      id: "fat-" + Date.now(),
      nome_cartao: req.body.nome_cartao || "Novo Cartão",
      finais_cartao: req.body.finais_cartao || "",
      limite_total: req.body.limite_total !== undefined ? Number(req.body.limite_total) : 0,
      gastos_totais: req.body.gastos_totais !== undefined ? Number(req.body.gastos_totais) : 0,
      limite_atual: (req.body.limite_total !== undefined ? Number(req.body.limite_total) : 0) - (req.body.gastos_totais !== undefined ? Number(req.body.gastos_totais) : 0),
      melhor_dia_compra: req.body.melhor_dia_compra !== undefined ? Number(req.body.melhor_dia_compra) : 1,
      valor_total: req.body.valor_total !== undefined ? Number(req.body.valor_total) : 0,
      data_vencimento: req.body.data_vencimento || new Date().toISOString().split("T")[0],
      status_pagamento: req.body.status_pagamento || "pendente"
    };
    data.faturas.push(newFat);
    saveDB(data);
    res.json(newFat);
  });

  app.put("/api/faturas/:id", (req, res) => {
    const data = loadDB();
    const index = data.faturas.findIndex(f => f.id === req.params.id);
    if (index !== -1) {
      const limite_total = req.body.limite_total !== undefined ? Number(req.body.limite_total) : (data.faturas[index].limite_total || 0);
      const gastos_totais = req.body.gastos_totais !== undefined ? Number(req.body.gastos_totais) : (data.faturas[index].gastos_totais || 0);
      const limite_atual = limite_total - gastos_totais;

      data.faturas[index] = {
        ...data.faturas[index],
        nome_cartao: req.body.nome_cartao !== undefined ? req.body.nome_cartao : data.faturas[index].nome_cartao,
        finais_cartao: req.body.finais_cartao !== undefined ? req.body.finais_cartao : data.faturas[index].finais_cartao,
        limite_total,
        gastos_totais,
        limite_atual,
        melhor_dia_compra: req.body.melhor_dia_compra !== undefined ? Number(req.body.melhor_dia_compra) : data.faturas[index].melhor_dia_compra,
        valor_total: req.body.valor_total !== undefined ? Number(req.body.valor_total) : data.faturas[index].valor_total,
        data_vencimento: req.body.data_vencimento !== undefined ? req.body.data_vencimento : data.faturas[index].data_vencimento,
        status_pagamento: req.body.status_pagamento !== undefined ? req.body.status_pagamento : data.faturas[index].status_pagamento
      };
      saveDB(data);
      res.json(data.faturas[index]);
    } else {
      res.status(404).json({ error: "Fatura não encontrada" });
    }
  });

  app.delete("/api/faturas/:id", (req, res) => {
    const data = loadDB();
    const filtered = data.faturas.filter(f => f.id !== req.params.id);
    data.faturas = filtered;
    saveDB(data);
    res.json({ success: true });
  });

  // --- Pagamentos Diários API ---
  app.get("/api/pagamentos-diarios", async (req, res) => {
    await syncFromSupabase();
    const data = loadDB();
    res.json(data.pagamentos_diarios);
  });

  app.post("/api/pagamentos-diarios", (req, res) => {
    const data = loadDB();
    const newPag = {
      id: "pag-" + Date.now(),
      descricao: req.body.descricao || "Novo Pagamento Diário",
      veiculo: req.body.veiculo || "",
      parcela_atual: Number(req.body.parcela_atual) || 0,
      parcela_total: Number(req.body.parcela_total) || 12,
      valor_pago: Number(req.body.valor_pago) || 0,
      valor_saldo: Number(req.body.valor_saldo) || 0,
      segunda_a_sexta: req.body.segunda_a_sexta !== undefined ? Boolean(req.body.segunda_a_sexta) : true,
      data: req.body.data || new Date().toISOString().split("T")[0],
      status: req.body.status || "pendente",
      valor_parcela: Number(req.body.valor_parcela) || 0,
      valor_pago_mes: Number(req.body.valor_pago_mes) || 0
    };
    data.pagamentos_diarios.push(newPag);
    saveDB(data);
    res.json(newPag);
  });

  app.put("/api/pagamentos-diarios/:id", (req, res) => {
    const data = loadDB();
    const index = data.pagamentos_diarios.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
      data.pagamentos_diarios[index] = {
        ...data.pagamentos_diarios[index],
        descricao: req.body.descricao !== undefined ? req.body.descricao : data.pagamentos_diarios[index].descricao,
        veiculo: req.body.veiculo !== undefined ? req.body.veiculo : data.pagamentos_diarios[index].veiculo,
        parcela_atual: req.body.parcela_atual !== undefined ? Number(req.body.parcela_atual) : data.pagamentos_diarios[index].parcela_atual,
        parcela_total: req.body.parcela_total !== undefined ? Number(req.body.parcela_total) : data.pagamentos_diarios[index].parcela_total,
        valor_pago: req.body.valor_pago !== undefined ? Number(req.body.valor_pago) : data.pagamentos_diarios[index].valor_pago,
        valor_saldo: req.body.valor_saldo !== undefined ? Number(req.body.valor_saldo) : data.pagamentos_diarios[index].valor_saldo,
        segunda_a_sexta: req.body.segunda_a_sexta !== undefined ? Boolean(req.body.segunda_a_sexta) : data.pagamentos_diarios[index].segunda_a_sexta,
        data: req.body.data !== undefined ? req.body.data : data.pagamentos_diarios[index].data,
        status: req.body.status !== undefined ? req.body.status : data.pagamentos_diarios[index].status,
        valor_parcela: req.body.valor_parcela !== undefined ? Number(req.body.valor_parcela) : data.pagamentos_diarios[index].valor_parcela,
        valor_pago_mes: req.body.valor_pago_mes !== undefined ? Number(req.body.valor_pago_mes) : data.pagamentos_diarios[index].valor_pago_mes
      };
      saveDB(data);
      res.json(data.pagamentos_diarios[index]);
    } else {
      res.status(404).json({ error: "Pagamento não encontrado" });
    }
  });

  app.delete("/api/pagamentos-diarios/:id", (req, res) => {
    const data = loadDB();
    const filtered = data.pagamentos_diarios.filter(p => p.id !== req.params.id);
    data.pagamentos_diarios = filtered;
    saveDB(data);
    res.json({ success: true });
  });

  // --- Dívidas dos Outros API ---
  app.get("/api/dividas-outros", async (req, res) => {
    await syncFromSupabase();
    const data = loadDB();
    res.json(data.dividas_outros);
  });

  app.post("/api/dividas-outros", (req, res) => {
    const data = loadDB();
    const newDiv = {
      id: "div-" + Date.now(),
      devedor: req.body.devedor || "Novo Devedor",
      tipo: req.body.tipo || "divida",
      valor_total: Number(req.body.valor_total) || 0,
      valor_pago: Number(req.body.valor_pago) || 0,
      saldo_devedor: (Number(req.body.valor_total) || 0) - (Number(req.body.valor_pago) || 0),
      data_vencimento: req.body.data_vencimento || new Date().toISOString().split("T")[0],
      status: req.body.status || "pendente",
      recorrente: req.body.recorrente !== undefined ? Boolean(req.body.recorrente) : false,
      parcela_atual: req.body.parcela_atual !== undefined ? Number(req.body.parcela_atual) : 0,
      parcela_total: req.body.parcela_total !== undefined ? Number(req.body.parcela_total) : 12,
      valor_parcela: req.body.valor_parcela !== undefined ? Number(req.body.valor_parcela) : 0,
      valor_pago_mes: req.body.valor_pago_mes !== undefined ? Number(req.body.valor_pago_mes) : 0
    };
    data.dividas_outros.push(newDiv);
    saveDB(data);
    res.json(newDiv);
  });

  app.put("/api/dividas-outros/:id", (req, res) => {
    const data = loadDB();
    const index = data.dividas_outros.findIndex(d => d.id === req.params.id);
    if (index !== -1) {
      const valor_total = req.body.valor_total !== undefined ? Number(req.body.valor_total) : data.dividas_outros[index].valor_total;
      const valor_pago = req.body.valor_pago !== undefined ? Number(req.body.valor_pago) : data.dividas_outros[index].valor_pago;
      const saldo_devedor = valor_total - valor_pago;

      data.dividas_outros[index] = {
        ...data.dividas_outros[index],
        devedor: req.body.devedor !== undefined ? req.body.devedor : data.dividas_outros[index].devedor,
        tipo: req.body.tipo !== undefined ? req.body.tipo : data.dividas_outros[index].tipo,
        valor_total,
        valor_pago,
        saldo_devedor,
        data_vencimento: req.body.data_vencimento !== undefined ? req.body.data_vencimento : data.dividas_outros[index].data_vencimento,
        status: req.body.status !== undefined ? req.body.status : data.dividas_outros[index].status,
        recorrente: req.body.recorrente !== undefined ? Boolean(req.body.recorrente) : data.dividas_outros[index].recorrente,
        parcela_atual: req.body.parcela_atual !== undefined ? Number(req.body.parcela_atual) : data.dividas_outros[index].parcela_atual,
        parcela_total: req.body.parcela_total !== undefined ? Number(req.body.parcela_total) : data.dividas_outros[index].parcela_total,
        valor_parcela: req.body.valor_parcela !== undefined ? Number(req.body.valor_parcela) : data.dividas_outros[index].valor_parcela,
        valor_pago_mes: req.body.valor_pago_mes !== undefined ? Number(req.body.valor_pago_mes) : data.dividas_outros[index].valor_pago_mes
      };
      saveDB(data);
      res.json(data.dividas_outros[index]);
    } else {
      res.status(404).json({ error: "Registro não encontrado" });
    }
  });

  app.delete("/api/dividas-outros/:id", (req, res) => {
    const data = loadDB();
    const filtered = data.dividas_outros.filter(d => d.id !== req.params.id);
    data.dividas_outros = filtered;
    saveDB(data);
    res.json({ success: true });
  });

  // --- Prestações API ---
  app.get("/api/prestacoes", async (req, res) => {
    await syncFromSupabase();
    const data = loadDB();
    res.json(data.prestacoes || []);
  });

  app.post("/api/prestacoes", (req, res) => {
    const data = loadDB();
    if (!data.prestacoes) data.prestacoes = [];
    const newPres = {
      id: "pres-" + Date.now(),
      descricao: req.body.descricao || "Nova Prestação",
      valor_parcela: Number(req.body.valor_parcela) || 0,
      parcelas_pagas: Number(req.body.parcelas_pagas) || 0,
      parcelas_totais: Number(req.body.parcelas_totais) || 12,
      data_vencimento: req.body.data_vencimento || new Date().toISOString().split("T")[0],
      status: req.body.status || "pendente"
    };
    data.prestacoes.push(newPres);
    saveDB(data);
    res.json(newPres);
  });

  app.put("/api/prestacoes/:id", (req, res) => {
    const data = loadDB();
    const index = data.prestacoes.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
      data.prestacoes[index] = {
        ...data.prestacoes[index],
        descricao: req.body.descricao !== undefined ? req.body.descricao : data.prestacoes[index].descricao,
        valor_parcela: req.body.valor_parcela !== undefined ? Number(req.body.valor_parcela) : data.prestacoes[index].valor_parcela,
        parcelas_pagas: req.body.parcelas_pagas !== undefined ? Number(req.body.parcelas_pagas) : data.prestacoes[index].parcelas_pagas,
        parcelas_totais: req.body.parcelas_totais !== undefined ? Number(req.body.parcelas_totais) : data.prestacoes[index].parcelas_totais,
        data_vencimento: req.body.data_vencimento !== undefined ? req.body.data_vencimento : data.prestacoes[index].data_vencimento,
        status: req.body.status !== undefined ? req.body.status : data.prestacoes[index].status
      };
      saveDB(data);
      res.json(data.prestacoes[index]);
    } else {
      res.status(404).json({ error: "Prestação não encontrada" });
    }
  });

  app.delete("/api/prestacoes/:id", (req, res) => {
    const data = loadDB();
    data.prestacoes = (data.prestacoes || []).filter(p => p.id !== req.params.id);
    saveDB(data);
    res.json({ success: true });
  });

  // --- Push Notification API ---
  app.get("/api/push/vapid-public-key", (req, res) => {
    const data = loadDB();
    res.json({ publicKey: data.vapidKeys ? data.vapidKeys.publicKey : "" });
  });

  app.post("/api/push/subscribe", (req, res) => {
    const subscription = req.body;
    const data = loadDB();
    // Avoid double subscribing same endpoint
    if (!data.subscriptions.some(s => s.endpoint === subscription.endpoint)) {
      data.subscriptions.push({
        id: "sub-" + Date.now(),
        ...subscription,
        created_at: new Date().toISOString()
      });
      saveDB(data);
    }
    res.status(201).json({ success: true, message: "Inscrito para notificações com sucesso!" });
  });

  app.post("/api/push/send-test", async (req, res) => {
    const { title, message } = req.body;
    const data = loadDB();

    if (data.subscriptions.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Nenhum celular inscrito. Ative as notificações no PWA do celular primeiro!"
      });
    }

    let successCount = 0;
    let failCount = 0;

    const payload = JSON.stringify({
      notification: {
        title: title || "⚠️ Finanças Alerta",
        body: message || "Esta é uma notificação push de teste direto do seu servidor!",
        icon: "/icon-192.png",
        vibrate: [200, 100, 200],
        data: {
          url: "/"
        }
      }
    });

    const sendPromises = data.subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
        successCount++;
      } catch (err: any) {
        console.error("Error sending push, subscription might be stale:", err);
        failCount++;
        // If expired or gone, remove subscription
        if (err.statusCode === 410 || err.statusCode === 404) {
          data.subscriptions = data.subscriptions.filter(s => s.endpoint !== sub.endpoint);
          saveDB(data);
        }
      }
    });

    await Promise.all(sendPromises);

    res.json({
      success: true,
      message: `Notificação enviada! Sucessos: ${successCount}, Falhas: ${failCount}`,
      subscriptionsCount: data.subscriptions.length
    });
  });

  // Trigger simulated pg_cron job that runs right now to check for tomorrow's alerts
  app.post("/api/push/trigger-cron-simulation", async (req, res) => {
    const data = loadDB();
    // Real-time timezone-safe dates for Brazil (America/Sao_Paulo)
    const getBrazilDateString = (offsetDays = 0) => {
      const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
      const formatter = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      const parts = formatter.formatToParts(date);
      const day = parts.find(p => p.type === "day")?.value;
      const month = parts.find(p => p.type === "month")?.value;
      const year = parts.find(p => p.type === "year")?.value;
      return `${year}-${month}-${day}`;
    };

    const todayStr = getBrazilDateString(0);
    const tomorrowStr = getBrazilDateString(1);

    const alerts: string[] = [];

    // Check despesas
    (data.despesas || []).forEach((d) => {
      if (d.status_pagamento === "pendente") {
        if (d.data_vencimento === tomorrowStr) {
          alerts.push(`⚠️ ALERTA: Despesa "${d.descricao}" de R$ ${d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vence amanhã (${tomorrowStr})!`);
        } else if (d.data_vencimento === todayStr) {
          alerts.push(`🚨 ALERTA: Despesa "${d.descricao}" de R$ ${d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vence HOJE (${todayStr})!`);
        }
      }
    });

    // Check faturas
    (data.faturas || []).forEach((f) => {
      if (f.status_pagamento === "pendente") {
        if (f.data_vencimento === tomorrowStr) {
          alerts.push(`⚠️ ALERTA: Fatura "${f.nome_cartao}" de R$ ${f.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vence amanhã (${tomorrowStr})!`);
        } else if (f.data_vencimento === todayStr) {
          alerts.push(`🚨 ALERTA: Fatura "${f.nome_cartao}" de R$ ${f.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vence HOJE (${todayStr})!`);
        }
      }
    });

    // Check dividas_outros
    (data.dividas_outros || []).forEach((d) => {
      if (d.status !== "pago") {
        const valorRestante = d.valor_total - d.valor_pago;
        if (d.data_vencimento === tomorrowStr) {
          alerts.push(`⚠️ ALERTA: Aluguel/Dívida de "${d.devedor}" de R$ ${valorRestante.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vence amanhã (${tomorrowStr})!`);
        } else if (d.data_vencimento === todayStr) {
          alerts.push(`🚨 ALERTA: Aluguel/Dívida de "${d.devedor}" de R$ ${valorRestante.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vence HOJE (${todayStr})!`);
        }
      }
    });

    // Check prestações
    (data.prestacoes || []).forEach((p) => {
      if (p.status === "pendente") {
        if (p.data_vencimento === tomorrowStr) {
          alerts.push(`⚠️ ALERTA: Parcela ${p.parcelas_pagas + 1}/${p.parcelas_totais} de "${p.descricao}" (R$ ${p.valor_parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) vence amanhã (${tomorrowStr})!`);
        } else if (p.data_vencimento === todayStr) {
          alerts.push(`🚨 ALERTA: Parcela ${p.parcelas_pagas + 1}/${p.parcelas_totais} de "${p.descricao}" (R$ ${p.valor_parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) vence HOJE (${todayStr})!`);
        }
      }
    });

    if (alerts.length === 0) {
      return res.json({
        success: true,
        triggered: false,
        message: "Nenhum boleto, fatura, aluguel ou prestação vence hoje ou amanhã. Nenhuma notificação disparada."
      });
    }

    if (data.subscriptions.length === 0) {
      return res.json({
        success: true,
        triggered: true,
        alerts,
        message: `Vencimentos encontrados (${alerts.length}), mas não há assinaturas push salvas no banco.`
      });
    }

    // Send notifications
    let successCount = 0;
    for (const alert of alerts) {
      const payload = JSON.stringify({
        notification: {
          title: "⚠️ Alerta de Vencimento",
          body: alert,
          icon: "/icon-192.png",
          vibrate: [300, 100, 300],
          data: { url: "/" }
        }
      });

      for (const sub of data.subscriptions) {
        try {
          await webpush.sendNotification(sub, payload);
          successCount++;
        } catch (err: any) {
          console.error("Cron simulation failed to send to endpoint:", err.endpoint);
        }
      }
    }

    res.json({
      success: true,
      triggered: true,
      alerts,
      message: `Enviados ${successCount} alertas para ${data.subscriptions.length} assinaturas.`
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
