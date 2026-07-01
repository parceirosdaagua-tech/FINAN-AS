import React, { useState } from "react";
import { Copy, Check, Code2, Database, Zap, BookOpen, KeyRound } from "lucide-react";

export default function PasskeySetupStep() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sqlDDL = `-- ==========================================
-- 1. ESQUEMA DE BANCO DE DADOS (SUPABASE POSTGRES)
-- ==========================================

-- Tabela de Receitas
CREATE TABLE receitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  placa_modelo TEXT DEFAULT NULL,
  data DATE NOT NULL,
  valor NUMERIC(15, 2) NOT NULL,
  status_recebimento TEXT NOT NULL CHECK (status_recebimento IN ('pendente', 'recebido')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Despesas
CREATE TABLE despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC(15, 2) NOT NULL,
  data_vencimento DATE NOT NULL,
  status_pagamento TEXT NOT NULL CHECK (status_pagamento IN ('pendente', 'pago')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Faturas de Cartões
CREATE TABLE faturas_cartoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_cartao TEXT NOT NULL,
  valor_total NUMERIC(15, 2) NOT NULL,
  data_vencimento DATE NOT NULL,
  status_pagamento TEXT NOT NULL CHECK (status_pagamento IN ('pendente', 'pago')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Assinaturas de Notificação Push (Web Push)
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 2. POLÍTICAS DE RLS (ROW LEVEL SECURITY)
-- ==========================================

-- Ativando RLS para segurança máxima
ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE faturas_cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso exclusivo ao UUID do usuário logado
CREATE POLICY "Acesso total do usuário receitas" ON receitas
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Acesso total do usuário despesas" ON despesas
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Acesso total do usuário faturas_cartoes" ON faturas_cartoes
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Acesso total do usuário push_subscriptions" ON push_subscriptions
  FOR ALL TO authenticated USING (auth.uid() = user_id);
`;

  const pgCronSQL = `-- ==========================================
-- 3. AGENDAMENTO DE ROTINA DIÁRIA (SUPABASE PG_CRON)
-- ==========================================

-- Ativar extensões necessárias no Supabase (se ainda não ativadas)
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar a Edge Function para rodar todo dia às 09:00 AM (Horário de Brasília: 12:00 UTC)
SELECT cron.schedule(
  'enviar-alertas-vencimento-diarios',
  '0 12 * * *',
  $$
    SELECT net.http_post(
      url := 'https://<PROJECT_ID>.supabase.co/functions/v1/send-bill-alerts',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
`;

  const edgeFunctionCode = `// ==========================================================
// 4. SUPABASE EDGE FUNCTION (Deno / TypeScript)
// Local: /supabase/functions/send-bill-alerts/index.ts
// ==========================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"
import webpush from "https://esm.sh/web-push@3.6.7"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? "";

// Configurar Web Push
webpush.setVapidDetails(
  "mailto:seu-email@dominio.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Calcular data de amanhã (exatamente 1 dia de antecedência)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // 1. Buscar despesas pendentes vencendo amanhã
    const { data: despesas } = await supabase
      .from('despesas')
      .select('user_id, descricao, valor, data_vencimento')
      .eq('status_pagamento', 'pendente')
      .eq('data_vencimento', tomorrowStr);

    // 2. Buscar faturas de cartões pendentes vencendo amanhã
    const { data: faturas } = await supabase
      .from('faturas_cartoes')
      .select('user_id, nome_cartao, valor_total, data_vencimento')
      .eq('status_pagamento', 'pendente')
      .eq('data_vencimento', tomorrowStr);

    const alerts = [];

    // Agrupar despesas por usuário
    despesas?.forEach(d => {
      alerts.push({
        userId: d.user_id,
        title: "⚠️ Conta Vencendo Amanhã!",
        message: \`Sua conta "\${d.descricao}" de R$ \${d.valor} vence amanhã (\${tomorrowStr})!\`
      });
    });

    // Agrupar faturas por usuário
    faturas?.forEach(f => {
      alerts.push({
        userId: f.user_id,
        title: "⚠️ Fatura Vencendo Amanhã!",
        message: \`Sua fatura "\${f.nome_cartao}" de R$ \${f.valor_total} vence amanhã (\${tomorrowStr})!\`
      });
    });

    if (alerts.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhum vencimento para amanhã." }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Disparar notificações via Web Push
    let successCount = 0;
    for (const alert of alerts) {
      // Buscar as assinaturas push do respectivo usuário no banco
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('endpoint, keys')
        .eq('user_id', alert.userId);

      if (!subscriptions) continue;

      const payload = JSON.stringify({
        notification: {
          title: alert.title,
          body: alert.message,
          icon: "/icon.svg",
          vibrate: [200, 100, 200],
          data: { url: "/" }
        }
      });

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            payload
          );
          successCount++;
        } catch (err) {
          console.error("Falha ao enviar notificação push:", err);
          // Se o endpoint estiver expirado (410), deletar assinatura
          if (err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sentNotifications: successCount }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
`;

  const frontendSetupGuide = `// ==========================================================
// 5. CONFIGURAÇÃO DO WEBAUTHN / PASSKEYS NO FRONTEND
// Exemplo de código React utilizando as APIs do navegador e Supabase
// ==========================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient('SUPABASE_URL', 'SUPABASE_ANON_KEY')

// 1. REGISTRO DE NOVA PASSKEY
async function registrarPasskey() {
  try {
    // Solicita os parâmetros de desafio de registro para a API do seu backend
    const response = await fetch('/api/auth/webauthn-register-challenge', { method: 'POST' });
    const options = await response.json();
    
    // Converter o challenge de Base64/Texto para ArrayBuffer
    options.challenge = Uint8Array.from(atob(options.challenge), c => c.charCodeAt(0));
    options.user.id = Uint8Array.from(atob(options.user.id), c => c.charCodeAt(0));
    
    // Dispara a janela nativa do celular (Face ID/Touch ID) para registrar a credencial
    const credential = await navigator.credentials.create({
      publicKey: options
    });
    
    // Enviar a credencial gerada para o servidor salvar no banco
    const verifyResponse = await fetch('/api/auth/webauthn-register-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credentialId: credential.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
      })
    });
    
    const result = await verifyResponse.json();
    if (result.success) {
      alert("Dispositivo biométrico registrado com sucesso!");
    }
  } catch (error) {
    console.error("Erro ao registrar passkey:", error);
  }
}

// 2. LOGIN COM BIOMETRIA / PASSKEY (SEM SENHAS)
async function loginComBiometria() {
  try {
    // Solicita o desafio de login para o servidor
    const response = await fetch('/api/auth/webauthn-login-challenge', { method: 'POST' });
    const options = await response.json();
    
    // Converter o challenge para buffer
    options.challenge = Uint8Array.from(atob(options.challenge), c => c.charCodeAt(0));
    if (options.allowCredentials) {
      options.allowCredentials.forEach(cred => {
        cred.id = Uint8Array.from(atob(cred.id), c => c.charCodeAt(0));
      });
    }
    
    // Dispara o escaneamento facial ou impressão digital nativa do celular
    const assertion = await navigator.credentials.get({
      publicKey: options
    });
    
    // Valida a assinatura da biometria no servidor
    const verifyResponse = await fetch('/api/auth/webauthn-login-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credentialId: assertion.id,
        clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(assertion.response.clientDataJSON))),
        authenticatorData: btoa(String.fromCharCode(...new Uint8Array(assertion.response.authenticatorData))),
        signature: btoa(String.fromCharCode(...new Uint8Array(assertion.response.signature)))
      })
    });
    
    const session = await verifyResponse.json();
    if (session.success) {
      // Login autorizado sem digitar uma única senha!
      return session.user;
    }
  } catch (error) {
    console.error("Erro na autenticação biométrica:", error);
  }
}
`;

  return (
    <div className="space-y-6 font-sans max-w-4xl mx-auto p-4 pb-16 text-slate-200">
      <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-6 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none text-indigo-500">
          <Code2 className="w-32 h-32" />
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-950/30 text-indigo-400 rounded-lg border border-indigo-500/20">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-mono uppercase tracking-widest font-bold text-slate-100">Instruções de Produção Staff</h2>
            <p className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">Códigos SQL e Edge Functions prontos para implantar no Supabase.</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed font-mono uppercase">
          PROJETADO PARA SUPORTAR DEPLOY IMEDIATO. ABAIXO ESTÃO TODOS OS RECURSOS PARA CONECTAR ESTA INTERFACE AO SEU AMBIENTE PROD SUPABASE COM SEGURANÇA TOTAL RLS.
        </p>
      </div>

      {/* DDL SQL Section */}
      <div className="border border-slate-800 bg-slate-900 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-slate-850 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <h3 className="font-mono font-bold text-[10px] text-slate-200 uppercase tracking-wider">1 &amp; 2. Estrutura de Banco DDL e RLS (PostgreSQL)</h3>
          </div>
          <button
            onClick={() => handleCopy("sql", sqlDDL)}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 hover:text-indigo-400 border border-slate-800 hover:border-indigo-500/30 bg-slate-950 px-2.5 py-1 rounded transition-all duration-200 cursor-pointer"
          >
            {copiedId === "sql" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copiedId === "sql" ? "COPIADO" : "COPIAR SQL"}
          </button>
        </div>
        <div className="p-5 bg-slate-950 font-mono text-[11px] overflow-x-auto text-slate-300 max-h-96 leading-relaxed">
          <pre>{sqlDDL}</pre>
        </div>
      </div>

      {/* pg_cron SQL Section */}
      <div className="border border-slate-800 bg-slate-900 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-slate-850 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-400" />
            <h3 className="font-mono font-bold text-[10px] text-slate-200 uppercase tracking-wider">3. Script pg_cron (Agendador do Supabase)</h3>
          </div>
          <button
            onClick={() => handleCopy("cron", pgCronSQL)}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 hover:text-indigo-400 border border-slate-800 hover:border-indigo-500/30 bg-slate-950 px-2.5 py-1 rounded transition-all duration-200 cursor-pointer"
          >
            {copiedId === "cron" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copiedId === "cron" ? "COPIADO" : "COPIAR SCRIPT"}
          </button>
        </div>
        <div className="p-5 bg-slate-950 font-mono text-[11px] overflow-x-auto text-slate-300 max-h-64 leading-relaxed">
          <pre>{pgCronSQL}</pre>
        </div>
      </div>

      {/* Edge Function Code Section */}
      <div className="border border-slate-800 bg-slate-900 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-slate-850 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-indigo-400" />
            <h3 className="font-mono font-bold text-[10px] text-slate-200 uppercase tracking-wider">4. Supabase Edge Function (Deno TypeScript)</h3>
          </div>
          <button
            onClick={() => handleCopy("edge", edgeFunctionCode)}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 hover:text-indigo-400 border border-slate-800 hover:border-indigo-500/30 bg-slate-950 px-2.5 py-1 rounded transition-all duration-200 cursor-pointer"
          >
            {copiedId === "edge" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copiedId === "edge" ? "COPIADO" : "COPIAR CÓDIGO"}
          </button>
        </div>
        <div className="p-5 bg-slate-950 font-mono text-[11px] overflow-x-auto text-slate-300 max-h-96 leading-relaxed">
          <pre>{edgeFunctionCode}</pre>
        </div>
      </div>

      {/* Frontend WebAuthn Guide Section */}
      <div className="border border-slate-800 bg-slate-900 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-slate-850 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <h3 className="font-mono font-bold text-[10px] text-slate-200 uppercase tracking-wider">5. Guia WebAuthn/Passkey no Frontend</h3>
          </div>
          <button
            onClick={() => handleCopy("frontend", frontendSetupGuide)}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 hover:text-indigo-400 border border-slate-800 hover:border-indigo-500/30 bg-slate-950 px-2.5 py-1 rounded transition-all duration-200 cursor-pointer"
          >
            {copiedId === "frontend" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copiedId === "frontend" ? "COPIADO" : "COPIAR GUIA"}
          </button>
        </div>
        <div className="p-5 bg-slate-950 font-mono text-[11px] overflow-x-auto text-slate-300 max-h-96 leading-relaxed">
          <pre>{frontendSetupGuide}</pre>
        </div>
      </div>
    </div>
  );
}
