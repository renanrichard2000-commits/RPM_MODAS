/**
 * LÓGICA DA LOJA ONLINE + SACOLA + PEDIDO NO WHATSAPP
 * Lê automaticamente todas as configurações do arquivo dados-loja.js
 */
(function () {
  "use strict";

  // Utilitário de armazenamento seguro (funciona mesmo em navegadores restritos)
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
        // Ignora se bloqueado
      }
    }
  };

  // Estado da aplicação
  const estado = {
    sacola: storage.get("loja_sacola_v1", []),
    favoritos: storage.get("loja_favoritos_v1", []),
    selecaoTamanhoCard: {},
    categoriaAtiva: "Todos",
    apenasFavoritos: false,
    busca: "",
    ordenacao: "destaques",
    cupomAtivo: null
  };

  // Formatador de moeda Real Brasileiro (R$)
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

  // Toast rápido de feedback
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
  // 1. INICIALIZAÇÃO DOS TEXTOS DA LOJA (dados-loja.js)
  // ==========================================================================
  function preencherDadosDaLoja() {
    document.title = `${DADOS_LOJA.nomeLoja} | ${DADOS_LOJA.subtituloLogo}`;

    const setTexto = (id, valor) => {
      const el = document.getElementById(id);
      if (el && valor) el.textContent = valor;
    };

    setTexto("header-nome-loja", DADOS_LOJA.nomeLoja);
    setTexto("header-sub-loja", DADOS_LOJA.subtituloLogo);
    setTexto("mobile-nome-loja", DADOS_LOJA.nomeLoja);
    setTexto("footer-nome-loja", DADOS_LOJA.nomeLoja);
    setTexto("copy-nome-loja", DADOS_LOJA.nomeLoja);
    setTexto("hero-tag", DADOS_LOJA.tagColecao);
    setTexto("hero-titulo", DADOS_LOJA.sloganHero);
    setTexto("hero-descricao", DADOS_LOJA.descricaoHero);
    setTexto("footer-cidade", DADOS_LOJA.cidadeEstado);
    setTexto("footer-horario", DADOS_LOJA.horarioAtendimento);
    setTexto("footer-whatsapp", DADOS_LOJA.whatsappExibicao);
    setTexto("ano-atual", String(new Date().getFullYear()));

    const linkInsta = document.getElementById("footer-instagram");
    if (linkInsta) {
      linkInsta.textContent = DADOS_LOJA.instagram;
      linkInsta.href = DADOS_LOJA.urlInstagram || "https://instagram.com/";
    }

    if (DADOS_LOJA.freteGratisAcimaDe > 0) {
      setTexto(
        "beneficio-frete-titulo",
        `Frete Grátis acima de R$ ${DADOS_LOJA.freteGratisAcimaDe.toFixed(0)}`
      );
    }

    // Barra superior de avisos
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
  // 2. CATEGORIAS, BUSCA E RENDERIZAÇÃO DO CATÁLOGO
  // ==========================================================================
  function renderizarPillsCategorias() {
    const container = document.getElementById("filtros-categoria");
    if (!container) return;

    const categoriasUnicas = ["Todos"];
    DADOS_LOJA.produtos.forEach((p) => {
      if (p.categoria && !categoriasUnicas.includes(p.categoria)) {
        categoriasUnicas.push(p.categoria);
      }
    });

    container.innerHTML = categoriasUnicas
      .map((cat) => {
        const ativo = !estado.apenasFavoritos && estado.categoriaAtiva === cat ? "active" : "";
        return `<button type="button" class="cat-pill ${ativo}" data-cat="${cat}">${cat}</button>`;
      })
      .join("");

    container.querySelectorAll(".cat-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        estado.categoriaAtiva = btn.getAttribute("data-cat");
        estado.apenasFavoritos = false;
        renderizarPillsCategorias();
        renderizarCatalogo();
      });
    });
  }

  function obterProdutosFiltrados() {
    let lista = [...DADOS_LOJA.produtos];

    if (estado.apenasFavoritos) {
      lista = lista.filter((p) => estado.favoritos.includes(p.id));
    } else if (estado.categoriaAtiva !== "Todos") {
      lista = lista.filter((p) => p.categoria === estado.categoriaAtiva);
    }

    if (estado.busca.trim() !== "") {
      const q = estado.busca.trim().toLowerCase();
      lista = lista.filter((p) => {
        const texto = [
          p.nome,
          p.categoria,
          p.descricao,
          p.tecido,
          ...(p.cores || [])
        ]
          .join(" ")
          .toLowerCase();
        return texto.includes(q);
      });
    }

    if (estado.ordenacao === "menor-preco") {
      lista.sort((a, b) => a.preco - b.preco);
    } else if (estado.ordenacao === "maior-preco") {
      lista.sort((a, b) => b.preco - a.preco);
    } else if (estado.ordenacao === "novidades") {
      lista.sort((a, b) => Number(Boolean(b.novo)) - Number(Boolean(a.novo)));
    }

    return lista;
  }

  function atualizarBannerFiltroAtivo(qtdResultados) {
    const banner = document.getElementById("banner-filtro-ativo");
    const texto = document.getElementById("texto-filtro-ativo");
    if (!banner || !texto) return;

    if (estado.apenasFavoritos || estado.busca.trim() !== "") {
      const partes = [];
      if (estado.apenasFavoritos) partes.push("♥ Meus Favoritos");
      if (estado.busca.trim() !== "") partes.push(`Busca: "${estado.busca.trim()}"`);
      texto.textContent = `${partes.join(" • ")} (${qtdResultados} ${
        qtdResultados === 1 ? "peça encontrada" : "peças encontradas"
      })`;
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }

  function renderizarCatalogo() {
    const grade = document.getElementById("grade-produtos");
    const vazio = document.getElementById("catalogo-vazio");
    if (!grade || !vazio) return;

    const produtos = obterProdutosFiltrados();
    atualizarBannerFiltroAtivo(produtos.length);

    if (produtos.length === 0) {
      grade.innerHTML = "";
      vazio.classList.remove("hidden");
      return;
    }

    vazio.classList.add("hidden");
    const percPix = DADOS_LOJA.descontoPixPercentual || 0;
    const parcelas = DADOS_LOJA.parcelasSemJuros || 3;

    grade.innerHTML = produtos
      .map((prod) => {
        const isFav = estado.favoritos.includes(prod.id);
        const tamSelecionado = estado.selecaoTamanhoCard[prod.id] || "";
        const precoPix = prod.preco * (1 - percPix / 100);
        const valorParcela = prod.preco / parcelas;
        const tagTexto = (prod.destaque || "").trim();
        const isOferta = Boolean(prod.precoAntigo && prod.precoAntigo > prod.preco);

        return `
          <article class="product-card" data-prod-id="${prod.id}">
            <div class="product-media" data-abrir-modal="${prod.id}">
              <img src="${prod.imagem}" alt="${prod.nome}" loading="lazy" />
              ${
                tagTexto
                  ? `<span class="product-badge ${isOferta ? "sale" : ""}">${tagTexto}</span>`
                  : ""
              }
              <button
                type="button"
                class="fav-btn ${isFav ? "active" : ""}"
                data-fav-id="${prod.id}"
                aria-label="Salvar nos favoritos"
                title="Favoritar peça"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </button>
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
                <div class="card-size-label" id="label-tam-${prod.id}">
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
      })
      .join("");

    // Eventos dos cards
    grade.querySelectorAll("[data-abrir-modal]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-fav-id]")) return;
        abrirModalProduto(el.getAttribute("data-abrir-modal"));
      });
    });

    grade.querySelectorAll("[data-fav-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        alternarFavorito(btn.getAttribute("data-fav-id"));
      });
    });

    grade.querySelectorAll("[data-card-tam]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const prodId = chip.getAttribute("data-card-prod");
        const tam = chip.getAttribute("data-card-tam");
        estado.selecaoTamanhoCard[prodId] = tam;
        renderizarCatalogo();
      });
    });

    grade.querySelectorAll("[data-add-card]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const prodId = btn.getAttribute("data-add-card");
        const prod = DADOS_LOJA.produtos.find((p) => p.id === prodId);
        if (!prod) return;

        const tam = estado.selecaoTamanhoCard[prodId];
        if (!tam) {
          const label = document.getElementById(`label-tam-${prodId}`);
          if (label) {
            label.innerHTML = "<span>👆 Escolha um tamanho acima:</span>";
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
  // 3. FAVORITOS
  // ==========================================================================
  function atualizarBadgeFavoritos() {
    const badge = document.getElementById("badge-favoritos");
    if (!badge) return;
    const total = estado.favoritos.length;
    badge.textContent = String(total);
    badge.classList.toggle("hidden", total === 0);
  }

  function alternarFavorito(prodId) {
    const idx = estado.favoritos.indexOf(prodId);
    if (idx >= 0) {
      estado.favoritos.splice(idx, 1);
      mostrarToast("Removido dos favoritos");
    } else {
      estado.favoritos.push(prodId);
      mostrarToast("♥ Salvo nos seus favoritos!");
    }
    storage.set("loja_favoritos_v1", estado.favoritos);
    atualizarBadgeFavoritos();
    renderizarCatalogo();
  }

  // ==========================================================================
  // 4. MODAL DE DETALHES DO PRODUTO
  // ==========================================================================
  function abrirModalProduto(prodId) {
    const prod = DADOS_LOJA.produtos.find((p) => p.id === prodId);
    if (!prod) return;

    const container = document.getElementById("conteudo-modal-produto");
    const modal = document.getElementById("modal-produto");
    if (!container || !modal) return;

    let tamEscolhido = estado.selecaoTamanhoCard[prod.id] || (prod.tamanhos && prod.tamanhos[0]) || "Único";
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
          <div class="modal-fabric-box"><strong>Composição &amp; Detalhes:</strong> ${prod.tecido}</div>

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

      const btnMedidas = document.getElementById("btn-medidas-dentro-modal");
      if (btnMedidas) {
        btnMedidas.addEventListener("click", () => {
          fecharTodosModais();
          abrirModalMedidas();
        });
      }

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
  // 5. SACOLA DE COMPRAS E CHECKOUT WHATSAPP
  // ==========================================================================
  function salvarSacola() {
    storage.set("loja_sacola_v1", estado.sacola);
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

    const descontoCupom = estado.cupomAtivo
      ? subtotal * (estado.cupomAtivo.percentual / 100)
      : 0;

    const baseAposCupom = Math.max(0, subtotal - descontoCupom);

    const selectPagamento = document.getElementById("cliente-pagamento");
    const pagandoPix = selectPagamento && selectPagamento.value === "PIX";
    const percPix = DADOS_LOJA.descontoPixPercentual || 0;
    const descontoPix = pagandoPix ? baseAposCupom * (percPix / 100) : 0;

    const totalFinal = Math.max(0, baseAposCupom - descontoPix);
    const metaFrete = DADOS_LOJA.freteGratisAcimaDe || 0;
    const ganhouFreteGratis = metaFrete > 0 && subtotal >= metaFrete;

    return {
      subtotal,
      qtdTotal,
      descontoCupom,
      descontoPix,
      pagandoPix,
      totalFinal,
      metaFrete,
      ganhouFreteGratis
    };
  }

  function renderizarSacola() {
    const totais = calcularTotaisSacola();

    // Badge topo
    const badge = document.getElementById("badge-sacola");
    if (badge) badge.textContent = String(totais.qtdTotal);

    const subtexto = document.getElementById("sacola-contagem-texto");
    if (subtexto) {
      subtexto.textContent = `${totais.qtdTotal} ${
        totais.qtdTotal === 1 ? "item selecionado" : "itens selecionados"
      }`;
    }

    // Barra de frete grátis
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

    // Resumo financeiro
    document.getElementById("resumo-subtotal").textContent = formatarMoeda(totais.subtotal);

    const linhaCupom = document.getElementById("linha-desconto-cupom");
    if (estado.cupomAtivo && totais.descontoCupom > 0) {
      linhaCupom.classList.remove("hidden");
      document.getElementById(
        "label-desconto-cupom"
      ).textContent = `Cupom (${estado.cupomAtivo.codigo})`;
      document.getElementById("valor-desconto-cupom").textContent = `- ${formatarMoeda(
        totais.descontoCupom
      )}`;
    } else {
      linhaCupom.classList.add("hidden");
    }

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

  function aplicarCupomCodigo(codigoInformado) {
    const codigo = String(codigoInformado || "")
      .trim()
      .toUpperCase();
    const feedback = document.getElementById("feedback-cupom");
    const input = document.getElementById("input-cupom");

    if (!codigo) {
      estado.cupomAtivo = null;
      if (feedback) feedback.classList.add("hidden");
      renderizarSacola();
      return;
    }

    const tabelaCupons = DADOS_LOJA.cupons || {};
    if (tabelaCupons[codigo]) {
      estado.cupomAtivo = { codigo, percentual: tabelaCupons[codigo] };
      if (input) input.value = codigo;
      if (feedback) {
        feedback.textContent = `✓ Cupom ${codigo} (${tabelaCupons[codigo]}% OFF) aplicado!`;
        feedback.className = "coupon-feedback ok";
      }
      renderizarSacola();
      mostrarToast(`🎁 Cupom ${codigo} ativado com sucesso!`);
    } else {
      estado.cupomAtivo = null;
      if (feedback) {
        feedback.textContent = "Cupom inválido ou expirado.";
        feedback.className = "coupon-feedback err";
      }
      renderizarSacola();
    }
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
    if (estado.cupomAtivo && totais.descontoCupom > 0) {
      linhasResumo.push(
        `Cupom (${estado.cupomAtivo.codigo}): -${formatarMoeda(totais.descontoCupom)}`
      );
    }
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

    // Tenta abrir o WhatsApp em nova aba automaticamente
    try {
      window.open(urlWa, "_blank", "noopener");
    } catch (_) {
      // Caso o navegador bloqueie pop-ups, o botão verde no modal garante o clique direto
    }
  }

  // ==========================================================================
  // 6. CONTROLE DE DRAWERS, MODAIS E EVENTOS GERAIS
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

  function abrirModalMedidas() {
    fecharTodosModais();
    abrirCamada(document.getElementById("modal-medidas"));
  }

  function abrirAtendimentoGeral() {
    const msg = `Olá! Vim pelo site da *${DADOS_LOJA.nomeLoja}* e gostaria de tirar uma dúvida sobre as peças ✨`;
    window.open(gerarLinkWhatsApp(msg), "_blank", "noopener");
  }

  function configurarEventos() {
    // Abrir e fechar sacola / menu / modais
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

    // Botões de Guia de Medidas espalhados pelo site
    ["btn-nav-medidas", "btn-mobile-medidas", "btn-footer-medidas", "btn-abrir-medidas-banner"].forEach(
      (id) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener("click", abrirModalMedidas);
      }
    );

    // Links de navegação que filtram categorias
    document.querySelectorAll("[data-nav-cat]").forEach((link) => {
      link.addEventListener("click", () => {
        estado.categoriaAtiva = link.getAttribute("data-nav-cat");
        estado.apenasFavoritos = false;
        fecharTodosModais();
        renderizarPillsCategorias();
        renderizarCatalogo();
      });
    });

    document.querySelectorAll(".mobile-anchor-close").forEach((a) => {
      a.addEventListener("click", fecharTodosModais);
    });

    // Busca no topo e no catálogo sincronizadas
    const painelBusca = document.getElementById("painel-busca");
    const inputBuscaTopo = document.getElementById("input-busca-topo");
    const inputBuscaCat = document.getElementById("input-busca-catalogo");

    document.getElementById("btn-toggle-busca").addEventListener("click", () => {
      painelBusca.classList.toggle("hidden");
      if (!painelBusca.classList.contains("hidden")) {
        inputBuscaTopo.focus();
      }
    });

    document.getElementById("btn-fechar-busca").addEventListener("click", () => {
      painelBusca.classList.add("hidden");
    });

    function atualizarBusca(valor) {
      estado.busca = valor;
      if (inputBuscaTopo.value !== valor) inputBuscaTopo.value = valor;
      if (inputBuscaCat.value !== valor) inputBuscaCat.value = valor;
      renderizarCatalogo();
    }

    inputBuscaTopo.addEventListener("input", (e) => {
      atualizarBusca(e.target.value);
      document.getElementById("catalogo").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    inputBuscaCat.addEventListener("input", (e) => atualizarBusca(e.target.value));

    // Ordenação
    document.getElementById("select-ordenacao").addEventListener("change", (e) => {
      estado.ordenacao = e.target.value;
      renderizarCatalogo();
    });

    // Favoritos no cabeçalho
    document.getElementById("btn-ver-favoritos").addEventListener("click", () => {
      estado.apenasFavoritos = !estado.apenasFavoritos;
      renderizarPillsCategorias();
      renderizarCatalogo();
      document.getElementById("catalogo").scrollIntoView({ behavior: "smooth" });
    });

    // Limpar filtros / busca
    const resetarFiltros = () => {
      estado.categoriaAtiva = "Todos";
      estado.apenasFavoritos = false;
      atualizarBusca("");
      renderizarPillsCategorias();
      renderizarCatalogo();
    };
    document.getElementById("btn-limpar-filtros").addEventListener("click", resetarFiltros);
    document.getElementById("btn-resetar-busca").addEventListener("click", resetarFiltros);

    // Explorar da sacola vazia
    document.getElementById("btn-explorar-da-sacola").addEventListener("click", () => {
      fecharTodosModais();
      document.getElementById("catalogo").scrollIntoView({ behavior: "smooth" });
    });

    // Cupom na sacola e no banner promocional
    document.getElementById("btn-aplicar-cupom").addEventListener("click", () => {
      aplicarCupomCodigo(document.getElementById("input-cupom").value);
    });

    document.getElementById("btn-copiar-cupom").addEventListener("click", () => {
      const cod = document.getElementById("codigo-cupom-destaque").textContent.trim();
      aplicarCupomCodigo(cod);
      abrirSacola();
    });

    // Campos de entrega e pagamento na sacola
    document.getElementById("cliente-entrega").addEventListener("change", (e) => {
      const grupoEnd = document.getElementById("grupo-endereco");
      grupoEnd.classList.toggle("hidden", !e.target.value.includes("endereço"));
    });

    document.getElementById("cliente-pagamento").addEventListener("change", renderizarSacola);

    // Finalizar pedido e copiar texto
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

    // Botões de contato direto WhatsApp
    document.getElementById("btn-hero-whatsapp").addEventListener("click", abrirAtendimentoGeral);
    document.getElementById("btn-wa-flutuante").addEventListener("click", abrirAtendimentoGeral);
  }

  // Inicializa tudo quando a página carrega
  document.addEventListener("DOMContentLoaded", () => {
    preencherDadosDaLoja();
    renderizarPillsCategorias();
    atualizarBadgeFavoritos();
    renderizarCatalogo();
    renderizarSacola();
    configurarEventos();
  });
})();
