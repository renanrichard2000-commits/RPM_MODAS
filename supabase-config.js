/**
 * ============================================================================
 * CONFIGURAÇÃO SUPABASE E ROTEAMENTO BASE — RPM MODAS
 * ============================================================================
 * Segurança: utiliza EXCLUSIVAMENTE a Publishable Key pública no frontend.
 * Nenhuma chave secreta (service_role, secret key ou Google Client Secret)
 * é armazenada ou exposta neste arquivo.
 */
(function () {
  "use strict";

  function detectarBasePath() {
    const pathname = window.location.pathname || "/";
    if (/^\/rpm_modas(\/|$)/i.test(pathname)) {
      const match = pathname.match(/^(\/[^/]+)(\/|$)/);
      return match ? `${match[1]}/` : "/RPM_MODAS/";
    }
    if (window.location.hostname.endsWith("github.io")) {
      return "/RPM_MODAS/";
    }
    return "/";
  }

  const BASE_PATH = detectarBasePath();

  const SUPABASE_CONFIG = Object.freeze({
    projectName: "RPM MODAS LOGIN",
    url: "https://gozefivthdgtfeteqcea.supabase.co",
    publishableKey: "sb_publishable_r_1-qfVXz0-MKTxNHfdqnA_SAd_BFm3",
    redirectUrl: "https://renanrichard2000-commits.github.io/RPM_MODAS/",
    storageBucket: "product-images",
    basePath: BASE_PATH
  });

  let instanciaCliente = null;

  function obterClienteSupabase() {
    if (instanciaCliente) {
      return instanciaCliente;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      console.error("[RPM Modas] Biblioteca @supabase/supabase-js não carregada.");
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

  // Garante que imagens locais (ex: vestido.jpg) e URLs do Supabase Storage funcionem em qualquer rota (/RPM_MODAS/produto/slug)
  function resolverUrlImagem(caminho) {
    const raw = String(caminho || "").trim();
    if (!raw) return "";
    if (/^(https?:\/\/|data:|blob:)/i.test(raw)) {
      return raw;
    }
    const limpo = raw.replace(/^(\.\/|\/)+/, "");
    return `${BASE_PATH}${limpo}`;
  }

  function montarRotaInterna(subcaminho) {
    const limpo = String(subcaminho || "").replace(/^\/+/, "");
    return `${BASE_PATH}${limpo}`;
  }

  function extrairSubrotaAtual() {
    const pathname = window.location.pathname || "/";
    let relativo = pathname;
    if (BASE_PATH !== "/" && pathname.toLowerCase().startsWith(BASE_PATH.toLowerCase())) {
      relativo = pathname.slice(BASE_PATH.length - 1);
    } else if (
      BASE_PATH !== "/" &&
      pathname.toLowerCase() === BASE_PATH.slice(0, -1).toLowerCase()
    ) {
      relativo = "/";
    }
    return relativo.replace(/\/+$/, "") || "/";
  }

  window.RPM_SUPABASE_CONFIG = SUPABASE_CONFIG;
  window.getRpmSupabaseClient = obterClienteSupabase;
  window.resolveRpmAssetUrl = resolverUrlImagem;
  window.buildRpmRouteUrl = montarRotaInterna;
  window.getRpmCurrentSubroute = extrairSubrotaAtual;
})();
