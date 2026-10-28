/**
 * LÓGICA DA LOJA RPM MODAS — 3 ABAS EM PÁGINA ÚNICA (INÍCIO, CATÁLOGO, CONTATO)
 * + PESQUISA RÁPIDA + FILTROS + SACOLA E PEDIDO NO WHATSAPP
 */
(function () {
  "use strict";

  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (_) {
        // Ignora se restrito
      }
    }
  };

  const estado = {
    abaAtual: "inicio",
    sacola: storage.get("rpm_sacola_v1", []),
    selecaoTamanhoCard: {},
    busca: "",
    categoriaAtiva: "Todas",
    tamanhoFiltro: "Todos",
    precoFiltro: "todos",
    ordenacao: "destaques"
  };

  function formatarMoeda(valor) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function limparNumeroWhatsApp(num) {
    return String(num || "").replace(/\D/g, "");
  }

  function gerarLinkWhatsApp(mensagem) {
    const fone = limparNumeroWhatsApp(DADOS_LOJA.whatsapp);
    return `https://wa.me/${fone}?text=${encodeURIComponent(mensagem)}`;
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
    }, 3000);
  }

  // ==========================================================================
  // 1. NAVEGAÇÃO ENTRE AS 3 ABAS (INÍCIO, CATÁLOGO, CONTATO)
  // ==========================================================================
  function navegarParaAba(nomeAba, rolarTopo = true) {
    const abasValidas = ["inicio", "catalogo", "contato"];
    const destino = abasValidas.includes(nomeAba) ? nomeAba : "inicio";
    estado.abaAtual = destino;

    abasValidas.forEach((aba) => {
      const secao = document.getElementById(`aba-${aba}`);
      if (secao) {
        secao.classList.toggle("hidden", aba !== destino);
      }
    });

    // Atualiza estado ativo nos botões do cabeçalho e menu mobile
    document.querySelectorAll(".tab-nav-btn, .mobile-tab-btn").forEach((btn) => {
      const alvo = btn.getAttribute("data-aba-link");
      const ativo = alvo === destino;
      btn.classList.toggle("active", ativo);
      if (ativo) {
        btn.setAttribute("aria-current", "page");
      } else {
        btn.removeAttribute("aria-current");
      }
    });

    try {
      window.history.replaceState(null, "", `#${destino}`);
    } catch (_) {
      // Ignora em ambientes sem histórico
    }

    if (rolarTopo) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // ==========================================================================
  // 2. PREENCHIMENTO DOS DADOS DA MARCA (RPM MODAS)
  // ==========================================================================
  function preencherDadosDaLoja() {
    document.title = `${DADOS_LOJA.nomeLoja} | ${DADOS_LOJA.subtituloLogo}`;

    const setTexto = (id, valor) => {
      const el = document.getElementById(id);
      if (el && valor) el.textContent = valor;
    };

    // Nome e subtítulo em todos os pontos
    setTexto("header-nome-loja", DADOS_LOJA.nomeLoja);
    setTexto("header-sub-loja", DADOS_LOJA.subtituloLogo);
    setTexto("mobile-nome-loja", DADOS_LOJA.nomeLoja);
    setTexto("mobile-sub-loja", DADOS_LOJA.subtituloLogo);
    setTexto("footer-nome-loja", DADOS_LOJA.nomeLoja);
    setTexto("footer-sub-loja", DADOS_LOJA.subtituloLogo);
    setTexto("copy-nome-loja", DADOS_LOJA.nomeLoja);
    setTexto("copy-sub-loja", DADOS_LOJA.subtituloLogo);

    // Hero da aba Início
    setTexto("hero-tag", DADOS_LOJA.tagColecao);
    setTexto("hero-titulo", DADOS_LOJA.sloganHero);
    setTexto("hero-descricao", DADOS_LOJA.descricaoHero);

    // Aba Contato & Rodapé
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

    // Barra de avisos no topo
    const topbar = document.getElementById("topbar-avisos");
    if (topbar && Array.isArray(DADOS_LOJA.avisosTopo) && DADOS_LOJA.avisosTopo.length) {
      topbar.innerHTML = DADOS_LOJA.avisosTopo
        .map((aviso) => `<span>${aviso}</span>`)
        .join('<span class="topbar-sep">•</span>');
    }

    // Tabela de medidas
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
  // 3. GERADOR DE CARDS DE PRODUTOS (USADO NO INÍCIO E NO CATÁLOGO)
  // ==========================================================================
  function montarHtmlCardProduto(prod) {
    const percPix = DADOS_LOJA.descontoPixPercentual || 0;
    const parcelas = DADOS_LOJA.parcelasSemJuros || 3;
    const tamSelecionado =
      estado.selecaoTamanhoCard[prod.id] ||
      (estado.tamanhoFiltro !== "Todos" && (prod.tamanhos || []).includes(estado.tamanhoFiltro)
        ? estado.tamanhoFiltro
        : "");

    const precoPix = prod.preco * (1 - percPix / 100);
    const valorParcela = prod.preco / parcelas;
    const isOferta = Boolean(prod.precoAntigo && prod.precoAntigo > prod.preco);
    const percDesconto = isOferta
      ? Math.round(((prod.precoAntigo - prod.preco) / prod.precoAntigo) * 100)
      : 0;
    const tagTexto = (prod.destaque || (isOferta ? `-${percDesconto}% OFF` : "")).trim();

    return `
      <article class="product-card" data-prod-id="${prod.id}">
        <div class="product-media" data-abrir-modal="${prod.id}">
          <img src="${prod.imagem}" alt="${prod.nome}" loading="lazy" />
          ${
            tagTexto
              ? `<span class="product-badge ${isOferta ? "sale" : ""}">${tagTexto}</span>`
              : ""
          }
          <span class="quick-detail-hint">Ver detalhes</span>
        </div>

        <div class="product-info">
          <span class="product-cat">${prod.categoria}</span>
          <h3 class="product-title" data-abrir-modal="${prod.id}">${prod.nome}</h3>

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
            <div class="card-size-label" data-label-tam>
              <span>Tamanho:</span>
              ${tamSelecionado ? `<strong>${tamSelecionado}</strong>` : ""}
            </div>
            <div class="size-chips">
              ${(prod.tamanhos || [])
                .map(
                  (tam) => `
                  <button
                    type="button"
                    class="size-chip ${tamSelecionado === tam ? "selected" : ""}"
                    data-card-tam="${tam}"
                    data-card-prod="${prod.id}"
                  >${tam}</button>
                `
                )
                .join("")}
            </div>
            <button type="button" class="btn-card-add" data-add-card="${prod.id}">
              Adicionar à Sacola
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function conectarEventosDeGrade(container) {
    if (!container) return;

    container.querySelectorAll("[data-abrir-modal]").forEach((el) => {
      el.addEventListener("click", () => {
        abrirModalProduto(el.getAttribute("data-abrir-modal"));
      });
    });

    container.querySelectorAll("[data-card-tam]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const prodId = chip.getAttribute("data-card-prod");
        const tam = chip.getAttribute("data-card-tam");
        estado.selecaoTamanhoCard[prodId] = tam;
        renderizarVitrinesInicio();
        renderizarCatalogo();
      });
    });

    container.querySelectorAll("[data-add-card]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const prodId = btn.getAttribute("data-add-card");
        const prod = DADOS_LOJA.produtos.find((p) => p.id === prodId);
        if (!prod) return;

        const tam =
          estado.selecaoTamanhoCard[prodId] ||
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
          mostrarToast("Selecione um tamanho antes de adicionar à sacola ✨");
          return;
        }

        const corPadrao = (prod.cores && prod.cores[0]) || "Única";
        adicionarNaSacola(prod, tam, corPadrao, 1);
      });
    });
  }

  // ==========================================================================
  // 4. ABA INÍCIO: VITRINES (MAIS VENDIDAS + PROMOÇÕES) E PESQUISA RÁPIDA
  // ==========================================================================
  function renderizarVitrinesInicio() {
    const gradeMaisVendidas = document.getElementById("grade-mais-vendidas");
    const gradePromocoes = document.getElementById("grade-promocoes");

    if (gradeMaisVendidas) {
      const maisVendidas = DADOS_LOJA.produtos.filter((p) => Boolean(p.maisVendido));
      gradeMaisVendidas.innerHTML = maisVendidas.map(montarHtmlCardProduto).join("");
      conectarEventosDeGrade(gradeMaisVendidas);
    }

    if (gradePromocoes) {
      const promocoes = DADOS_LOJA.produtos.filter(
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

    const encontrados = DADOS_LOJA.produtos.filter((p) => corresponderTextoBusca(p, q));
    box.classList.remove("hidden");

    if (encontrados.length === 0) {
      box.innerHTML = `<p style="font-size:0.86rem;color:var(--ink-soft);">Nenhuma peça encontrada para "<strong>${q}</strong>". Clique em Buscar no Catálogo para explorar todas as categorias.</p>`;
      return;
    }

    box.innerHTML = `
      <div class="live-results-list">
        ${encontrados
          .slice(0, 4)
          .map(
            (p) => `
          <div class="live-result-item" data-live-prod="${p.id}">
            <img src="${p.imagem}" alt="${p.nome}" />
            <div>
              <strong>${p.nome}</strong>
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

    box.querySelectorAll("[data-live-prod]").forEach((el) => {
      el.addEventListener("click", () => abrirModalProduto(el.getAttribute("data-live-prod")));
    });

    const btnIr = document.getElementById("btn-ir-resultados-catalogo");
    if (btnIr) {
      btnIr.addEventListener("click", () => {
        aplicarBuscaEIrParaCatalogo(q);
      });
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
  // 5. ABA CATÁLOGO: PESQUISA + FILTROS COMPLETOS
  // ==========================================================================
  function renderizarPillsCategorias() {
    const container = document.getElementById("filtros-categoria");
    if (!container) return;

    const categorias = ["Todas"];
    DADOS_LOJA.produtos.forEach((p) => {
      if (p.categoria && !categorias.includes(p.categoria)) {
        categorias.push(p.categoria);
      }
    });

    container.innerHTML = categorias
      .map((cat) => {
        const ativo = estado.categoriaAtiva === cat ? "active" : "";
        return `<button type="button" class="cat-pill ${ativo}" data-cat="${cat}">${cat}</button>`;
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
    let lista = [...DADOS_LOJA.produtos];

    if (estado.categoriaAtiva !== "Todas") {
      lista = lista.filter((p) => p.categoria === estado.categoriaAtiva);
    }

    if (estado.tamanhoFiltro !== "Todos") {
      lista = lista.filter((p) => (p.tamanhos || []).includes(estado.tamanhoFiltro));
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
    const totalGeral = DADOS_LOJA.produtos.length;

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
  // 6. MODAL DE DETALHES DO PRODUTO
  // ==========================================================================
  function abrirModalProduto(prodId) {
    const prod = DADOS_LOJA.produtos.find((p) => p.id === prodId);
    if (!prod) return;

    const container = document.getElementById("conteudo-modal-produto");
    const modal = document.getElementById("modal-produto");
    if (!container || !modal) return;

    let tamEscolhido =
      estado.selecaoTamanhoCard[prod.id] || (prod.tamanhos && prod.tamanhos[0]) || "Único";
    let corEscolhida = (prod.cores && prod.cores[0]) || "Padrão";

    const percPix = DADOS_LOJA.descontoPixPercentual || 0;
    const precoPix = prod.preco * (1 - percPix / 100);
    const parcelas = DADOS_LOJA.parcelasSemJuros || 3;

    function renderizarInterno() {
      container.innerHTML = `
        <div class="modal-prod-img-wrap">
          <img src="${prod.imagem}" alt="${prod.nome}" />
        </div>
        <div class="modal-prod-details">
          <span class="eyebrow">${prod.categoria}</span>
          <h3 id="modal-prod-titulo">${prod.nome}</h3>

          <div class="price-block">
            <div class="price-main-line">
              ${
                prod.precoAntigo
                  ? `<span class="old-price">${formatarMoeda(prod.precoAntigo)}</span>`
                  : ""
              }
              <span class="current-price" style="font-size:1.35rem">${formatarMoeda(prod.preco)}</span>
            </div>
            ${
              percPix > 0
                ? `<div class="pix-price-hint">${formatarMoeda(precoPix)} no PIX (${percPix}% de desconto)</div>`
                : ""
            }
            <div class="installment-hint">ou até ${parcelas}x de ${formatarMoeda(
              prod.preco / parcelas
            )} sem juros</div>
          </div>

          <p class="modal-prod-desc">${prod.descricao}</p>
          <div class="modal-fabric-box"><strong>Tecido &amp; Detalhes:</strong> ${prod.tecido}</div>

          ${
            prod.cores && prod.cores.length > 0
              ? `
            <div class="selector-group">
              <div class="selector-header">
                <span>Cor selecionada: <strong>${corEscolhida}</strong></span>
              </div>
              <div class="color-chips">
                ${prod.cores
                  .map(
                    (cor) => `
                  <button type="button" class="color-chip ${
                    corEscolhida === cor ? "selected" : ""
                  }" data-modal-cor="${cor}">${cor}</button>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }

          <div class="selector-group">
            <div class="selector-header">
              <span>Tamanho: <strong>${tamEscolhido}</strong></span>
              <button type="button" class="text-btn" id="btn-medidas-dentro-modal">📏 Guia de Medidas</button>
            </div>
            <div class="size-chips">
              ${(prod.tamanhos || [])
                .map(
                  (tam) => `
                <button type="button" class="size-chip ${
                  tamEscolhido === tam ? "selected" : ""
                }" data-modal-tam="${tam}">${tam}</button>
              `
                )
                .join("")}
            </div>
          </div>

          <div class="modal-actions-stack">
            <button type="button" class="btn btn-primary btn-block" id="btn-modal-add-sacola">
              Adicionar à Sacola • ${formatarMoeda(prod.preco)}
            </button>
            <button type="button" class="btn btn-whatsapp btn-block" id="btn-modal-comprar-direto">
              Comprar esta peça no WhatsApp
            </button>
          </div>
        </div>
      `;

      container.querySelectorAll("[data-modal-cor]").forEach((btn) => {
        btn.addEventListener("click", () => {
          corEscolhida = btn.getAttribute("data-modal-cor");
          renderizarInterno();
        });
      });

      container.querySelectorAll("[data-modal-tam]").forEach((btn) => {
        btn.addEventListener("click", () => {
          tamEscolhido = btn.getAttribute("data-modal-tam");
          estado.selecaoTamanhoCard[prod.id] = tamEscolhido;
          renderizarInterno();
        });
      });

      document.getElementById("btn-medidas-dentro-modal").addEventListener("click", () => {
        fecharTodosModais();
        abrirCamada(document.getElementById("modal-medidas"));
      });

      document.getElementById("btn-modal-add-sacola").addEventListener("click", () => {
        fecharTodosModais();
        adicionarNaSacola(prod, tamEscolhido, corEscolhida, 1);
      });

      document.getElementById("btn-modal-comprar-direto").addEventListener("click", () => {
        const msg = [
          `Olá! Vim pelo site da *${DADOS_LOJA.nomeLoja}* e gostaria de comprar esta peça: ✨`,
          "",
          `• *${prod.nome}*`,
          `  Tamanho: *${tamEscolhido}* | Cor: *${corEscolhida}*`,
          `  Valor: ${formatarMoeda(prod.preco)} (${formatarMoeda(precoPix)} no PIX)`,
          "",
          "Poderia confirmar a disponibilidade?"
        ].join("\n");
        fecharTodosModais();
        exibirConfirmacaoPedido(msg);
      });
    }

    renderizarInterno();
    abrirCamada(modal);
  }

  // ==========================================================================
  // 7. SACOLA DE COMPRAS E CHECKOUT WHATSAPP
  // ==========================================================================
  function salvarSacola() {
    storage.set("rpm_sacola_v1", estado.sacola);
  }

  function adicionarNaSacola(prod, tamanho, cor, qtd) {
    const uid = `${prod.id}__${tamanho}__${cor}`;
    const existente = estado.sacola.find((item) => item.uid === uid);

    if (existente) {
      existente.qtd += qtd;
    } else {
      estado.sacola.push({
        uid,
        id: prod.id,
        nome: prod.nome,
        imagem: prod.imagem,
        preco: prod.preco,
        tamanho,
        cor,
        qtd
      });
    }

    salvarSacola();
    renderizarSacola();
    renderizarVitrinesInicio();
    renderizarCatalogo();
    abrirSacola();
    mostrarToast(`✨ ${prod.nome} (${tamanho}) adicionado à sacola!`);
  }

  function alterarQuantidade(uid, delta) {
    const idx = estado.sacola.findIndex((i) => i.uid === uid);
    if (idx === -1) return;

    estado.sacola[idx].qtd += delta;
    if (estado.sacola[idx].qtd <= 0) {
      estado.sacola.splice(idx, 1);
    }
    salvarSacola();
    renderizarSacola();
  }

  function removerItemSacola(uid) {
    estado.sacola = estado.sacola.filter((i) => i.uid !== uid);
    salvarSacola();
    renderizarSacola();
  }

  function calcularTotaisSacola() {
    const subtotal = estado.sacola.reduce((acc, item) => acc + item.preco * item.qtd, 0);
    const qtdTotal = estado.sacola.reduce((acc, item) => acc + item.qtd, 0);

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
    const totais = calcularTotaisSacola();

    const badge = document.getElementById("badge-sacola");
    if (badge) badge.textContent = String(totais.qtdTotal);

    const subtexto = document.getElementById("sacola-contagem-texto");
    if (subtexto) {
      subtexto.textContent = `${totais.qtdTotal} ${
        totais.qtdTotal === 1 ? "item selecionado" : "itens selecionados"
      }`;
    }

    const barraContainer = document.getElementById("barra-frete-container");
    const textoFrete = document.getElementById("texto-progresso-frete");
    const barraFill = document.getElementById("preenchimento-frete");

    if (barraContainer && totais.metaFrete > 0) {
      barraContainer.classList.remove("hidden");
      const progresso = Math.min(100, (totais.subtotal / totais.metaFrete) * 100);
      if (barraFill) barraFill.style.width = `${progresso}%`;

      if (totais.ganhouFreteGratis) {
        textoFrete.innerHTML = "🎉 Parabéns! Você ganhou <strong>Frete Grátis</strong> neste pedido!";
      } else {
        const falta = totais.metaFrete - totais.subtotal;
        textoFrete.innerHTML = `Faltam <strong>${formatarMoeda(
          falta
        )}</strong> para ganhar <strong>Frete Grátis</strong>`;
      }
    } else if (barraContainer) {
      barraContainer.classList.add("hidden");
    }

    const vaziaEl = document.getElementById("sacola-vazia");
    const cheioEl = document.getElementById("sacola-conteudo-cheio");
    const rodapeEl = document.getElementById("sacola-rodape");
    const listaEl = document.getElementById("lista-itens-sacola");

    if (estado.sacola.length === 0) {
      vaziaEl.classList.remove("hidden");
      cheioEl.classList.add("hidden");
      rodapeEl.classList.add("hidden");
      return;
    }

    vaziaEl.classList.add("hidden");
    cheioEl.classList.remove("hidden");
    rodapeEl.classList.remove("hidden");

    listaEl.innerHTML = estado.sacola
      .map(
        (item) => `
        <li class="cart-item">
          <img src="${item.imagem}" alt="${item.nome}" />
          <div>
            <div class="cart-item-top">
              <span class="cart-item-title">${item.nome}</span>
              <button type="button" class="cart-remove-btn" data-remover="${item.uid}" title="Remover item">✕</button>
            </div>
            <div class="cart-item-meta">Tam: <strong>${item.tamanho}</strong> • Cor: ${item.cor}</div>
            <div class="cart-item-bottom">
              <div class="qty-control">
                <button type="button" class="qty-btn" data-menos="${item.uid}" aria-label="Diminuir quantidade">−</button>
                <span class="qty-val">${item.qtd}</span>
                <button type="button" class="qty-btn" data-mais="${item.uid}" aria-label="Aumentar quantidade">+</button>
              </div>
              <span class="cart-item-price">${formatarMoeda(item.preco * item.qtd)}</span>
            </div>
          </div>
        </li>
      `
      )
      .join("");

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

  function finalizarPedidoWhatsApp() {
    if (estado.sacola.length === 0) return;

    const nomeInput = document.getElementById("cliente-nome");
    const nome = (nomeInput ? nomeInput.value : "").trim();
    if (!nome) {
      if (nomeInput) nomeInput.focus();
      mostrarToast("Por favor, digite seu nome antes de enviar o pedido 😊");
      return;
    }

    const entrega = document.getElementById("cliente-entrega").value;
    const cep = document.getElementById("cliente-cep").value.trim();
    const pagamento = document.getElementById("cliente-pagamento").value;
    const obs = document.getElementById("cliente-obs").value.trim();
    const totais = calcularTotaisSacola();

    const linhasItens = estado.sacola.map(
      (item) =>
        `• ${item.qtd}x *${item.nome}*\n  Tam: ${item.tamanho} | Cor: ${item.cor} — ${formatarMoeda(
          item.preco * item.qtd
        )}`
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
    } catch (_) {
      // Botão no modal permanece disponível
    }
  }

  // ==========================================================================
  // 8. CONTROLES GERAIS E EVENTOS
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

  function configurarEventos() {
    // Cliques em todas as abas (Início, Catálogo, Contato)
    document.querySelectorAll("[data-aba-link]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const aba = el.getAttribute("data-aba-link");
        fecharTodosModais();
        navegarParaAba(aba);
      });
    });

    // Pesquisa na aba Início
    const inputHome = document.getElementById("input-pesquisa-inicio");
    const formHome = document.getElementById("form-pesquisa-inicio");

    inputHome.addEventListener("input", (e) => {
      atualizarResultadosRapidosInicio(e.target.value);
    });

    formHome.addEventListener("submit", (e) => {
      e.preventDefault();
      aplicarBuscaEIrParaCatalogo(inputHome.value);
    });

    // Atalhos rápidos da pesquisa na aba Início
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

    // Pesquisa e filtros na aba Catálogo
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

    // Aba Contato: copiar contatos e enviar mensagem direta
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

    // Sacola, menu e modais
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
  }

  document.addEventListener("DOMContentLoaded", () => {
    preencherDadosDaLoja();
    renderizarPillsCategorias();
    renderizarVitrinesInicio();
    renderizarCatalogo();
    renderizarSacola();
    configurarEventos();

    // Abre diretamente a aba caso a URL tenha #inicio, #catalogo ou #contato
    const hashInicial = (window.location.hash || "").replace("#", "").toLowerCase();
    if (["inicio", "catalogo", "contato"].includes(hashInicial)) {
      navegarParaAba(hashInicial, false);
    } else {
      navegarParaAba("inicio", false);
    }
  });
})();
