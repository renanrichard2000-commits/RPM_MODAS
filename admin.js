/**
 * ============================================================================
 * PAINEL ADMINISTRATIVO EXCLUSIVO — RPM MODAS
 * ============================================================================
 * Módulos:
 * 1. Visão geral
 * 2. Adicionar / Editar produto (múltiplas fotos Storage + matriz Cor x Tamanho)
 * 3. Meus produtos (edição completa, status, exclusão com confirmação)
 * 4. Categorias
 * 5. Cores e tamanhos
 * 6. Estoque individual por Cor e Tamanho
 * 7. Configurações da loja
 *
 * Segurança: renderiza somente após confirmação no banco via is_admin()
 * e todas as gravações passam pelas políticas RLS do Supabase.
 */
(function () {
  "use strict";

  const estadoAdmin = {
    abaPainel: "visao-geral",
    buscaProdutos: "",
    filtroStatusProdutos: "todos",
    buscaEstoque: "",
    filtroEstoqueApenasBaixo: false,
    produtoEmEdicao: null, // null = novo produto, objeto = editando existente
    formImagens: [], // [{ id, file, previewUrl, imageUrl, storagePath, colorName }]
    removedStoragePaths: [],
    coresSelecionadasForm: [],
    tamanhosSelecionadosForm: [],
    mapaEstoqueForm: {}, // chave "cor__tam" -> { stockQuantity, isActive }
    categoriaEditando: null,
    corEditando: null,
    tamanhoEditando: null,
    confirmacaoExclusaoId: null
  };

  function moeda(v) {
    return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 3400);
  }

  function chaveComb(cor, tam) {
    return `${String(cor || "").trim().toLowerCase()}__${String(tam || "").trim().toLowerCase()}`;
  }

  // ==========================================================================
  // ABERTURA SEGURA E VERIFICAÇÃO DE AUTORIZAÇÃO NO BANCO
  // ==========================================================================
  async function abrirPainelAdmin(atualizarUrl = true) {
    const autorizado =
      window.RPMAuth && (await window.RPMAuth.recheckAdminPermission()) === true;

    if (!autorizado) {
      limparPainelAdmin();
      toast("Acesso restrito: área exclusiva da administração da RPM MODAS.");
      window.dispatchEvent(new CustomEvent("rpm:voltar-loja-inicio"));
      return false;
    }

    await window.RpmCatalog.loadCatalog(true);

    // Oculta páginas públicas da loja e exibe a área administrativa
    ["aba-inicio", "aba-catalogo", "aba-contato", "aba-produto"].forEach((id) => {
      const sec = document.getElementById(id);
      if (sec) sec.classList.add("hidden");
    });

    document.querySelectorAll(".tab-nav-btn, .mobile-tab-btn").forEach((b) => {
      b.classList.remove("active");
      b.removeAttribute("aria-current");
    });

    const secAdmin = document.getElementById("aba-admin");
    if (secAdmin) {
      secAdmin.classList.remove("hidden");
      renderizarEstruturaAdmin();
    }

    if (atualizarUrl) {
      try {
        window.history.pushState({ view: "admin" }, "", window.buildRpmRouteUrl("admin"));
      } catch (_) {}
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
  }

  function limparPainelAdmin() {
    const secAdmin = document.getElementById("aba-admin");
    if (secAdmin) {
      secAdmin.innerHTML = "";
      secAdmin.classList.add("hidden");
    }
  }

  // ==========================================================================
  // ESTRUTURA PRINCIPAL DO PAINEL ADMINISTRATIVO
  // ==========================================================================
  function renderizarEstruturaAdmin() {
    const secAdmin = document.getElementById("aba-admin");
    if (!secAdmin) return;

    const itensMenu = [
      { id: "visao-geral", label: "Visão geral" },
      {
        id: "adicionar-produto",
        label: estadoAdmin.produtoEmEdicao ? "Editar produto" : "Adicionar produto"
      },
      { id: "meus-produtos", label: "Meus produtos" },
      { id: "categorias", label: "Categorias" },
      { id: "cores-tamanhos", label: "Cores e tamanhos" },
      { id: "estoque", label: "Estoque" },
      { id: "configuracoes", label: "Configurações" }
    ];

    const usernameAdmin = (window.RPMAuth && window.RPMAuth.getAdminUsername()) || "Administradora";

    secAdmin.innerHTML = `
      <div class="admin-shell">
        <div class="container">
          <div class="admin-topbar-card">
            <div>
              <span class="eyebrow">GESTÃO EXCLUSIVA • ${esc(usernameAdmin)}</span>
              <h1>Painel Administrativo RPM MODAS</h1>
            </div>
            <div class="admin-topbar-actions">
              <button type="button" class="btn btn-outline" id="btn-admin-ver-loja">
                ← Ver Loja Pública
              </button>
              <button type="button" class="btn btn-primary" id="btn-admin-atalho-novo">
                + Nova Roupa
              </button>
            </div>
          </div>

          <div class="admin-layout-grid">
            <aside class="admin-sidebar" aria-label="Menu do painel administrativo">
              ${itensMenu
                .map(
                  (m) => `
                <button
                  type="button"
                  class="admin-nav-item ${estadoAdmin.abaPainel === m.id ? "active" : ""}"
                  data-admin-tab="${m.id}"
                >
                  ${esc(m.label)}
                </button>
              `
                )
                .join("")}
            </aside>

            <div class="admin-content-area" id="admin-conteudo-modulo"></div>
          </div>
        </div>
      </div>

      <!-- Modal interno de confirmação de exclusão -->
      <div class="modal-wrap hidden" id="modal-admin-confirmar-exclusao" role="dialog" aria-modal="true">
        <div class="modal-card modal-confirm-card">
          <span class="eyebrow">CONFIRMAÇÃO DE SEGURANÇA</span>
          <h3>Deseja realmente excluir este produto?</h3>
          <p class="confirm-desc" id="texto-confirmar-exclusao-prod">
            Esta ação impedirá novas compras imediatamente. Caso existam pedidos antigos vinculados, os dados históricos serão preservados com segurança.
          </p>
          <div class="confirm-actions">
            <button type="button" class="btn btn-danger btn-block" id="btn-confirmar-delete-prod">
              Sim, confirmar exclusão
            </button>
            <button type="button" class="btn btn-outline btn-block" id="btn-cancelar-delete-prod">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    `;

    secAdmin.querySelectorAll("[data-admin-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const destino = btn.getAttribute("data-admin-tab");
        if (destino === "adicionar-produto" && estadoAdmin.abaPainel !== "adicionar-produto") {
          if (!estadoAdmin.produtoEmEdicao) prepararFormularioProduto(null);
        }
        estadoAdmin.abaPainel = destino;
        renderizarEstruturaAdmin();
      });
    });

    document.getElementById("btn-admin-ver-loja").addEventListener("click", () => {
      limparPainelAdmin();
      window.dispatchEvent(new CustomEvent("rpm:voltar-loja-inicio"));
    });

    document.getElementById("btn-admin-atalho-novo").addEventListener("click", () => {
      prepararFormularioProduto(null);
      estadoAdmin.abaPainel = "adicionar-produto";
      renderizarEstruturaAdmin();
    });

    renderizarModuloAtivo();
  }

  function renderizarModuloAtivo() {
    const area = document.getElementById("admin-conteudo-modulo");
    if (!area) return;

    switch (estadoAdmin.abaPainel) {
      case "visao-geral":
        renderizarVisaoGeral(area);
        break;
      case "adicionar-produto":
        renderizarFormularioProduto(area);
        break;
      case "meus-produtos":
        renderizarMeusProdutos(area);
        break;
      case "categorias":
        renderizarCategorias(area);
        break;
      case "cores-tamanhos":
        renderizarCoresETamanhos(area);
        break;
      case "estoque":
        renderizarEstoque(area);
        break;
      case "configuracoes":
        renderizarConfiguracoes(area);
        break;
      default:
        renderizarVisaoGeral(area);
    }
  }

  // ==========================================================================
  // MÓDULO 1: VISÃO GERAL
  // ==========================================================================
  function renderizarVisaoGeral(area) {
    const produtos = window.RpmCatalog.getAllAdminProducts();
    const publicados = produtos.filter((p) => p.status === "published");
    const rascunhos = produtos.filter((p) => p.status === "draft");
    const emPromo = publicados.filter((p) => Boolean(p.precoPromocional));
    const estoqueTotal = publicados.reduce((s, p) => s + p.estoqueTotal, 0);

    const variantesCriticas = [];
    publicados.forEach((p) => {
      (p.todasVariantesAdmin || []).forEach((v) => {
        if (v.isActive && v.stockQuantity <= 2) {
          variantesCriticas.push({ produto: p.nome, prodId: p.id, ...v });
        }
      });
    });

    area.innerHTML = `
      <div class="admin-panel-card">
        <div class="admin-card-head">
          <div>
            <h2>Visão Geral da Loja</h2>
            <p>Resumo atualizado em tempo real do seu catálogo e estoque no Supabase.</p>
          </div>
        </div>

        <div class="admin-kpi-grid">
          <div class="admin-kpi-box">
            <span class="kpi-label">Roupas Publicadas</span>
            <strong class="kpi-value">${publicados.length}</strong>
          </div>
          <div class="admin-kpi-box">
            <span class="kpi-label">Em Rascunho</span>
            <strong class="kpi-value">${rascunhos.length}</strong>
          </div>
          <div class="admin-kpi-box">
            <span class="kpi-label">Em Promoção</span>
            <strong class="kpi-value">${emPromo.length}</strong>
          </div>
          <div class="admin-kpi-box">
            <span class="kpi-label">Unidades em Estoque</span>
            <strong class="kpi-value">${estoqueTotal}</strong>
          </div>
        </div>

        <div class="admin-subcard">
          <div class="admin-subcard-head">
            <h3> Atenção no Estoque (Esgotados ou até 2 unidades)</h3>
            <button type="button" class="text-btn" id="btn-ir-estoque-geral">Gerenciar todo o estoque →</button>
          </div>
          ${
            variantesCriticas.length === 0
              ? `<p class="admin-muted">Excelente! Todas as combinações ativas possuem estoque confortável.</p>`
              : `
              <div class="table-responsive">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Cor</th>
                      <th>Tamanho</th>
                      <th>Estoque</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${variantesCriticas
                      .slice(0, 10)
                      .map(
                        (vc) => `
                      <tr>
                        <td><strong>${esc(vc.produto)}</strong></td>
                        <td><span class="color-dot-inline" style="background:${esc(
                          vc.colorHex
                        )}"></span> ${esc(vc.colorName)}</td>
                        <td>${esc(vc.sizeCode)}</td>
                        <td>
                          <span class="status-pill ${
                            vc.stockQuantity === 0 ? "pill-danger" : "pill-warn"
                          }">
                            ${vc.stockQuantity === 0 ? "Esgotado (0)" : `${vc.stockQuantity} un.`}
                          </span>
                        </td>
                      </tr>
                    `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
            `
          }
        </div>
      </div>
    `;

    document.getElementById("btn-ir-estoque-geral").addEventListener("click", () => {
      estadoAdmin.abaPainel = "estoque";
      renderizarEstruturaAdmin();
    });
  }

  // ==========================================================================
  // MÓDULO 2: ADICIONAR / EDITAR PRODUTO
  // ==========================================================================
  function prepararFormularioProduto(produto) {
    estadoAdmin.produtoEmEdicao = produto || null;
    estadoAdmin.removedStoragePaths = [];

    if (!produto) {
      estadoAdmin.formImagens = [];
      const coresAtivas = window.RpmCatalog.getActiveColors();
      const tamsAtivos = window.RpmCatalog.getActiveSizes();
      estadoAdmin.coresSelecionadasForm = coresAtivas.length ? [coresAtivas[0].name] : ["Preto"];
      estadoAdmin.tamanhosSelecionadosForm = tamsAtivos
        .filter((s) => ["P", "M", "G"].includes(s.code))
        .map((s) => s.code);
      if (estadoAdmin.tamanhosSelecionadosForm.length === 0) {
        estadoAdmin.tamanhosSelecionadosForm = ["P", "M", "G"];
      }
      estadoAdmin.mapaEstoqueForm = {};
      estadoAdmin.coresSelecionadasForm.forEach((c) => {
        estadoAdmin.tamanhosSelecionadosForm.forEach((t) => {
          estadoAdmin.mapaEstoqueForm[chaveComb(c, t)] = { stockQuantity: 5, isActive: true };
        });
      });
      return;
    }

    // Preenche com dados do produto existente para edição
    estadoAdmin.formImagens = (produto.imagens || []).map((img) => ({
      id: img.id,
      file: null,
      previewUrl: img.url,
      imageUrl: img.rawUrl || img.url,
      storagePath: img.storagePath || null,
      colorName: img.colorName || ""
    }));

    const setC = new Set();
    const setT = new Set();
    estadoAdmin.mapaEstoqueForm = {};

    (produto.todasVariantesAdmin || []).forEach((v) => {
      setC.add(v.colorName);
      setT.add(v.sizeCode);
      estadoAdmin.mapaEstoqueForm[chaveComb(v.colorName, v.sizeCode)] = {
        stockQuantity: v.stockQuantity,
        isActive: v.isActive !== false
      };
    });

    estadoAdmin.coresSelecionadasForm = Array.from(setC);
    estadoAdmin.tamanhosSelecionadosForm = Array.from(setT);
  }

  function renderizarFormularioProduto(area) {
    if (
      !estadoAdmin.produtoEmEdicao &&
      estadoAdmin.coresSelecionadasForm.length === 0 &&
      Object.keys(estadoAdmin.mapaEstoqueForm).length === 0
    ) {
      prepararFormularioProduto(null);
    }

    const p = estadoAdmin.produtoEmEdicao;
    const categorias = window.RpmCatalog.getAllCategoriesAdmin();
    const coresBanco = window.RpmCatalog.getAllColorsAdmin().filter((c) => c.is_active !== false);
    const tamanhosBanco = window.RpmCatalog.getAllSizesAdmin().filter((s) => s.is_active !== false);

    // Garante que cores/tamanhos já vinculados ao produto em edição também apareçam
    const opcoesCores = [...coresBanco.map((c) => ({ name: c.name, hex: c.hex_code }))];
    estadoAdmin.coresSelecionadasForm.forEach((cn) => {
      if (!opcoesCores.some((o) => o.name.toLowerCase() === cn.toLowerCase())) {
        opcoesCores.push({ name: cn, hex: window.RpmCatalog.getColorHex(cn) });
      }
    });

    const opcoesTamanhos = [...tamanhosBanco.map((s) => s.code)];
    estadoAdmin.tamanhosSelecionadosForm.forEach((tc) => {
      if (!opcoesTamanhos.includes(tc)) opcoesTamanhos.push(tc);
    });

    area.innerHTML = `
      <div class="admin-panel-card">
        <div class="admin-card-head">
          <div>
            <h2>${p ? `Editar Roupa: ${esc(p.nome)}` : "Adicionar Produto"}</h2>
            <p>Cadastre fotos, preços, cores, tamanhos e estoque individual de cada combinação.</p>
          </div>
          ${
            p
              ? `<button type="button" class="btn btn-outline" id="btn-cancelar-edicao-prod">Cancelar edição</button>`
              : ""
          }
        </div>

        <form id="form-admin-produto" class="admin-form">
          <div class="form-row-2">
            <div class="form-group">
              <label for="prod-nome">Nome da roupa *</label>
              <input type="text" id="prod-nome" value="${esc(p ? p.nome : "")}" placeholder="Ex: Vestido Elegance Midi" required />
            </div>

            <div class="form-group">
              <label for="prod-slug">Endereço individual (slug) *</label>
              <input type="text" id="prod-slug" value="${esc(p ? p.slug : "")}" placeholder="Ex: vestido-elegance-midi" required />
              <small class="field-hint">Link da peça: /RPM_MODAS/produto/<span id="preview-slug-txt">${esc(
                p ? p.slug : "vestido-elegance"
              )}</span></small>
            </div>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label for="prod-categoria">Categoria *</label>
              <select id="prod-categoria" required>
                ${
                  categorias.length
                    ? categorias
                        .map(
                          (cat) => `
                      <option value="${esc(cat.name)}" data-cat-id="${esc(cat.id)}" ${
                            p && p.categoria === cat.name ? "selected" : ""
                          }>${esc(cat.name)}</option>
                    `
                        )
                        .join("")
                    : `<option value="Vestidos">Vestidos</option>`
                }
              </select>
            </div>

            <div class="form-group">
              <label for="prod-status">Status de publicação</label>
              <select id="prod-status">
                <option value="published" ${!p || p.status === "published" ? "selected" : ""}>Publicado (Visível na loja)</option>
                <option value="draft" ${p && p.status === "draft" ? "selected" : ""}>Rascunho (Oculto)</option>
              </select>
            </div>

            <div class="form-group">
              <label for="prod-parcelas">Condições de parcelamento</label>
              <select id="prod-parcelas">
                ${[1, 2, 3, 4, 5, 6, 10, 12]
                  .map(
                    (n) => `
                  <option value="${n}" ${(p ? p.parcelasMax : 3) === n ? "selected" : ""}>Até ${n}x sem juros</option>
                `
                  )
                  .join("")}
              </select>
            </div>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label for="prod-preco">Preço de venda (R$) *</label>
              <input type="number" id="prod-preco" step="0.01" min="0.01" value="${
                p ? p.precoVendaBase.toFixed(2) : ""
              }" placeholder="Ex: 289.90" required />
            </div>

            <div class="form-group">
              <label for="prod-promo">Preço promocional opcional (R$)</label>
              <input type="number" id="prod-promo" step="0.01" min="0" value="${
                p && p.precoPromocional ? p.precoPromocional.toFixed(2) : ""
              }" placeholder="Deixe vazio se sem promoção" />
              <small class="field-hint" id="hint-calculo-promo"></small>
            </div>

            <div class="form-group checkbox-inline-group">
              <label class="checkbox-card-label">
                <input type="checkbox" id="prod-mais-vendido" ${
                  p && p.maisVendido ? "checked" : ""
                } />
                <span>Destacar em <strong>"Roupas Mais Vendidas"</strong> na página inicial</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label for="prod-descricao">Descrição completa da roupa *</label>
            <textarea id="prod-descricao" rows="3" placeholder="Descreva o caimento, ocasiões de uso e diferenciais da peça..." required>${esc(
              p ? p.descricao : ""
            )}</textarea>
          </div>

          <div class="form-group">
            <label for="prod-tecido">Tecido, modelagem e características</label>
            <input type="text" id="prod-tecido" value="${esc(
              p ? p.tecido : ""
            )}" placeholder="Ex: 70% Viscose, 30% Linho • Forro interno e zíper invisível" />
          </div>

          <!-- GALERIA DE IMAGENS (SUPABASE STORAGE) -->
          <div class="admin-subcard">
            <div class="admin-subcard-head">
              <div>
                <h3>Fotos da Roupa (Galeria)</h3>
                <p class="admin-muted">Adicione uma ou várias fotos. Visualize antes de publicar e associe uma cor se desejar.</p>
              </div>
              <label class="btn btn-outline btn-upload-label">
                + Selecionar Fotos
                <input type="file" id="input-upload-fotos" accept="image/jpeg,image/png,image/webp" multiple class="hidden" />
              </label>
            </div>

            <div class="admin-images-preview-grid" id="grid-preview-fotos"></div>
          </div>

          <!-- CORES, TAMANHOS E ESTOQUE POR COMBINAÇÃO -->
          <div class="admin-subcard">
            <div class="admin-subcard-head">
              <div>
                <h3>Cores, Tamanhos e Estoque Individual</h3>
                <p class="admin-muted">Marque as cores e tamanhos disponíveis para controlar o estoque exato de cada combinação.</p>
              </div>
            </div>

            <div class="form-group">
              <label>1. Selecione as Cores desta roupa:</label>
              <div class="admin-check-pills" id="check-cores-prod">
                ${opcoesCores
                  .map(
                    (c) => `
                  <label class="attr-check-pill">
                    <input type="checkbox" value="${esc(c.name)}" ${
                      estadoAdmin.coresSelecionadasForm.includes(c.name) ? "checked" : ""
                    } />
                    <span class="color-dot-inline" style="background:${esc(c.hex)}"></span>
                    <span>${esc(c.name)}</span>
                  </label>
                `
                  )
                  .join("")}
              </div>
              <div class="quick-inline-create">
                <input type="text" id="nova-cor-rapida-nome" placeholder="Nova cor personalizada (ex: Vinho)" />
                <input type="color" id="nova-cor-rapida-hex" value="#8b2635" title="Escolher tom da cor" />
                <button type="button" class="btn btn-small" id="btn-criar-cor-rapida">+ Adicionar Cor</button>
              </div>
            </div>

            <div class="form-group">
              <label>2. Selecione os Tamanhos desta roupa:</label>
              <div class="admin-check-pills" id="check-tamanhos-prod">
                ${opcoesTamanhos
                  .map(
                    (tam) => `
                  <label class="attr-check-pill">
                    <input type="checkbox" value="${esc(tam)}" ${
                      estadoAdmin.tamanhosSelecionadosForm.includes(tam) ? "checked" : ""
                    } />
                    <span>${esc(tam)}</span>
                  </label>
                `
                  )
                  .join("")}
              </div>
            </div>

            <div class="variant-matrix-wrap">
              <div class="matrix-header-row">
                <h4>3. Estoque por Combinação (Cor + Tamanho)</h4>
                <span class="total-stock-pill">Estoque Total Calculado: <strong id="form-estoque-total-calc">0</strong> un.</span>
              </div>
              <div id="container-matriz-estoque"></div>
            </div>
          </div>

          <div id="admin-form-erro" class="login-erro-box hidden"></div>

          <div class="admin-form-actions">
            <button type="submit" class="btn btn-primary" id="btn-salvar-produto-admin">
              ${p ? "Salvar Alterações no Supabase" : "Publicar / Salvar Produto"}
            </button>
          </div>
        </form>
      </div>
    `;

    // Slug automático ao digitar nome (apenas se criando novo produto)
    const inputNome = document.getElementById("prod-nome");
    const inputSlug = document.getElementById("prod-slug");
    const spanSlug = document.getElementById("preview-slug-txt");

    inputNome.addEventListener("input", () => {
      if (!p) {
        inputSlug.value = window.RpmCatalog.slugify(inputNome.value);
      }
      spanSlug.textContent = inputSlug.value || "produto";
    });

    inputSlug.addEventListener("input", () => {
      inputSlug.value = window.RpmCatalog.slugify(inputSlug.value);
      spanSlug.textContent = inputSlug.value || "produto";
    });

    // Cálculo visual de desconto promocional
    const inputPreco = document.getElementById("prod-preco");
    const inputPromo = document.getElementById("prod-promo");
    const hintPromo = document.getElementById("hint-calculo-promo");
    function atualizarHintPromo() {
      const base = Number(inputPreco.value || 0);
      const promo = Number(inputPromo.value || 0);
      if (promo > 0 && base > 0) {
        if (promo >= base) {
          hintPromo.textContent = "Atenção: o preço promocional deve ser menor que o preço de venda.";
          hintPromo.style.color = "#a9442a";
        } else {
          const pct = Math.round(((base - promo) / base) * 100);
          hintPromo.textContent = `Promoção ativa: -${pct}% de desconto (${moeda(promo)})`;
          hintPromo.style.color = "#1e7b4b";
        }
      } else {
        hintPromo.textContent = "";
      }
    }
    inputPreco.addEventListener("input", atualizarHintPromo);
    inputPromo.addEventListener("input", atualizarHintPromo);
    atualizarHintPromo();

    if (p) {
      document.getElementById("btn-cancelar-edicao-prod").addEventListener("click", () => {
        prepararFormularioProduto(null);
        estadoAdmin.abaPainel = "meus-produtos";
        renderizarEstruturaAdmin();
      });
    }

    // Upload e pré-visualização de múltiplas imagens
    document.getElementById("input-upload-fotos").addEventListener("change", (e) => {
      const arquivos = Array.from(e.target.files || []);
      arquivos.forEach((arq) => {
        const previewUrl = URL.createObjectURL(arq);
        estadoAdmin.formImagens.push({
          id: null,
          file: arq,
          previewUrl,
          imageUrl: "",
          storagePath: null,
          colorName: ""
        });
      });
      e.target.value = "";
      renderizarGridPreviewFotos();
    });

    // Checkboxes de cores e tamanhos
    function sincronizarSelecaoAtributos() {
      estadoAdmin.coresSelecionadasForm = Array.from(
        document.querySelectorAll("#check-cores-prod input:checked")
      ).map((el) => el.value);

      estadoAdmin.tamanhosSelecionadosForm = Array.from(
        document.querySelectorAll("#check-tamanhos-prod input:checked")
      ).map((el) => el.value);

      estadoAdmin.coresSelecionadasForm.forEach((cor) => {
        estadoAdmin.tamanhosSelecionadosForm.forEach((tam) => {
          const k = chaveComb(cor, tam);
          if (!estadoAdmin.mapaEstoqueForm[k]) {
            estadoAdmin.mapaEstoqueForm[k] = { stockQuantity: 5, isActive: true };
          }
        });
      });

      renderizarGridPreviewFotos();
      renderizarMatrizEstoqueForm();
    }

    document
      .querySelectorAll("#check-cores-prod input, #check-tamanhos-prod input")
      .forEach((chk) => chk.addEventListener("change", sincronizarSelecaoAtributos));

    // Criar nova cor personalizada rapidamente
    document.getElementById("btn-criar-cor-rapida").addEventListener("click", async () => {
      const nomeCor = document.getElementById("nova-cor-rapida-nome").value.trim();
      const hexCor = document.getElementById("nova-cor-rapida-hex").value;
      if (!nomeCor) {
        toast("Digite o nome da nova cor.");
        return;
      }
      try {
        await window.RpmCatalog.saveColor({ name: nomeCor, hexCode: hexCor, isActive: true });
        if (!estadoAdmin.coresSelecionadasForm.includes(nomeCor)) {
          estadoAdmin.coresSelecionadasForm.push(nomeCor);
          estadoAdmin.tamanhosSelecionadosForm.forEach((tam) => {
            estadoAdmin.mapaEstoqueForm[chaveComb(nomeCor, tam)] = {
              stockQuantity: 5,
              isActive: true
            };
          });
        }
        toast(`Cor "${nomeCor}" adicionada!`);
        renderizarFormularioProduto(area);
      } catch (err) {
        toast(`Erro ao criar cor: ${err.message}`);
      }
    });

    renderizarGridPreviewFotos();
    renderizarMatrizEstoqueForm();

    // Submissão completa do produto ao Supabase
    document.getElementById("form-admin-produto").addEventListener("submit", async (e) => {
      e.preventDefault();
      const erroBox = document.getElementById("admin-form-erro");
      const btnSalvar = document.getElementById("btn-salvar-produto-admin");
      erroBox.classList.add("hidden");

      const precoVal = Number(inputPreco.value || 0);
      const promoVal = inputPromo.value ? Number(inputPromo.value) : null;

      if (promoVal !== null && promoVal >= precoVal) {
        erroBox.textContent = "O preço promocional deve ser menor do que o preço de venda.";
        erroBox.classList.remove("hidden");
        return;
      }

      if (
        estadoAdmin.coresSelecionadasForm.length === 0 ||
        estadoAdmin.tamanhosSelecionadosForm.length === 0
      ) {
        erroBox.textContent = "Selecione pelo menos uma cor e um tamanho para o produto.";
        erroBox.classList.remove("hidden");
        return;
      }

      if (estadoAdmin.formImagens.length === 0) {
        erroBox.textContent = "Adicione pelo menos uma foto para o produto antes de salvar.";
        erroBox.classList.remove("hidden");
        return;
      }

      const variantesParaSalvar = [];
      estadoAdmin.coresSelecionadasForm.forEach((cor) => {
        estadoAdmin.tamanhosSelecionadosForm.forEach((tam) => {
          const itemMapa = estadoAdmin.mapaEstoqueForm[chaveComb(cor, tam)];
          if (itemMapa && !itemMapa.removida) {
            variantesParaSalvar.push({
              colorName: cor,
              colorHex: window.RpmCatalog.getColorHex(cor),
              sizeCode: tam,
              stockQuantity: Math.max(0, Math.floor(Number(itemMapa.stockQuantity || 0))),
              isActive: itemMapa.isActive !== false
            });
          }
        });
      });

      const selectCat = document.getElementById("prod-categoria");
      const optCat = selectCat.options[selectCat.selectedIndex];

      btnSalvar.disabled = true;
      btnSalvar.textContent = "Salvando no Supabase...";

      try {
        await window.RpmCatalog.saveProduct({
          id: p ? p.id : null,
          name: inputNome.value,
          slug: inputSlug.value,
          categoryId: optCat ? optCat.getAttribute("data-cat-id") || null : null,
          categoryName: selectCat.value,
          status: document.getElementById("prod-status").value,
          installmentsMax: Number(document.getElementById("prod-parcelas").value || 3),
          price: precoVal,
          promoPrice: promoVal,
          isBestseller: document.getElementById("prod-mais-vendido").checked,
          description: document.getElementById("prod-descricao").value,
          fabricDetails: document.getElementById("prod-tecido").value,
          images: estadoAdmin.formImagens,
          removedStoragePaths: estadoAdmin.removedStoragePaths,
          variants: variantesParaSalvar
        });

        toast(p ? "✓ Produto atualizado com sucesso!" : "✓ Novo produto cadastrado com sucesso!");
        prepararFormularioProduto(null);
        estadoAdmin.abaPainel = "meus-produtos";
        renderizarEstruturaAdmin();
      } catch (err) {
        erroBox.textContent = `Não foi possível salvar no Supabase: ${err.message}`;
        erroBox.classList.remove("hidden");
        btnSalvar.disabled = false;
        btnSalvar.textContent = p ? "Salvar Alterações no Supabase" : "Publicar / Salvar Produto";
      }
    });
  }

  function renderizarGridPreviewFotos() {
    const grid = document.getElementById("grid-preview-fotos");
    if (!grid) return;

    if (estadoAdmin.formImagens.length === 0) {
      grid.innerHTML = `<p class="admin-muted">Nenhuma foto selecionada ainda. Clique em "+ Selecionar Fotos" acima para enviar imagens ao Supabase Storage.</p>`;
      return;
    }

    grid.innerHTML = estadoAdmin.formImagens
      .map(
        (img, idx) => `
      <div class="admin-img-card">
        <div class="admin-img-thumb-wrap">
          <img src="${esc(img.previewUrl)}" alt="Prévia ${idx + 1}" />
          ${idx === 0 ? `<span class="img-main-badge">Principal</span>` : ""}
        </div>
        <div class="admin-img-controls">
          <select data-img-cor="${idx}" aria-label="Associar foto a uma cor">
            <option value="">Todas as cores</option>
            ${estadoAdmin.coresSelecionadasForm
              .map(
                (cor) => `
              <option value="${esc(cor)}" ${img.colorName === cor ? "selected" : ""}>Cor: ${esc(
                  cor
                )}</option>
            `
              )
              .join("")}
          </select>
          <div class="admin-img-btns">
            ${
              idx > 0
                ? `<button type="button" class="text-btn" data-tornar-principal="${idx}">Destacar</button>`
                : `<span>Capa</span>`
            }
            <button type="button" class="text-btn danger-text" data-remover-img="${idx}">Remover</button>
          </div>
        </div>
      </div>
    `
      )
      .join("");

    grid.querySelectorAll("[data-img-cor]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const i = Number(sel.getAttribute("data-img-cor"));
        if (estadoAdmin.formImagens[i]) estadoAdmin.formImagens[i].colorName = sel.value;
      });
    });

    grid.querySelectorAll("[data-tornar-principal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-tornar-principal"));
        const [escolhida] = estadoAdmin.formImagens.splice(i, 1);
        estadoAdmin.formImagens.unshift(escolhida);
        renderizarGridPreviewFotos();
      });
    });

    grid.querySelectorAll("[data-remover-img]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-remover-img"));
        const removida = estadoAdmin.formImagens[i];
        if (removida && removida.storagePath) {
          estadoAdmin.removedStoragePaths.push(removida.storagePath);
        }
        estadoAdmin.formImagens.splice(i, 1);
        renderizarGridPreviewFotos();
      });
    });
  }

  function renderizarMatrizEstoqueForm() {
    const container = document.getElementById("container-matriz-estoque");
    const totalEl = document.getElementById("form-estoque-total-calc");
    if (!container) return;

    const linhas = [];
    let somaTotal = 0;

    estadoAdmin.coresSelecionadasForm.forEach((cor) => {
      estadoAdmin.tamanhosSelecionadosForm.forEach((tam) => {
        const k = chaveComb(cor, tam);
        const info = estadoAdmin.mapaEstoqueForm[k] || { stockQuantity: 0, isActive: true };
        if (info.removida) return;
        const qtd = Math.max(0, Math.floor(Number(info.stockQuantity || 0)));
        if (info.isActive !== false) somaTotal += qtd;
        linhas.push({ chave: k, cor, tam, qtd, isActive: info.isActive !== false });
      });
    });

    if (totalEl) totalEl.textContent = String(somaTotal);

    if (linhas.length === 0) {
      container.innerHTML = `<p class="admin-muted">Selecione ao menos uma cor e um tamanho acima para gerar a tabela de estoque.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Cor</th>
              <th>Tamanho</th>
              <th>Quantidade em Estoque</th>
              <th>Disponibilidade</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            ${linhas
              .map(
                (l) => `
              <tr>
                <td><span class="color-dot-inline" style="background:${esc(
                  window.RpmCatalog.getColorHex(l.cor)
                )}"></span> <strong>${esc(l.cor)}</strong></td>
                <td><strong>${esc(l.tam)}</strong></td>
                <td>
                  <div class="stock-stepper">
                    <button type="button" class="qty-btn" data-step-menos="${esc(l.chave)}">−</button>
                    <input type="number" min="0" step="1" value="${l.qtd}" data-input-est="${esc(
                  l.chave
                )}" class="stock-num-input" />
                    <button type="button" class="qty-btn" data-step-mais="${esc(l.chave)}">+</button>
                  </div>
                </td>
                <td>
                  <label class="inline-switch">
                    <input type="checkbox" data-toggle-comb="${esc(l.chave)}" ${
                  l.isActive ? "checked" : ""
                } />
                    <span>${l.isActive ? (l.qtd > 0 ? "Disponível" : "Esgotado (0)") : "Indisponível"}</span>
                  </label>
                </td>
                <td>
                  <button type="button" class="text-btn danger-text" data-del-comb="${esc(
                    l.chave
                  )}" title="Remover somente esta combinação">Remover</button>
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll("[data-step-menos]").forEach((b) => {
      b.addEventListener("click", () => {
        const k = b.getAttribute("data-step-menos");
        const cur = estadoAdmin.mapaEstoqueForm[k];
        if (cur) cur.stockQuantity = Math.max(0, Number(cur.stockQuantity || 0) - 1);
        renderizarMatrizEstoqueForm();
      });
    });

    container.querySelectorAll("[data-step-mais]").forEach((b) => {
      b.addEventListener("click", () => {
        const k = b.getAttribute("data-step-mais");
        const cur = estadoAdmin.mapaEstoqueForm[k];
        if (cur) cur.stockQuantity = Math.max(0, Number(cur.stockQuantity || 0) + 1);
        renderizarMatrizEstoqueForm();
      });
    });

    container.querySelectorAll("[data-input-est]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const k = inp.getAttribute("data-input-est");
        const val = Math.max(0, Math.floor(Number(inp.value || 0)));
        if (estadoAdmin.mapaEstoqueForm[k]) estadoAdmin.mapaEstoqueForm[k].stockQuantity = val;
        renderizarMatrizEstoqueForm();
      });
    });

    container.querySelectorAll("[data-toggle-comb]").forEach((chk) => {
      chk.addEventListener("change", () => {
        const k = chk.getAttribute("data-toggle-comb");
        if (estadoAdmin.mapaEstoqueForm[k]) estadoAdmin.mapaEstoqueForm[k].isActive = chk.checked;
        renderizarMatrizEstoqueForm();
      });
    });

    container.querySelectorAll("[data-del-comb]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const k = btn.getAttribute("data-del-comb");
        if (estadoAdmin.mapaEstoqueForm[k]) estadoAdmin.mapaEstoqueForm[k].removida = true;
        renderizarMatrizEstoqueForm();
      });
    });
  }

  // ==========================================================================
  // MÓDULO 3: MEUS PRODUTOS
  // ==========================================================================
  function renderizarMeusProdutos(area) {
    const todos = window.RpmCatalog.getAllAdminProducts();
    const filtrados = todos.filter((p) => {
      if (estadoAdmin.filtroStatusProdutos === "published" && p.status !== "published") return false;
      if (estadoAdmin.filtroStatusProdutos === "draft" && p.status !== "draft") return false;
      if (estadoAdmin.filtroStatusProdutos === "promo" && !p.precoPromocional) return false;
      if (estadoAdmin.filtroStatusProdutos === "sem-estoque" && p.estoqueTotal > 0) return false;
      if (estadoAdmin.buscaProdutos.trim()) {
        const q = estadoAdmin.buscaProdutos.trim().toLowerCase();
        return (
          p.nome.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)
        );
      }
      return true;
    });

    area.innerHTML = `
      <div class="admin-panel-card">
        <div class="admin-card-head">
          <div>
            <h2>Meus Produtos (${filtrados.length})</h2>
            <p>Gerencie preços, promoções, fotos, cores, tamanhos, estoque e visibilidade na loja.</p>
          </div>
          <button type="button" class="btn btn-primary" id="btn-lista-add-prod">+ Adicionar Produto</button>
        </div>

        <div class="admin-toolbar-row">
          <input type="search" id="admin-busca-meus-prods" value="${esc(
            estadoAdmin.buscaProdutos
          )}" placeholder="Buscar por nome ou categoria..." />
          <select id="admin-filtro-status-prods">
            <option value="todos" ${estadoAdmin.filtroStatusProdutos === "todos" ? "selected" : ""}>Todos os status</option>
            <option value="published" ${
              estadoAdmin.filtroStatusProdutos === "published" ? "selected" : ""
            }>Publicados</option>
            <option value="draft" ${estadoAdmin.filtroStatusProdutos === "draft" ? "selected" : ""}>Rascunhos</option>
            <option value="promo" ${estadoAdmin.filtroStatusProdutos === "promo" ? "selected" : ""}>Em promoção</option>
            <option value="sem-estoque" ${
              estadoAdmin.filtroStatusProdutos === "sem-estoque" ? "selected" : ""
            }>Esgotados</option>
          </select>
        </div>

        ${
          filtrados.length === 0
            ? `<p class="admin-muted">Nenhum produto encontrado para este filtro.</p>`
            : `
            <div class="table-responsive">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Foto</th>
                    <th>Produto / Categoria</th>
                    <th>Preços</th>
                    <th>Cores &amp; Tamanhos</th>
                    <th>Estoque Total</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtrados
                    .map(
                      (prod) => `
                    <tr>
                      <td>
                        <img src="${esc(prod.imagem)}" alt="${esc(
                        prod.nome
                      )}" class="admin-table-thumb" />
                      </td>
                      <td>
                        <strong>${esc(prod.nome)}</strong>
                        <small class="admin-cell-sub">${esc(prod.categoria)} • <button type="button" class="text-btn" data-ver-pagina-prod="${esc(
                        prod.slug
                      )}">Abrir página ↗</button></small>
                      </td>
                      <td>
                        ${
                          prod.precoPromocional
                            ? `<span class="old-price">${moeda(
                                prod.precoVendaBase
                              )}</span><br/><strong>${moeda(prod.precoPromocional)}</strong>`
                            : `<strong>${moeda(prod.precoVendaBase)}</strong>`
                        }
                      </td>
                      <td>
                        <div class="admin-cell-sub">Cores: ${esc(prod.cores.join(", ") || "—")}</div>
                        <div class="admin-cell-sub">Tam: ${esc(
                          prod.tamanhos.join(", ") || "—"
                        )}</div>
                      </td>
                      <td>
                        <span class="status-pill ${
                          prod.estoqueTotal > 0 ? "pill-ok" : "pill-danger"
                        }">${prod.estoqueTotal} un.</span>
                      </td>
                      <td>
                        <span class="status-pill ${
                          prod.status === "published" ? "pill-ok" : "pill-muted"
                        }">${prod.status === "published" ? "Publicado" : "Rascunho"}</span>
                      </td>
                      <td>
                        <div class="admin-row-actions">
                          <button type="button" class="text-btn" data-editar-prod="${esc(
                            prod.id
                          )}">Editar</button>
                          <button type="button" class="text-btn" data-toggle-status-prod="${esc(
                            prod.id
                          )}" data-atual-status="${esc(prod.status)}">
                            ${prod.status === "published" ? "Despublicar" : "Publicar"}
                          </button>
                          <button type="button" class="text-btn danger-text" data-excluir-prod="${esc(
                            prod.id
                          )}" data-nome-prod="${esc(prod.nome)}">Excluir</button>
                        </div>
                      </td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `
        }
      </div>
    `;

    document.getElementById("btn-lista-add-prod").addEventListener("click", () => {
      prepararFormularioProduto(null);
      estadoAdmin.abaPainel = "adicionar-produto";
      renderizarEstruturaAdmin();
    });

    document.getElementById("admin-busca-meus-prods").addEventListener("input", (e) => {
      estadoAdmin.buscaProdutos = e.target.value;
      renderizarMeusProdutos(area);
      const campo = document.getElementById("admin-busca-meus-prods");
      if (campo) {
        campo.focus();
        campo.setSelectionRange(campo.value.length, campo.value.length);
      }
    });

    document.getElementById("admin-filtro-status-prods").addEventListener("change", (e) => {
      estadoAdmin.filtroStatusProdutos = e.target.value;
      renderizarMeusProdutos(area);
    });

    area.querySelectorAll("[data-ver-pagina-prod]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slug = btn.getAttribute("data-ver-pagina-prod");
        limparPainelAdmin();
        window.dispatchEvent(new CustomEvent("rpm:abrir-pagina-produto", { detail: { slug } }));
      });
    });

    area.querySelectorAll("[data-editar-prod]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-editar-prod");
        const alvo = todos.find((x) => String(x.id) === String(id));
        if (alvo) {
          prepararFormularioProduto(alvo);
          estadoAdmin.abaPainel = "adicionar-produto";
          renderizarEstruturaAdmin();
        }
      });
    });

    area.querySelectorAll("[data-toggle-status-prod]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-toggle-status-prod");
        const st = btn.getAttribute("data-atual-status");
        const novo = st === "published" ? "draft" : "published";
        try {
          await window.RpmCatalog.setProductStatus(id, novo);
          toast(novo === "published" ? "Produto publicado na vitrine!" : "Produto movido para rascunho.");
          renderizarMeusProdutos(area);
        } catch (err) {
          toast(`Erro: ${err.message}`);
        }
      });
    });

    const modalDel = document.getElementById("modal-admin-confirmar-exclusao");
    area.querySelectorAll("[data-excluir-prod]").forEach((btn) => {
      btn.addEventListener("click", () => {
        estadoAdmin.confirmacaoExclusaoId = btn.getAttribute("data-excluir-prod");
        const nomeP = btn.getAttribute("data-nome-prod");
        document.getElementById(
          "texto-confirmar-exclusao-prod"
        ).textContent = `Confirma a exclusão de "${nomeP}"? A roupa deixará de aparecer na loja imediatamente.`;
        document.getElementById("backdrop").classList.remove("hidden");
        modalDel.classList.remove("hidden");
      });
    });

    const btnCancelarDel = document.getElementById("btn-cancelar-delete-prod");
    const btnConfirmarDel = document.getElementById("btn-confirmar-delete-prod");

    if (btnCancelarDel) {
      btnCancelarDel.onclick = () => {
        estadoAdmin.confirmacaoExclusaoId = null;
        modalDel.classList.add("hidden");
        document.getElementById("backdrop").classList.add("hidden");
      };
    }

    if (btnConfirmarDel) {
      btnConfirmarDel.onclick = async () => {
        if (!estadoAdmin.confirmacaoExclusaoId) return;
        btnConfirmarDel.disabled = true;
        try {
          const res = await window.RpmCatalog.deleteProduct(estadoAdmin.confirmacaoExclusaoId);
          modalDel.classList.add("hidden");
          document.getElementById("backdrop").classList.add("hidden");
          estadoAdmin.confirmacaoExclusaoId = null;
          toast(
            res.acao === "archived"
              ? "Produto arquivado (pedidos antigos preservados)!"
              : "Produto excluído com sucesso!"
          );
          renderizarMeusProdutos(area);
        } catch (err) {
          toast(`Erro ao excluir: ${err.message}`);
        } finally {
          btnConfirmarDel.disabled = false;
        }
      };
    }
  }

  // ==========================================================================
  // MÓDULO 4: CATEGORIAS
  // ==========================================================================
  function renderizarCategorias(area) {
    const categorias = window.RpmCatalog.getAllCategoriesAdmin();
    const edit = estadoAdmin.categoriaEditando;

    area.innerHTML = `
      <div class="admin-panel-card">
        <div class="admin-card-head">
          <div>
            <h2>Gerenciar Categorias</h2>
            <p>Organize as seções exibidas nos filtros do catálogo da RPM MODAS.</p>
          </div>
        </div>

        <form id="form-admin-cat" class="admin-inline-form">
          <input type="text" id="cat-nome" value="${esc(
            edit ? edit.name : ""
          )}" placeholder="Nome da categoria (ex: Macacões)" required />
          <input type="number" id="cat-ordem" value="${
            edit ? edit.display_order : categorias.length + 1
          }" min="1" style="max-width:110px" title="Ordem de exibição" />
          <button type="submit" class="btn btn-primary">${
            edit ? "Salvar Categoria" : "+ Adicionar Categoria"
          }</button>
          ${
            edit
              ? `<button type="button" class="btn btn-outline" id="btn-cancel-cat">Cancelar</button>`
              : ""
          }
        </form>

        <div class="table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Ordem</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${categorias
                .map(
                  (c) => `
                <tr>
                  <td>${c.display_order || 1}</td>
                  <td><strong>${esc(c.name)}</strong></td>
                  <td>
                    <span class="status-pill ${c.is_active !== false ? "pill-ok" : "pill-muted"}">
                      ${c.is_active !== false ? "Ativa" : "Oculta"}
                    </span>
                  </td>
                  <td>
                    <div class="admin-row-actions">
                      <button type="button" class="text-btn" data-edit-cat="${esc(c.id)}">Editar</button>
                      <button type="button" class="text-btn" data-toggle-cat="${esc(c.id)}">
                        ${c.is_active !== false ? "Ocultar" : "Ativar"}
                      </button>
                      <button type="button" class="text-btn danger-text" data-del-cat="${esc(
                        c.id
                      )}">Remover</button>
                    </div>
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById("form-admin-cat").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await window.RpmCatalog.saveCategory({
          id: edit ? edit.id : null,
          name: document.getElementById("cat-nome").value,
          displayOrder: Number(document.getElementById("cat-ordem").value || 1),
          isActive: edit ? edit.is_active !== false : true
        });
        estadoAdmin.categoriaEditando = null;
        toast("Categoria salva!");
        renderizarCategorias(area);
      } catch (err) {
        toast(`Erro: ${err.message}`);
      }
    });

    if (edit) {
      document.getElementById("btn-cancel-cat").addEventListener("click", () => {
        estadoAdmin.categoriaEditando = null;
        renderizarCategorias(area);
      });
    }

    area.querySelectorAll("[data-edit-cat]").forEach((b) => {
      b.addEventListener("click", () => {
        estadoAdmin.categoriaEditando =
          categorias.find((x) => String(x.id) === b.getAttribute("data-edit-cat")) || null;
        renderizarCategorias(area);
      });
    });

    area.querySelectorAll("[data-toggle-cat]").forEach((b) => {
      b.addEventListener("click", async () => {
        const c = categorias.find((x) => String(x.id) === b.getAttribute("data-toggle-cat"));
        if (!c) return;
        try {
          await window.RpmCatalog.saveCategory({
            id: c.id,
            name: c.name,
            displayOrder: c.display_order,
            isActive: !(c.is_active !== false)
          });
          renderizarCategorias(area);
        } catch (err) {
          toast(`Erro: ${err.message}`);
        }
      });
    });

    area.querySelectorAll("[data-del-cat]").forEach((b) => {
      b.addEventListener("click", async () => {
        try {
          await window.RpmCatalog.deleteCategory(b.getAttribute("data-del-cat"));
          toast("Categoria removida.");
          renderizarCategorias(area);
        } catch (err) {
          toast(`Erro: ${err.message}`);
        }
      });
    });
  }

  // ==========================================================================
  // MÓDULO 5: CORES E TAMANHOS
  // ==========================================================================
  function renderizarCoresETamanhos(area) {
    const cores = window.RpmCatalog.getAllColorsAdmin();
    const tamanhos = window.RpmCatalog.getAllSizesAdmin();
    const ec = estadoAdmin.corEditando;
    const et = estadoAdmin.tamanhoEditando;

    area.innerHTML = `
      <div class="admin-panel-card">
        <div class="admin-card-head">
          <div>
            <h2>Gerenciar Cores e Tamanhos</h2>
            <p>Quando uma cor ou tamanho é desativado ou removido, deixa imediatamente de aparecer como disponível para compra na loja.</p>
          </div>
        </div>

        <div class="admin-split-2">
          <!-- GERENCIAR CORES -->
          <div class="admin-subcard">
            <h3>Cores Disponíveis</h3>
            <form id="form-admin-cor" class="admin-inline-form">
              <input type="text" id="cor-nome" value="${esc(
                ec ? ec.name : ""
              )}" placeholder="Ex: Preto, Bege, Rosa..." required />
              <input type="color" id="cor-hex" value="${esc(
                ec ? ec.hex_code : "#231b16"
              )}" title="Tom visual da cor" />
              <button type="submit" class="btn btn-primary btn-small">${
                ec ? "Salvar" : "+ Cor"
              }</button>
            </form>

            <div class="table-responsive">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Cor</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${cores
                    .map(
                      (c) => `
                    <tr>
                      <td><span class="color-dot-inline" style="background:${esc(
                        c.hex_code
                      )}"></span> <strong>${esc(c.name)}</strong></td>
                      <td>
                        <span class="status-pill ${
                          c.is_active !== false ? "pill-ok" : "pill-muted"
                        }">${c.is_active !== false ? "Ativa" : "Inativa"}</span>
                      </td>
                      <td>
                        <div class="admin-row-actions">
                          <button type="button" class="text-btn" data-edit-cor="${esc(c.id)}">Editar</button>
                          <button type="button" class="text-btn" data-toggle-cor="${esc(c.id)}">
                            ${c.is_active !== false ? "Desativar" : "Ativar"}
                          </button>
                          <button type="button" class="text-btn danger-text" data-del-cor="${esc(
                            c.id
                          )}">Remover</button>
                        </div>
                      </td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>

          <!-- GERENCIAR TAMANHOS -->
          <div class="admin-subcard">
            <h3>Tamanhos Disponíveis</h3>
            <form id="form-admin-tam" class="admin-inline-form">
              <input type="text" id="tam-codigo" value="${esc(
                et ? et.code : ""
              )}" placeholder="Ex: PP, P, M, G, GG, XG, Tamanho único" required />
              <input type="number" id="tam-ordem" value="${
                et ? et.display_order : tamanhos.length + 1
              }" min="1" style="max-width:85px" title="Ordem" />
              <button type="submit" class="btn btn-primary btn-small">${
                et ? "Salvar" : "+ Tamanho"
              }</button>
            </form>

            <div class="table-responsive">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Tamanho</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${tamanhos
                    .map(
                      (s) => `
                    <tr>
                      <td><strong>${esc(s.code)}</strong></td>
                      <td>
                        <span class="status-pill ${
                          s.is_active !== false ? "pill-ok" : "pill-muted"
                        }">${s.is_active !== false ? "Ativo" : "Inativo"}</span>
                      </td>
                      <td>
                        <div class="admin-row-actions">
                          <button type="button" class="text-btn" data-edit-tam="${esc(s.id)}">Editar</button>
                          <button type="button" class="text-btn" data-toggle-tam="${esc(s.id)}">
                            ${s.is_active !== false ? "Desativar" : "Ativar"}
                          </button>
                          <button type="button" class="text-btn danger-text" data-del-tam="${esc(
                            s.id
                          )}">Remover</button>
                        </div>
                      </td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("form-admin-cor").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await window.RpmCatalog.saveColor({
          id: ec ? ec.id : null,
          name: document.getElementById("cor-nome").value,
          hexCode: document.getElementById("cor-hex").value,
          isActive: ec ? ec.is_active !== false : true,
          displayOrder: ec ? ec.display_order : cores.length + 1
        });
        estadoAdmin.corEditando = null;
        toast("Cor salva com sucesso!");
        renderizarCoresETamanhos(area);
      } catch (err) {
        toast(`Erro: ${err.message}`);
      }
    });

    document.getElementById("form-admin-tam").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await window.RpmCatalog.saveSize({
          id: et ? et.id : null,
          code: document.getElementById("tam-codigo").value,
          label: document.getElementById("tam-codigo").value,
          isActive: et ? et.is_active !== false : true,
          displayOrder: Number(document.getElementById("tam-ordem").value || 1)
        });
        estadoAdmin.tamanhoEditando = null;
        toast("Tamanho salvo com sucesso!");
        renderizarCoresETamanhos(area);
      } catch (err) {
        toast(`Erro: ${err.message}`);
      }
    });

    area.querySelectorAll("[data-edit-cor]").forEach((b) => {
      b.addEventListener("click", () => {
        estadoAdmin.corEditando =
          cores.find((x) => String(x.id) === b.getAttribute("data-edit-cor")) || null;
        renderizarCoresETamanhos(area);
      });
    });

    area.querySelectorAll("[data-toggle-cor]").forEach((b) => {
      b.addEventListener("click", async () => {
        const c = cores.find((x) => String(x.id) === b.getAttribute("data-toggle-cor"));
        if (!c) return;
        try {
          await window.RpmCatalog.saveColor({
            id: c.id,
            name: c.name,
            hexCode: c.hex_code,
            isActive: !(c.is_active !== false),
            displayOrder: c.display_order
          });
          toast("Disponibilidade da cor atualizada!");
          renderizarCoresETamanhos(area);
        } catch (err) {
          toast(`Erro: ${err.message}`);
        }
      });
    });

    area.querySelectorAll("[data-del-cor]").forEach((b) => {
      b.addEventListener("click", async () => {
        try {
          await window.RpmCatalog.deleteColor(b.getAttribute("data-del-cor"));
          toast("Cor removida!");
          renderizarCoresETamanhos(area);
        } catch (err) {
          toast(`Erro: ${err.message}`);
        }
      });
    });

    area.querySelectorAll("[data-edit-tam]").forEach((b) => {
      b.addEventListener("click", () => {
        estadoAdmin.tamanhoEditando =
          tamanhos.find((x) => String(x.id) === b.getAttribute("data-edit-tam")) || null;
        renderizarCoresETamanhos(area);
      });
    });

    area.querySelectorAll("[data-toggle-tam]").forEach((b) => {
      b.addEventListener("click", async () => {
        const s = tamanhos.find((x) => String(x.id) === b.getAttribute("data-toggle-tam"));
        if (!s) return;
        try {
          await window.RpmCatalog.saveSize({
            id: s.id,
            code: s.code,
            label: s.label,
            isActive: !(s.is_active !== false),
            displayOrder: s.display_order
          });
          toast("Disponibilidade do tamanho atualizada!");
          renderizarCoresETamanhos(area);
        } catch (err) {
          toast(`Erro: ${err.message}`);
        }
      });
    });

    area.querySelectorAll("[data-del-tam]").forEach((b) => {
      b.addEventListener("click", async () => {
        try {
          await window.RpmCatalog.deleteSize(b.getAttribute("data-del-tam"));
          toast("Tamanho removido!");
          renderizarCoresETamanhos(area);
        } catch (err) {
          toast(`Erro: ${err.message}`);
        }
      });
    });
  }

  // ==========================================================================
  // MÓDULO 6: CONTROLE DE ESTOQUE POR COR E TAMANHO
  // ==========================================================================
  function renderizarEstoque(area) {
    const produtos = window.RpmCatalog.getAllAdminProducts();
    const linhas = [];

    produtos.forEach((p) => {
      (p.todasVariantesAdmin || []).forEach((v) => {
        if (estadoAdmin.filtroEstoqueApenasBaixo && v.stockQuantity > 2) return;
        if (estadoAdmin.buscaEstoque.trim()) {
          const q = estadoAdmin.buscaEstoque.trim().toLowerCase();
          const txt = `${p.nome} ${v.colorName} ${v.sizeCode}`.toLowerCase();
          if (!txt.includes(q)) return;
        }
        linhas.push({
          produtoId: p.id,
          produtoNome: p.nome,
          estoqueTotalProduto: p.estoqueTotal,
          ...v
        });
      });
    });

    area.innerHTML = `
      <div class="admin-panel-card">
        <div class="admin-card-head">
          <div>
            <h2>Controle de Estoque por Cor e Tamanho</h2>
            <p>Ajuste quantidades individualmente. Combinações zeradas aparecem automaticamente como esgotadas na loja.</p>
          </div>
        </div>

        <div class="admin-toolbar-row">
          <input type="search" id="busca-estoque-input" value="${esc(
            estadoAdmin.buscaEstoque
          )}" placeholder="Filtrar por roupa, cor ou tamanho..." />
          <label class="checkbox-card-label">
            <input type="checkbox" id="chk-estoque-critico" ${
              estadoAdmin.filtroEstoqueApenasBaixo ? "checked" : ""
            } />
            <span>Mostrar apenas esgotados / baixo estoque (≤ 2)</span>
          </label>
        </div>

        <div class="table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Roupa</th>
                <th>Cor</th>
                <th>Tamanho</th>
                <th>Estoque Individual</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${linhas
                .map(
                  (l) => `
                <tr>
                  <td>
                    <strong>${esc(l.produtoNome)}</strong>
                    <small class="admin-cell-sub">Total da peça: ${l.estoqueTotalProduto} un.</small>
                  </td>
                  <td><span class="color-dot-inline" style="background:${esc(
                    l.colorHex
                  )}"></span> ${esc(l.colorName)}</td>
                  <td><strong>${esc(l.sizeCode)}</strong></td>
                  <td>
                    <div class="stock-stepper">
                      <button type="button" class="qty-btn" data-est-delta="-1" data-var-id="${esc(
                        l.id
                      )}" data-cur-qtd="${l.stockQuantity}" data-cur-act="${l.isActive}">−</button>
                      <input type="number" min="0" step="1" value="${
                        l.stockQuantity
                      }" class="stock-num-input" data-est-input-id="${esc(
                    l.id
                  )}" data-cur-act="${l.isActive}" />
                      <button type="button" class="qty-btn" data-est-delta="1" data-var-id="${esc(
                        l.id
                      )}" data-cur-qtd="${l.stockQuantity}" data-cur-act="${l.isActive}">+</button>
                    </div>
                  </td>
                  <td>
                    <span class="status-pill ${
                      !l.isActive
                        ? "pill-muted"
                        : l.stockQuantity > 0
                        ? "pill-ok"
                        : "pill-danger"
                    }">
                      ${
                        !l.isActive
                          ? "Inativa"
                          : l.stockQuantity > 0
                          ? `Disponível (${l.stockQuantity})`
                          : "Esgotada (0)"
                      }
                    </span>
                  </td>
                  <td>
                    <div class="admin-row-actions">
                      <button type="button" class="text-btn" data-toggle-var-ativa="${esc(
                        l.id
                      )}" data-cur-qtd="${l.stockQuantity}" data-cur-act="${l.isActive}">
                        ${l.isActive ? "Desativar" : "Ativar"}
                      </button>
                      <button type="button" class="text-btn danger-text" data-remover-var-unica="${esc(
                        l.id
                      )}">Remover</button>
                    </div>
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById("busca-estoque-input").addEventListener("input", (e) => {
      estadoAdmin.buscaEstoque = e.target.value;
      renderizarEstoque(area);
      const el = document.getElementById("busca-estoque-input");
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });

    document.getElementById("chk-estoque-critico").addEventListener("change", (e) => {
      estadoAdmin.filtroEstoqueApenasBaixo = e.target.checked;
      renderizarEstoque(area);
    });

    area.querySelectorAll("[data-est-delta]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const varId = btn.getAttribute("data-var-id");
        const delta = Number(btn.getAttribute("data-est-delta"));
        const atual = Number(btn.getAttribute("data-cur-qtd") || 0);
        const ativa = btn.getAttribute("data-cur-act") !== "false";
        const nova = Math.max(0, atual + delta);
        try {
          await window.RpmCatalog.updateVariantStock(varId, nova, ativa);
          renderizarEstoque(area);
        } catch (err) {
          toast(`Erro ao atualizar estoque: ${err.message}`);
        }
      });
    });

    area.querySelectorAll("[data-est-input-id]").forEach((inp) => {
      inp.addEventListener("change", async () => {
        const varId = inp.getAttribute("data-est-input-id");
        const ativa = inp.getAttribute("data-cur-act") !== "false";
        const nova = Math.max(0, Math.floor(Number(inp.value || 0)));
        try {
          await window.RpmCatalog.updateVariantStock(varId, nova, ativa);
          toast("Estoque atualizado!");
          renderizarEstoque(area);
        } catch (err) {
          toast(`Erro: ${err.message}`);
        }
      });
    });

    area.querySelectorAll("[data-toggle-var-ativa]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const varId = btn.getAttribute("data-toggle-var-ativa");
        const qtd = Number(btn.getAttribute("data-cur-qtd") || 0);
        const ativa = btn.getAttribute("data-cur-act") !== "false";
        try {
          await window.RpmCatalog.updateVariantStock(varId, qtd, !ativa);
          renderizarEstoque(area);
        } catch (err) {
          toast(`Erro: ${err.message}`);
        }
      });
    });

    area.querySelectorAll("[data-remover-var-unica]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await window.RpmCatalog.deleteSingleVariant(
            btn.getAttribute("data-remover-var-unica")
          );
          toast("Combinação removida!");
          renderizarEstoque(area);
        } catch (err) {
          toast(`Erro: ${err.message}`);
        }
      });
    });
  }

  // ==========================================================================
  // MÓDULO 7: CONFIGURAÇÕES DA LOJA
  // ==========================================================================
  function renderizarConfiguracoes(area) {
    area.innerHTML = `
      <div class="admin-panel-card">
        <div class="admin-card-head">
          <div>
            <h2>Configurações da RPM MODAS</h2>
            <p>Atualize WhatsApp, Instagram, condições de PIX/parcelamento e textos de apresentação.</p>
          </div>
        </div>

        <form id="form-admin-config" class="admin-form">
          <div class="form-row-2">
            <div class="form-group">
              <label for="cfg-wa-num">WhatsApp (somente números com DDI 55 + DDD)</label>
              <input type="text" id="cfg-wa-num" value="${esc(DADOS_LOJA.whatsapp)}" required />
            </div>
            <div class="form-group">
              <label for="cfg-wa-txt">WhatsApp para exibição</label>
              <input type="text" id="cfg-wa-txt" value="${esc(
                DADOS_LOJA.whatsappExibicao
              )}" required />
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label for="cfg-insta">Usuário do Instagram</label>
              <input type="text" id="cfg-insta" value="${esc(DADOS_LOJA.instagram)}" required />
            </div>
            <div class="form-group">
              <label for="cfg-insta-url">Link do Instagram</label>
              <input type="url" id="cfg-insta-url" value="${esc(
                DADOS_LOJA.urlInstagram
              )}" required />
            </div>
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label for="cfg-frete">Frete Grátis acima de (R$)</label>
              <input type="number" step="0.01" min="0" id="cfg-frete" value="${
                DADOS_LOJA.freteGratisAcimaDe
              }" />
            </div>
            <div class="form-group">
              <label for="cfg-pix">Desconto no PIX (%)</label>
              <input type="number" step="1" min="0" max="50" id="cfg-pix" value="${
                DADOS_LOJA.descontoPixPercentual
              }" />
            </div>
            <div class="form-group">
              <label for="cfg-parcelas">Parcelas padrão sem juros</label>
              <input type="number" step="1" min="1" max="12" id="cfg-parcelas" value="${
                DADOS_LOJA.parcelasSemJuros
              }" />
            </div>
          </div>

          <div class="form-group">
            <label for="cfg-horario">Horário de atendimento</label>
            <input type="text" id="cfg-horario" value="${esc(
              DADOS_LOJA.horarioAtendimento
            )}" />
          </div>

          <button type="submit" class="btn btn-primary" id="btn-salvar-cfg">
            Salvar Configurações
          </button>
        </form>
      </div>
    `;

    document.getElementById("form-admin-config").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-salvar-cfg");
      btn.disabled = true;
      try {
        await window.RpmCatalog.saveSettings({
          store_name: DADOS_LOJA.nomeLoja,
          store_subtitle: DADOS_LOJA.subtituloLogo,
          whatsapp: document.getElementById("cfg-wa-num").value.replace(/\D/g, ""),
          whatsapp_display: document.getElementById("cfg-wa-txt").value.trim(),
          instagram: document.getElementById("cfg-insta").value.trim(),
          instagram_url: document.getElementById("cfg-insta-url").value.trim(),
          free_shipping_min: Number(document.getElementById("cfg-frete").value || 0),
          pix_discount_percent: Number(document.getElementById("cfg-pix").value || 0),
          default_installments: Number(document.getElementById("cfg-parcelas").value || 3),
          opening_hours: document.getElementById("cfg-horario").value.trim()
        });
        toast("✓ Configurações salvas e atualizadas na loja!");
      } catch (err) {
        toast(`Erro ao salvar configurações: ${err.message}`);
      } finally {
        btn.disabled = false;
      }
    });
  }

  window.addEventListener("rpm:abrir-painel-admin", () => abrirPainelAdmin(true));
  window.addEventListener("rpm:usuario-deslogado", limparPainelAdmin);

  window.RPMAdmin = Object.freeze({
    openPanel: abrirPainelAdmin,
    closePanel: limparPainelAdmin
  });
})();
