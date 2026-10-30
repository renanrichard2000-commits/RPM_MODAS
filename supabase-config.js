/**
 * ============================================================================
 * CONFIGURAÇÃO E INICIALIZAÇÃO DO SUPABASE — RPM MODAS
 * ============================================================================
 * Segurança: utiliza EXCLUSIVAMENTE a Publishable Key pública no frontend.
 * Nenhuma chave secreta (service_role / secret key / Google Client Secret)
 * deve ser inserida neste arquivo ou no repositório público.
 */
(function () {
  "use strict";

  const SUPABASE_CONFIG = Object.freeze({
    projectName: "RPM MODAS LOGIN",
    url: "https://gozefivthdgtfeteqcea.supabase.co",
    publishableKey: "sb_publishable_r_1-qfVXz0-MKTxNHfdqnA_SAd_BFm3",
    redirectUrl: "https://renanrichard2000-commits.github.io/RPM_MODAS/"
  });

  // Instância única (Singleton) para evitar múltiplas instâncias do cliente
  let instanciaCliente = null;

  function obterClienteSupabase() {
    if (instanciaCliente) {
      return instanciaCliente;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      console.error("[RPM Auth] Biblioteca @supabase/supabase-js não carregada.");
      return null;
    }

    instanciaCliente = window.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
          storageKey: "rpm-modas-supabase-auth"
        }
      }
    );

    return instanciaCliente;
  }

  window.RPM_SUPABASE_CONFIG = SUPABASE_CONFIG;
  window.getRpmSupabaseClient = obterClienteSupabase;
})();
