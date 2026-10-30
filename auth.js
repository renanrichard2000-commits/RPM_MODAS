/**
 * ============================================================================
 * AUTENTICAÇÃO GOOGLE OAUTH, SESSÃO, PERFIL E PERMISSÕES — RPM MODAS
 * ============================================================================
 * Módulos organizados:
 * 1. Utilitários de URL e retorno OAuth (compatível com GitHub Pages)
 * 2. Gerenciamento automático de perfil (tabela public.profiles)
 * 3. Verificação segura de permissão administrativa no banco (RLS / RPC)
 * 4. Controle visual do cabeçalho (Botão ENTRAR vs Identificação + Sair)
 * 5. Controle do Pop-up de Login (abertura, fechamento, loading, erros)
 * 6. Inicialização da sessão e autenticação exclusiva Google OAuth
 */
(function () {
  "use strict";

  const estadoAuth = {
    usuario: null,
    perfil: null,
    isAdmin: false,
    iniciandoOAuth: false,
    ultimoUserIdSincronizado: null
  };

  // ==========================================================================
  // 1. UTILITÁRIOS DE URL E RETORNO OAUTH (GITHUB PAGES)
  // ==========================================================================
  function possuiCallbackOAuthNaUrl() {
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    return (
      /[?&](code|error|error_description)=/.test(search) ||
      /[#&](access_token|refresh_token|error|error_description)=/.test(hash)
    );
  }

  function extrairErroOAuthDaUrl() {
    try {
      const searchParams = new URLSearchParams(window.location.search || "");
      const hashLimpo = (window.location.hash || "").replace(/^#/, "");
      const hashParams = new URLSearchParams(hashLimpo);

      const codigoErro = searchParams.get("error") || hashParams.get("error");
      const descErro =
        searchParams.get("error_description") || hashParams.get("error_description");

      if (!codigoErro && !descErro) return null;

      if (codigoErro === "access_denied") {
        return "O acesso com o Google foi cancelado. Você pode tentar novamente quando desejar.";
      }

      return descErro
        ? decodeURIComponent(descErro.replace(/\+/g, " "))
        : "Não foi possível concluir a autenticação com o Google.";
    } catch (_) {
      return null;
    }
  }

  function limparParametrosOAuthDaUrl() {
    if (!possuiCallbackOAuthNaUrl()) return;
    try {
      const hashAtual = window.location.hash || "";
      const abaSalva = ["#inicio", "#catalogo", "#contato"].includes(hashAtual.toLowerCase())
        ? hashAtual.toLowerCase()
        : "#inicio";
      const urlLimpa = `${window.location.pathname}${abaSalva}`;
      window.history.replaceState(null, "", urlLimpa);
    } catch (_) {
      // Ignora em ambientes restritos
    }
  }

  function notificarLoja(mensagem) {
    const toastEl = document.getElementById("toast");
    if (!toastEl) return;
    toastEl.textContent = mensagem;
    toastEl.classList.remove("hidden");
    setTimeout(() => {
      toastEl.classList.add("hidden");
    }, 3200);
  }

  // ==========================================================================
  // 2. GERENCIAMENTO DE PERFIL DO CLIENTE (public.profiles)
  // ==========================================================================
  function extrairMetadadosGoogle(user) {
    if (!user) return { fullName: "", email: "", avatarUrl: "" };
    const meta = user.user_metadata || {};

    const fullName = String(meta.full_name || meta.name || "").trim();
    const email = String(user.email || meta.email || "").trim();
    const avatarUrl = String(meta.avatar_url || meta.picture || "").trim();

    return { fullName, email, avatarUrl };
  }

  function obterPrimeiroNome(fullName, email) {
    if (fullName) {
      return fullName.split(/\s+/)[0];
    }
    if (email && email.includes("@")) {
      return email.split("@")[0];
    }
    return "Cliente";
  }

  function obterInicialNome(fullName, email) {
    const base = (fullName || email || "R").trim();
    return base.charAt(0).toUpperCase();
  }

  async function sincronizarPerfilCliente(user) {
    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();
    if (!supabase || !user || !user.id) return null;

    const { fullName, email, avatarUrl } = extrairMetadadosGoogle(user);

    try {
      // Consulta somente o próprio perfil (protegido por RLS: auth.uid() = id)
      const { data: perfilExistente, error: erroConsulta } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, created_at, updated_at")
        .eq("id", user.id)
        .maybeSingle();

      if (erroConsulta) {
        // Caso a tabela ainda não tenha sido criada no Supabase SQL Editor (PGRST205), mantém sessão funcionando
        if (erroConsulta.code !== "PGRST205") {
          console.warn("[RPM Auth] Aviso ao consultar perfil:", erroConsulta.message);
        }
        return null;
      }

      const agoraIso = new Date().toISOString();

      if (!perfilExistente) {
        // Cria o perfil automaticamente no primeiro acesso (sem duplicar graças ao onConflict: 'id')
        const { data: novoPerfil, error: erroCriacao } = await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              full_name: fullName || null,
              email: email || null,
              avatar_url: avatarUrl || null,
              updated_at: agoraIso
            },
            { onConflict: "id" }
          )
          .select("id, full_name, email, avatar_url, created_at, updated_at")
          .maybeSingle();

        if (erroCriacao) {
          console.warn("[RPM Auth] Aviso ao registrar perfil inicial:", erroCriacao.message);
          return null;
        }
        return novoPerfil;
      }

      // Atualiza dados básicos caso tenham mudado na conta Google (sem alterar permissões)
      const mudouDados =
        (fullName && fullName !== (perfilExistente.full_name || "")) ||
        (email && email !== (perfilExistente.email || "")) ||
        (avatarUrl && avatarUrl !== (perfilExistente.avatar_url || ""));

      if (mudouDados) {
        const { data: perfilAtualizado, error: erroUpdate } = await supabase
          .from("profiles")
          .update({
            full_name: fullName || perfilExistente.full_name,
            email: email || perfilExistente.email,
            avatar_url: avatarUrl || perfilExistente.avatar_url,
            updated_at: agoraIso
          })
          .eq("id", user.id)
          .select("id, full_name, email, avatar_url, created_at, updated_at")
          .maybeSingle();

        if (!erroUpdate && perfilAtualizado) {
          return perfilAtualizado;
        }
      }

      return perfilExistente;
    } catch (err) {
      console.warn("[RPM Auth] Falha de rede ao sincronizar perfil:", err);
      return null;
    }
  }

  // ==========================================================================
  // 3. VERIFICAÇÃO DE PERMISSÃO ADMINISTRATIVA NO BANCO DE DADOS
  // ==========================================================================
  async function verificarPermissaoAdminBanco() {
    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();
    if (!supabase || !estadoAuth.usuario) {
      estadoAuth.isAdmin = false;
      return false;
    }

    try {
      // Verifica permissão diretamente no PostgreSQL via função SECURITY DEFINER is_admin()
      const { data, error } = await supabase.rpc("is_admin");
      if (!error && data === true) {
        estadoAuth.isAdmin = true;
        return true;
      }
    } catch (_) {
      // Permanece falso por segurança padrão (deny by default)
    }

    estadoAuth.isAdmin = false;
    return false;
  }

  // ==========================================================================
  // 4. INTERFACE DO CABEÇALHO (BOTÃO ENTRAR vs CLIENTE CONECTADO + SAIR)
  // ==========================================================================
  function fecharMenuUsuario() {
    const dropdown = document.getElementById("auth-user-dropdown");
    const trigger = document.getElementById("btn-auth-user-trigger");
    if (dropdown) dropdown.classList.add("hidden");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  function alternarMenuUsuario(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById("auth-user-dropdown");
    const trigger = document.getElementById("btn-auth-user-trigger");
    if (!dropdown || !trigger) return;

    const vaiAbrir = dropdown.classList.contains("hidden");
    dropdown.classList.toggle("hidden", !vaiAbrir);
    trigger.setAttribute("aria-expanded", vaiAbrir ? "true" : "false");
  }

  function preencherNomeNosFormulariosSeVazio(nomeCompleto) {
    if (!nomeCompleto) return;
    ["cliente-nome", "contato-nome"].forEach((idCampo) => {
      const input = document.getElementById(idCampo);
      if (input && !input.value.trim()) {
        input.value = nomeCompleto;
      }
    });
  }

  function atualizarCabecalhoAutenticacao() {
    const btnEntrar = document.getElementById("btn-header-entrar");
    const containerUsuario = document.getElementById("auth-user-container");
    const imgAvatar = document.getElementById("auth-user-avatar");
    const inicialAvatar = document.getElementById("auth-user-initial");
    const spanNomeCurto = document.getElementById("auth-user-short-name");
    const menuNomeCompleto = document.getElementById("auth-menu-full-name");
    const menuEmail = document.getElementById("auth-menu-email");
    const badgeAdmin = document.getElementById("auth-admin-badge");

    if (!btnEntrar || !containerUsuario) return;

    if (!estadoAuth.usuario) {
      btnEntrar.classList.remove("hidden");
      containerUsuario.classList.add("hidden");
      fecharMenuUsuario();
      if (badgeAdmin) badgeAdmin.classList.add("hidden");
      return;
    }

    const dadosGoogle = extrairMetadadosGoogle(estadoAuth.usuario);
    const nomeCompleto =
      (estadoAuth.perfil && estadoAuth.perfil.full_name) || dadosGoogle.fullName || "";
    const email = (estadoAuth.perfil && estadoAuth.perfil.email) || dadosGoogle.email || "";
    const avatarUrl =
      (estadoAuth.perfil && estadoAuth.perfil.avatar_url) || dadosGoogle.avatarUrl || "";

    const primeiroNome = obterPrimeiroNome(nomeCompleto, email);
    const inicial = obterInicialNome(nomeCompleto, email);

    btnEntrar.classList.add("hidden");
    containerUsuario.classList.remove("hidden");

    if (spanNomeCurto) spanNomeCurto.textContent = primeiroNome;
    if (menuNomeCompleto) menuNomeCompleto.textContent = nomeCompleto || primeiroNome;
    if (menuEmail) menuEmail.textContent = email;

    if (inicialAvatar) {
      inicialAvatar.textContent = inicial;
    }

    if (imgAvatar && avatarUrl) {
      imgAvatar.src = avatarUrl;
      imgAvatar.alt = `Foto de ${primeiroNome}`;
      imgAvatar.classList.remove("hidden");
      if (inicialAvatar) inicialAvatar.classList.add("hidden");

      imgAvatar.onerror = () => {
        imgAvatar.classList.add("hidden");
        if (inicialAvatar) inicialAvatar.classList.remove("hidden");
      };
    } else if (imgAvatar) {
      imgAvatar.classList.add("hidden");
      if (inicialAvatar) inicialAvatar.classList.remove("hidden");
    }

    if (badgeAdmin) {
      badgeAdmin.classList.toggle("hidden", !estadoAuth.isAdmin);
    }

    preencherNomeNosFormulariosSeVazio(nomeCompleto);
  }

  // ==========================================================================
  // 5. COMPONENTE DO POP-UP DE LOGIN
  // ==========================================================================
  function exibirErroNoModal(mensagem) {
    const boxErro = document.getElementById("login-erro-box");
    if (!boxErro) return;
    if (!mensagem) {
      boxErro.textContent = "";
      boxErro.classList.add("hidden");
      return;
    }
    boxErro.textContent = mensagem;
    boxErro.classList.remove("hidden");
  }

  function definirEstadoCarregamentoGoogle(carregando) {
    estadoAuth.iniciandoOAuth = carregando;
    const btnGoogle = document.getElementById("btn-continuar-google");
    const iconeGoogle = document.getElementById("icone-oficial-google");
    const spinner = document.getElementById("login-google-spinner");
    const textoBtn = document.getElementById("texto-btn-google");

    if (!btnGoogle) return;

    btnGoogle.disabled = carregando;
    btnGoogle.setAttribute("aria-busy", carregando ? "true" : "false");

    if (iconeGoogle) iconeGoogle.classList.toggle("hidden", carregando);
    if (spinner) spinner.classList.toggle("hidden", !carregando);
    if (textoBtn) {
      textoBtn.textContent = carregando ? "Conectando ao Google..." : "Continuar com Google";
    }
  }

  function abrirModalLogin(mensagemErroOpcional) {
    const modal = document.getElementById("modal-login");
    if (!modal) return;

    fecharMenuUsuario();
    definirEstadoCarregamentoGoogle(false);
    exibirErroNoModal(mensagemErroOpcional || "");

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    const btnGoogle = document.getElementById("btn-continuar-google");
    if (btnGoogle) {
      setTimeout(() => btnGoogle.focus(), 40);
    }
  }

  function fecharModalLogin() {
    const modal = document.getElementById("modal-login");
    if (!modal || modal.classList.contains("hidden")) return;

    modal.classList.add("hidden");
    definirEstadoCarregamentoGoogle(false);
    exibirErroNoModal("");

    // Libera a rolagem apenas se nenhum outro modal/sacola da loja estiver aberto
    const backdropLoja = document.getElementById("backdrop");
    if (!backdropLoja || backdropLoja.classList.contains("hidden")) {
      document.body.style.overflow = "";
    }
  }

  // ==========================================================================
  // 6. AUTENTICAÇÃO GOOGLE OAUTH E CONTROLE DE SESSÃO
  // ==========================================================================
  async function iniciarLoginComGoogle() {
    if (estadoAuth.iniciandoOAuth) return; // Impede cliques repetidos

    exibirErroNoModal("");
    definirEstadoCarregamentoGoogle(true);

    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();
    if (!supabase) {
      definirEstadoCarregamentoGoogle(false);
      exibirErroNoModal(
        "Não foi possível inicializar a conexão segura. Verifique sua internet e tente novamente."
      );
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.RPM_SUPABASE_CONFIG.redirectUrl
        }
      });

      if (error) {
        definirEstadoCarregamentoGoogle(false);
        exibirErroNoModal(
          error.message || "Ocorreu um erro ao iniciar o login com Google. Tente novamente."
        );
      }
    } catch (err) {
      definirEstadoCarregamentoGoogle(false);
      exibirErroNoModal(
        "Falha de comunicação ao conectar com o Google. Verifique sua conexão e tente novamente."
      );
    }
  }

  async function sairDaConta() {
    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();
    fecharMenuUsuario();

    if (!supabase) return;

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        notificarLoja("Não foi possível encerrar a sessão. Tente novamente.");
        return;
      }
      estadoAuth.usuario = null;
      estadoAuth.perfil = null;
      estadoAuth.isAdmin = false;
      estadoAuth.ultimoUserIdSincronizado = null;
      atualizarCabecalhoAutenticacao();
      notificarLoja("Você saiu da sua conta.");
    } catch (_) {
      notificarLoja("Erro ao sair da conta. Tente novamente.");
    }
  }

  async function processarMudancaDeSessao(session, evento) {
    const novoUsuario = session && session.user ? session.user : null;
    estadoAuth.usuario = novoUsuario;

    if (!novoUsuario) {
      estadoAuth.perfil = null;
      estadoAuth.isAdmin = false;
      estadoAuth.ultimoUserIdSincronizado = null;
      atualizarCabecalhoAutenticacao();
      return;
    }

    // Fecha o modal de login caso estivesse aberto e atualiza cabeçalho imediatamente
    fecharModalLogin();
    atualizarCabecalhoAutenticacao();

    // Sincroniza perfil no banco e verifica permissão administrativa sem travar a navegação
    if (
      estadoAuth.ultimoUserIdSincronizado !== novoUsuario.id ||
      evento === "SIGNED_IN" ||
      evento === "USER_UPDATED"
    ) {
      estadoAuth.ultimoUserIdSincronizado = novoUsuario.id;
      const [perfilBanco] = await Promise.all([
        sincronizarPerfilCliente(novoUsuario),
        verificarPermissaoAdminBanco()
      ]);

      if (perfilBanco) {
        estadoAuth.perfil = perfilBanco;
      }
      atualizarCabecalhoAutenticacao();
    }
  }

  function configurarEventosAutenticacao() {
    const btnEntrar = document.getElementById("btn-header-entrar");
    const btnFecharLogin = document.getElementById("btn-fechar-login");
    const modalLogin = document.getElementById("modal-login");
    const btnContinuarGoogle = document.getElementById("btn-continuar-google");
    const btnUserTrigger = document.getElementById("btn-auth-user-trigger");
    const btnLogout = document.getElementById("btn-auth-logout");

    // 1. Abrir pop-up ao clicar em ENTRAR
    if (btnEntrar) {
      btnEntrar.addEventListener("click", () => abrirModalLogin());
    }

    // 2. Fechar pelo botão de fechar
    if (btnFecharLogin) {
      btnFecharLogin.addEventListener("click", fecharModalLogin);
    }

    // 3. Fechar ao clicar fora da janela (no overlay escuro/desfocado)
    if (modalLogin) {
      modalLogin.addEventListener("click", (e) => {
        if (e.target === modalLogin) {
          fecharModalLogin();
        }
      });
    }

    // 4. Fechar utilizando a tecla ESC (e fechar dropdown de usuário)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        fecharModalLogin();
        fecharMenuUsuario();
      }
    });

    // 5. Iniciar login exclusivo com Google OAuth
    if (btnContinuarGoogle) {
      btnContinuarGoogle.addEventListener("click", iniciarLoginComGoogle);
    }

    // 6. Menu do cliente autenticado e opção de sair
    if (btnUserTrigger) {
      btnUserTrigger.addEventListener("click", alternarMenuUsuario);
    }

    if (btnLogout) {
      btnLogout.addEventListener("click", sairDaConta);
    }

    document.addEventListener("click", (e) => {
      const containerUsuario = document.getElementById("auth-user-container");
      if (containerUsuario && !containerUsuario.contains(e.target)) {
        fecharMenuUsuario();
      }
    });
  }

  async function inicializarSistemaAutenticacao() {
    configurarEventosAutenticacao();

    const erroRetornoUrl = extrairErroOAuthDaUrl();
    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();

    if (!supabase) {
      if (erroRetornoUrl) abrirModalLogin(erroRetornoUrl);
      return;
    }

    // Escuta mudanças automáticas no estado de autenticação (login, refresh, logout)
    supabase.auth.onAuthStateChange((evento, session) => {
      processarMudancaDeSessao(session, evento);
      if (evento === "SIGNED_IN") {
        limparParametrosOAuthDaUrl();
      }
    });

    // Recupera sessão ativa ao abrir ou atualizar a página
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn("[RPM Auth] Aviso ao recuperar sessão:", error.message);
      }
      await processarMudancaDeSessao(data ? data.session : null, "INITIAL_SESSION");
    } catch (err) {
      console.warn("[RPM Auth] Erro ao verificar sessão inicial:", err);
    } finally {
      if (erroRetornoUrl) {
        limparParametrosOAuthDaUrl();
        abrirModalLogin(erroRetornoUrl);
      } else if (possuiCallbackOAuthNaUrl()) {
        limparParametrosOAuthDaUrl();
      }
    }
  }

  document.addEventListener("DOMContentLoaded", inicializarSistemaAutenticacao);

  // API pública segura e somente-leitura para integração futura com o Painel Administrativo
  window.RPMAuth = Object.freeze({
    hasOAuthCallbackInUrl: possuiCallbackOAuthNaUrl,
    openLoginModal: abrirModalLogin,
    closeLoginModal: fecharModalLogin,
    getUser: () => estadoAuth.usuario,
    getProfile: () => estadoAuth.perfil,
    isAdminVerified: () => Boolean(estadoAuth.isAdmin),
    recheckAdminPermission: verificarPermissaoAdminBanco,
    signOut: sairDaConta
  });
})();
