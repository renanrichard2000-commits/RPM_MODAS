/**
 * ============================================================================
 * AUTENTICAÇÃO UNIFICADA (CLIENTES GOOGLE + ADMIN USUÁRIO/SENHA) — RPM MODAS
 * ============================================================================
 * - Um único botão ENTRAR e um único pop-up centralizado.
 * - Clientes entram exclusivamente via Google OAuth.
 * - Proprietário entra via usuário autorizado + senha segura no Supabase Auth
 *   (nenhum usuário, e-mail privado ou senha é exposto no HTML/JS/GitHub).
 * - Permissões administrativas são validadas no banco via RLS / RPC is_admin().
 */
(function () {
  "use strict";

  const estadoAuth = {
    usuario: null,
    perfil: null,
    adminUsername: null,
    isAdmin: false,
    processandoAuth: false,
    ultimoUserIdSincronizado: null
  };

  // ==========================================================================
  // 1. UTILITÁRIOS DE URL E RETORNO OAUTH
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
        : "";
      const urlLimpa = `${window.location.pathname}${abaSalva}`;
      window.history.replaceState(null, "", urlLimpa);
    } catch (_) {
      // Ignora caso restrito
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
  // 2. SINCRONIZAÇÃO DE PERFIL DE CLIENTES (public.profiles)
  // ==========================================================================
  function extrairMetadadosUsuario(user) {
    if (!user) return { fullName: "", email: "", avatarUrl: "" };
    const meta = user.user_metadata || {};

    const fullName = String(meta.full_name || meta.name || "").trim();
    const email = String(user.email || meta.email || "").trim();
    const avatarUrl = String(meta.avatar_url || meta.picture || "").trim();

    return { fullName, email, avatarUrl };
  }

  function obterNomeCurtoExibicao(fullName, email, adminUsername) {
    if (adminUsername) {
      return adminUsername.startsWith("@") ? adminUsername : `@${adminUsername}`;
    }
    if (fullName) {
      return fullName.split(/\s+/)[0];
    }
    if (email && email.includes("@")) {
      return email.split("@")[0];
    }
    return "Cliente";
  }

  function obterInicialAvatar(fullName, email, adminUsername) {
    const base = String(adminUsername || fullName || email || "R")
      .replace(/^@+/, "")
      .trim();
    return (base.charAt(0) || "R").toUpperCase();
  }

  async function sincronizarPerfilCliente(user) {
    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();
    if (!supabase || !user || !user.id) return null;

    const { fullName, email, avatarUrl } = extrairMetadadosUsuario(user);

    try {
      const { data: perfilExistente, error: erroConsulta } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, created_at, updated_at")
        .eq("id", user.id)
        .maybeSingle();

      if (erroConsulta) {
        if (erroConsulta.code !== "PGRST205") {
          console.warn("[RPM Auth] Aviso ao consultar perfil:", erroConsulta.message);
        }
        return null;
      }

      const agoraIso = new Date().toISOString();

      if (!perfilExistente) {
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

        if (erroCriacao) return null;
        return novoPerfil;
      }

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

        if (!erroUpdate && perfilAtualizado) return perfilAtualizado;
      }

      return perfilExistente;
    } catch (_) {
      return null;
    }
  }

  // ==========================================================================
  // 3. VERIFICAÇÃO DE AUTORIZAÇÃO ADMINISTRATIVA NO BANCO (admin_users + RLS)
  // ==========================================================================
  async function verificarPermissaoAdminBanco() {
    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();
    if (!supabase || !estadoAuth.usuario) {
      estadoAuth.isAdmin = false;
      estadoAuth.adminUsername = null;
      return false;
    }

    try {
      const { data: ehAdmin, error } = await supabase.rpc("is_admin");
      if (!error && ehAdmin === true) {
        estadoAuth.isAdmin = true;

        const { data: rowAdmin } = await supabase
          .from("admin_users")
          .select("username")
          .eq("user_id", estadoAuth.usuario.id)
          .eq("is_active", true)
          .maybeSingle();

        estadoAuth.adminUsername =
          rowAdmin && rowAdmin.username ? `@${rowAdmin.username.replace(/^@+/, "")}` : null;
        return true;
      }
    } catch (_) {
      // Negado por padrão
    }

    estadoAuth.isAdmin = false;
    estadoAuth.adminUsername = null;
    return false;
  }

  // ==========================================================================
  // 4. CABEÇALHO E MENU DO USUÁRIO CONECTADO
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
    if (!nomeCompleto || estadoAuth.isAdmin) return;
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
    const menuSubInfo = document.getElementById("auth-menu-email");
    const badgeAdmin = document.getElementById("auth-admin-badge");
    const btnIrPainel = document.getElementById("btn-auth-abrir-admin");

    if (!btnEntrar || !containerUsuario) return;

    if (!estadoAuth.usuario) {
      btnEntrar.classList.remove("hidden");
      containerUsuario.classList.add("hidden");
      fecharMenuUsuario();
      if (badgeAdmin) badgeAdmin.classList.add("hidden");
      if (btnIrPainel) btnIrPainel.classList.add("hidden");
      return;
    }

    const dadosMeta = extrairMetadadosUsuario(estadoAuth.usuario);
    const nomeCompleto =
      (estadoAuth.perfil && estadoAuth.perfil.full_name) || dadosMeta.fullName || "";
    const emailReal = (estadoAuth.perfil && estadoAuth.perfil.email) || dadosMeta.email || "";
    const avatarUrl =
      (estadoAuth.perfil && estadoAuth.perfil.avatar_url) || dadosMeta.avatarUrl || "";

    const nomeCurto = obterNomeCurtoExibicao(
      nomeCompleto,
      emailReal,
      estadoAuth.adminUsername
    );
    const inicial = obterInicialAvatar(nomeCompleto, emailReal, estadoAuth.adminUsername);

    btnEntrar.classList.add("hidden");
    containerUsuario.classList.remove("hidden");

    if (spanNomeCurto) spanNomeCurto.textContent = nomeCurto;
    if (menuNomeCompleto) {
      menuNomeCompleto.textContent = estadoAuth.adminUsername
        ? nomeCompleto || "Administração RPM MODAS"
        : nomeCompleto || nomeCurto;
    }
    if (menuSubInfo) {
      // Nunca exibe identificador técnico interno .local caso seja conta administrativa dedicada
      menuSubInfo.textContent = estadoAuth.adminUsername
        ? estadoAuth.adminUsername
        : emailReal;
    }

    if (inicialAvatar) inicialAvatar.textContent = inicial;

    if (imgAvatar && avatarUrl) {
      imgAvatar.src = avatarUrl;
      imgAvatar.alt = `Foto de ${nomeCurto}`;
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

    if (badgeAdmin) badgeAdmin.classList.toggle("hidden", !estadoAuth.isAdmin);
    if (btnIrPainel) btnIrPainel.classList.toggle("hidden", !estadoAuth.isAdmin);

    preencherNomeNosFormulariosSeVazio(nomeCompleto);
  }

  // ==========================================================================
  // 5. POP-UP UNIFICADO DE LOGIN (GOOGLE + USUÁRIO/SENHA ADMIN)
  // ==========================================================================
  const TEXTO_PADRAO_MODAL_LOGIN = "Entre na sua conta para continuar.";

  function exibirAvisoNoModal(mensagemAviso) {
    const boxAviso = document.getElementById("login-aviso-box");
    const descModal = document.getElementById("desc-modal-login");

    if (descModal) {
      descModal.textContent = TEXTO_PADRAO_MODAL_LOGIN;
      descModal.classList.toggle("hidden", Boolean(mensagemAviso));
    }

    if (!boxAviso) return;
    if (!mensagemAviso) {
      boxAviso.textContent = "";
      boxAviso.classList.add("hidden");
      return;
    }
    boxAviso.textContent = mensagemAviso;
    boxAviso.classList.remove("hidden");
  }

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

  function definirEstadoProcessando(processando, origem = "google") {
    estadoAuth.processandoAuth = processando;

    const btnGoogle = document.getElementById("btn-continuar-google");
    const iconeGoogle = document.getElementById("icone-oficial-google");
    const spinnerGoogle = document.getElementById("login-google-spinner");
    const textoGoogle = document.getElementById("texto-btn-google");

    const btnAdmin = document.getElementById("btn-submit-admin");
    const spinnerAdmin = document.getElementById("login-admin-spinner");
    const textoAdmin = document.getElementById("texto-btn-admin");
    const inputUser = document.getElementById("input-admin-usuario");
    const inputPass = document.getElementById("input-admin-senha");

    if (btnGoogle) {
      btnGoogle.disabled = processando;
      btnGoogle.setAttribute("aria-busy", processando && origem === "google" ? "true" : "false");
    }
    if (iconeGoogle) iconeGoogle.classList.toggle("hidden", processando && origem === "google");
    if (spinnerGoogle) {
      spinnerGoogle.classList.toggle("hidden", !(processando && origem === "google"));
    }
    if (textoGoogle) {
      textoGoogle.textContent =
        processando && origem === "google" ? "Conectando ao Google..." : "Continuar com Google";
    }

    if (btnAdmin) {
      btnAdmin.disabled = processando;
      btnAdmin.setAttribute("aria-busy", processando && origem === "admin" ? "true" : "false");
    }
    if (spinnerAdmin) {
      spinnerAdmin.classList.toggle("hidden", !(processando && origem === "admin"));
    }
    if (textoAdmin) {
      textoAdmin.textContent = processando && origem === "admin" ? "Verificando..." : "Entrar";
    }
    if (inputUser) inputUser.disabled = processando;
    if (inputPass) inputPass.disabled = processando;
  }

  function abrirModalLogin(opcoesOuErro) {
    const modal = document.getElementById("modal-login");
    if (!modal) return;

    let msgErro = "";
    let msgAviso = "";
    if (typeof opcoesOuErro === "string") {
      msgErro = opcoesOuErro;
    } else if (opcoesOuErro && typeof opcoesOuErro === "object") {
      msgAviso = opcoesOuErro.infoMessage || "";
      msgErro = opcoesOuErro.errorMessage || "";
    }

    fecharMenuUsuario();
    definirEstadoProcessando(false);
    exibirAvisoNoModal(msgAviso);
    exibirErroNoModal(msgErro);

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function fecharModalLogin() {
    const modal = document.getElementById("modal-login");
    if (!modal || modal.classList.contains("hidden")) return;

    modal.classList.add("hidden");
    definirEstadoProcessando(false);
    exibirAvisoNoModal("");
    exibirErroNoModal("");

    const inputSenha = document.getElementById("input-admin-senha");
    if (inputSenha) {
      inputSenha.value = "";
      inputSenha.type = "password";
    }
    atualizarIconeMostrarSenha(false);

    const backdropLoja = document.getElementById("backdrop");
    if (!backdropLoja || backdropLoja.classList.contains("hidden")) {
      document.body.style.overflow = "";
    }
  }

  function atualizarIconeMostrarSenha(visivel) {
    const btnToggle = document.getElementById("btn-toggle-senha");
    const iconeOlhoAberto = document.getElementById("icone-senha-mostrar");
    const iconeOlhoFechado = document.getElementById("icone-senha-ocultar");
    if (!btnToggle) return;
    btnToggle.setAttribute("aria-label", visivel ? "Ocultar senha" : "Mostrar senha");
    btnToggle.setAttribute("title", visivel ? "Ocultar senha" : "Mostrar senha");
    if (iconeOlhoAberto) iconeOlhoAberto.classList.toggle("hidden", visivel);
    if (iconeOlhoFechado) iconeOlhoFechado.classList.toggle("hidden", !visivel);
  }

  // ==========================================================================
  // 6. FLUXOS DE LOGIN: GOOGLE (CLIENTES) E USUÁRIO/SENHA (ADMINISTRADOR)
  // ==========================================================================
  async function iniciarLoginComGoogle() {
    if (estadoAuth.processandoAuth) return;

    exibirErroNoModal("");
    definirEstadoProcessando(true, "google");

    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();
    if (!supabase) {
      definirEstadoProcessando(false);
      exibirErroNoModal("Conexão indisponível no momento. Verifique sua internet.");
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
        definirEstadoProcessando(false);
        exibirErroNoModal(
          error.message || "Ocorreu um erro ao iniciar o login com Google. Tente novamente."
        );
      }
    } catch (_) {
      definirEstadoProcessando(false);
      exibirErroNoModal("Falha de comunicação ao iniciar login com o Google.");
    }
  }

  async function iniciarLoginAdministrativo(e) {
    if (e) e.preventDefault();
    if (estadoAuth.processandoAuth) return;

    const inputUsuario = document.getElementById("input-admin-usuario");
    const inputSenha = document.getElementById("input-admin-senha");
    const usuarioDigitado = String(inputUsuario ? inputUsuario.value : "").trim();
    const senhaDigitada = String(inputSenha ? inputSenha.value : "");

    if (!usuarioDigitado || !senhaDigitada) {
      exibirErroNoModal("Informe o usuário e a senha para continuar.");
      return;
    }

    // Clientes comuns entram exclusivamente com Google; usuário/senha é exclusivo para contas autorizadas em admin_users
    const usernameNormalizado = usuarioDigitado.replace(/^@+/, "").trim().toLowerCase();
    if (!usernameNormalizado || usernameNormalizado.includes(" ")) {
      exibirErroNoModal("Usuário ou senha inválidos.");
      return;
    }

    exibirErroNoModal("");
    definirEstadoProcessando(true, "admin");

    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();
    if (!supabase) {
      definirEstadoProcessando(false);
      exibirErroNoModal("Serviço de autenticação indisponível no momento.");
      return;
    }

    try {
      // 1. Resolve no banco o identificador técnico da conta administrativa sem expor dados no código
      const { data: authIdentifier, error: errRpc } = await supabase.rpc(
        "resolve_admin_login",
        { p_username: usernameNormalizado }
      );

      if (errRpc) {
        definirEstadoProcessando(false);
        if (errRpc.code === "PGRST202") {
          exibirErroNoModal(
            "A estrutura administrativa ainda não foi ativada no banco Supabase (execute o script supabase-setup.sql)."
          );
          return;
        }
        exibirErroNoModal("Não foi possível validar o usuário administrativo.");
        return;
      }

      if (!authIdentifier) {
        definirEstadoProcessando(false);
        exibirErroNoModal("Usuário ou senha incorretos, ou conta sem permissão administrativa.");
        return;
      }

      // 2. Autentica com segurança via Supabase Auth (hash bcrypt verificado no servidor)
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: authIdentifier,
        password: senhaDigitada
      });

      if (signInErr || !signInData || !signInData.session) {
        definirEstadoProcessando(false);
        const msgLower = String((signInErr && signInErr.message) || "").toLowerCase();
        if (msgLower.includes("email logins are disabled")) {
          exibirErroNoModal(
            "Ative o provedor 'Email' em Authentication → Providers no painel do Supabase para liberar o login por senha do administrador."
          );
          return;
        }
        exibirErroNoModal("Usuário ou senha incorretos.");
        return;
      }

      // 3. Confirma no banco via RLS/RPC que a conta autenticada realmente possui permissão administrativa
      estadoAuth.usuario = signInData.user;
      const confirmadoAdmin = await verificarPermissaoAdminBanco();

      if (!confirmadoAdmin) {
        await supabase.auth.signOut();
        estadoAuth.usuario = null;
        definirEstadoProcessando(false);
        exibirErroNoModal("Acesso negado: esta conta não possui autorização administrativa.");
        return;
      }

      if (inputSenha) inputSenha.value = "";
      definirEstadoProcessando(false);
      fecharModalLogin();
      atualizarCabecalhoAutenticacao();
      notificarLoja("Bem-vinda ao Painel Administrativo da RPM MODAS!");

      // Encaminha automaticamente o administrador autenticado ao Painel Administrativo
      window.dispatchEvent(new CustomEvent("rpm:abrir-painel-admin"));
    } catch (_) {
      definirEstadoProcessando(false);
      exibirErroNoModal("Erro de conexão ao autenticar. Tente novamente.");
    }
  }

  async function sairDaConta() {
    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();
    fecharMenuUsuario();
    if (!supabase) return;

    try {
      await supabase.auth.signOut();
      estadoAuth.usuario = null;
      estadoAuth.perfil = null;
      estadoAuth.adminUsername = null;
      estadoAuth.isAdmin = false;
      estadoAuth.ultimoUserIdSincronizado = null;

      ["cliente-nome", "cliente-cep", "cliente-obs"].forEach((idCampo) => {
        const el = document.getElementById(idCampo);
        if (el) el.value = "";
      });

      atualizarCabecalhoAutenticacao();
      window.dispatchEvent(
        new CustomEvent("rpm:auth-sessao", { detail: { user: null, event: "SIGNED_OUT" } })
      );
      window.dispatchEvent(new CustomEvent("rpm:usuario-deslogado"));
      notificarLoja("Você saiu da sua conta.");
    } catch (_) {
      notificarLoja("Erro ao encerrar a sessão.");
    }
  }

  async function processarMudancaDeSessao(session, evento) {
    const novoUsuario = session && session.user ? session.user : null;
    estadoAuth.usuario = novoUsuario;

    // Notifica imediatamente o controlador da sacola para troca atômica (guestCart vs userCart)
    window.dispatchEvent(
      new CustomEvent("rpm:auth-sessao", { detail: { user: novoUsuario, event: evento } })
    );

    if (!novoUsuario) {
      estadoAuth.perfil = null;
      estadoAuth.adminUsername = null;
      estadoAuth.isAdmin = false;
      estadoAuth.ultimoUserIdSincronizado = null;
      atualizarCabecalhoAutenticacao();
      window.dispatchEvent(new CustomEvent("rpm:auth-atualizado", { detail: { isAdmin: false } }));
      return;
    }

    if (
      estadoAuth.ultimoUserIdSincronizado !== novoUsuario.id ||
      evento === "SIGNED_IN" ||
      evento === "USER_UPDATED"
    ) {
      estadoAuth.ultimoUserIdSincronizado = novoUsuario.id;
      const [perfilBanco, ehAdmin] = await Promise.all([
        sincronizarPerfilCliente(novoUsuario),
        verificarPermissaoAdminBanco()
      ]);

      if (perfilBanco) estadoAuth.perfil = perfilBanco;

      fecharModalLogin();
      atualizarCabecalhoAutenticacao();

      window.dispatchEvent(
        new CustomEvent("rpm:auth-atualizado", { detail: { isAdmin: ehAdmin } })
      );

      // Se uma conta Google autenticada também tiver autorização em admin_users e estiver na rota /admin, libera
      if (ehAdmin && evento === "SIGNED_IN" && window.getRpmCurrentSubroute() === "/admin") {
        window.dispatchEvent(new CustomEvent("rpm:abrir-painel-admin"));
      }
    } else {
      atualizarCabecalhoAutenticacao();
    }
  }

  function configurarEventosAutenticacao() {
    const btnEntrar = document.getElementById("btn-header-entrar");
    const btnFecharLogin = document.getElementById("btn-fechar-login");
    const modalLogin = document.getElementById("modal-login");
    const btnContinuarGoogle = document.getElementById("btn-continuar-google");
    const formAdmin = document.getElementById("form-login-admin");
    const btnToggleSenha = document.getElementById("btn-toggle-senha");
    const inputSenha = document.getElementById("input-admin-senha");
    const btnUserTrigger = document.getElementById("btn-auth-user-trigger");
    const btnAbrirAdminMenu = document.getElementById("btn-auth-abrir-admin");
    const btnLogout = document.getElementById("btn-auth-logout");

    if (btnEntrar) btnEntrar.addEventListener("click", () => abrirModalLogin());
    if (btnFecharLogin) btnFecharLogin.addEventListener("click", fecharModalLogin);

    if (modalLogin) {
      modalLogin.addEventListener("click", (e) => {
        if (e.target === modalLogin) fecharModalLogin();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        fecharModalLogin();
        fecharMenuUsuario();
      }
    });

    if (btnContinuarGoogle) {
      btnContinuarGoogle.addEventListener("click", iniciarLoginComGoogle);
    }

    if (formAdmin) {
      formAdmin.addEventListener("submit", iniciarLoginAdministrativo);
    }

    if (btnToggleSenha && inputSenha) {
      btnToggleSenha.addEventListener("click", () => {
        const mostrar = inputSenha.type === "password";
        inputSenha.type = mostrar ? "text" : "password";
        atualizarIconeMostrarSenha(mostrar);
        inputSenha.focus();
      });
    }

    if (btnUserTrigger) {
      btnUserTrigger.addEventListener("click", alternarMenuUsuario);
    }

    if (btnAbrirAdminMenu) {
      btnAbrirAdminMenu.addEventListener("click", () => {
        fecharMenuUsuario();
        window.dispatchEvent(new CustomEvent("rpm:abrir-painel-admin"));
      });
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
      window.dispatchEvent(
        new CustomEvent("rpm:auth-sessao", { detail: { user: null, event: "INITIAL_SESSION" } })
      );
      if (erroRetornoUrl) abrirModalLogin(erroRetornoUrl);
      return;
    }

    supabase.auth.onAuthStateChange((evento, session) => {
      processarMudancaDeSessao(session, evento);
      if (evento === "SIGNED_IN") {
        limparParametrosOAuthDaUrl();
      }
    });

    try {
      const { data } = await supabase.auth.getSession();
      await processarMudancaDeSessao(data ? data.session : null, "INITIAL_SESSION");
    } catch (_) {
      window.dispatchEvent(
        new CustomEvent("rpm:auth-sessao", { detail: { user: null, event: "INITIAL_SESSION" } })
      );
    } finally {
      if (erroRetornoUrl) {
        limparParametrosOAuthDaUrl();
        abrirModalLogin(erroRetornoUrl);
      } else if (possuiCallbackOAuthNaUrl()) {
        limparParametrosOAuthDaUrl();
      }
    }
  }

  async function verificarSessaoAtivaReal() {
    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data || !data.session || !data.session.user) return null;
      return data.session.user;
    } catch (_) {
      return null;
    }
  }

  document.addEventListener("DOMContentLoaded", inicializarSistemaAutenticacao);

  window.RPMAuth = Object.freeze({
    hasOAuthCallbackInUrl: possuiCallbackOAuthNaUrl,
    openLoginModal: abrirModalLogin,
    closeLoginModal: fecharModalLogin,
    getUser: () => estadoAuth.usuario,
    isAuthenticated: () => Boolean(estadoAuth.usuario && estadoAuth.usuario.id),
    verifyActiveSession: verificarSessaoAtivaReal,
    getProfile: () => estadoAuth.perfil,
    getAdminUsername: () => estadoAuth.adminUsername,
    isAdminVerified: () => Boolean(estadoAuth.isAdmin),
    recheckAdminPermission: verificarPermissaoAdminBanco,
    signOut: sairDaConta
  });
})();
