/**
 * ============================================================================
 * LÓGICA DA LOJA RPM MODAS — VITRINE DINÂMICA SUPABASE + PÁGINAS INDIVIDUAIS
 * (/RPM_MODAS/produto/<slug>) + FILTROS + SACOLA COM ESTOQUE POR COR/TAMANHO
 * ============================================================================
 */
(function () {
  "use strict";

  // Remove definitivamente qualquer chave legada global que misturava contas no mesmo navegador
  try {
    localStorage.removeItem("rpm_sacola_v1");
  } catch (_) {}

  const CHAVE_GUEST_CART = "rpm_guest_cart_v2";
  const MENSAGEM_LOGIN_COMPRA = "Entre na sua conta para continuar com sua compra.";

  const guestStorage = {
    ler() {
      try {
        const raw = sessionStorage.getItem(CHAVE_GUEST_CART);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    },
    salvar(itens) {
      try {
        sessionStorage.setItem(CHAVE_GUEST_CART, JSON.stringify(Array.isArray(itens) ? itens : []));
      } catch (_) {}
    },
    limpar() {
      try {
        sessionStorage.removeItem(CHAVE_GUEST_CART);
      } catch (_) {}
      try {
        localStorage.removeItem(CHAVE_GUEST_CART);
      } catch (_) {}
    }
  };

  // Estados estritamente isolados: guestCart (visitante) NUNCA é mesclado com userCart (Supabase)
  const controleSacola = {
    modo: "inicializando", // "inicializando" | "guest" | "user"
    userIdAtivo: null,
    guestCart: [],
    userCart: [],
    carregandoUserCart: false,
    seqSincronizacao: 0
  };

  const estado = {
    abaAtual: "inicio",
    slugProdutoAberto: null,
    selecaoTamanhoCard: {},
    selecaoCorCard: {},
    busca: "",
    categoriaAtiva: "Todas",
    tamanhoFiltro: "Todos",
    precoFiltro: "todos",
    ordenacao: "destaques",
    validandoCheckout: false
  };

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function escaparHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function limparNumeroWhatsApp(num) {
    return String(num || "").replace(/\D/g, "");
  }

  function gerarLinkWhatsApp(mensagem) {
    const fone = limparNumeroWhatsApp(DADOS_LOJA.whatsapp);
    return `https://wa.me/${fone}?text=${encodeURIComponent(mensagem)}`;
  }

  function obterProdutosPublicados() {
    if (window.RpmCatalog && typeof window.RpmCatalog.getPublishedProducts === "function") {
      const lista = window.RpmCatalog.getPublishedProducts();
      if (Array.isArray(lista)) return lista;
    }
    return DADOS_LOJA.produtos || [];
  }

  let toastTimer = null;
  function mostrarToast(texto) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = texto;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.add("hidden");
    }, 3400);
  }

  // ==========================================================================
  // 1. NAVEGAÇÃO ENTRE ABAS E ROTAS LIMPAS (/RPM_MODAS/produto/<slug>)
  // ==========================================================================
  function ocultarSecoesPrincipais() {
    ["aba-inicio", "aba-catalogo", "aba-contato", "aba-produto", "aba-admin"].forEach((id) => {
      const sec = document.getElementById(id);
      if (sec) sec.classList.add("hidden");
    });
  }

  function marcarAbaMenuAtiva(abaOuNull) {
    document.querySelectorAll(".tab-nav-btn, .mobile-tab-btn").forEach((btn) => {
      const alvo = btn.getAttribute("data-aba-link");
      const ativo = Boolean(abaOuNull && alvo === abaOuNull);
      btn.classList.toggle("active", ativo);
      if (ativo) {
        btn.setAttribute("aria-current", "page");
      } else {
        btn.removeAttribute("aria-current");
      }
    });
  }

  function navegarParaAba(nomeAba, opcoes = {}) {
    const { rolarTopo = true, pushHistory = true } =
      typeof opcoes === "boolean" ? { rolarTopo: opcoes, pushHistory: true } : opcoes;

    const abasValidas = ["inicio", "catalogo", "contato"];
    const destino = abasValidas.includes(nomeAba) ? nomeAba : "inicio";

    estado.abaAtual = destino;
    estado.slugProdutoAberto = null;
    document.title = `${DADOS_LOJA.nomeLoja} | ${DADOS_LOJA.subtituloLogo}`;

    if (window.RPMAdmin) window.RPMAdmin.closePanel();
    ocultarSecoesPrincipais();

    const secaoDestino = document.getElementById(`aba-${destino}`);
    if (secaoDestino) secaoDestino.classList.remove("hidden");
    marcarAbaMenuAtiva(destino);

    if (pushHistory && (!window.RPMAuth || !window.RPMAuth.hasOAuthCallbackInUrl())) {
      try {
        const urlRaiz = window.buildRpmRouteUrl ? window.buildRpmRouteUrl("") : "./";
        const hashSufixo = destino === "inicio" ? "" : `#${destino}`;
        window.history.pushState({ view: "tab", tab: destino }, "", `${urlRaiz}${hashSufixo}`);
      } catch (_) {}
    }

    if (rolarTopo) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // ==========================================================================
  // 2. PÁGINA INDIVIDUAL DE CADA ROUPA (/RPM_MODAS/produto/<slug>)
  // ==========================================================================
  function abrirPaginaProduto(slugOuId, opcoes = {}) {
    const { rolarTopo = true, pushHistory = true } = opcoes;

    fecharTodosModais();
    if (window.RPMAdmin) window.RPMAdmin.closePanel();
    ocultarSecoesPrincipais();
    marcarAbaMenuAtiva("catalogo");

    const secProduto = document.getElementById("aba-produto");
    const container = document.getElementById("conteudo-pagina-produto");
    if (!secProduto || !container) return;

    secProduto.classList.remove("hidden");

    const prod =
      window.RpmCatalog && window.RpmCatalog.getProductBySlugOrId
        ? window.RpmCatalog.getProductBySlugOrId(slugOuId)
        : obterProdutosPublicados().find(
            (p) => p.slug === slugOuId || String(p.id) === String(slugOuId)
          );

    // Caso o produto tenha sido removido, arquivado ou despublicado, impede compra
    if (!prod || prod.status !== "published") {
      estado.slugProdutoAberto = String(slugOuId || "");
      document.title = `Peça Indisponível | ${DADOS_LOJA.nomeLoja}`;

      if (pushHistory && slugOuId) {
        try {
          window.history.pushState(
            { view: "produto", slug: slugOuId },
            "",
            window.buildRpmRouteUrl(`produto/${encodeURIComponent(slugOuId)}`)
          );
        } catch (_) {}
      }

      container.innerHTML = `
        <div class="product-unavailable-card">
          <span class="eyebrow">CATÁLOGO RPM MODAS</span>
          <h1>Esta peça não está disponível no momento</h1>
          <p>
            A roupa que você tentou acessar foi despublicada, encerrada ou está temporariamente indisponível para compra.
          </p>
          <div class="unavailable-actions">
            <button type="button" class="btn btn-primary" id="btn-voltar-cat-indisp">
              Explorar Catálogo Atualizado
            </button>
            <button type="button" class="btn btn-outline" id="btn-voltar-home-indisp">
              Ir para o Início
            </button>
          </div>
        </div>
      `;

      document.getElementById("btn-voltar-cat-indisp").addEventListener("click", () => {
        navegarParaAba("catalogo");
      });
      document.getElementById("btn-voltar-home-indisp").addEventListener("click", () => {
        navegarParaAba("inicio");
      });

      if (rolarTopo) window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    estado.abaAtual = "produto";
    estado.slugProdutoAberto = prod.slug;
    document.title = `${prod.nome} | ${DADOS_LOJA.nomeLoja}`;

    if (pushHistory) {
      try {
        const urlProduto = window.buildRpmRouteUrl(`produto/${prod.slug}`);
        if (window.location.pathname !== urlProduto) {
          window.history.pushState({ view: "produto", slug: prod.slug }, "", urlProduto);
        }
      } catch (_) {}
    }

    const galeria =
      prod.imagens && prod.imagens.length
        ? prod.imagens
        : [{ id: "main", url: prod.imagem, colorName: null }];

    const coresDisp = prod.cores && prod.cores.length ? prod.cores : [];
    const tamanhosDisp = prod.tamanhos && prod.tamanhos.length ? prod.tamanhos : [];

    // Escolhe inicialmente uma cor que possua estoque > 0, se houver
    let corEscolhida =
      estado.selecaoCorCard[prod.slug] && coresDisp.includes(estado.selecaoCorCard[prod.slug])
        ? estado.selecaoCorCard[prod.slug]
        : coresDisp.find((c) => window.RpmCatalog.hasColorAnyStock(prod.slug, c)) ||
          coresDisp[0] ||
          "";

    function obterPrimeiroTamanhoComEstoque(cor) {
      return (
        tamanhosDisp.find((t) => window.RpmCatalog.getVariantStock(prod.slug, cor, t) > 0) ||
        tamanhosDisp[0] ||
        ""
      );
    }

    let tamEscolhido =
      estado.selecaoTamanhoCard[prod.slug] &&
      tamanhosDisp.includes(estado.selecaoTamanhoCard[prod.slug]) &&
      window.RpmCatalog.getVariantStock(prod.slug, corEscolhida, estado.selecaoTamanhoCard[prod.slug]) > 0
        ? estado.selecaoTamanhoCard[prod.slug]
        : obterPrimeiroTamanhoComEstoque(corEscolhida);

    let indiceFotoAtiva = 0;

    function renderizarPaginaInterna() {
      const percPix = DADOS_LOJA.descontoPixPercentual || 0;
      const precoPix = prod.preco * (1 - percPix / 100);
      const parcelas = prod.parcelasMax || DADOS_LOJA.parcelasSemJuros || 3;
      const isOferta = Boolean(prod.precoAntigo && prod.precoAntigo > prod.preco);
      const percDesconto = isOferta
        ? Math.round(((prod.precoAntigo - prod.preco) / prod.precoAntigo) * 100)
        : 0;

      const estoqueAtual =
        corEscolhida && tamEscolhido
          ? window.RpmCatalog.getVariantStock(prod.id, corEscolhida, tamEscolhido)
          : 0;
      const podeComprar = !prod.esgotadoGeral && Boolean(corEscolhida && tamEscolhido && estoqueAtual > 0);

      const fotoPrincipal = galeria[indiceFotoAtiva] ? galeria[indiceFotoAtiva].url : prod.imagem;

      // Produtos relacionados para navegação direta entre peças
      const relacionados = obterProdutosPublicados()
        .filter((item) => String(item.id) !== String(prod.id))
        .sort((a, b) => Number(b.categoria === prod.categoria) - Number(a.categoria === prod.categoria))
        .slice(0, 4);

      container.innerHTML = `
        <nav class="product-breadcrumb" aria-label="Localização">
          <button type="button" class="crumb-link" id="crumb-inicio">Início</button>
          <span>/</span>
          <button type="button" class="crumb-link" id="crumb-catalogo">Catálogo</button>
          <span>/</span>
          <button type="button" class="crumb-link" id="crumb-categoria">${escaparHtml(
            prod.categoria
          )}</button>
          <span>/</span>
          <span class="crumb-current">${escaparHtml(prod.nome)}</span>
        </nav>

        <div class="product-detail-layout">
          <!-- GALERIA DE FOTOS -->
          <div class="product-gallery-col">
            <div class="product-main-photo-wrap">
              <img src="${escaparHtml(fotoPrincipal)}" alt="${escaparHtml(
        prod.nome
      )}" id="img-principal-pagina-prod" />
              ${
                isOferta
                  ? `<span class="product-badge sale">-${percDesconto}% OFF</span>`
                  : prod.destaque
                  ? `<span class="product-badge">${escaparHtml(prod.destaque)}</span>`
                  : ""
              }
            </div>

            ${
              galeria.length > 1
                ? `
              <div class="product-thumbs-row" role="list" aria-label="Miniaturas da peça">
                ${galeria
                  .map(
                    (img, idx) => `
                  <button
                    type="button"
                    class="product-thumb-btn ${idx === indiceFotoAtiva ? "active" : ""}"
                    data-thumb-idx="${idx}"
                    aria-label="Ver foto ${idx + 1}"
                  >
                    <img src="${escaparHtml(img.url)}" alt="${escaparHtml(prod.nome)} - foto ${
                      idx + 1
                    }" />
                  </button>
                `
                  )
                  .join("")}
              </div>
            `
                : ""
            }
          </div>

          <!-- INFORMAÇÕES E COMPRA -->
          <div class="product-buy-col">
            <div class="product-top-meta">
              <span class="eyebrow">${escaparHtml(prod.categoria)}</span>
              <button type="button" class="share-link-btn" id="btn-compartilhar-peca" title="Copiar link direto desta roupa">
                🔗 Compartilhar link
              </button>
            </div>

            <h1 class="product-page-title">${escaparHtml(prod.nome)}</h1>

            <div class="product-page-price-box">
              <div class="price-main-line">
                ${
                  isOferta
                    ? `<span class="old-price">${formatarMoeda(prod.precoAntigo)}</span>`
                    : ""
                }
                <span class="current-price product-big-price">${formatarMoeda(prod.preco)}</span>
              </div>
              ${
                percPix > 0
                  ? `<div class="pix-price-hint">${formatarMoeda(
                      precoPix
                    )} no PIX (${percPix}% de desconto imediato)</div>`
                  : ""
              }
              <div class="installment-hint">
                ou em até <strong>${parcelas}x de ${formatarMoeda(
        prod.preco / parcelas
      )}</strong> sem juros no cartão
              </div>
            </div>

            <p class="product-page-description">${escaparHtml(prod.descricao)}</p>

            ${
              prod.tecido
                ? `<div class="modal-fabric-box"><strong>Tecido, modelagem &amp; detalhes:</strong> ${escaparHtml(
                    prod.tecido
                  )}</div>`
                : ""
            }

            <!-- SELETOR DE CORES -->
            ${
              coresDisp.length > 0
                ? `
              <div class="selector-group">
                <div class="selector-header">
                  <span>Cor selecionada: <strong>${escaparHtml(corEscolhida)}</strong></span>
                </div>
                <div class="color-chips">
                  ${(prod.coresDetalhes || coresDisp.map((n) => ({ name: n, hex: "#231b16" })))
                    .map((cObj) => {
                      const corTemEstoque = window.RpmCatalog.hasColorAnyStock(
                        prod.id,
                        cObj.name
                      );
                      return `
                      <button
                        type="button"
                        class="color-chip ${corEscolhida === cObj.name ? "selected" : ""} ${
                        !corTemEstoque ? "color-out" : ""
                      }"
                        data-pag-cor="${escaparHtml(cObj.name)}"
                      >
                        <span class="color-dot-inline" style="background:${escaparHtml(
                          cObj.hex
                        )}"></span>
                        <span>${escaparHtml(cObj.name)}</span>
                      </button>
                    `;
                    })
                    .join("")}
                </div>
              </div>
            `
                : ""
            }

            <!-- SELETOR DE TAMANHOS COM ESTOQUE REAL POR COR -->
            ${
              tamanhosDisp.length > 0
                ? `
              <div class="selector-group">
                <div class="selector-header">
                  <span>Tamanho: <strong>${escaparHtml(tamEscolhido || "Selecione")}</strong></span>
                  <button type="button" class="text-btn" id="btn-medidas-pagina-prod">📏 Guia de Medidas</button>
                </div>
                <div class="size-chips">
                  ${tamanhosDisp
                    .map((tam) => {
                      const qtdComb = window.RpmCatalog.getVariantStock(
                        prod.id,
                        corEscolhida,
                        tam
                      );
                      const esgotadoTam = qtdComb <= 0;
                      return `
                      <button
                        type="button"
                        class="size-chip ${tamEscolhido === tam ? "selected" : ""} ${
                        esgotadoTam ? "sold-out" : ""
                      }"
                        data-pag-tam="${escaparHtml(tam)}"
                        ${esgotadoTam ? 'disabled title="Tamanho esgotado nesta cor"' : ""}
                      >
                        ${escaparHtml(tam)}${esgotadoTam ? " (Esgotado)" : ""}
                      </button>
                    `;
                    })
                    .join("")}
                </div>
              </div>
            `
                : ""
            }

            <!-- INDICADOR DE DISPONIBILIDADE EM TEMPO REAL -->
            <div class="variant-stock-banner ${
              podeComprar ? (estoqueAtual <= 3 ? "low" : "ok") : "out"
            }">
              ${
                prod.esgotadoGeral
                  ? "✕ Peça temporariamente esgotada em todas as cores e tamanhos."
                  : podeComprar
                  ? estoqueAtual <= 3
                    ? `🔥 Últimas ${estoqueAtual} unidade(s) disponíveis em ${escaparHtml(
                        corEscolhida
                      )} (${escaparHtml(tamEscolhido)})!`
                    : `✓ Em estoque para envio imediato (${estoqueAtual} un. disponíveis nesta combinação)`
                  : `✕ Combinação ${escaparHtml(corEscolhida)} • ${escaparHtml(
                      tamEscolhido || "—"
                    )} esgotada. Escolha outra opção disponível.`
              }
            </div>

            <div class="modal-actions-stack">
              <button
                type="button"
                class="btn btn-primary btn-block"
                id="btn-pagina-add-sacola"
                ${!podeComprar ? "disabled" : ""}
              >
                ${
                  podeComprar
                    ? `Adicionar à Sacola • ${formatarMoeda(prod.preco)}`
                    : "Indisponível para Compra"
                }
              </button>

              ${
                podeComprar
                  ? `
                <button type="button" class="btn btn-whatsapp btn-block" id="btn-pagina-comprar-wa">
                  Comprar esta peça direto no WhatsApp
                </button>
              `
                  : ""
              }
            </div>
          </div>
        </div>

        ${
          relacionados.length > 0
            ? `
          <div class="related-products-section">
            <div class="section-header">
              <div>
                <span class="eyebrow">CONTINUE EXPLORANDO</span>
                <h2>Você também pode amar</h2>
              </div>
              <button type="button" class="btn-link-arrow" id="btn-rel-ver-catalogo">
                Ver catálogo completo →
              </button>
            </div>
            <div class="products-grid" id="grade-relacionados-produto">
              ${relacionados.map(montarHtmlCardProduto).join("")}
            </div>
          </div>
        `
            : ""
        }
      `;

      // Eventos de navegação breadcrumb
      document.getElementById("crumb-inicio").addEventListener("click", () => navegarParaAba("inicio"));
      document
        .getElementById("crumb-catalogo")
        .addEventListener("click", () => navegarParaAba("catalogo"));
      document.getElementById("crumb-categoria").addEventListener("click", () => {
        limparTodosOsFiltros();
        estado.categoriaAtiva = prod.categoria;
        renderizarPillsCategorias();
        renderizarCatalogo();
        navegarParaAba("catalogo");
      });

      const btnVerCatRel = document.getElementById("btn-rel-ver-catalogo");
      if (btnVerCatRel) {
        btnVerCatRel.addEventListener("click", () => navegarParaAba("catalogo"));
      }

      // Compartilhar link direto da página individual
      document.getElementById("btn-compartilhar-peca").addEventListener("click", async () => {
        const urlCompleta = `${window.location.origin}${window.buildRpmRouteUrl(
          `produto/${prod.slug}`
        )}`;
        try {
          await navigator.clipboard.writeText(urlCompleta);
          mostrarToast("✓ Link da roupa copiado para compartilhar!");
        } catch (_) {
          mostrarToast(urlCompleta);
        }
      });

      // Miniaturas da galeria
      container.querySelectorAll("[data-thumb-idx]").forEach((btn) => {
        btn.addEventListener("click", () => {
          indiceFotoAtiva = Number(btn.getAttribute("data-thumb-idx") || 0);
          renderizarPaginaInterna();
        });
      });

      // Troca de cor (troca foto correspondente se associada e valida tamanho com estoque)
      container.querySelectorAll("[data-pag-cor]").forEach((btn) => {
        btn.addEventListener("click", () => {
          corEscolhida = btn.getAttribute("data-pag-cor");
          estado.selecaoCorCard[prod.slug] = corEscolhida;

          const idxFotoDaCor = galeria.findIndex(
            (img) =>
              img.colorName && img.colorName.toLowerCase() === corEscolhida.toLowerCase()
          );
          if (idxFotoDaCor >= 0) indiceFotoAtiva = idxFotoDaCor;

          if (window.RpmCatalog.getVariantStock(prod.id, corEscolhida, tamEscolhido) <= 0) {
            tamEscolhido = obterPrimeiroTamanhoComEstoque(corEscolhida);
          }

          renderizarPaginaInterna();
        });
      });

      // Troca de tamanho
      container.querySelectorAll("[data-pag-tam]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const novoTam = btn.getAttribute("data-pag-tam");
          if (window.RpmCatalog.getVariantStock(prod.id, corEscolhida, novoTam) <= 0) {
            mostrarToast("Este tamanho está esgotado na cor selecionada.");
            return;
          }
          tamEscolhido = novoTam;
          estado.selecaoTamanhoCard[prod.slug] = tamEscolhido;
          renderizarPaginaInterna();
        });
      });

      const btnGuia = document.getElementById("btn-medidas-pagina-prod");
      if (btnGuia) {
        btnGuia.addEventListener("click", () => {
          abrirCamada(document.getElementById("modal-medidas"));
        });
      }

      const btnAdd = document.getElementById("btn-pagina-add-sacola");
      if (btnAdd && podeComprar) {
        btnAdd.addEventListener("click", () => {
          adicionarNaSacola(prod, tamEscolhido, corEscolhida, 1, fotoPrincipal);
        });
      }

      const btnComprarWa = document.getElementById("btn-pagina-comprar-wa");
      if (btnComprarWa && podeComprar) {
        btnComprarWa.addEventListener("click", async () => {
          const sessaoValida = await exigirAutenticacaoParaCompra();
          if (!sessaoValida) return;

          const urlDireta = `${window.location.origin}${window.buildRpmRouteUrl(
            `produto/${prod.slug}`
          )}`;
          const msg = [
            `Olá! Vim pelo site da *${DADOS_LOJA.nomeLoja}* e gostaria de comprar esta peça: ✨`,
            "",
            `• *${prod.nome}*`,
            `  Cor: *${corEscolhida}* | Tamanho: *${tamEscolhido}*`,
            `  Valor: ${formatarMoeda(prod.preco)} (${formatarMoeda(precoPix)} no PIX)`,
            `  Link: ${urlDireta}`,
            "",
            "Poderia confirmar para finalizarmos?"
          ].join("\n");
          exibirConfirmacaoPedido(msg);
        });
      }

      conectarEventosDeGrade(document.getElementById("grade-relacionados-produto"));
    }

    renderizarPaginaInterna();
    if (rolarTopo) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ==========================================================================
  // 3. PREENCHIMENTO DOS DADOS DA MARCA (RPM MODAS)
  // ==========================================================================
  function preencherDadosDaLoja() {
    if (estado.abaAtual !== "produto") {
      document.title = `${DADOS_LOJA.nomeLoja} | ${DADOS_LOJA.subtituloLogo}`;
    }

    const setTexto = (id, valor) => {
      const el = document.getElementById(id);
      if (el && valor) el.textContent = valor;
    };

    setTexto("header-nome-loja", DADOS_LOJA.nomeLoja);
    setTexto("header-sub-loja", DADOS_LOJA.subtituloLogo);
    setTexto("mobile-nome-loja", DADOS_LOJA.nomeLoja);
    setTexto("mobile-sub-loja", DADOS_LOJA.subtituloLogo);
    setTexto("footer-nome-loja", DADOS_LOJA.nomeLoja);
    setTexto("footer-sub-loja", DADOS_LOJA.subtituloLogo);
    setTexto("copy-nome-loja", DADOS_LOJA.nomeLoja);
    setTexto("copy-sub-loja", DADOS_LOJA.subtituloLogo);

    setTexto("hero-tag", DADOS_LOJA.tagColecao);
    setTexto("hero-titulo", DADOS_LOJA.sloganHero);
    setTexto("hero-descricao", DADOS_LOJA.descricaoHero);

    setTexto("contato-numero-wa", DADOS_LOJA.whatsappExibicao);
    setTexto("contato-arroba-insta", DADOS_LOJA.instagram);
    setTexto("contato-horario", DADOS_LOJA.horarioAtendimento);
    setTexto("contato-cidade", DADOS_LOJA.cidadeEstado);
    setTexto("footer-whatsapp", DADOS_LOJA.whatsappExibicao);
    setTexto("ano-atual", String(new Date().getFullYear()));

    const msgPadraoWa = `Olá! Vim pelo site da *${DADOS_LOJA.nomeLoja}* e gostaria de atendimento ✨`;
    const linkCardWa = document.getElementById("link-card-whatsapp");
    if (linkCardWa) linkCardWa.href = gerarLinkWhatsApp(msgPadraoWa);

    const linkCardInsta = document.getElementById("link-card-instagram");
    if (linkCardInsta) linkCardInsta.href = DADOS_LOJA.urlInstagram || "https://instagram.com/";

    const footerInsta = document.getElementById("footer-instagram");
    if (footerInsta) {
      footerInsta.textContent = DADOS_LOJA.instagram;
      footerInsta.href = DADOS_LOJA.urlInstagram || "https://instagram.com/";
    }

    const topbar = document.getElementById("topbar-avisos");
    if (topbar && Array.isArray(DADOS_LOJA.avisosTopo) && DADOS_LOJA.avisosTopo.length) {
      topbar.innerHTML = DADOS_LOJA.avisosTopo
        .map((aviso) => `<span>${aviso}</span>`)
        .join('<span class="topbar-sep">•</span>');
    }

    const tbody = document.getElementById("corpo-tabela-medidas");
    if (tbody && Array.isArray(DADOS_LOJA.tabelaMedidas)) {
      tbody.innerHTML = DADOS_LOJA.tabelaMedidas
        .map(
          (m) => `
          <tr>
            <td><strong>${m.tamanho}</strong></td>
            <td>${m.manequim}</td>
            <td>${m.busto}</td>
            <td>${m.cintura}</td>
            <td>${m.quadril}</td>
          </tr>
        `
        )
        .join("");
    }
  }

  // ==========================================================================
  // 4. GERADOR DE CARDS DE PRODUTOS (INÍCIO, CATÁLOGO E RELACIONADOS)
  // ==========================================================================
  function montarHtmlCardProduto(prod) {
    const percPix = DADOS_LOJA.descontoPixPercentual || 0;
    const parcelas = prod.parcelasMax || DADOS_LOJA.parcelasSemJuros || 3;

    const coresProd = prod.cores || [];
    const corCard =
      estado.selecaoCorCard[prod.slug] && coresProd.includes(estado.selecaoCorCard[prod.slug])
        ? estado.selecaoCorCard[prod.slug]
        : coresProd.find(
            (c) => window.RpmCatalog && window.RpmCatalog.hasColorAnyStock(prod.slug, c)
          ) ||
          coresProd[0] ||
          "";

    const tamSelecionado =
      estado.selecaoTamanhoCard[prod.slug] ||
      (estado.tamanhoFiltro !== "Todos" && (prod.tamanhos || []).includes(estado.tamanhoFiltro)
        ? estado.tamanhoFiltro
        : "");

    const precoPix = prod.preco * (1 - percPix / 100);
    const valorParcela = prod.preco / parcelas;
    const isOferta = Boolean(prod.precoAntigo && prod.precoAntigo > prod.preco);
    const percDesconto = isOferta
      ? Math.round(((prod.precoAntigo - prod.preco) / prod.precoAntigo) * 100)
      : 0;
    const tagTexto = prod.esgotadoGeral
      ? "Esgotado"
      : (prod.destaque || (isOferta ? `-${percDesconto}% OFF` : "")).trim();

    return `
      <article class="product-card" data-prod-id="${escaparHtml(prod.id)}">
        <div class="product-media" data-abrir-pagina="${escaparHtml(prod.slug)}">
          <img src="${escaparHtml(prod.imagem)}" alt="${escaparHtml(prod.nome)}" loading="lazy" />
          ${
            tagTexto
              ? `<span class="product-badge ${isOferta ? "sale" : ""}">${escaparHtml(
                  tagTexto
                )}</span>`
              : ""
          }
          <span class="quick-detail-hint">Ver detalhes</span>
        </div>

        <div class="product-info">
          <span class="product-cat">${escaparHtml(prod.categoria)}</span>
          <h3 class="product-title" data-abrir-pagina="${escaparHtml(prod.slug)}">${escaparHtml(
      prod.nome
    )}</h3>

          <div class="price-block">
            <div class="price-main-line">
              ${
                isOferta
                  ? `<span class="old-price">${formatarMoeda(prod.precoAntigo)}</span>`
                  : ""
              }
              <span class="current-price">${formatarMoeda(prod.preco)}</span>
            </div>
            ${
              percPix > 0
                ? `<div class="pix-price-hint">${formatarMoeda(precoPix)} no PIX (${percPix}% OFF)</div>`
                : ""
            }
            <div class="installment-hint">ou ${parcelas}x de ${formatarMoeda(valorParcela)} sem juros</div>
          </div>

          <div class="card-sizes-wrap">
            ${
              (prod.coresDetalhes || []).length > 0
                ? `
              <div class="card-colors-row" aria-label="Cores disponíveis">
                ${prod.coresDetalhes
                  .map(
                    (cObj) => `
                  <button
                    type="button"
                    class="card-color-dot ${corCard === cObj.name ? "selected" : ""}"
                    style="background:${escaparHtml(cObj.hex)}"
                    title="Cor: ${escaparHtml(cObj.name)}"
                    aria-label="Cor ${escaparHtml(cObj.name)}"
                    data-card-cor="${escaparHtml(cObj.name)}"
                    data-card-prod="${escaparHtml(prod.slug)}"
                  ></button>
                `
                  )
                  .join("")}
              </div>
            `
                : ""
            }

            <div class="card-size-label" data-label-tam>
              <span>${corCard ? `${escaparHtml(corCard)} • ` : ""}Tamanho:</span>
              ${tamSelecionado ? `<strong>${escaparHtml(tamSelecionado)}</strong>` : ""}
            </div>

            <div class="size-chips">
              ${(prod.tamanhos || [])
                .map((tam) => {
                  const est =
                    window.RpmCatalog && corCard
                      ? window.RpmCatalog.getVariantStock(prod.slug, corCard, tam)
                      : 5;
                  const semEst = est <= 0;
                  return `
                  <button
                    type="button"
                    class="size-chip ${tamSelecionado === tam && !semEst ? "selected" : ""} ${
                    semEst ? "sold-out" : ""
                  }"
                    data-card-tam="${escaparHtml(tam)}"
                    data-card-prod="${escaparHtml(prod.slug)}"
                    ${semEst ? 'disabled title="Esgotado nesta cor"' : ""}
                  >${escaparHtml(tam)}</button>
                `;
                })
                .join("")}
            </div>

            <button
              type="button"
              class="btn-card-add"
              data-add-card="${escaparHtml(prod.slug)}"
              ${prod.esgotadoGeral ? "disabled" : ""}
            >
              ${prod.esgotadoGeral ? "Peça Esgotada" : "Adicionar à Sacola"}
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function conectarEventosDeGrade(container) {
    if (!container) return;

    container.querySelectorAll("[data-abrir-pagina]").forEach((el) => {
      el.addEventListener("click", () => {
        abrirPaginaProduto(el.getAttribute("data-abrir-pagina"));
      });
    });

    container.querySelectorAll("[data-card-cor]").forEach((dot) => {
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        const prodSlug = dot.getAttribute("data-card-prod");
        const cor = dot.getAttribute("data-card-cor");
        estado.selecaoCorCard[prodSlug] = cor;

        const tamAtual = estado.selecaoTamanhoCard[prodSlug];
        if (tamAtual && window.RpmCatalog.getVariantStock(prodSlug, cor, tamAtual) <= 0) {
          delete estado.selecaoTamanhoCard[prodSlug];
        }

        renderizarVitrinesInicio();
        renderizarCatalogo();
        if (estado.abaAtual === "produto" && estado.slugProdutoAberto) {
          abrirPaginaProduto(estado.slugProdutoAberto, { rolarTopo: false, pushHistory: false });
        }
      });
    });

    container.querySelectorAll("[data-card-tam]").forEach((chip) => {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        const prodSlug = chip.getAttribute("data-card-prod");
        const tam = chip.getAttribute("data-card-tam");
        estado.selecaoTamanhoCard[prodSlug] = tam;
        renderizarVitrinesInicio();
        renderizarCatalogo();
      });
    });

    container.querySelectorAll("[data-add-card]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const prodSlug = btn.getAttribute("data-add-card");
        const prod = obterProdutosPublicados().find(
          (p) => p.slug === prodSlug || String(p.id) === String(prodSlug)
        );
        if (!prod || prod.esgotadoGeral) return;

        const corEscolhida =
          estado.selecaoCorCard[prod.slug] ||
          (prod.cores || []).find((c) => window.RpmCatalog.hasColorAnyStock(prod.slug, c)) ||
          (prod.cores && prod.cores[0]) ||
          "Única";

        const tam =
          estado.selecaoTamanhoCard[prod.slug] ||
          (estado.tamanhoFiltro !== "Todos" && (prod.tamanhos || []).includes(estado.tamanhoFiltro)
            ? estado.tamanhoFiltro
            : "");

        if (!tam) {
          const card = btn.closest(".product-card");
          const label = card ? card.querySelector("[data-label-tam]") : null;
          if (label) {
            label.innerHTML = "<span>👆 Escolha um tamanho:</span>";
            label.classList.add("error-pulse");
          }
          mostrarToast("Selecione um tamanho disponível antes de adicionar à sacola ✨");
          return;
        }

        adicionarNaSacola(prod, tam, corEscolhida, 1);
      });
    });
  }

  // ==========================================================================
  // 5. ABA INÍCIO: VITRINES E PESQUISA RÁPIDA
  // ==========================================================================
  function renderizarVitrinesInicio() {
    const publicados = obterProdutosPublicados();
    const gradeMaisVendidas = document.getElementById("grade-mais-vendidas");
    const gradePromocoes = document.getElementById("grade-promocoes");

    if (gradeMaisVendidas) {
      const maisVendidas = publicados.filter((p) => Boolean(p.maisVendido));
      const exibidas = maisVendidas.length ? maisVendidas : publicados.slice(0, 4);
      gradeMaisVendidas.innerHTML = exibidas.map(montarHtmlCardProduto).join("");
      conectarEventosDeGrade(gradeMaisVendidas);
    }

    if (gradePromocoes) {
      const promocoes = publicados.filter(
        (p) => Boolean(p.precoAntigo && p.precoAntigo > p.preco)
      );
      gradePromocoes.innerHTML = promocoes.map(montarHtmlCardProduto).join("");
      conectarEventosDeGrade(gradePromocoes);
    }
  }

  function corresponderTextoBusca(prod, termo) {
    const q = termo.trim().toLowerCase();
    if (!q) return true;
    const texto = [
      prod.nome,
      prod.categoria,
      prod.descricao,
      prod.tecido,
      ...(prod.cores || [])
    ]
      .join(" ")
      .toLowerCase();
    return texto.includes(q);
  }

  function atualizarResultadosRapidosInicio(termo) {
    const box = document.getElementById("resultados-rapidos-inicio");
    if (!box) return;

    const q = termo.trim();
    if (!q) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }

    const encontrados = obterProdutosPublicados().filter((p) => corresponderTextoBusca(p, q));
    box.classList.remove("hidden");

    if (encontrados.length === 0) {
      box.innerHTML = `<p style="font-size:0.86rem;color:var(--ink-soft);">Nenhuma peça encontrada para "<strong>${escaparHtml(
        q
      )}</strong>". Clique em Buscar no Catálogo para explorar todas as categorias.</p>`;
      return;
    }

    box.innerHTML = `
      <div class="live-results-list">
        ${encontrados
          .slice(0, 4)
          .map(
            (p) => `
          <div class="live-result-item" data-live-slug="${escaparHtml(p.slug)}">
            <img src="${escaparHtml(p.imagem)}" alt="${escaparHtml(p.nome)}" />
            <div>
              <strong>${escaparHtml(p.nome)}</strong>
              <span>${formatarMoeda(p.preco)}</span>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
      <button type="button" class="text-btn" id="btn-ir-resultados-catalogo">
        Ver todos os ${encontrados.length} resultado(s) no Catálogo →
      </button>
    `;

    box.querySelectorAll("[data-live-slug]").forEach((el) => {
      el.addEventListener("click", () => abrirPaginaProduto(el.getAttribute("data-live-slug")));
    });

    const btnIr = document.getElementById("btn-ir-resultados-catalogo");
    if (btnIr) {
      btnIr.addEventListener("click", () => aplicarBuscaEIrParaCatalogo(q));
    }
  }

  function aplicarBuscaEIrParaCatalogo(termo) {
    estado.busca = termo.trim();
    const inputCat = document.getElementById("input-pesquisa-catalogo");
    if (inputCat) inputCat.value = estado.busca;
    document
      .getElementById("btn-limpar-texto-busca")
      .classList.toggle("hidden", estado.busca === "");
    renderizarCatalogo();
    navegarParaAba("catalogo");
  }

  // ==========================================================================
  // 6. ABA CATÁLOGO: CATEGORIAS E TAMANHOS DINÂMICOS + FILTROS
  // ==========================================================================
  function renderizarFiltroTamanhosDinamico() {
    const selectTam = document.getElementById("filtro-tamanho");
    if (!selectTam || !window.RpmCatalog) return;

    const ativos = window.RpmCatalog.getActiveSizes();
    const atual = estado.tamanhoFiltro;

    selectTam.innerHTML = [
      `<option value="Todos">Todos os tamanhos</option>`,
      ...ativos.map(
        (s) =>
          `<option value="${escaparHtml(s.code)}" ${
            atual === s.code ? "selected" : ""
          }>${escaparHtml(s.code)}</option>`
      )
    ].join("");
  }

  function renderizarPillsCategorias() {
    const container = document.getElementById("filtros-categoria");
    if (!container) return;

    const categorias = ["Todas"];
    if (window.RpmCatalog) {
      window.RpmCatalog.getActiveCategories().forEach((c) => {
        if (c.name && !categorias.includes(c.name)) categorias.push(c.name);
      });
    }
    obterProdutosPublicados().forEach((p) => {
      if (p.categoria && !categorias.includes(p.categoria)) {
        categorias.push(p.categoria);
      }
    });

    if (!categorias.includes(estado.categoriaAtiva)) {
      estado.categoriaAtiva = "Todas";
    }

    container.innerHTML = categorias
      .map((cat) => {
        const ativo = estado.categoriaAtiva === cat ? "active" : "";
        return `<button type="button" class="cat-pill ${ativo}" data-cat="${escaparHtml(
          cat
        )}">${escaparHtml(cat)}</button>`;
      })
      .join("");

    container.querySelectorAll(".cat-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        estado.categoriaAtiva = btn.getAttribute("data-cat");
        renderizarPillsCategorias();
        renderizarCatalogo();
      });
    });
  }

  function obterProdutosFiltradosCatalogo() {
    let lista = [...obterProdutosPublicados()];

    if (estado.categoriaAtiva !== "Todas") {
      lista = lista.filter((p) => p.categoria === estado.categoriaAtiva);
    }

    if (estado.tamanhoFiltro !== "Todos") {
      lista = lista.filter((p) => {
        if (!(p.tamanhos || []).includes(estado.tamanhoFiltro)) return false;
        return (p.variantes || []).some(
          (v) => v.sizeCode === estado.tamanhoFiltro && v.stockQuantity > 0
        );
      });
    }

    if (estado.precoFiltro === "promocao") {
      lista = lista.filter((p) => Boolean(p.precoAntigo && p.precoAntigo > p.preco));
    } else if (estado.precoFiltro === "ate-220") {
      lista = lista.filter((p) => p.preco <= 220);
    } else if (estado.precoFiltro === "220-330") {
      lista = lista.filter((p) => p.preco > 220 && p.preco <= 330);
    } else if (estado.precoFiltro === "acima-330") {
      lista = lista.filter((p) => p.preco > 330);
    }

    if (estado.busca.trim() !== "") {
      lista = lista.filter((p) => corresponderTextoBusca(p, estado.busca));
    }

    if (estado.ordenacao === "mais-vendidas") {
      lista.sort((a, b) => Number(Boolean(b.maisVendido)) - Number(Boolean(a.maisVendido)));
    } else if (estado.ordenacao === "menor-preco") {
      lista.sort((a, b) => a.preco - b.preco);
    } else if (estado.ordenacao === "maior-preco") {
      lista.sort((a, b) => b.preco - a.preco);
    } else if (estado.ordenacao === "maior-desconto") {
      const desc = (p) => (p.precoAntigo && p.precoAntigo > p.preco ? p.precoAntigo - p.preco : 0);
      lista.sort((a, b) => desc(b) - desc(a));
    }

    return lista;
  }

  function temFiltroAtivoNoCatalogo() {
    return (
      estado.categoriaAtiva !== "Todas" ||
      estado.tamanhoFiltro !== "Todos" ||
      estado.precoFiltro !== "todos" ||
      estado.busca.trim() !== ""
    );
  }

  function renderizarCatalogo() {
    const grade = document.getElementById("grade-catalogo");
    const vazio = document.getElementById("catalogo-vazio");
    const contador = document.getElementById("contador-resultados-catalogo");
    const btnLimpar = document.getElementById("btn-limpar-filtros");
    if (!grade || !vazio) return;

    const filtrados = obterProdutosFiltradosCatalogo();
    const totalGeral = obterProdutosPublicados().length;

    if (contador) {
      contador.textContent =
        filtrados.length === totalGeral
          ? `Exibindo todas as ${totalGeral} peças`
          : `Encontradas ${filtrados.length} de ${totalGeral} peças`;
    }

    if (btnLimpar) {
      btnLimpar.classList.toggle("hidden", !temFiltroAtivoNoCatalogo());
    }

    if (filtrados.length === 0) {
      grade.innerHTML = "";
      vazio.classList.remove("hidden");
      return;
    }

    vazio.classList.add("hidden");
    grade.innerHTML = filtrados.map(montarHtmlCardProduto).join("");
    conectarEventosDeGrade(grade);
  }

  function limparTodosOsFiltros() {
    estado.busca = "";
    estado.categoriaAtiva = "Todas";
    estado.tamanhoFiltro = "Todos";
    estado.precoFiltro = "todos";
    estado.ordenacao = "destaques";

    const inputCat = document.getElementById("input-pesquisa-catalogo");
    const inputHome = document.getElementById("input-pesquisa-inicio");
    if (inputCat) inputCat.value = "";
    if (inputHome) inputHome.value = "";

    document.getElementById("btn-limpar-texto-busca").classList.add("hidden");
    document.getElementById("filtro-tamanho").value = "Todos";
    document.getElementById("filtro-preco").value = "todos";
    document.getElementById("select-ordenacao").value = "destaques";
    atualizarResultadosRapidosInicio("");

    renderizarPillsCategorias();
    renderizarCatalogo();
  }

  // ==========================================================================
  // 7. SACOLA ISOLADA POR SESSÃO (guestCart vs userCart NO SUPABASE COM RLS)
  // ==========================================================================
  function gerarUidSacola(slug, tamanho, cor) {
    return `${String(slug || "").trim()}__${String(tamanho || "").trim()}__${String(
      cor || ""
    ).trim()}`;
  }

  function descartarSacolaVisitante() {
    controleSacola.guestCart = [];
    guestStorage.limpar();
  }

  function obterSacolaVisivel() {
    if (controleSacola.modo === "inicializando" || controleSacola.carregandoUserCart) {
      return [];
    }
    if (controleSacola.modo === "user") {
      return controleSacola.userCart;
    }
    return controleSacola.guestCart;
  }

  function mapearLinhaBancoParaItem(row) {
    return {
      dbId: row.id,
      uid: gerarUidSacola(row.product_slug, row.size_code, row.color_name),
      id: row.product_id,
      slug: row.product_slug,
      nome: row.product_name,
      imagem: row.image_url,
      preco: Number(row.unit_price || 0),
      tamanho: row.size_code,
      cor: row.color_name,
      qtd: Math.max(1, Number(row.quantity || 1))
    };
  }

  async function carregarSacolaDaContaNoSupabase(userId, seqEsperada) {
    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();
    if (!supabase || !userId) {
      if (seqEsperada === controleSacola.seqSincronizacao) {
        controleSacola.userCart = [];
        controleSacola.carregandoUserCart = false;
        renderizarSacola();
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from("cart_items")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      // Garante que nenhuma resposta atrasada de outra sessão vaze para a conta atual
      if (
        seqEsperada !== controleSacola.seqSincronizacao ||
        controleSacola.modo !== "user" ||
        controleSacola.userIdAtivo !== userId
      ) {
        return;
      }

      if (error) {
        if (error.code === "PGRST205") {
          console.warn(
            "[RPM Sacola] Tabela public.cart_items ainda não criada. Execute supabase-sacola-setup.sql no Supabase SQL Editor."
          );
        } else {
          console.warn("[RPM Sacola] Erro ao carregar sacola da conta:", error.message);
        }
        controleSacola.userCart = [];
      } else {
        controleSacola.userCart = Array.isArray(data) ? data.map(mapearLinhaBancoParaItem) : [];
      }
    } catch (err) {
      if (
        seqEsperada !== controleSacola.seqSincronizacao ||
        controleSacola.modo !== "user" ||
        controleSacola.userIdAtivo !== userId
      ) {
        return;
      }
      console.warn("[RPM Sacola] Falha de rede ao consultar sacola da conta:", err);
      controleSacola.userCart = [];
    } finally {
      if (
        seqEsperada === controleSacola.seqSincronizacao &&
        controleSacola.modo === "user" &&
        controleSacola.userIdAtivo === userId
      ) {
        controleSacola.carregandoUserCart = false;
        renderizarSacola();
      }
    }
  }

  async function salvarItemNaContaSupabase(userId, item) {
    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();
    if (!supabase || !userId) return;

    const payload = {
      user_id: userId,
      product_id: String(item.id),
      product_slug: String(item.slug),
      product_name: String(item.nome),
      image_url: String(item.imagem),
      unit_price: Number(item.preco),
      color_name: String(item.cor),
      size_code: String(item.tamanho),
      quantity: Number(item.qtd)
    };

    const { error } = await supabase
      .from("cart_items")
      .upsert(payload, { onConflict: "user_id,product_slug,color_name,size_code" });

    if (error && error.code !== "PGRST205") {
      console.warn("[RPM Sacola] Erro ao salvar item na sacola da conta:", error.message);
    }
  }

  async function removerItemDaContaSupabase(userId, item) {
    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();
    if (!supabase || !userId || !item) return;

    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", userId)
      .eq("product_slug", String(item.slug))
      .eq("color_name", String(item.cor))
      .eq("size_code", String(item.tamanho));

    if (error && error.code !== "PGRST205") {
      console.warn("[RPM Sacola] Erro ao excluir item da sacola da conta:", error.message);
    }
  }

  async function sincronizarListaCompletaNaContaSupabase(userId, itensAntes, itensDepois) {
    const uidsDepois = new Set(itensDepois.map((i) => i.uid));
    const removidos = itensAntes.filter((antigo) => !uidsDepois.has(antigo.uid));

    await Promise.all([
      ...removidos.map((rem) => removerItemDaContaSupabase(userId, rem)),
      ...itensDepois.map((atu) => salvarItemNaContaSupabase(userId, atu))
    ]);
  }

  // Fila sequencial para garantir ordem exata nas escritas assíncronas em public.cart_items
  let filaEscritaSacola = Promise.resolve();
  function enfileirarEscritaSacola(tarefaAsync) {
    filaEscritaSacola = filaEscritaSacola.then(tarefaAsync).catch((err) => {
      console.warn("[RPM Sacola] Falha em operação enfileirada:", err);
    });
    return filaEscritaSacola;
  }

  async function processarTransicaoSessaoSacola(usuario, evento) {
    // 1. USUÁRIO AUTENTICADO (Login, F5 logado ou troca direta para outra conta)
    if (usuario && usuario.id) {
      // NUNCA transfere nem mantém sacola temporária de visitante ao entrar em uma conta
      descartarSacolaVisitante();

      // Evita recarregar em duplicidade quando INITIAL_SESSION ou TOKEN_REFRESHED dispara 2x para a mesma conta
      if (
        controleSacola.modo === "user" &&
        controleSacola.userIdAtivo === usuario.id &&
        (evento === "INITIAL_SESSION" ||
          (!controleSacola.carregandoUserCart && evento === "TOKEN_REFRESHED"))
      ) {
        return;
      }

      const minhaSeq = ++controleSacola.seqSincronizacao;
      controleSacola.modo = "user";
      controleSacola.userIdAtivo = usuario.id;
      // Limpa imediatamente qualquer resquício de conta anterior antes do carregamento assíncrono
      controleSacola.userCart = [];
      controleSacola.carregandoUserCart = true;
      renderizarSacola();

      await carregarSacolaDaContaNoSupabase(usuario.id, minhaSeq);
      return;
    }

    // 2. VISITANTE NÃO AUTENTICADO (Acesso inicial sem login OU Logout)
    // Se já estamos como visitante inicializado e chega um segundo INITIAL_SESSION idêntico, preserva a sacola temporária atual
    if (
      controleSacola.modo === "guest" &&
      !controleSacola.userIdAtivo &&
      evento === "INITIAL_SESSION"
    ) {
      return;
    }

    ++controleSacola.seqSincronizacao;
    const saiuDeUmaConta = Boolean(controleSacola.userIdAtivo) || evento === "SIGNED_OUT";

    // Limpa estado da conta em memória (sem apagar os registros salvos no Supabase)
    controleSacola.userIdAtivo = null;
    controleSacola.userCart = [];
    controleSacola.carregandoUserCart = false;
    controleSacola.modo = "guest";

    if (saiuDeUmaConta) {
      // Ao sair da conta, inicia uma sacola de visitante limpa e zera contador imediatamente
      descartarSacolaVisitante();
    } else {
      // Visitante navegando sem nunca ter logado nesta aba recupera apenas sua sacola temporária
      controleSacola.guestCart = guestStorage.ler();
    }

    renderizarSacola();
  }

  async function exigirAutenticacaoParaCompra() {
    const authApi = window.RPMAuth;
    const usuarioMemoria = authApi && authApi.getUser ? authApi.getUser() : null;
    const usuarioSessaoReal =
      authApi && authApi.verifyActiveSession ? await authApi.verifyActiveSession() : null;

    if (
      !usuarioMemoria ||
      !usuarioSessaoReal ||
      usuarioMemoria.id !== usuarioSessaoReal.id ||
      controleSacola.modo !== "user" ||
      controleSacola.userIdAtivo !== usuarioSessaoReal.id
    ) {
      fecharTodosModais();
      if (authApi && typeof authApi.openLoginModal === "function") {
        authApi.openLoginModal({ infoMessage: MENSAGEM_LOGIN_COMPRA });
      }
      return null;
    }

    return usuarioSessaoReal;
  }

  // Escuta transições de sessão imediatamente (antes mesmo de DOMContentLoaded concluir)
  window.addEventListener("rpm:auth-sessao", (e) => {
    const detalhe = (e && e.detail) || {};
    processarTransicaoSessaoSacola(detalhe.user || null, detalhe.event || "AUTH_CHANGE");
  });

  function adicionarNaSacola(prod, tamanho, cor, qtd, imagemOpcional) {
    if (controleSacola.modo === "inicializando" || controleSacola.carregandoUserCart) {
      mostrarToast("Sincronizando sua conta, tente adicionar novamente em um instante...");
      return;
    }

    const estoqueDisp = window.RpmCatalog
      ? window.RpmCatalog.getVariantStock(prod.slug || prod.id, cor, tamanho)
      : 10;

    if (estoqueDisp <= 0) {
      mostrarToast(`A combinação ${cor} (${tamanho}) está esgotada no momento.`);
      return;
    }

    const slugSeguro =
      prod.slug ||
      String(prod.nome || prod.id)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
    const uid = gerarUidSacola(slugSeguro, tamanho, cor);

    const listaAlvo =
      controleSacola.modo === "user" ? controleSacola.userCart : controleSacola.guestCart;
    const existente = listaAlvo.find((item) => item.uid === uid);
    const qtdAtual = existente ? existente.qtd : 0;

    if (qtdAtual + qtd > estoqueDisp) {
      mostrarToast(
        `Estoque máximo atingido para ${prod.nome} em ${cor} (${tamanho}): ${estoqueDisp} un.`
      );
      return;
    }

    let itemAtualizado;
    if (existente) {
      existente.qtd += qtd;
      existente.preco = prod.preco;
      existente.slug = slugSeguro;
      existente.id = prod.id;
      itemAtualizado = existente;
    } else {
      itemAtualizado = {
        uid,
        id: prod.id,
        slug: slugSeguro,
        nome: prod.nome,
        imagem: imagemOpcional || prod.imagem,
        preco: prod.preco,
        tamanho,
        cor,
        qtd
      };
      listaAlvo.push(itemAtualizado);
    }

    if (controleSacola.modo === "user" && controleSacola.userIdAtivo) {
      const uidConta = controleSacola.userIdAtivo;
      const copiaItem = { ...itemAtualizado };
      enfileirarEscritaSacola(() => salvarItemNaContaSupabase(uidConta, copiaItem));
    } else {
      guestStorage.salvar(controleSacola.guestCart);
    }

    renderizarSacola();
    renderizarVitrinesInicio();
    renderizarCatalogo();
    abrirSacola();
    mostrarToast(`✨ ${prod.nome} (${cor} • ${tamanho}) adicionado à sacola!`);
  }

  function alterarQuantidade(uid, delta) {
    if (controleSacola.modo === "inicializando" || controleSacola.carregandoUserCart) return;

    const listaAlvo =
      controleSacola.modo === "user" ? controleSacola.userCart : controleSacola.guestCart;
    const idx = listaAlvo.findIndex((i) => i.uid === uid);
    if (idx === -1) return;

    const item = listaAlvo[idx];
    if (delta > 0 && window.RpmCatalog) {
      const maxEstoque = window.RpmCatalog.getVariantStock(
        item.slug || item.id,
        item.cor,
        item.tamanho
      );
      if (item.qtd + delta > maxEstoque) {
        mostrarToast(`Apenas ${maxEstoque} unidade(s) disponíveis nesta cor e tamanho.`);
        return;
      }
    }

    item.qtd += delta;
    const foiRemovido = item.qtd <= 0;
    if (foiRemovido) {
      listaAlvo.splice(idx, 1);
    }

    if (controleSacola.modo === "user" && controleSacola.userIdAtivo) {
      const uidConta = controleSacola.userIdAtivo;
      const copiaItem = { ...item };
      if (foiRemovido) {
        enfileirarEscritaSacola(() => removerItemDaContaSupabase(uidConta, copiaItem));
      } else {
        enfileirarEscritaSacola(() => salvarItemNaContaSupabase(uidConta, copiaItem));
      }
    } else {
      guestStorage.salvar(controleSacola.guestCart);
    }

    renderizarSacola();
  }

  function removerItemSacola(uid) {
    if (controleSacola.modo === "inicializando" || controleSacola.carregandoUserCart) return;

    const listaAlvo =
      controleSacola.modo === "user" ? controleSacola.userCart : controleSacola.guestCart;
    const itemAlvo = listaAlvo.find((i) => i.uid === uid);
    if (!itemAlvo) return;

    if (controleSacola.modo === "user") {
      controleSacola.userCart = controleSacola.userCart.filter((i) => i.uid !== uid);
      if (controleSacola.userIdAtivo) {
        const uidConta = controleSacola.userIdAtivo;
        const copiaItem = { ...itemAlvo };
        enfileirarEscritaSacola(() => removerItemDaContaSupabase(uidConta, copiaItem));
      }
    } else {
      controleSacola.guestCart = controleSacola.guestCart.filter((i) => i.uid !== uid);
      guestStorage.salvar(controleSacola.guestCart);
    }

    renderizarSacola();
  }

  function calcularTotaisSacola() {
    const itensVisiveis = obterSacolaVisivel();
    const subtotal = itensVisiveis.reduce((acc, item) => acc + item.preco * item.qtd, 0);
    const qtdTotal = itensVisiveis.reduce((acc, item) => acc + item.qtd, 0);

    const selectPagamento = document.getElementById("cliente-pagamento");
    const pagandoPix = selectPagamento && selectPagamento.value === "PIX";
    const percPix = DADOS_LOJA.descontoPixPercentual || 0;
    const descontoPix = pagandoPix ? subtotal * (percPix / 100) : 0;

    const totalFinal = Math.max(0, subtotal - descontoPix);
    const metaFrete = DADOS_LOJA.freteGratisAcimaDe || 0;
    const ganhouFreteGratis = metaFrete > 0 && subtotal >= metaFrete;

    return {
      subtotal,
      qtdTotal,
      descontoPix,
      pagandoPix,
      totalFinal,
      metaFrete,
      ganhouFreteGratis
    };
  }

  function renderizarSacola() {
    const carregando =
      controleSacola.modo === "inicializando" || controleSacola.carregandoUserCart;
    const itensVisiveis = obterSacolaVisivel();
    const totais = calcularTotaisSacola();

    const badge = document.getElementById("badge-sacola");
    if (badge) badge.textContent = String(totais.qtdTotal);

    const subtexto = document.getElementById("sacola-contagem-texto");
    if (subtexto) {
      subtexto.textContent = carregando
        ? "Sincronizando sacola..."
        : `${totais.qtdTotal} ${
            totais.qtdTotal === 1 ? "item selecionado" : "itens selecionados"
          }`;
    }

    const barraContainer = document.getElementById("barra-frete-container");
    const textoFrete = document.getElementById("texto-progresso-frete");
    const barraFill = document.getElementById("preenchimento-frete");

    if (barraContainer && totais.metaFrete > 0 && !carregando) {
      barraContainer.classList.remove("hidden");
      const progresso = Math.min(100, (totais.subtotal / totais.metaFrete) * 100);
      if (barraFill) barraFill.style.width = `${progresso}%`;

      if (totais.ganhouFreteGratis) {
        textoFrete.innerHTML =
          "🎉 Parabéns! Você ganhou <strong>Frete Grátis</strong> neste pedido!";
      } else {
        const falta = totais.metaFrete - totais.subtotal;
        textoFrete.innerHTML = `Faltam <strong>${formatarMoeda(
          falta
        )}</strong> para ganhar <strong>Frete Grátis</strong>`;
      }
    } else if (barraContainer) {
      barraContainer.classList.add("hidden");
    }

    const carregandoEl = document.getElementById("sacola-carregando");
    const vaziaEl = document.getElementById("sacola-vazia");
    const cheioEl = document.getElementById("sacola-conteudo-cheio");
    const rodapeEl = document.getElementById("sacola-rodape");
    const listaEl = document.getElementById("lista-itens-sacola");
    const checkoutBoxEl = document.getElementById("checkout-form-box");

    // Formulário de checkout só fica visível quando há conta autenticada ativa
    if (checkoutBoxEl) {
      checkoutBoxEl.classList.toggle("hidden", controleSacola.modo !== "user" || carregando);
    }

    // Enquanto carrega sacola da conta, NUNCA exibe guestCart nem dados anteriores no DOM
    if (carregando) {
      if (listaEl) listaEl.innerHTML = "";
      if (carregandoEl) carregandoEl.classList.remove("hidden");
      if (vaziaEl) vaziaEl.classList.add("hidden");
      if (cheioEl) cheioEl.classList.add("hidden");
      if (rodapeEl) rodapeEl.classList.add("hidden");
      return;
    }

    if (carregandoEl) carregandoEl.classList.add("hidden");

    if (itensVisiveis.length === 0) {
      if (listaEl) listaEl.innerHTML = "";
      vaziaEl.classList.remove("hidden");
      cheioEl.classList.add("hidden");
      rodapeEl.classList.add("hidden");
      return;
    }

    vaziaEl.classList.add("hidden");
    cheioEl.classList.remove("hidden");
    rodapeEl.classList.remove("hidden");

    listaEl.innerHTML = itensVisiveis
      .map(
        (item) => `
        <li class="cart-item">
          <img src="${escaparHtml(item.imagem)}" alt="${escaparHtml(
          item.nome
        )}" data-cart-abrir="${escaparHtml(item.slug || item.id)}" style="cursor:pointer" />
          <div>
            <div class="cart-item-top">
              <span class="cart-item-title" data-cart-abrir="${escaparHtml(
                item.slug || item.id
              )}" style="cursor:pointer">${escaparHtml(item.nome)}</span>
              <button type="button" class="cart-remove-btn" data-remover="${escaparHtml(
                item.uid
              )}" title="Remover item">✕</button>
            </div>
            <div class="cart-item-meta">Cor: <strong>${escaparHtml(
              item.cor
            )}</strong> • Tam: <strong>${escaparHtml(item.tamanho)}</strong></div>
            <div class="cart-item-bottom">
              <div class="qty-control">
                <button type="button" class="qty-btn" data-menos="${escaparHtml(
                  item.uid
                )}" aria-label="Diminuir quantidade">−</button>
                <span class="qty-val">${item.qtd}</span>
                <button type="button" class="qty-btn" data-mais="${escaparHtml(
                  item.uid
                )}" aria-label="Aumentar quantidade">+</button>
              </div>
              <span class="cart-item-price">${formatarMoeda(item.preco * item.qtd)}</span>
            </div>
          </div>
        </li>
      `
      )
      .join("");

    listaEl.querySelectorAll("[data-cart-abrir]").forEach((el) =>
      el.addEventListener("click", () => abrirPaginaProduto(el.getAttribute("data-cart-abrir")))
    );
    listaEl.querySelectorAll("[data-menos]").forEach((b) =>
      b.addEventListener("click", () => alterarQuantidade(b.getAttribute("data-menos"), -1))
    );
    listaEl.querySelectorAll("[data-mais]").forEach((b) =>
      b.addEventListener("click", () => alterarQuantidade(b.getAttribute("data-mais"), 1))
    );
    listaEl.querySelectorAll("[data-remover]").forEach((b) =>
      b.addEventListener("click", () => removerItemSacola(b.getAttribute("data-remover")))
    );

    document.getElementById("resumo-subtotal").textContent = formatarMoeda(totais.subtotal);

    const linhaPix = document.getElementById("linha-desconto-pix");
    if (totais.pagandoPix && totais.descontoPix > 0) {
      linhaPix.classList.remove("hidden");
      document.getElementById("valor-desconto-pix").textContent = `- ${formatarMoeda(
        totais.descontoPix
      )}`;
    } else {
      linhaPix.classList.add("hidden");
    }

    document.getElementById("resumo-frete").textContent = totais.ganhouFreteGratis
      ? "Grátis ✨"
      : "A calcular";

    document.getElementById("resumo-total").textContent = formatarMoeda(totais.totalFinal);
  }

  async function finalizarPedidoWhatsApp() {
    if (estado.validandoCheckout) return;

    // OBRIGATORIEDADE DE LOGIN PARA COMPRAR: visitantes são direcionados ao pop-up de login
    const usuarioAutenticado = await exigirAutenticacaoParaCompra();
    if (!usuarioAutenticado) return;

    if (controleSacola.carregandoUserCart || controleSacola.userCart.length === 0) return;

    const nomeInput = document.getElementById("cliente-nome");
    const nome = (nomeInput ? nomeInput.value : "").trim();
    if (!nome) {
      if (nomeInput) nomeInput.focus();
      mostrarToast("Por favor, digite seu nome antes de enviar o pedido 😊");
      return;
    }

    const btnCheckout = document.getElementById("btn-finalizar-whatsapp");

    // Revalida preços atuais e disponibilidade real de estoque no Supabase antes de concluir
    if (window.RpmCatalog && window.RpmCatalog.revalidateCart) {
      estado.validandoCheckout = true;
      if (btnCheckout) {
        btnCheckout.disabled = true;
        btnCheckout.textContent = "Verificando estoque atualizado...";
      }

      try {
        const snapshotAntes = [...controleSacola.userCart];
        const revisao = await window.RpmCatalog.revalidateCart(controleSacola.userCart);
        const itensNormalizados = revisao.itensAtualizados.map((item) => ({
          ...item,
          uid: gerarUidSacola(item.slug || item.id, item.tamanho, item.cor)
        }));

        controleSacola.userCart = itensNormalizados;
        await sincronizarListaCompletaNaContaSupabase(
          usuarioAutenticado.id,
          snapshotAntes,
          itensNormalizados
        );
        renderizarSacola();

        if (!revisao.valido) {
          mostrarToast(
            revisao.alteracoes[0] || "Alguns itens na sacola sofreram alteração de estoque."
          );
          return;
        }
      } finally {
        estado.validandoCheckout = false;
        if (btnCheckout) {
          btnCheckout.disabled = false;
          btnCheckout.textContent = "Finalizar Pedido no WhatsApp";
        }
      }
    }

    if (controleSacola.userCart.length === 0) return;

    const entrega = document.getElementById("cliente-entrega").value;
    const cep = document.getElementById("cliente-cep").value.trim();
    const pagamento = document.getElementById("cliente-pagamento").value;
    const obs = document.getElementById("cliente-obs").value.trim();
    const totais = calcularTotaisSacola();

    const linhasItens = controleSacola.userCart.map(
      (item) =>
        `• ${item.qtd}x *${item.nome}*\n  Cor: ${item.cor} | Tam: ${
          item.tamanho
        } — ${formatarMoeda(item.preco * item.qtd)}`
    );

    const linhasResumo = [`Subtotal: ${formatarMoeda(totais.subtotal)}`];
    if (totais.pagandoPix && totais.descontoPix > 0) {
      linhasResumo.push(
        `Desconto PIX (${DADOS_LOJA.descontoPixPercentual}%): -${formatarMoeda(totais.descontoPix)}`
      );
    }
    linhasResumo.push(`Frete: ${totais.ganhouFreteGratis ? "Grátis ✨" : "A confirmar"}`);
    linhasResumo.push(`*Total estimado: ${formatarMoeda(totais.totalFinal)}*`);

    const linhasCliente = [
      `Cliente: *${nome}*`,
      `Recebimento: ${entrega}${cep && entrega.includes("endereço") ? ` (${cep})` : ""}`,
      `Pagamento preferido: *${pagamento}*`
    ];
    if (obs) linhasCliente.push(`Observação: ${obs}`);

    const mensagemFinal = [
      `Olá! Gostaria de finalizar meu pedido na *${DADOS_LOJA.nomeLoja}* ✨`,
      "",
      "*ITENS ESCOLHIDOS:*",
      ...linhasItens,
      "",
      "*RESUMO DOS VALORES:*",
      ...linhasResumo,
      "",
      "*DADOS DO PEDIDO:*",
      ...linhasCliente
    ].join("\n");

    fecharTodosModais();
    exibirConfirmacaoPedido(mensagemFinal);
  }

  function exibirConfirmacaoPedido(mensagem) {
    const urlWa = gerarLinkWhatsApp(mensagem);
    const previa = document.getElementById("previa-mensagem-wa");
    const linkDireto = document.getElementById("link-direto-wa");
    const modalConf = document.getElementById("modal-confirmacao");

    if (previa) previa.textContent = mensagem;
    if (linkDireto) linkDireto.href = urlWa;

    abrirCamada(modalConf);

    try {
      window.open(urlWa, "_blank", "noopener");
    } catch (_) {}
  }

  // ==========================================================================
  // 8. CONTROLES GERAIS, HISTÓRICO DE ROTAS E EVENTOS
  // ==========================================================================
  function abrirCamada(elemento) {
    document.getElementById("backdrop").classList.remove("hidden");
    elemento.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function fecharTodosModais() {
    document.getElementById("backdrop").classList.add("hidden");
    ["sacola-drawer", "menu-mobile", "modal-produto", "modal-medidas", "modal-confirmacao"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
      }
    );
    document.body.style.overflow = "";
  }

  function abrirSacola() {
    fecharTodosModais();
    renderizarSacola();
    abrirCamada(document.getElementById("sacola-drawer"));
  }

  function resolverRotaAtual(rolarTopo = false) {
    const subrota = window.getRpmCurrentSubroute ? window.getRpmCurrentSubroute() : "/";

    if (subrota.startsWith("/produto/")) {
      const slug = decodeURIComponent(subrota.replace(/^\/produto\//, "").replace(/\/+$/, ""));
      if (slug) {
        abrirPaginaProduto(slug, { rolarTopo, pushHistory: false });
        return;
      }
    }

    if (subrota === "/admin" || subrota.startsWith("/admin/")) {
      if (window.RPMAdmin) {
        window.RPMAdmin.openPanel(false);
        return;
      }
    }

    const hashInicial = (window.location.hash || "").replace("#", "").toLowerCase();
    if (["inicio", "catalogo", "contato"].includes(hashInicial)) {
      navegarParaAba(hashInicial, { rolarTopo, pushHistory: false });
    } else {
      navegarParaAba("inicio", { rolarTopo, pushHistory: false });
    }
  }

  function reRenderizarVitrineCompleta() {
    preencherDadosDaLoja();
    renderizarFiltroTamanhosDinamico();
    renderizarPillsCategorias();
    renderizarVitrinesInicio();
    renderizarCatalogo();
    renderizarSacola();

    if (estado.abaAtual === "produto" && estado.slugProdutoAberto) {
      abrirPaginaProduto(estado.slugProdutoAberto, { rolarTopo: false, pushHistory: false });
    }
  }

  function configurarEventos() {
    document.querySelectorAll("[data-aba-link]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const aba = el.getAttribute("data-aba-link");
        fecharTodosModais();
        navegarParaAba(aba);
      });
    });

    const inputHome = document.getElementById("input-pesquisa-inicio");
    const formHome = document.getElementById("form-pesquisa-inicio");

    inputHome.addEventListener("input", (e) => {
      atualizarResultadosRapidosInicio(e.target.value);
    });

    formHome.addEventListener("submit", (e) => {
      e.preventDefault();
      aplicarBuscaEIrParaCatalogo(inputHome.value);
    });

    document.querySelectorAll("[data-atalho-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        limparTodosOsFiltros();
        estado.categoriaAtiva = btn.getAttribute("data-atalho-cat");
        renderizarPillsCategorias();
        renderizarCatalogo();
        navegarParaAba("catalogo");
      });
    });

    document.querySelectorAll("[data-atalho-promo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        limparTodosOsFiltros();
        estado.precoFiltro = "promocao";
        document.getElementById("filtro-preco").value = "promocao";
        renderizarCatalogo();
        navegarParaAba("catalogo");
      });
    });

    document.getElementById("btn-ver-todas-promos").addEventListener("click", () => {
      limparTodosOsFiltros();
      estado.precoFiltro = "promocao";
      document.getElementById("filtro-preco").value = "promocao";
      renderizarCatalogo();
      navegarParaAba("catalogo");
    });

    const inputCat = document.getElementById("input-pesquisa-catalogo");
    const btnLimparTexto = document.getElementById("btn-limpar-texto-busca");

    inputCat.addEventListener("input", (e) => {
      estado.busca = e.target.value;
      btnLimparTexto.classList.toggle("hidden", estado.busca.trim() === "");
      renderizarCatalogo();
    });

    btnLimparTexto.addEventListener("click", () => {
      estado.busca = "";
      inputCat.value = "";
      btnLimparTexto.classList.add("hidden");
      renderizarCatalogo();
      inputCat.focus();
    });

    document.getElementById("filtro-tamanho").addEventListener("change", (e) => {
      estado.tamanhoFiltro = e.target.value;
      renderizarCatalogo();
    });

    document.getElementById("filtro-preco").addEventListener("change", (e) => {
      estado.precoFiltro = e.target.value;
      renderizarCatalogo();
    });

    document.getElementById("select-ordenacao").addEventListener("change", (e) => {
      estado.ordenacao = e.target.value;
      renderizarCatalogo();
    });

    document.getElementById("btn-limpar-filtros").addEventListener("click", limparTodosOsFiltros);
    document.getElementById("btn-resetar-vazio").addEventListener("click", limparTodosOsFiltros);

    document.getElementById("btn-guia-medidas-catalogo").addEventListener("click", () => {
      fecharTodosModais();
      abrirCamada(document.getElementById("modal-medidas"));
    });

    document.getElementById("btn-copiar-wa").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(DADOS_LOJA.whatsappExibicao);
        mostrarToast("✓ Número do WhatsApp copiado!");
      } catch (_) {
        mostrarToast(`WhatsApp: ${DADOS_LOJA.whatsappExibicao}`);
      }
    });

    document.getElementById("btn-copiar-insta").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(DADOS_LOJA.instagram);
        mostrarToast("✓ @ do Instagram copiado!");
      } catch (_) {
        mostrarToast(`Instagram: ${DADOS_LOJA.instagram}`);
      }
    });

    document.getElementById("form-contato-rapido").addEventListener("submit", (e) => {
      e.preventDefault();
      const nome = document.getElementById("contato-nome").value.trim();
      const assunto = document.getElementById("contato-assunto").value;
      const texto = document.getElementById("contato-texto").value.trim();
      if (!nome || !texto) return;

      const msg = [
        `Olá, *${DADOS_LOJA.nomeLoja}*! ✨`,
        "",
        `*Nome:* ${nome}`,
        `*Assunto:* ${assunto}`,
        `*Mensagem:* ${texto}`
      ].join("\n");

      window.open(gerarLinkWhatsApp(msg), "_blank", "noopener");
      mostrarToast("Abrindo conversa no WhatsApp...");
    });

    document.getElementById("btn-abrir-sacola").addEventListener("click", abrirSacola);
    document.getElementById("btn-fechar-sacola").addEventListener("click", fecharTodosModais);
    document.getElementById("btn-abrir-menu").addEventListener("click", () => {
      fecharTodosModais();
      abrirCamada(document.getElementById("menu-mobile"));
    });
    document.getElementById("btn-fechar-menu").addEventListener("click", fecharTodosModais);
    document.getElementById("btn-fechar-modal-produto").addEventListener("click", fecharTodosModais);
    document.getElementById("btn-fechar-medidas").addEventListener("click", fecharTodosModais);
    document.getElementById("btn-fechar-confirmacao").addEventListener("click", fecharTodosModais);
    document.getElementById("backdrop").addEventListener("click", fecharTodosModais);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fecharTodosModais();
    });

    document.getElementById("btn-explorar-da-sacola").addEventListener("click", () => {
      fecharTodosModais();
      navegarParaAba("catalogo");
    });

    document.getElementById("cliente-entrega").addEventListener("change", (e) => {
      const grupoEnd = document.getElementById("grupo-endereco");
      grupoEnd.classList.toggle("hidden", !e.target.value.includes("endereço"));
    });

    document.getElementById("cliente-pagamento").addEventListener("change", renderizarSacola);

    document
      .getElementById("btn-finalizar-whatsapp")
      .addEventListener("click", finalizarPedidoWhatsApp);

    document.getElementById("btn-copiar-pedido").addEventListener("click", async () => {
      const texto = document.getElementById("previa-mensagem-wa").textContent;
      try {
        await navigator.clipboard.writeText(texto);
        mostrarToast("✓ Resumo do pedido copiado!");
      } catch (_) {
        mostrarToast("Selecione o texto acima para copiar");
      }
    });

    // Eventos globais de integração com Catálogo Dinâmico e Admin
    window.addEventListener("popstate", () => resolverRotaAtual(false));
    window.addEventListener("rpm:catalogo-atualizado", reRenderizarVitrineCompleta);
    window.addEventListener("rpm:voltar-loja-inicio", () => navegarParaAba("inicio"));
    window.addEventListener("rpm:abrir-pagina-produto", (e) => {
      if (e.detail && e.detail.slug) abrirPaginaProduto(e.detail.slug);
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    configurarEventos();

    // Renderiza imediatamente e em seguida sincroniza com o banco Supabase
    reRenderizarVitrineCompleta();
    resolverRotaAtual(false);

    if (window.RpmCatalog && window.RpmCatalog.loadCatalog) {
      await window.RpmCatalog.loadCatalog(true);
      resolverRotaAtual(false);
    }
  });
})();
