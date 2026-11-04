/**
 * ============================================================================
 * RPM MODAS — MODO ADM AVANÇADO: EDITOR VISUAL COMPLETO DO SITE (FASE 2)
 * Descrição: Personalize completamente o visual e o conteúdo da RPM MODAS.
 * ============================================================================
 * Todos os controles estão conectados ao serviço window.RPMCms (Fase 1):
 * - Rascunhos salvos isoladamente em public.site_cms_drafts
 * - Pré-visualização real Desktop e Mobile sem afetar visitantes
 * - Publicação atômica com ponto de restauração em public.site_cms_versions
 * - Biblioteca de Mídia integrada ao Supabase Storage (bucket site-media)
 */
(function () {
  "use strict";

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clonar(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function mostrarToastEditor(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(mostrarToastEditor._t);
    mostrarToastEditor._t = setTimeout(() => el.classList.add("hidden"), 3600);
  }

  const IMAGENS_ACERVO_PADRAO = [
    { title: "Banner Principal Coleção", url: "hero-colecao.jpg", category: "Banners" },
    { title: "Vestido Midi Linho", url: "vestido-midi-linho.jpg", category: "Coleções" },
    { title: "Conjunto Alfaiataria", url: "conjunto-alfaiataria.jpg", category: "Coleções" },
    { title: "Vestido Cetim", url: "vestido-cetim.jpg", category: "Coleções" },
    { title: "Blazer Estruturado", url: "blazer-estruturado.jpg", category: "Coleções" },
    { title: "Macacão Pantalona", url: "macacao-pantalona.jpg", category: "Coleções" },
    { title: "Conjunto Tricot", url: "conjunto-tricot.jpg", category: "Coleções" }
  ];

  const DESTINOS_SUGERIDOS = [
    { label: "Catálogo Completo", value: "aba:catalogo" },
    { label: "Página Inicial", value: "aba:inicio" },
    { label: "Página de Contato", value: "aba:contato" },
    { label: "Peças em Promoção", value: "filtro:promocao" },
    { label: "Página: Sobre Nós", value: "pagina:sobre-nos" },
    { label: "Página: Informações de Entrega", value: "pagina:entrega" },
    { label: "Página: Trocas e Devoluções", value: "pagina:trocas-devolucoes" },
    { label: "Página: Políticas da Loja", value: "pagina:politicas" }
  ];

  const MAPA_CAMPOS_CORES = [
    { key: "primary", label: "Cor Principal (Identidade)" },
    { key: "secondary", label: "Cor Secundária (Fundos Suaves)" },
    { key: "accent", label: "Cor de Destaque (Terracota / Selos)" },
    { key: "accentDark", label: "Cor de Destaque Escura (Hover)" },
    { key: "buttonBg", label: "Fundo dos Botões Principais" },
    { key: "buttonText", label: "Texto dos Botões Principais" },
    { key: "headingColor", label: "Cor dos Títulos" },
    { key: "textColor", label: "Cor dos Textos Secundários" },
    { key: "pageBg", label: "Fundo Geral da Página" },
    { key: "surfaceBg", label: "Fundo de Painéis / Superfícies" },
    { key: "menuBg", label: "Fundo do Cabeçalho / Menu" },
    { key: "menuText", label: "Texto do Menu" },
    { key: "cardBg", label: "Fundo dos Cards de Produtos" },
    { key: "borderColor", label: "Cor das Bordas e Divisórias" },
    { key: "iconColor", label: "Cor dos Ícones" },
    { key: "priceColor", label: "Cor dos Preços" },
    { key: "promoColor", label: "Cor de Ofertas e Promoções" },
    { key: "topbarBg", label: "Fundo da Barra de Avisos (Topo)" },
    { key: "topbarText", label: "Texto da Barra de Avisos (Topo)" },
    { key: "footerBg", label: "Fundo do Rodapé" },
    { key: "footerText", label: "Texto do Rodapé" }
  ];

  const estadoEditor = {
    inicializado: false,
    carregando: false,
    salvando: false,
    alteracoesNaoSalvas: false,
    abaAtiva: "banners", // banners | secoes | midia | textos | cores | fontes | cabecalho | paginas | historico
    secaoExpandidaId: "sec-bestsellers",
    paginaInternaSelecionada: "sobre-nos",
    filtroMidiaCat: "Todas",
    buscaMidia: "",
    resumoPublicacao: "",
    rascunho: null,
    bibliotecaMidia: [],
    historicoVersoes: [],
    erroAvisoBanco: ""
  };

  function marcarModificado() {
    estadoEditor.alteracoesNaoSalvas = true;
    atualizarIndicadoresTopo();
  }

  function atualizarIndicadoresTopo() {
    const badgeStatus = document.getElementById("cms-status-badge");
    if (!badgeStatus) return;
    if (estadoEditor.alteracoesNaoSalvas) {
      badgeStatus.className = "cms-badge unsaved";
      badgeStatus.textContent = "● Alterações em edição (não publicadas)";
    } else {
      badgeStatus.className = "cms-badge published";
      badgeStatus.textContent = "✓ Rascunho sincronizado";
    }
  }

  // ==========================================================================
  // SELETOR MODAL DE IMAGENS DA BIBLIOTECA (PARA BANNERS, LOGO, SEÇÕES, PÁGINAS)
  // ==========================================================================
  async function abrirModalEscolherImagem(aoEscolher) {
    let listaDb = estadoEditor.bibliotecaMidia;
    try {
      listaDb = await window.RPMCms.listMedia();
      estadoEditor.bibliotecaMidia = listaDb;
    } catch (_) {}

    const overlay = document.createElement("div");
    overlay.className = "modal-wrap";
    overlay.style.zIndex = "1100";

    const opcoesCombinadas = [
      ...listaDb.map((m) => ({
        title: m.title,
        url: m.image_url,
        alt: m.alt_text || m.title,
        category: m.category || "Enviadas"
      })),
      ...IMAGENS_ACERVO_PADRAO.map((p) => ({
        title: p.title,
        url: p.url,
        alt: p.title,
        category: p.category
      }))
    ];

    overlay.innerHTML = `
      <div class="modal-card" style="max-width:860px;width:95%;max-height:86vh;overflow-y:auto;padding:1.6rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
          <div>
            <span class="eyebrow">BIBLIOTECA DE MÍDIA RPM MODAS</span>
            <h3 style="margin:0;">Selecionar ou Enviar Imagem</h3>
          </div>
          <button type="button" class="icon-btn" id="btn-fechar-picker-midia">✕</button>
        </div>

        <div style="padding:1rem;background:var(--surface-soft);border-radius:var(--radius-sm);margin-bottom:1.2rem;display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">
          <input type="file" id="picker-upload-file" accept="image/jpeg,image/png,image/webp,image/gif" />
          <input type="text" id="picker-upload-alt" placeholder="Texto alternativo (alt) opcional" style="flex:1;min-width:180px;padding:0.48rem 0.7rem;border:1px solid var(--border);border-radius:6px;" />
          <button type="button" class="btn btn-primary btn-sm" id="btn-picker-enviar-usar">Enviar & Usar Agora</button>
        </div>

        <div class="cms-media-grid">
          ${opcoesCombinadas
            .map((item, idx) => {
              const srcResolvida = window.resolveRpmAssetUrl
                ? window.resolveRpmAssetUrl(item.url)
                : item.url;
              return `
                <div class="cms-media-card">
                  <div class="cms-media-thumb">
                    <img src="${esc(srcResolvida)}" alt="${esc(item.alt)}" style="object-fit:cover;" />
                  </div>
                  <div class="cms-media-body">
                    <strong>${esc(item.title)}</strong>
                    <span style="color:var(--ink-soft);font-size:0.72rem;">${esc(item.category)}</span>
                    <button type="button" class="btn btn-primary btn-sm" data-pick-idx="${idx}">Escolher esta foto</button>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector("#btn-fechar-picker-midia").addEventListener("click", () => {
      overlay.remove();
    });

    overlay.querySelectorAll("[data-pick-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const escolhido = opcoesCombinadas[Number(btn.getAttribute("data-pick-idx"))];
        overlay.remove();
        if (escolhido && aoEscolher) aoEscolher(escolhido);
      });
    });

    overlay.querySelector("#btn-picker-enviar-usar").addEventListener("click", async (ev) => {
      const fileInput = overlay.querySelector("#picker-upload-file");
      const altInput = overlay.querySelector("#picker-upload-alt");
      const arq = fileInput.files && fileInput.files[0];
      if (!arq) {
        mostrarToastEditor("Selecione uma imagem do seu dispositivo primeiro.");
        return;
      }
      const btn = ev.currentTarget;
      btn.disabled = true;
      btn.textContent = "Enviando...";
      try {
        const salvo = await window.RPMCms.uploadMedia(arq, {
          title: arq.name.replace(/\.[^.]+$/, ""),
          category: "Banners",
          alt_text: altInput.value.trim()
        });
        estadoEditor.bibliotecaMidia.unshift(salvo);
        overlay.remove();
        mostrarToastEditor("✓ Imagem enviada para a biblioteca!");
        if (aoEscolher) {
          aoEscolher({
            title: salvo.title,
            url: salvo.image_url,
            alt: salvo.alt_text || salvo.title
          });
        }
      } catch (err) {
        mostrarToastEditor("Erro no upload: " + err.message);
        btn.disabled = false;
        btn.textContent = "Enviar & Usar Agora";
      }
    });
  }

  // ==========================================================================
  // RENDERIZADORES DAS 9 SUB-ABAS DO MODO ADM AVANÇADO
  // ==========================================================================

  // 1. ABA BANNERS DA HOME
  function renderAbaBanners(container) {
    const banners = estadoEditor.rascunho.banners_config || [];

    container.innerHTML = `
      <div class="cms-panel-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:0.75rem;">
          <div>
            <h3>Editor de Banners Principais (Página Inicial)</h3>
            <p class="cms-panel-hint" style="margin-bottom:0;">
              Adicione um ou múltiplos banners rotativos, troque fotos, textos, cores, alinhamentos, altura e botões.
            </p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" id="btn-cms-add-banner">
            + Adicionar Novo Banner
          </button>
        </div>

        <div id="lista-banners-editor">
          ${banners
            .map((b, idx) => {
              const previewImg = window.resolveRpmAssetUrl
                ? window.resolveRpmAssetUrl(b.imageUrl || "hero-colecao.jpg")
                : b.imageUrl;
              return `
                <div class="cms-section-item" data-banner-index="${idx}">
                  <div class="cms-section-item-head">
                    <div class="cms-section-item-title">
                      <span>🖼️ <strong>Banner ${idx + 1}:</strong> ${esc(
                b.title || "Sem título"
              )}</span>
                      <span class="cms-badge">${b.visible !== false ? "Visível" : "Oculto"}</span>
                    </div>
                    <div class="cms-section-item-controls">
                      <button type="button" class="cms-icon-action" data-ban-up="${idx}" ${
                idx === 0 ? "disabled" : ""
              }>↑ Subir</button>
                      <button type="button" class="cms-icon-action" data-ban-down="${idx}" ${
                idx === banners.length - 1 ? "disabled" : ""
              }>↓ Descer</button>
                      <button type="button" class="cms-icon-action" data-ban-toggle="${idx}">
                        ${b.visible !== false ? "🙈 Ocultar" : "👁️ Mostrar"}
                      </button>
                      <button type="button" class="cms-icon-action danger" data-ban-del="${idx}" ${
                banners.length <= 1 ? "disabled" : ""
              }>🗑 Excluir</button>
                    </div>
                  </div>

                  <div class="cms-section-item-body">
                    <div class="cms-grid-2" style="margin-bottom:1rem;">
                      <div>
                        <label class="admin-label">Foto do Banner</label>
                        <div style="display:flex;gap:0.65rem;align-items:center;margin-bottom:0.55rem;">
                          <img src="${esc(previewImg)}" alt="" style="width:96px;height:68px;object-fit:${esc(
                b.objectFit || "cover"
              )};object-position:${esc(
                b.objectPosition || "50% 18%"
              )};border-radius:6px;border:1px solid var(--border);" />
                          <div style="flex:1;display:flex;flex-direction:column;gap:0.4rem;">
                            <input type="text" class="admin-input" data-ban-field="imageUrl" data-idx="${idx}" value="${esc(
                b.imageUrl
              )}" placeholder="URL ou caminho da imagem" />
                            <button type="button" class="btn btn-outline btn-sm" data-ban-pick-img="${idx}">
                              📁 Escolher da Biblioteca / Enviar Foto
                            </button>
                          </div>
                        </div>
                        <label class="admin-label">Texto Alternativo da Imagem (alt)</label>
                        <input type="text" class="admin-input" data-ban-field="imageAlt" data-idx="${idx}" value="${esc(
                b.imageAlt || ""
              )}" />
                      </div>

                      <div class="cms-grid-2">
                        <div>
                          <label class="admin-label">Ajuste (object-fit)</label>
                          <select class="admin-input" data-ban-field="objectFit" data-idx="${idx}">
                            <option value="cover" ${b.objectFit === "cover" ? "selected" : ""}>Preencher (cover)</option>
                            <option value="contain" ${b.objectFit === "contain" ? "selected" : ""}>Ajustar inteira (contain)</option>
                            <option value="fill" ${b.objectFit === "fill" ? "selected" : ""}>Esticar (fill)</option>
                          </select>
                        </div>
                        <div>
                          <label class="admin-label">Enquadramento / Foco</label>
                          <select class="admin-input" data-ban-field="objectPosition" data-idx="${idx}">
                            <option value="50% 18%" ${b.objectPosition === "50% 18%" ? "selected" : ""}>Topo suave (Rosto/Look)</option>
                            <option value="center top" ${b.objectPosition === "center top" ? "selected" : ""}>Topo central</option>
                            <option value="center center" ${b.objectPosition === "center center" ? "selected" : ""}>Centro exato</option>
                            <option value="center bottom" ${b.objectPosition === "center bottom" ? "selected" : ""}>Base central</option>
                            <option value="left center" ${b.objectPosition === "left center" ? "selected" : ""}>Esquerda</option>
                            <option value="right center" ${b.objectPosition === "right center" ? "selected" : ""}>Direita</option>
                          </select>
                        </div>
                        <div>
                          <label class="admin-label">Zoom da Foto (%)</label>
                          <input type="number" min="80" max="150" class="admin-input" data-ban-field="imageScale" data-idx="${idx}" value="${Number(
                b.imageScale || 100
              )}" />
                        </div>
                        <div>
                          <label class="admin-label">Altura Mínima (px)</label>
                          <input type="number" min="300" max="800" step="10" class="admin-input" data-ban-field="minHeight" data-idx="${idx}" value="${Number(
                b.minHeight || 540
              )}" />
                        </div>
                      </div>
                    </div>

                    <div class="cms-grid-2" style="margin-bottom:1rem;">
                      <div>
                        <label class="admin-label">Selo Superior (Eyebrow)</label>
                        <input type="text" class="admin-input" data-ban-field="eyebrow" data-idx="${idx}" value="${esc(
                b.eyebrow || ""
              )}" />
                      </div>
                      <div>
                        <label class="admin-label">Título Principal do Banner</label>
                        <input type="text" class="admin-input" data-ban-field="title" data-idx="${idx}" value="${esc(
                b.title || ""
              )}" />
                      </div>
                    </div>

                    <div style="margin-bottom:1rem;">
                      <label class="admin-label">Subtítulo / Descrição</label>
                      <textarea rows="2" class="admin-input" data-ban-field="description" data-idx="${idx}">${esc(
                b.description || ""
              )}</textarea>
                    </div>

                    <div class="cms-grid-2" style="margin-bottom:1rem;">
                      <div class="cms-grid-2">
                        <div>
                          <label class="admin-label">Texto Botão 1</label>
                          <input type="text" class="admin-input" data-ban-field="primaryBtnText" data-idx="${idx}" value="${esc(
                b.primaryBtnText || ""
              )}" />
                        </div>
                        <div>
                          <label class="admin-label">Link / Destino Botão 1</label>
                          <input type="text" list="cms-destinos-datalist" class="admin-input" data-ban-field="primaryBtnLink" data-idx="${idx}" value="${esc(
                b.primaryBtnLink || "aba:catalogo"
              )}" />
                        </div>
                      </div>
                      <div class="cms-grid-2">
                        <div>
                          <label class="admin-label">Texto Botão 2</label>
                          <input type="text" class="admin-input" data-ban-field="secondaryBtnText" data-idx="${idx}" value="${esc(
                b.secondaryBtnText || ""
              )}" />
                        </div>
                        <div>
                          <label class="admin-label">Link / Destino Botão 2</label>
                          <input type="text" list="cms-destinos-datalist" class="admin-input" data-ban-field="secondaryBtnLink" data-idx="${idx}" value="${esc(
                b.secondaryBtnLink || "aba:contato"
              )}" />
                        </div>
                      </div>
                    </div>

                    <div class="cms-grid-3">
                      <div>
                        <label class="admin-label">Posição do Card no Banner</label>
                        <select class="admin-input" data-ban-field="contentPosition" data-idx="${idx}">
                          <option value="left" ${b.contentPosition === "left" ? "selected" : ""}>Esquerda</option>
                          <option value="center" ${b.contentPosition === "center" ? "selected" : ""}>Centro</option>
                          <option value="right" ${b.contentPosition === "right" ? "selected" : ""}>Direita</option>
                        </select>
                      </div>
                      <div>
                        <label class="admin-label">Alinhamento do Texto</label>
                        <select class="admin-input" data-ban-field="textAlign" data-idx="${idx}">
                          <option value="left" ${b.textAlign === "left" ? "selected" : ""}>À Esquerda</option>
                          <option value="center" ${b.textAlign === "center" ? "selected" : ""}>Centralizado</option>
                          <option value="right" ${b.textAlign === "right" ? "selected" : ""}>À Direita</option>
                        </select>
                      </div>
                      <div>
                        <label class="admin-label">Largura da Seção</label>
                        <select class="admin-input" data-ban-field="sectionWidth" data-idx="${idx}">
                          <option value="full" ${b.sectionWidth !== "contained" ? "selected" : ""}>Largura Total (Full)</option>
                          <option value="contained" ${b.sectionWidth === "contained" ? "selected" : ""}>Centralizada (Container)</option>
                        </select>
                      </div>
                      <div>
                        <label class="admin-label">Cor de Fundo do Card</label>
                        <input type="color" class="admin-input" style="height:40px;padding:3px;" data-ban-field="cardBg" data-idx="${idx}" value="${esc(
                /^#[0-9a-fA-F]{6}$/.test(b.cardBg || "") ? b.cardBg : "#faf7f2"
              )}" />
                      </div>
                      <div>
                        <label class="admin-label">Cor do Texto do Card</label>
                        <input type="color" class="admin-input" style="height:40px;padding:3px;" data-ban-field="textColor" data-idx="${idx}" value="${esc(
                /^#[0-9a-fA-F]{6}$/.test(b.textColor || "") ? b.textColor : "#231b16"
              )}" />
                      </div>
                      <div>
                        <label class="admin-label">Espaçamento Vertical (px)</label>
                        <input type="number" min="20" max="140" class="admin-input" data-ban-field="paddingY" data-idx="${idx}" value="${Number(
                b.paddingY ?? 56
              )}" />
                      </div>
                    </div>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;

    container.querySelector("#btn-cms-add-banner").addEventListener("click", () => {
      const padrao = window.RPMCms.getFactoryDefaults().banners_config[0];
      banners.push({
        ...clonar(padrao),
        id: `banner-${Date.now()}`,
        title: "Nova Coleção Exclusiva RPM MODAS"
      });
      marcarModificado();
      renderAbaBanners(container);
    });

    container.querySelectorAll("[data-ban-field]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const idx = Number(inp.getAttribute("data-idx"));
        const campo = inp.getAttribute("data-ban-field");
        let val = inp.value;
        if (["imageScale", "minHeight", "paddingY", "cardOpacity"].includes(campo)) {
          val = Number(val);
        }
        banners[idx][campo] = val;
        marcarModificado();
      });
    });

    container.querySelectorAll("[data-ban-pick-img]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-ban-pick-img"));
        abrirModalEscolherImagem((item) => {
          banners[idx].imageUrl = item.url;
          if (!banners[idx].imageAlt && item.alt) banners[idx].imageAlt = item.alt;
          marcarModificado();
          renderAbaBanners(container);
        });
      });
    });

    container.querySelectorAll("[data-ban-up]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-ban-up"));
        if (i > 0) {
          [banners[i - 1], banners[i]] = [banners[i], banners[i - 1]];
          marcarModificado();
          renderAbaBanners(container);
        }
      });
    });

    container.querySelectorAll("[data-ban-down]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-ban-down"));
        if (i < banners.length - 1) {
          [banners[i + 1], banners[i]] = [banners[i], banners[i + 1]];
          marcarModificado();
          renderAbaBanners(container);
        }
      });
    });

    container.querySelectorAll("[data-ban-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-ban-toggle"));
        banners[i].visible = banners[i].visible === false;
        marcarModificado();
        renderAbaBanners(container);
      });
    });

    container.querySelectorAll("[data-ban-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-ban-del"));
        if (banners.length <= 1) return;
        banners.splice(i, 1);
        marcarModificado();
        renderAbaBanners(container);
      });
    });
  }

  // 2. ABA SEÇÕES & LAYOUT DA HOME
  function renderAbaSecoesLayout(container) {
    const secoes = estadoEditor.rascunho.sections_config || [];
    const categoriasReais =
      window.RpmCatalog && window.RpmCatalog.getActiveCategories
        ? window.RpmCatalog.getActiveCategories()
        : [];

    const idsNativosFixos = new Set([
      "sec-hero",
      "sec-search",
      "sec-bestsellers",
      "sec-promotions",
      "sec-novidades",
      "sec-featured-categories",
      "sec-collections",
      "sec-recommended",
      "sec-about-home",
      "sec-shipping-info"
    ]);

    container.innerHTML = `
      <div class="cms-panel-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
          <div>
            <h3>Gerenciador de Seções, Posicionamento e Layout da Home</h3>
            <p class="cms-panel-hint" style="margin-bottom:0;">
              Mova seções para cima ou para baixo, oculte/mostre, duplique, adicione novas vitrines conectadas aos produtos reais ou restaure o layout padrão.
            </p>
          </div>
          <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
            <button type="button" class="btn btn-primary btn-sm" id="btn-add-sec-produtos">+ Vitrine de Produtos</button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-sec-banner">+ Destaque com Foto</button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-add-sec-texto">+ Bloco de Texto</button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-reset-layout-secoes">↺ Restaurar Layout Original</button>
          </div>
        </div>

        <div id="lista-secoes-home">
          ${secoes
            .map((sec, idx) => {
              const expandida = estadoEditor.secaoExpandidaId === sec.id;
              const ehCustom = !idsNativosFixos.has(sec.id);

              return `
                <div class="cms-section-item" data-sec-id="${esc(sec.id)}">
                  <div class="cms-section-item-head">
                    <div class="cms-section-item-title">
                      <span>#${idx + 1}</span>
                      <strong>${esc(sec.label || sec.title || sec.type)}</strong>
                      <span class="cms-badge">${sec.visible !== false ? "Visível" : "Oculta"}</span>
                    </div>

                    <div class="cms-section-item-controls">
                      <button type="button" class="cms-icon-action" data-sec-up="${idx}" ${
                idx === 0 ? "disabled" : ""
              } title="Mover seção para cima">↑</button>
                      <button type="button" class="cms-icon-action" data-sec-down="${idx}" ${
                idx === secoes.length - 1 ? "disabled" : ""
              } title="Mover seção para baixo">↓</button>
                      <button type="button" class="cms-icon-action" data-sec-vis="${idx}">
                        ${sec.visible !== false ? "🙈 Ocultar" : "👁️ Mostrar"}
                      </button>
                      ${
                        sec.type !== "hero"
                          ? `<button type="button" class="cms-icon-action" data-sec-dup="${idx}">⧉ Duplicar</button>`
                          : ""
                      }
                      <button type="button" class="cms-icon-action" data-sec-expand="${esc(sec.id)}">
                        ${expandida ? "▲ Fechar Ajustes" : "⚙️ Editar Seção"}
                      </button>
                      ${
                        ehCustom
                          ? `<button type="button" class="cms-icon-action danger" data-sec-del="${idx}">🗑 Excluir</button>`
                          : ""
                      }
                    </div>
                  </div>

                  ${
                    expandida
                      ? `
                    <div class="cms-section-item-body">
                      ${
                        sec.type === "hero"
                          ? `<p style="font-size:0.86rem;color:var(--ink-soft);margin-bottom:0.8rem;">O conteúdo interno dos slides do Banner Principal é editado na aba <strong>Banners & Home</strong>. Abaixo você ajusta a margem e a largura geral da seção:</p>`
                          : `
                        <div class="cms-grid-2" style="margin-bottom:0.9rem;">
                          <div>
                            <label class="admin-label">Nome Interno no Painel</label>
                            <input type="text" class="admin-input" data-sec-field="label" data-idx="${idx}" value="${esc(
                              sec.label || ""
                            )}" />
                          </div>
                          <div>
                            <label class="admin-label">Selo Superior (Eyebrow)</label>
                            <input type="text" class="admin-input" data-sec-field="eyebrow" data-idx="${idx}" value="${esc(
                              sec.eyebrow || ""
                            )}" />
                          </div>
                          <div>
                            <label class="admin-label">Título da Seção</label>
                            <input type="text" class="admin-input" data-sec-field="title" data-idx="${idx}" value="${esc(
                              sec.title || ""
                            )}" />
                          </div>
                          <div>
                            <label class="admin-label">Subtítulo / Texto</label>
                            <input type="text" class="admin-input" data-sec-field="subtitle" data-idx="${idx}" value="${esc(
                              sec.subtitle || ""
                            )}" />
                          </div>
                        </div>
                      `
                      }

                      ${
                        sec.type === "products"
                          ? `
                        <div class="cms-grid-3" style="margin-bottom:0.9rem;">
                          <div>
                            <label class="admin-label">Origem dos Produtos (Catálogo Real)</label>
                            <select class="admin-input" data-sec-field="source" data-idx="${idx}">
                              <option value="bestsellers" ${sec.source === "bestsellers" ? "selected" : ""}>Mais Vendidas</option>
                              <option value="promotions" ${sec.source === "promotions" ? "selected" : ""}>Ofertas / Em Promoção</option>
                              <option value="newest" ${sec.source === "newest" ? "selected" : ""}>Novidades Recentes</option>
                              <option value="recommended" ${sec.source === "recommended" ? "selected" : ""}>Produtos Recomendados</option>
                              ${categoriasReais
                                .map(
                                  (c) =>
                                    `<option value="cat:${esc(c.name)}" ${
                                      sec.source === `cat:${c.name}` ? "selected" : ""
                                    }>Categoria: ${esc(c.name)}</option>`
                                )
                                .join("")}
                            </select>
                          </div>
                          <div>
                            <label class="admin-label">Quantidade de Cards Exibidos</label>
                            <input type="number" min="1" max="16" class="admin-input" data-sec-field="limit" data-idx="${idx}" value="${Number(
                              sec.limit || 4
                            )}" />
                          </div>
                          <div>
                            <label class="admin-label">Texto do Link de Ação</label>
                            <input type="text" class="admin-input" data-sec-field="ctaText" data-idx="${idx}" value="${esc(
                              sec.ctaText || ""
                            )}" />
                          </div>
                        </div>
                      `
                          : ""
                      }

                      ${
                        ["collection_banner", "about_block", "custom_banner"].includes(sec.type)
                          ? `
                        <div class="cms-grid-3" style="margin-bottom:0.9rem;">
                          <div>
                            <label class="admin-label">Imagem da Seção</label>
                            <div style="display:flex;gap:0.4rem;">
                              <input type="text" class="admin-input" data-sec-field="imageUrl" data-idx="${idx}" value="${esc(
                              sec.imageUrl || ""
                            )}" />
                              <button type="button" class="btn btn-outline btn-sm" data-sec-pick-img="${idx}">📁</button>
                            </div>
                          </div>
                          <div>
                            <label class="admin-label">Texto do Botão</label>
                            <input type="text" class="admin-input" data-sec-field="ctaText" data-idx="${idx}" value="${esc(
                              sec.ctaText || ""
                            )}" />
                          </div>
                          <div>
                            <label class="admin-label">Destino do Botão</label>
                            <input type="text" list="cms-destinos-datalist" class="admin-input" data-sec-field="ctaLink" data-idx="${idx}" value="${esc(
                              sec.ctaLink || "aba:catalogo"
                            )}" />
                          </div>
                        </div>
                      `
                          : ""
                      }

                      <div class="cms-grid-3">
                        <div>
                          <label class="admin-label">Espaçamento Interno Vertical (px)</label>
                          <input type="number" min="0" max="140" class="admin-input" data-sec-field="paddingY" data-idx="${idx}" value="${Number(
                        sec.paddingY ?? 48
                      )}" />
                        </div>
                        <div>
                          <label class="admin-label">Margem Inferior (px)</label>
                          <input type="number" min="0" max="120" class="admin-input" data-sec-field="marginBottom" data-idx="${idx}" value="${Number(
                        sec.marginBottom ?? 0
                      )}" />
                        </div>
                        <div>
                          <label class="admin-label">Alinhamento</label>
                          <select class="admin-input" data-sec-field="alignment" data-idx="${idx}">
                            <option value="left" ${sec.alignment === "left" ? "selected" : ""}>Esquerda</option>
                            <option value="center" ${sec.alignment === "center" ? "selected" : ""}>Centralizado</option>
                            <option value="right" ${sec.alignment === "right" ? "selected" : ""}>Direita</option>
                          </select>
                        </div>
                        <div>
                          <label class="admin-label">Largura da Seção</label>
                          <select class="admin-input" data-sec-field="sectionWidth" data-idx="${idx}">
                            <option value="contained" ${sec.sectionWidth !== "full" ? "selected" : ""}>Container Centralizado</option>
                            <option value="full" ${sec.sectionWidth === "full" ? "selected" : ""}>Largura Total</option>
                          </select>
                        </div>
                        <div>
                          <label class="admin-label">Cor de Fundo Específica (opcional)</label>
                          <input type="text" class="admin-input" placeholder="#f3ece2 ou vazio" data-sec-field="bgColor" data-idx="${idx}" value="${esc(
                        sec.bgColor || ""
                      )}" />
                        </div>
                        <div>
                          <label class="admin-label">Cor do Texto Específica (opcional)</label>
                          <input type="text" class="admin-input" placeholder="#231b16 ou vazio" data-sec-field="textColor" data-idx="${idx}" value="${esc(
                        sec.textColor || ""
                      )}" />
                        </div>
                      </div>
                    </div>
                  `
                      : ""
                  }
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;

    container.querySelector("#btn-add-sec-produtos").addEventListener("click", () => {
      const novaId = `sec-custom-prod-${Date.now()}`;
      secoes.push({
        id: novaId,
        type: "products",
        source: "newest",
        label: "Nova Vitrine de Produtos",
        visible: true,
        eyebrow: "SELEÇÃO ESPECIAL",
        title: "Nova Vitrine RPM MODAS",
        subtitle: "",
        ctaText: "Ver todo o catálogo →",
        ctaLink: "aba:catalogo",
        limit: 4,
        bgColor: "",
        textColor: "",
        paddingY: 52,
        marginBottom: 0,
        sectionWidth: "contained",
        alignment: "left"
      });
      estadoEditor.secaoExpandidaId = novaId;
      marcarModificado();
      renderAbaSecoesLayout(container);
    });

    container.querySelector("#btn-add-sec-banner").addEventListener("click", () => {
      const novaId = `sec-custom-ban-${Date.now()}`;
      secoes.push({
        id: novaId,
        type: "custom_banner",
        label: "Novo Destaque com Foto",
        visible: true,
        eyebrow: "DESTAQUE EXCLUSIVO",
        title: "Elegância em Cada Detalhe",
        subtitle: "Confira nossa seleção especial com envio rápido para todo o Brasil.",
        imageUrl: "vestido-cetim.jpg",
        imageAlt: "Destaque RPM MODAS",
        objectFit: "cover",
        objectPosition: "50% 25%",
        minHeight: 350,
        ctaText: "Conferir Peças",
        ctaLink: "aba:catalogo",
        bgColor: "#f3ece2",
        textColor: "#231b16",
        paddingY: 48,
        marginBottom: 0,
        sectionWidth: "contained",
        alignment: "left"
      });
      estadoEditor.secaoExpandidaId = novaId;
      marcarModificado();
      renderAbaSecoesLayout(container);
    });

    container.querySelector("#btn-add-sec-texto").addEventListener("click", () => {
      const novaId = `sec-custom-txt-${Date.now()}`;
      secoes.push({
        id: novaId,
        type: "custom_text",
        label: "Bloco Institucional",
        visible: true,
        eyebrow: "COMUNICADO RPM MODAS",
        title: "Atendimento Personalizado",
        subtitle: "Nossa consultoria ajuda você a escolher o caimento ideal pelo WhatsApp.",
        ctaText: "Falar com a Equipe",
        ctaLink: "aba:contato",
        bgColor: "",
        textColor: "",
        paddingY: 44,
        marginBottom: 0,
        sectionWidth: "contained",
        alignment: "center"
      });
      estadoEditor.secaoExpandidaId = novaId;
      marcarModificado();
      renderAbaSecoesLayout(container);
    });

    container.querySelector("#btn-reset-layout-secoes").addEventListener("click", () => {
      estadoEditor.rascunho.sections_config = clonar(
        window.RPMCms.getFactoryDefaults().sections_config
      );
      marcarModificado();
      mostrarToastEditor("✓ Ordem e layout original das seções restaurados no rascunho!");
      renderAbaSecoesLayout(container);
    });

    container.querySelectorAll("[data-sec-up]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-sec-up"));
        if (i > 0) {
          [secoes[i - 1], secoes[i]] = [secoes[i], secoes[i - 1]];
          marcarModificado();
          renderAbaSecoesLayout(container);
        }
      });
    });

    container.querySelectorAll("[data-sec-down]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-sec-down"));
        if (i < secoes.length - 1) {
          [secoes[i + 1], secoes[i]] = [secoes[i], secoes[i + 1]];
          marcarModificado();
          renderAbaSecoesLayout(container);
        }
      });
    });

    container.querySelectorAll("[data-sec-vis]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-sec-vis"));
        secoes[i].visible = secoes[i].visible === false;
        marcarModificado();
        renderAbaSecoesLayout(container);
      });
    });

    container.querySelectorAll("[data-sec-dup]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-sec-dup"));
        const copia = clonar(secoes[i]);
        copia.id = `sec-dup-${Date.now()}`;
        copia.label = `${copia.label || copia.title} (Cópia)`;
        copia.visible = true;
        secoes.splice(i + 1, 0, copia);
        estadoEditor.secaoExpandidaId = copia.id;
        marcarModificado();
        renderAbaSecoesLayout(container);
      });
    });

    container.querySelectorAll("[data-sec-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-sec-del"));
        secoes.splice(i, 1);
        marcarModificado();
        renderAbaSecoesLayout(container);
      });
    });

    container.querySelectorAll("[data-sec-expand]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idAlvo = btn.getAttribute("data-sec-expand");
        estadoEditor.secaoExpandidaId = estadoEditor.secaoExpandidaId === idAlvo ? "" : idAlvo;
        renderAbaSecoesLayout(container);
      });
    });

    container.querySelectorAll("[data-sec-field]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const idx = Number(inp.getAttribute("data-idx"));
        const campo = inp.getAttribute("data-sec-field");
        let val = inp.value;
        if (["limit", "paddingY", "marginBottom", "minHeight"].includes(campo)) val = Number(val);
        secoes[idx][campo] = val;
        marcarModificado();
      });
    });

    container.querySelectorAll("[data-sec-pick-img]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-sec-pick-img"));
        abrirModalEscolherImagem((item) => {
          secoes[idx].imageUrl = item.url;
          secoes[idx].imageAlt = item.alt || secoes[idx].title;
          marcarModificado();
          renderAbaSecoesLayout(container);
        });
      });
    });
  }

  // 3. ABA BIBLIOTECA DE IMAGENS E FOTOS (SUPABASE STORAGE)
  function renderAbaBibliotecaMidia(container) {
    const categorias = ["Todas", "Banners", "Coleções", "Sobre Nós", "Logos", "Geral"];
    const filtradas = (estadoEditor.bibliotecaMidia || []).filter((item) => {
      const okCat =
        estadoEditor.filtroMidiaCat === "Todas" || item.category === estadoEditor.filtroMidiaCat;
      const q = estadoEditor.buscaMidia.trim().toLowerCase();
      const okBusca =
        !q ||
        String(item.title || "")
          .toLowerCase()
          .includes(q) ||
        String(item.alt_text || "")
          .toLowerCase()
          .includes(q);
      return okCat && okBusca;
    });

    container.innerHTML = `
      <div class="cms-panel-card">
        <h3>Biblioteca de Imagens e Fotos (Supabase Storage)</h3>
        <p class="cms-panel-hint">
          Envie novas imagens (JPG, PNG, WEBP ou GIF até 8 MB), organize por categorias, ajuste enquadramento/alt ou substitua fotos. Imagens em uso no site publicado, rascunho ou histórico são protegidas contra exclusão.
        </p>

        <form id="form-cms-upload-midia" class="cms-grid-3" style="padding:1rem;background:var(--surface-soft);border-radius:var(--radius-sm);margin-bottom:1.25rem;align-items:end;">
          <div>
            <label class="admin-label">Arquivo de Imagem *</label>
            <input type="file" id="cms-midia-file" accept="image/jpeg,image/png,image/webp,image/gif" class="admin-input" required />
          </div>
          <div>
            <label class="admin-label">Título da Foto</label>
            <input type="text" id="cms-midia-title" class="admin-input" placeholder="Ex: Banner Inverno" />
          </div>
          <div>
            <label class="admin-label">Categoria</label>
            <select id="cms-midia-cat" class="admin-input">
              <option value="Banners">Banners</option>
              <option value="Coleções">Coleções</option>
              <option value="Sobre Nós">Sobre Nós</option>
              <option value="Logos">Logos</option>
              <option value="Geral">Geral</option>
            </select>
          </div>
          <div style="grid-column:span 2;">
            <label class="admin-label">Texto Alternativo (alt — acessibilidade e SEO)</label>
            <input type="text" id="cms-midia-alt" class="admin-input" placeholder="Ex: Modelo usando vestido midi de linho off-white" />
          </div>
          <div>
            <button type="submit" class="btn btn-primary btn-block" id="btn-submit-upload-midia">
              ⬆️ Enviar para Biblioteca
            </button>
          </div>
        </form>

        <div style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem;">
          <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
            ${categorias
              .map(
                (c) =>
                  `<button type="button" class="cms-subtab-btn ${
                    estadoEditor.filtroMidiaCat === c ? "active" : ""
                  }" data-midia-cat-filter="${esc(c)}">${esc(c)}</button>`
              )
              .join("")}
          </div>
          <input type="search" id="cms-busca-midia" class="admin-input" style="max-width:260px;" placeholder="Buscar foto..." value="${esc(
            estadoEditor.buscaMidia
          )}" />
        </div>

        ${
          filtradas.length === 0
            ? `<div style="padding:1.4rem;border:1px dashed var(--border);border-radius:var(--radius-sm);text-align:center;color:var(--ink-soft);margin-bottom:1.25rem;">Nenhuma foto enviada nesta categoria ainda. Envie acima ou utilize as fotos do acervo abaixo.</div>`
            : `
          <div class="cms-media-grid" style="margin-bottom:1.5rem;">
            ${filtradas
              .map(
                (m, idx) => `
              <div class="cms-media-card">
                <div class="cms-media-thumb">
                  <img src="${esc(m.image_url)}" alt="${esc(m.alt_text || m.title)}" style="object-fit:${esc(
                  m.object_fit || "cover"
                )};object-position:${esc(m.object_position || "50% 50%")};transform:scale(${
                  Number(m.scale_percent || 100) / 100
                });" />
                </div>
                <div class="cms-media-body">
                  <input type="text" class="admin-input" data-m-title="${idx}" value="${esc(
                  m.title
                )}" title="Título" />
                  <input type="text" class="admin-input" data-m-alt="${idx}" value="${esc(
                  m.alt_text || ""
                )}" placeholder="Texto alt" />
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.35rem;">
                    <select class="admin-input" data-m-fit="${idx}">
                      <option value="cover" ${m.object_fit === "cover" ? "selected" : ""}>Cover</option>
                      <option value="contain" ${m.object_fit === "contain" ? "selected" : ""}>Contain</option>
                      <option value="fill" ${m.object_fit === "fill" ? "selected" : ""}>Fill</option>
                    </select>
                    <input type="text" class="admin-input" data-m-pos="${idx}" value="${esc(
                  m.object_position || "50% 50%"
                )}" title="Posição ex: 50% 25%" />
                  </div>
                  <label style="font-size:0.72rem;color:var(--ink-soft);">Substituir arquivo (opcional):</label>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-m-replace="${idx}" style="font-size:0.72rem;" />
                  <div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.25rem;">
                    <button type="button" class="cms-icon-action" data-m-save="${idx}">💾 Salvar</button>
                    <button type="button" class="cms-icon-action" data-m-use-banner="${idx}">Aplicar no Banner</button>
                    <button type="button" class="cms-icon-action danger" data-m-del="${idx}">🗑 Excluir</button>
                  </div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        `
        }

        <h4 style="margin-bottom:0.65rem;">Fotos Nativas do Acervo RPM MODAS</h4>
        <div class="cms-media-grid">
          ${IMAGENS_ACERVO_PADRAO.map((p) => {
            const urlRes = window.resolveRpmAssetUrl ? window.resolveRpmAssetUrl(p.url) : p.url;
            return `
              <div class="cms-media-card">
                <div class="cms-media-thumb">
                  <img src="${esc(urlRes)}" alt="${esc(p.title)}" style="object-fit:cover;" />
                </div>
                <div class="cms-media-body">
                  <strong>${esc(p.title)}</strong>
                  <button type="button" class="cms-icon-action" data-native-use-banner="${esc(
                    p.url
                  )}">Usar no Banner Principal</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    container.querySelector("#form-cms-upload-midia").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileEl = container.querySelector("#cms-midia-file");
      const arq = fileEl.files && fileEl.files[0];
      if (!arq) return;

      const btn = container.querySelector("#btn-submit-upload-midia");
      btn.disabled = true;
      btn.textContent = "Enviando...";
      try {
        const salvo = await window.RPMCms.uploadMedia(arq, {
          title: container.querySelector("#cms-midia-title").value.trim(),
          category: container.querySelector("#cms-midia-cat").value,
          alt_text: container.querySelector("#cms-midia-alt").value.trim()
        });
        estadoEditor.bibliotecaMidia.unshift(salvo);
        mostrarToastEditor("✓ Imagem enviada para o Supabase Storage!");
        renderAbaBibliotecaMidia(container);
      } catch (err) {
        mostrarToastEditor("Não foi possível enviar: " + err.message);
        btn.disabled = false;
        btn.textContent = "⬆️ Enviar para Biblioteca";
      }
    });

    container.querySelectorAll("[data-midia-cat-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        estadoEditor.filtroMidiaCat = btn.getAttribute("data-midia-cat-filter");
        renderAbaBibliotecaMidia(container);
      });
    });

    container.querySelector("#cms-busca-midia").addEventListener("input", (e) => {
      estadoEditor.buscaMidia = e.target.value;
      renderAbaBibliotecaMidia(container);
    });

    container.querySelectorAll("[data-m-save]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const idx = Number(btn.getAttribute("data-m-save"));
        const item = filtradas[idx];
        const repFile = container.querySelector(`[data-m-replace="${idx}"]`)?.files?.[0] || null;
        btn.disabled = true;
        try {
          const atualizado = await window.RPMCms.updateMedia(
            item.id,
            {
              title: container.querySelector(`[data-m-title="${idx}"]`).value,
              category: item.category || "Geral",
              alt_text: container.querySelector(`[data-m-alt="${idx}"]`).value,
              object_fit: container.querySelector(`[data-m-fit="${idx}"]`).value,
              object_position: container.querySelector(`[data-m-pos="${idx}"]`).value,
              scale_percent: item.scale_percent || 100
            },
            repFile
          );
          const posOrig = estadoEditor.bibliotecaMidia.findIndex((x) => x.id === item.id);
          if (posOrig >= 0) estadoEditor.bibliotecaMidia[posOrig] = atualizado;
          mostrarToastEditor("✓ Dados da imagem atualizados!");
          renderAbaBibliotecaMidia(container);
        } catch (err) {
          mostrarToastEditor("Erro: " + err.message);
          btn.disabled = false;
        }
      });
    });

    container.querySelectorAll("[data-m-use-banner]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = filtradas[Number(btn.getAttribute("data-m-use-banner"))];
        if (estadoEditor.rascunho.banners_config[0]) {
          estadoEditor.rascunho.banners_config[0].imageUrl = item.image_url;
          estadoEditor.rascunho.banners_config[0].imageAlt = item.alt_text || item.title;
          estadoEditor.rascunho.banners_config[0].objectFit = item.object_fit || "cover";
          estadoEditor.rascunho.banners_config[0].objectPosition =
            item.object_position || "50% 18%";
          marcarModificado();
          mostrarToastEditor("✓ Foto aplicada ao Banner Principal no rascunho!");
        }
      });
    });

    container.querySelectorAll("[data-native-use-banner]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-native-use-banner");
        if (estadoEditor.rascunho.banners_config[0]) {
          estadoEditor.rascunho.banners_config[0].imageUrl = url;
          marcarModificado();
          mostrarToastEditor("✓ Foto aplicada ao Banner Principal no rascunho!");
        }
      });
    });

    container.querySelectorAll("[data-m-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const item = filtradas[Number(btn.getAttribute("data-m-del"))];
        btn.disabled = true;
        try {
          await window.RPMCms.deleteMedia(item, estadoEditor.rascunho);
          estadoEditor.bibliotecaMidia = estadoEditor.bibliotecaMidia.filter(
            (x) => x.id !== item.id
          );
          mostrarToastEditor("✓ Imagem removida da biblioteca.");
          renderAbaBibliotecaMidia(container);
        } catch (err) {
          mostrarToastEditor(err.message);
          btn.disabled = false;
        }
      });
    });
  }

  // 4. ABA TEXTOS & COPY GERAL
  function renderAbaTextos(container) {
    const tx = estadoEditor.rascunho.texts_config;
    if (!Array.isArray(tx.customTextBlocks)) tx.customTextBlocks = [];

    container.innerHTML = `
      <div class="cms-panel-card">
        <h3>Editor de Textos Gerais e Mensagens da Loja</h3>
        <p class="cms-panel-hint">
          Edite textos de boas-vindas, sacola, campos de pesquisa e crie blocos de texto adicionais na página inicial. (Todos os textos passam por proteção automática contra scripts maliciosos.)
        </p>

        <div class="cms-grid-2" style="margin-bottom:1.25rem;">
          <div>
            <label class="admin-label">Título de Boas-Vindas (Janela Entrar)</label>
            <input type="text" class="admin-input" data-tx-field="welcomeModalTitle" value="${esc(
              tx.welcomeModalTitle || ""
            )}" />
          </div>
          <div>
            <label class="admin-label">Título da Gaveta da Sacola</label>
            <input type="text" class="admin-input" data-tx-field="bagDrawerTitle" value="${esc(
              tx.bagDrawerTitle || ""
            )}" />
          </div>
          <div>
            <label class="admin-label">Texto de Busca do Catálogo (Placeholder)</label>
            <input type="text" class="admin-input" data-tx-field="searchPlaceholderCatalog" value="${esc(
              tx.searchPlaceholderCatalog || ""
            )}" />
          </div>
          <div>
            <label class="admin-label">Frase Promocional de Destaque</label>
            <input type="text" class="admin-input" data-tx-field="promoHighlightMessage" value="${esc(
              tx.promoHighlightMessage || ""
            )}" />
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;">
          <h4 style="margin:0;">Blocos de Texto Extras na Página Inicial</h4>
          <button type="button" class="btn btn-primary btn-sm" id="btn-add-custom-txt-block">
            + Adicionar Bloco de Texto
          </button>
        </div>

        ${
          tx.customTextBlocks.length === 0
            ? `<p style="font-size:0.84rem;color:var(--ink-soft);">Nenhum bloco extra adicionado. Clique em "+ Adicionar Bloco de Texto" caso queira exibir avisos ou textos especiais na Home.</p>`
            : tx.customTextBlocks
                .map(
                  (bl, idx) => `
              <div class="cms-section-item">
                <div class="cms-section-item-head">
                  <strong>Bloco #${idx + 1}: ${esc(bl.title || "Texto")}</strong>
                  <div class="cms-section-item-controls">
                    <button type="button" class="cms-icon-action" data-cbl-toggle="${idx}">
                      ${bl.visible !== false ? "🙈 Ocultar" : "👁️ Mostrar"}
                    </button>
                    <button type="button" class="cms-icon-action danger" data-cbl-del="${idx}">🗑 Excluir</button>
                  </div>
                </div>
                <div class="cms-section-item-body cms-grid-2">
                  <div>
                    <label class="admin-label">Selo Superior</label>
                    <input type="text" class="admin-input" data-cbl-field="eyebrow" data-idx="${idx}" value="${esc(
                    bl.eyebrow || ""
                  )}" />
                  </div>
                  <div>
                    <label class="admin-label">Título</label>
                    <input type="text" class="admin-input" data-cbl-field="title" data-idx="${idx}" value="${esc(
                    bl.title || ""
                  )}" />
                  </div>
                  <div style="grid-column:1/-1;">
                    <label class="admin-label">Conteúdo do Texto</label>
                    <textarea rows="3" class="admin-input" data-cbl-field="body" data-idx="${idx}">${esc(
                    bl.body || ""
                  )}</textarea>
                  </div>
                </div>
              </div>
            `
                )
                .join("")
        }
      </div>
    `;

    container.querySelectorAll("[data-tx-field]").forEach((inp) => {
      inp.addEventListener("input", () => {
        tx[inp.getAttribute("data-tx-field")] = inp.value;
        marcarModificado();
      });
    });

    container.querySelector("#btn-add-custom-txt-block").addEventListener("click", () => {
      tx.customTextBlocks.push({
        id: `txt-${Date.now()}`,
        eyebrow: "DESTAQUE RPM MODAS",
        title: "Novo Comunicado",
        body: "Confira nossas condições especiais da semana.",
        align: "center",
        visible: true
      });
      marcarModificado();
      renderAbaTextos(container);
    });

    container.querySelectorAll("[data-cbl-field]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const idx = Number(inp.getAttribute("data-idx"));
        tx.customTextBlocks[idx][inp.getAttribute("data-cbl-field")] = inp.value;
        marcarModificado();
      });
    });

    container.querySelectorAll("[data-cbl-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-cbl-toggle"));
        tx.customTextBlocks[idx].visible = tx.customTextBlocks[idx].visible === false;
        marcarModificado();
        renderAbaTextos(container);
      });
    });

    container.querySelectorAll("[data-cbl-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        tx.customTextBlocks.splice(Number(btn.getAttribute("data-cbl-del")), 1);
        marcarModificado();
        renderAbaTextos(container);
      });
    });
  }

  // 5. ABA PERSONALIZAÇÃO COMPLETA DE CORES
  function renderAbaCores(container) {
    const cores = estadoEditor.rascunho.theme_config.colors;

    container.innerHTML = `
      <div class="cms-panel-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
          <div>
            <h3>Personalização Completa de Cores</h3>
            <p class="cms-panel-hint" style="margin-bottom:0;">
              Utilize o seletor visual de cor ou digite o código HEX manualmente. Você pode restaurar a paleta original a qualquer momento.
            </p>
          </div>
          <button type="button" class="btn btn-outline btn-sm" id="btn-restaurar-cores-padrao">
            ↺ Restaurar Cores Padrão
          </button>
        </div>

        <div class="cms-grid-3">
          ${MAPA_CAMPOS_CORES.map((item) => {
            const valAtual = /^#[0-9a-fA-F]{6}$/.test(cores[item.key] || "")
              ? cores[item.key]
              : "#231b16";
            return `
              <div class="cms-color-field">
                <label>${esc(item.label)}</label>
                <div class="cms-color-inputs">
                  <input type="color" data-color-picker="${esc(item.key)}" value="${esc(valAtual)}" />
                  <input type="text" maxlength="9" data-color-hex="${esc(item.key)}" value="${esc(
              cores[item.key] || valAtual
            )}" />
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    container.querySelector("#btn-restaurar-cores-padrao").addEventListener("click", () => {
      estadoEditor.rascunho.theme_config.colors = clonar(
        window.RPMCms.getFactoryDefaults().theme_config.colors
      );
      marcarModificado();
      mostrarToastEditor("✓ Cores originais restauradas no rascunho!");
      renderAbaCores(container);
    });

    container.querySelectorAll("[data-color-picker]").forEach((picker) => {
      picker.addEventListener("input", () => {
        const key = picker.getAttribute("data-color-picker");
        cores[key] = picker.value;
        const hexInput = container.querySelector(`[data-color-hex="${key}"]`);
        if (hexInput) hexInput.value = picker.value;
        marcarModificado();
      });
    });

    container.querySelectorAll("[data-color-hex]").forEach((hexInput) => {
      hexInput.addEventListener("input", () => {
        const key = hexInput.getAttribute("data-color-hex");
        const limpo = hexInput.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(limpo)) {
          cores[key] = limpo;
          const picker = container.querySelector(`[data-color-picker="${key}"]`);
          if (picker) picker.value = limpo;
          marcarModificado();
        }
      });
    });
  }

  // 6. ABA PERSONALIZAÇÃO DE FONTES E TIPOGRAFIA
  function renderAbaFontes(container) {
    const t = estadoEditor.rascunho.theme_config.typography;
    const fontes = window.RPMCms.FONTS || [
      "Cormorant Garamond",
      "Playfair Display",
      "Lora",
      "Libre Baskerville",
      "Plus Jakarta Sans",
      "Montserrat",
      "Inter",
      "Lato",
      "Georgia"
    ];

    container.innerHTML = `
      <div class="cms-panel-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
          <div>
            <h3>Personalização de Fontes e Tipografia</h3>
            <p class="cms-panel-hint" style="margin-bottom:0;">
              Escolha fontes de títulos, textos e botões, ajuste tamanhos, pesos, espaçamentos e veja a prévia instantânea abaixo.
            </p>
          </div>
          <button type="button" class="btn btn-outline btn-sm" id="btn-restaurar-fontes-padrao">
            ↺ Restaurar Fontes Padrão
          </button>
        </div>

        <div class="cms-grid-3" style="margin-bottom:1rem;">
          <div>
            <label class="admin-label">Fonte dos Títulos</label>
            <select class="admin-input" data-typo-field="headingFont">
              ${fontes
                .map(
                  (f) => `<option value="${esc(f)}" ${t.headingFont === f ? "selected" : ""}>${esc(f)}</option>`
                )
                .join("")}
            </select>
          </div>
          <div>
            <label class="admin-label">Fonte Geral / Textos</label>
            <select class="admin-input" data-typo-field="bodyFont">
              ${fontes
                .map(
                  (f) => `<option value="${esc(f)}" ${t.bodyFont === f ? "selected" : ""}>${esc(f)}</option>`
                )
                .join("")}
            </select>
          </div>
          <div>
            <label class="admin-label">Fonte dos Botões</label>
            <select class="admin-input" data-typo-field="buttonFont">
              ${fontes
                .map(
                  (f) => `<option value="${esc(f)}" ${t.buttonFont === f ? "selected" : ""}>${esc(f)}</option>`
                )
                .join("")}
            </select>
          </div>

          <div>
            <label class="admin-label">Tamanho Base do Site (px)</label>
            <input type="number" min="13" max="20" step="1" class="admin-input" data-typo-field="baseFontSize" value="${Number(
              t.baseFontSize || 16
            )}" />
          </div>
          <div>
            <label class="admin-label">Escala dos Títulos (%)</label>
            <input type="number" min="80" max="135" step="5" class="admin-input" data-typo-field="headingScale" value="${Number(
              t.headingScale || 100
            )}" />
          </div>
          <div>
            <label class="admin-label">Tamanho dos Botões (px)</label>
            <input type="number" min="11" max="17" step="1" class="admin-input" data-typo-field="buttonFontSize" value="${Number(
              t.buttonFontSize || 13
            )}" />
          </div>

          <div>
            <label class="admin-label">Peso dos Títulos</label>
            <select class="admin-input" data-typo-field="fontWeightHeading">
              <option value="400" ${t.fontWeightHeading === "400" ? "selected" : ""}>Regular (400)</option>
              <option value="500" ${t.fontWeightHeading === "500" ? "selected" : ""}>Médio (500)</option>
              <option value="600" ${t.fontWeightHeading === "600" ? "selected" : ""}>Seminegrito (600)</option>
              <option value="700" ${t.fontWeightHeading === "700" ? "selected" : ""}>Negrito (700)</option>
            </select>
          </div>
          <div>
            <label class="admin-label">Peso dos Textos</label>
            <select class="admin-input" data-typo-field="fontWeightBody">
              <option value="300" ${t.fontWeightBody === "300" ? "selected" : ""}>Leve (300)</option>
              <option value="400" ${t.fontWeightBody === "400" ? "selected" : ""}>Regular (400)</option>
              <option value="500" ${t.fontWeightBody === "500" ? "selected" : ""}>Médio (500)</option>
              <option value="600" ${t.fontWeightBody === "600" ? "selected" : ""}>Seminegrito (600)</option>
            </select>
          </div>
          <div>
            <label class="admin-label">Peso dos Botões</label>
            <select class="admin-input" data-typo-field="fontWeightButton">
              <option value="500" ${t.fontWeightButton === "500" ? "selected" : ""}>Médio (500)</option>
              <option value="600" ${t.fontWeightButton === "600" ? "selected" : ""}>Seminegrito (600)</option>
              <option value="700" ${t.fontWeightButton === "700" ? "selected" : ""}>Negrito (700)</option>
            </select>
          </div>

          <div>
            <label class="admin-label">Altura da Linha (line-height)</label>
            <input type="number" min="1.2" max="2.0" step="0.05" class="admin-input" data-typo-field="lineHeight" value="${Number(
              t.lineHeight || 1.55
            )}" />
          </div>
          <div>
            <label class="admin-label">Espaçamento entre Letras (em)</label>
            <input type="number" min="-0.03" max="0.12" step="0.01" class="admin-input" data-typo-field="letterSpacing" value="${Number(
              t.letterSpacing || 0
            )}" />
          </div>
          <div>
            <label class="admin-label">Estilo dos Títulos</label>
            <select class="admin-input" data-typo-field="headingStyle">
              <option value="normal" ${t.headingStyle === "normal" ? "selected" : ""}>Normal</option>
              <option value="bold" ${t.headingStyle === "bold" ? "selected" : ""}>Negrito</option>
              <option value="italic" ${t.headingStyle === "italic" ? "selected" : ""}>Itálico</option>
            </select>
          </div>
          <div>
            <label class="admin-label">Estilo dos Textos</label>
            <select class="admin-input" data-typo-field="bodyStyle">
              <option value="normal" ${t.bodyStyle === "normal" ? "selected" : ""}>Normal</option>
              <option value="bold" ${t.bodyStyle === "bold" ? "selected" : ""}>Negrito</option>
              <option value="italic" ${t.bodyStyle === "italic" ? "selected" : ""}>Itálico</option>
            </select>
          </div>
        </div>

        <div class="cms-font-preview-box" id="cms-typo-live-sample"></div>
      </div>
    `;

    function atualizarAmostraTipografia() {
      const box = container.querySelector("#cms-typo-live-sample");
      if (!box) return;
      box.innerHTML = `
        <span style="font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent);">AMOSTRA AO VIVO DA TIPOGRAFIA</span>
        <h2 style="font-family:'${esc(t.headingFont)}', serif;font-weight:${
        t.headingStyle === "bold" ? "700" : esc(t.fontWeightHeading)
      };font-style:${t.headingStyle === "italic" ? "italic" : "normal"};font-size:${(
        2.0 *
        (Number(t.headingScale || 100) / 100)
      ).toFixed(2)}rem;margin:0.35rem 0;">
          RPM MODAS — Elegância & Sofisticação
        </h2>
        <p style="font-family:'${esc(t.bodyFont)}', sans-serif;font-size:${Number(
        t.baseFontSize || 16
      )}px;font-weight:${
        t.bodyStyle === "bold" ? "600" : esc(t.fontWeightBody)
      };font-style:${t.bodyStyle === "italic" ? "italic" : "normal"};line-height:${Number(
        t.lineHeight || 1.55
      )};letter-spacing:${Number(t.letterSpacing || 0)}em;margin-bottom:0.9rem;">
          Peças selecionadas em tecidos nobres para valorizar cada detalhe do seu estilo em qualquer ocasião.
        </p>
        <span style="display:inline-block;padding:0.6rem 1.2rem;background:#231b16;color:#fff;border-radius:6px;font-family:'${esc(
          t.buttonFont
        )}', sans-serif;font-size:${Number(t.buttonFontSize || 13)}px;font-weight:${esc(
        t.fontWeightButton || "600"
      )};text-transform:uppercase;letter-spacing:0.08em;">
          COMPRAR AGORA
        </span>
      `;
    }

    atualizarAmostraTipografia();

    container.querySelector("#btn-restaurar-fontes-padrao").addEventListener("click", () => {
      estadoEditor.rascunho.theme_config.typography = clonar(
        window.RPMCms.getFactoryDefaults().theme_config.typography
      );
      marcarModificado();
      mostrarToastEditor("✓ Tipografia original restaurada no rascunho!");
      renderAbaFontes(container);
    });

    container.querySelectorAll("[data-typo-field]").forEach((el) => {
      el.addEventListener("input", () => {
        const key = el.getAttribute("data-typo-field");
        let v = el.value;
        if (
          ["baseFontSize", "headingScale", "buttonFontSize", "lineHeight", "letterSpacing"].includes(
            key
          )
        ) {
          v = Number(v);
        }
        t[key] = v;
        marcarModificado();
        atualizarAmostraTipografia();
      });
    });
  }

  // 7. ABA CABEÇALHO & RODAPÉ
  function renderAbaCabecalhoRodape(container) {
    const h = estadoEditor.rascunho.header_config;
    const f = estadoEditor.rascunho.footer_config;

    container.innerHTML = `
      <div class="cms-panel-card">
        <h3>Editor de Cabeçalho e Menu Superior</h3>
        <p class="cms-panel-hint">
          Personalize barra de avisos, logo, nome da loja, tamanho, organização e visibilidade dos links — preservando sempre busca, login e sacola.
        </p>

        <div class="cms-grid-3" style="margin-bottom:1rem;">
          <div>
            <label class="admin-label">Nome da Loja no Topo</label>
            <input type="text" class="admin-input" data-hd-field="storeName" value="${esc(
              h.storeName || ""
            )}" />
          </div>
          <div>
            <label class="admin-label">Subtítulo da Logo</label>
            <input type="text" class="admin-input" data-hd-field="storeSubtitle" value="${esc(
              h.storeSubtitle || ""
            )}" />
          </div>
          <div>
            <label class="admin-label">Tamanho da Logo / Nome (16 a 48)</label>
            <input type="number" min="16" max="48" class="admin-input" data-hd-field="logoSize" value="${Number(
              h.logoSize || 25
            )}" />
          </div>
          <div>
            <label class="admin-label">Organização do Cabeçalho</label>
            <select class="admin-input" data-hd-field="headerLayout">
              <option value="classic" ${h.headerLayout === "classic" ? "selected" : ""}>Clássico (Logo à esquerda)</option>
              <option value="centered" ${h.headerLayout === "centered" ? "selected" : ""}>Editorial (Logo centralizada)</option>
              <option value="compact" ${h.headerLayout === "compact" ? "selected" : ""}>Compacto</option>
            </select>
          </div>
          <div>
            <label class="admin-label">Rótulo do Botão da Sacola</label>
            <input type="text" class="admin-input" data-hd-field="bagLabel" value="${esc(
              h.bagLabel || "Sacola"
            )}" />
          </div>
          <div>
            <label class="admin-label">Imagem de Logo (opcional)</label>
            <div style="display:flex;gap:0.4rem;">
              <input type="text" class="admin-input" data-hd-field="logoImageUrl" value="${esc(
                h.logoImageUrl || ""
              )}" placeholder="URL da logo" />
              <button type="button" class="btn btn-outline btn-sm" id="btn-pick-header-logo">📁</button>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:1.25rem;flex-wrap:wrap;margin-bottom:1rem;">
          <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;">
            <input type="checkbox" id="chk-hd-topbar" ${h.showTopbar !== false ? "checked" : ""} />
            Mostrar Barra Superior de Avisos
          </label>
          <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;">
            <input type="checkbox" id="chk-hd-sub" ${h.showSubtitle !== false ? "checked" : ""} />
            Mostrar Subtítulo ("MODA FEMININA")
          </label>
          <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;">
            <input type="checkbox" id="chk-hd-logoimg" ${h.showLogoImage ? "checked" : ""} />
            Exibir Imagem da Logo
          </label>
          <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;">
            <input type="checkbox" id="chk-hd-menu" ${h.showMenu !== false ? "checked" : ""} />
            Exibir Menu de Navegação
          </label>
        </div>

        <div style="margin-bottom:1.1rem;">
          <label class="admin-label">Mensagens da Barra Superior (uma por linha)</label>
          <textarea rows="3" class="admin-input" id="txt-topbar-msgs">${esc(
            (h.topbarMessages || []).join("\n")
          )}</textarea>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem;">
          <h4 style="margin:0;">Itens do Menu Superior</h4>
          <button type="button" class="btn btn-outline btn-sm" id="btn-add-menu-item">+ Adicionar Link no Menu</button>
        </div>
        <div>
          ${(h.menuItems || [])
            .map(
              (m, idx) => `
            <div style="display:grid;grid-template-columns:1fr 1.2fr auto;gap:0.5rem;align-items:center;margin-bottom:0.45rem;">
              <input type="text" class="admin-input" data-menu-label="${idx}" value="${esc(m.label)}" />
              <input type="text" list="cms-destinos-datalist" class="admin-input" data-menu-target="${idx}" value="${esc(
                m.target
              )}" />
              <div style="display:flex;gap:0.3rem;">
                <button type="button" class="cms-icon-action" data-menu-up="${idx}" ${
                idx === 0 ? "disabled" : ""
              }>↑</button>
                <button type="button" class="cms-icon-action" data-menu-vis="${idx}">${
                m.visible !== false ? "Visível" : "Oculto"
              }</button>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>

      <div class="cms-panel-card">
        <h3>Editor de Rodapé</h3>
        <div style="display:flex;gap:1.25rem;flex-wrap:wrap;margin-bottom:1rem;">
          <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;">
            <input type="checkbox" id="chk-ft-vis" ${f.visible !== false ? "checked" : ""} />
            Exibir Rodapé no Site
          </label>
          <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;">
            <input type="checkbox" id="chk-ft-tag" ${f.showTagline ? "checked" : ""} />
            Exibir Frase Institucional Abaixo da Marca
          </label>
          <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;">
            <input type="checkbox" id="chk-ft-soc" ${f.showSocial !== false ? "checked" : ""} />
            Exibir WhatsApp e Instagram no Rodapé
          </label>
        </div>

        <div class="cms-grid-3" style="margin-bottom:1rem;">
          <div>
            <label class="admin-label">Nome no Rodapé</label>
            <input type="text" class="admin-input" data-ft-field="storeName" value="${esc(
              f.storeName || ""
            )}" />
          </div>
          <div>
            <label class="admin-label">Subtítulo no Rodapé</label>
            <input type="text" class="admin-input" data-ft-field="storeSubtitle" value="${esc(
              f.storeSubtitle || ""
            )}" />
          </div>
          <div>
            <label class="admin-label">WhatsApp Exibido</label>
            <input type="text" class="admin-input" data-ft-field="whatsappDisplay" value="${esc(
              f.whatsappDisplay || ""
            )}" />
          </div>
          <div>
            <label class="admin-label">Instagram (@)</label>
            <input type="text" class="admin-input" data-ft-field="instagramHandle" value="${esc(
              f.instagramHandle || ""
            )}" />
          </div>
          <div>
            <label class="admin-label">URL do Instagram</label>
            <input type="text" class="admin-input" data-ft-field="instagramUrl" value="${esc(
              f.instagramUrl || ""
            )}" />
          </div>
          <div>
            <label class="admin-label">Texto de Direitos Autorais</label>
            <input type="text" class="admin-input" data-ft-field="copyrightText" value="${esc(
              f.copyrightText || ""
            )}" />
          </div>
          <div style="grid-column:1/-1;">
            <label class="admin-label">Frase Institucional do Rodapé</label>
            <input type="text" class="admin-input" data-ft-field="tagline" value="${esc(
              f.tagline || ""
            )}" />
          </div>
        </div>

        <h4 style="margin-bottom:0.6rem;">Links Exibidos no Rodapé</h4>
        <div>
          ${(f.links || [])
            .map(
              (l, idx) => `
            <div style="display:grid;grid-template-columns:1fr 1.2fr auto;gap:0.5rem;align-items:center;margin-bottom:0.45rem;">
              <input type="text" class="admin-input" data-ftlink-label="${idx}" value="${esc(l.label)}" />
              <input type="text" list="cms-destinos-datalist" class="admin-input" data-ftlink-target="${idx}" value="${esc(
                l.target
              )}" />
              <button type="button" class="cms-icon-action" data-ftlink-vis="${idx}">${
                l.visible !== false ? "Visível" : "Oculto"
              }</button>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;

    container.querySelectorAll("[data-hd-field]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const k = inp.getAttribute("data-hd-field");
        h[k] = k === "logoSize" ? Number(inp.value) : inp.value;
        marcarModificado();
      });
    });

    container.querySelector("#btn-pick-header-logo").addEventListener("click", () => {
      abrirModalEscolherImagem((item) => {
        h.logoImageUrl = item.url;
        h.showLogoImage = true;
        marcarModificado();
        renderAbaCabecalhoRodape(container);
      });
    });

    container.querySelector("#chk-hd-topbar").addEventListener("change", (e) => {
      h.showTopbar = e.target.checked;
      marcarModificado();
    });
    container.querySelector("#chk-hd-sub").addEventListener("change", (e) => {
      h.showSubtitle = e.target.checked;
      marcarModificado();
    });
    container.querySelector("#chk-hd-logoimg").addEventListener("change", (e) => {
      h.showLogoImage = e.target.checked;
      marcarModificado();
    });
    container.querySelector("#chk-hd-menu").addEventListener("change", (e) => {
      h.showMenu = e.target.checked;
      marcarModificado();
    });

    container.querySelector("#txt-topbar-msgs").addEventListener("input", (e) => {
      h.topbarMessages = e.target.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      marcarModificado();
    });

    container.querySelector("#btn-add-menu-item").addEventListener("click", () => {
      h.menuItems.push({
        id: `nav-${Date.now()}`,
        label: "Novo Link",
        target: "pagina:sobre-nos",
        visible: true
      });
      marcarModificado();
      renderAbaCabecalhoRodape(container);
    });

    container.querySelectorAll("[data-menu-label]").forEach((inp) => {
      inp.addEventListener("input", () => {
        h.menuItems[Number(inp.getAttribute("data-menu-label"))].label = inp.value;
        marcarModificado();
      });
    });
    container.querySelectorAll("[data-menu-target]").forEach((inp) => {
      inp.addEventListener("input", () => {
        h.menuItems[Number(inp.getAttribute("data-menu-target"))].target = inp.value;
        marcarModificado();
      });
    });
    container.querySelectorAll("[data-menu-up]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-menu-up"));
        if (i > 0) {
          [h.menuItems[i - 1], h.menuItems[i]] = [h.menuItems[i], h.menuItems[i - 1]];
          marcarModificado();
          renderAbaCabecalhoRodape(container);
        }
      });
    });
    container.querySelectorAll("[data-menu-vis]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-menu-vis"));
        h.menuItems[i].visible = h.menuItems[i].visible === false;
        marcarModificado();
        renderAbaCabecalhoRodape(container);
      });
    });

    // Eventos Rodapé
    container.querySelector("#chk-ft-vis").addEventListener("change", (e) => {
      f.visible = e.target.checked;
      marcarModificado();
    });
    container.querySelector("#chk-ft-tag").addEventListener("change", (e) => {
      f.showTagline = e.target.checked;
      marcarModificado();
    });
    container.querySelector("#chk-ft-soc").addEventListener("change", (e) => {
      f.showSocial = e.target.checked;
      marcarModificado();
    });
    container.querySelectorAll("[data-ft-field]").forEach((inp) => {
      inp.addEventListener("input", () => {
        f[inp.getAttribute("data-ft-field")] = inp.value;
        marcarModificado();
      });
    });
    container.querySelectorAll("[data-ftlink-label]").forEach((inp) => {
      inp.addEventListener("input", () => {
        f.links[Number(inp.getAttribute("data-ftlink-label"))].label = inp.value;
        marcarModificado();
      });
    });
    container.querySelectorAll("[data-ftlink-target]").forEach((inp) => {
      inp.addEventListener("input", () => {
        f.links[Number(inp.getAttribute("data-ftlink-target"))].target = inp.value;
        marcarModificado();
      });
    });
    container.querySelectorAll("[data-ftlink-vis]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-ftlink-vis"));
        f.links[i].visible = f.links[i].visible === false;
        marcarModificado();
        renderAbaCabecalhoRodape(container);
      });
    });
  }

  // 8. ABA PÁGINAS INTERNAS
  function renderAbaPaginasInternas(container) {
    const listaSlugs = [
      { slug: "sobre-nos", label: "Sobre Nós" },
      { slug: "contato", label: "Contato" },
      { slug: "politicas", label: "Políticas da Loja" },
      { slug: "entrega", label: "Entrega" },
      { slug: "trocas-devolucoes", label: "Trocas e Devoluções" },
      { slug: "categorias", label: "Categorias / Topo do Catálogo" }
    ];

    const slugAtivo = estadoEditor.paginaInternaSelecionada || "sobre-nos";
    const pag = estadoEditor.rascunho.pages_config[slugAtivo] || {};
    const ehInstitucionalComBlocos = ["sobre-nos", "politicas", "entrega", "trocas-devolucoes"].includes(
      slugAtivo
    );

    container.innerHTML = `
      <div class="cms-panel-card">
        <h3>Editor de Páginas Internas</h3>
        <p class="cms-panel-hint">
          Personalize títulos, textos, imagens, cores e blocos das páginas institucionais sem alterar a lógica de autenticação, estoque ou sacola.
        </p>

        <div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-bottom:1.25rem;">
          ${listaSlugs
            .map(
              (p) =>
                `<button type="button" class="cms-subtab-btn ${
                  slugAtivo === p.slug ? "active" : ""
                }" data-pag-select="${esc(p.slug)}">${esc(p.label)}</button>`
            )
            .join("")}
        </div>

        <div class="cms-grid-2" style="margin-bottom:1rem;">
          <div>
            <label class="admin-label">Selo Superior (Eyebrow)</label>
            <input type="text" class="admin-input" data-pg-field="eyebrow" value="${esc(
              pag.eyebrow || ""
            )}" />
          </div>
          <div>
            <label class="admin-label">Título da Página</label>
            <input type="text" class="admin-input" data-pg-field="title" value="${esc(
              pag.title || ""
            )}" />
          </div>
          <div style="grid-column:1/-1;">
            <label class="admin-label">Subtítulo / Introdução</label>
            <textarea rows="2" class="admin-input" data-pg-field="subtitle">${esc(
              pag.subtitle || ""
            )}</textarea>
          </div>
        </div>

        ${
          slugAtivo === "contato"
            ? `
          <div class="cms-grid-2" style="margin-bottom:1rem;">
            <div>
              <label class="admin-label">Título Card WhatsApp</label>
              <input type="text" class="admin-input" data-pg-field="waTitle" value="${esc(
                pag.waTitle || ""
              )}" />
            </div>
            <div>
              <label class="admin-label">Descrição Card WhatsApp</label>
              <input type="text" class="admin-input" data-pg-field="waDesc" value="${esc(
                pag.waDesc || ""
              )}" />
            </div>
            <div>
              <label class="admin-label">Título Card Instagram</label>
              <input type="text" class="admin-input" data-pg-field="instaTitle" value="${esc(
                pag.instaTitle || ""
              )}" />
            </div>
            <div>
              <label class="admin-label">Descrição Card Instagram</label>
              <input type="text" class="admin-input" data-pg-field="instaDesc" value="${esc(
                pag.instaDesc || ""
              )}" />
            </div>
            <div>
              <label class="admin-label">Horário de Funcionamento</label>
              <input type="text" class="admin-input" data-pg-field="hoursText" value="${esc(
                pag.hoursText || ""
              )}" />
            </div>
            <div>
              <label class="admin-label">Texto de Envios & Entregas</label>
              <input type="text" class="admin-input" data-pg-field="shippingText" value="${esc(
                pag.shippingText || ""
              )}" />
            </div>
            <div style="grid-column:1/-1;">
              <label class="admin-label">Texto de Formas de Pagamento</label>
              <input type="text" class="admin-input" data-pg-field="paymentText" value="${esc(
                pag.paymentText || ""
              )}" />
            </div>
          </div>
        `
            : ""
        }

        ${
          ehInstitucionalComBlocos
            ? `
          <div class="cms-grid-3" style="margin-bottom:1rem;">
            <div>
              <label class="admin-label">Imagem de Destaque da Página</label>
              <div style="display:flex;gap:0.4rem;">
                <input type="text" class="admin-input" data-pg-field="imageUrl" value="${esc(
                  pag.imageUrl || ""
                )}" />
                <button type="button" class="btn btn-outline btn-sm" id="btn-pick-pag-img">📁</button>
              </div>
              <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.8rem;margin-top:0.4rem;">
                <input type="checkbox" id="chk-pg-showimg" ${pag.showImage ? "checked" : ""} />
                Exibir imagem no topo desta página
              </label>
            </div>
            <div>
              <label class="admin-label">Alinhamento do Conteúdo</label>
              <select class="admin-input" data-pg-field="alignment">
                <option value="left" ${pag.alignment === "left" ? "selected" : ""}>Esquerda</option>
                <option value="center" ${pag.alignment === "center" ? "selected" : ""}>Centralizado</option>
                <option value="right" ${pag.alignment === "right" ? "selected" : ""}>Direita</option>
              </select>
            </div>
            <div>
              <label class="admin-label">Cor de Fundo do Card (opcional)</label>
              <input type="text" class="admin-input" data-pg-field="bgColor" placeholder="#ffffff" value="${esc(
                pag.bgColor || ""
              )}" />
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
            <h4 style="margin:0;">Seções de Conteúdo da Página</h4>
            <div style="display:flex;gap:0.5rem;">
              <button type="button" class="btn btn-outline btn-sm" id="btn-preview-esta-pagina">
                👁️ Pré-visualizar Esta Página
              </button>
              <button type="button" class="btn btn-primary btn-sm" id="btn-add-pg-bloco">
                + Adicionar Seção de Texto
              </button>
            </div>
          </div>

          <div>
            ${(pag.blocks || [])
              .map(
                (bl, idx) => `
              <div class="cms-section-item">
                <div class="cms-section-item-head">
                  <strong>Bloco #${idx + 1}: ${esc(bl.heading || "Tópico")}</strong>
                  <div class="cms-section-item-controls">
                    <button type="button" class="cms-icon-action" data-pgb-up="${idx}" ${
                  idx === 0 ? "disabled" : ""
                }>↑</button>
                    <button type="button" class="cms-icon-action" data-pgb-vis="${idx}">${
                  bl.visible !== false ? "Visível" : "Oculto"
                }</button>
                    <button type="button" class="cms-icon-action danger" data-pgb-del="${idx}">🗑</button>
                  </div>
                </div>
                <div class="cms-section-item-body">
                  <label class="admin-label">Subtítulo do Tópico</label>
                  <input type="text" class="admin-input" style="margin-bottom:0.6rem;" data-pgb-head="${idx}" value="${esc(
                  bl.heading || ""
                )}" />
                  <label class="admin-label">Texto</label>
                  <textarea rows="3" class="admin-input" data-pgb-body="${idx}">${esc(
                  bl.body || ""
                )}</textarea>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    `;

    container.querySelectorAll("[data-pag-select]").forEach((btn) => {
      btn.addEventListener("click", () => {
        estadoEditor.paginaInternaSelecionada = btn.getAttribute("data-pag-select");
        renderAbaPaginasInternas(container);
      });
    });

    container.querySelectorAll("[data-pg-field]").forEach((inp) => {
      inp.addEventListener("input", () => {
        pag[inp.getAttribute("data-pg-field")] = inp.value;
        marcarModificado();
      });
    });

    container.querySelector("#btn-pick-pag-img")?.addEventListener("click", () => {
      abrirModalEscolherImagem((item) => {
        pag.imageUrl = item.url;
        pag.imageAlt = item.alt;
        pag.showImage = true;
        marcarModificado();
        renderAbaPaginasInternas(container);
      });
    });

    container.querySelector("#chk-pg-showimg")?.addEventListener("change", (e) => {
      pag.showImage = e.target.checked;
      marcarModificado();
    });

    container.querySelector("#btn-preview-esta-pagina")?.addEventListener("click", async () => {
      await window.RPMCms.startPreview(estadoEditor.rascunho, "desktop");
      if (window.RPMStoreUI && window.RPMStoreUI.openInstitutionalPage) {
        window.RPMStoreUI.openInstitutionalPage(slugAtivo);
      }
    });

    container.querySelector("#btn-add-pg-bloco")?.addEventListener("click", () => {
      if (!Array.isArray(pag.blocks)) pag.blocks = [];
      pag.blocks.push({
        id: `bl-${Date.now()}`,
        heading: "Novo Tópico",
        body: "Digite as informações aqui.",
        visible: true
      });
      marcarModificado();
      renderAbaPaginasInternas(container);
    });

    container.querySelectorAll("[data-pgb-head]").forEach((inp) => {
      inp.addEventListener("input", () => {
        pag.blocks[Number(inp.getAttribute("data-pgb-head"))].heading = inp.value;
        marcarModificado();
      });
    });
    container.querySelectorAll("[data-pgb-body]").forEach((inp) => {
      inp.addEventListener("input", () => {
        pag.blocks[Number(inp.getAttribute("data-pgb-body"))].body = inp.value;
        marcarModificado();
      });
    });
    container.querySelectorAll("[data-pgb-up]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-pgb-up"));
        if (i > 0) {
          [pag.blocks[i - 1], pag.blocks[i]] = [pag.blocks[i], pag.blocks[i - 1]];
          marcarModificado();
          renderAbaPaginasInternas(container);
        }
      });
    });
    container.querySelectorAll("[data-pgb-vis]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-pgb-vis"));
        pag.blocks[i].visible = pag.blocks[i].visible === false;
        marcarModificado();
        renderAbaPaginasInternas(container);
      });
    });
    container.querySelectorAll("[data-pgb-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        pag.blocks.splice(Number(btn.getAttribute("data-pgb-del")), 1);
        marcarModificado();
        renderAbaPaginasInternas(container);
      });
    });
  }

  // 9. ABA HISTÓRICO, AUDITORIA E RESTAURAÇÃO DE VERSÕES
  function renderAbaHistorico(container) {
    const versoes = estadoEditor.historicoVersoes || [];

    container.innerHTML = `
      <div class="cms-panel-card">
        <h3>Histórico de Versões, Auditoria e Restauração</h3>
        <p class="cms-panel-hint">
          Cada publicação gera automaticamente um ponto de restauração seguro registrando administrador responsável, data/hora, tipo de alteração, conteúdo anterior e conteúdo novo.
        </p>

        ${
          versoes.length === 0
            ? `<div style="padding:1.5rem;border:1px dashed var(--border);border-radius:var(--radius-sm);text-align:center;color:var(--ink-soft);">Nenhuma versão publicada registrada ainda no histórico. Ao clicar em <strong>PUBLICAR ALTERAÇÕES</strong>, os pontos de restauração aparecerão automaticamente aqui.</div>`
            : versoes
                .map((v) => {
                  const dt = v.created_at
                    ? new Date(v.created_at).toLocaleString("pt-BR")
                    : "Data recente";
                  const tipoFmt =
                    v.action_type === "restore" ? "Restauração de Backup" : "Publicação";
                  return `
                    <div class="cms-version-row">
                      <div>
                        <div style="display:flex;align-items:center;gap:0.55rem;flex-wrap:wrap;">
                          <strong>Versão v${Number(v.version_number || 1)}</strong>
                          <span class="cms-badge">${esc(tipoFmt)}</span>
                          <span style="font-size:0.8rem;color:var(--ink-soft);">${esc(dt)}</span>
                        </div>
                        <p style="font-size:0.86rem;margin:0.25rem 0;">
                          <strong>Resumo:</strong> ${esc(v.change_summary || "Alteração visual")}
                        </p>
                        <p style="font-size:0.76rem;color:var(--ink-soft);margin:0;">
                          Administrador responsável: <strong>${esc(
                            v.admin_identifier || "Admin"
                          )}</strong>
                        </p>
                      </div>
                      <div style="display:flex;gap:0.45rem;align-items:center;">
                        <button type="button" class="btn btn-primary btn-sm" data-restore-ver="${esc(
                          v.id
                        )}">
                          ↺ RESTAURAR ESTA VERSÃO
                        </button>
                      </div>
                    </div>
                  `;
                })
                .join("")
        }
      </div>
    `;

    container.querySelectorAll("[data-restore-ver]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const verId = btn.getAttribute("data-restore-ver");
        btn.disabled = true;
        btn.textContent = "Restaurando...";
        try {
          const resp = await window.RPMCms.restoreVersion(verId);
          estadoEditor.rascunho = await window.RPMCms.loadDraftForEditor();
          estadoEditor.historicoVersoes = await window.RPMCms.listVersions();
          estadoEditor.alteracoesNaoSalvas = false;
          mostrarToastEditor(
            `✓ Versão restaurada e publicada com sucesso (nova versão v${resp.version_number})!`
          );
          renderAbaHistorico(container);
          atualizarIndicadoresTopo();
        } catch (err) {
          mostrarToastEditor("Erro ao restaurar versão: " + err.message);
          btn.disabled = false;
          btn.textContent = "↺ RESTAURAR ESTA VERSÃO";
        }
      });
    });
  }

  // ==========================================================================
  // SHELL PRINCIPAL DO MODO ADM AVANÇADO DENTRO DO PAINEL ADMINISTRATIVO
  // ==========================================================================
  async function renderizarEditorCompleto(container) {
    if (!container) return;

    const ehAdmin = window.RPMAuth && (await window.RPMAuth.recheckAdminPermission()) === true;
    if (!ehAdmin) {
      container.innerHTML = `<div class="cms-panel-card"><h3>Acesso Negado</h3><p>Apenas administradores autorizados podem acessar o Modo ADM Avançado.</p></div>`;
      return;
    }

    container.innerHTML = `
      <div class="cms-panel-card" style="text-align:center;padding:2.5rem;">
        <span class="login-spinner"></span>
        <p style="margin-top:0.75rem;color:var(--ink-soft);">Carregando Modo ADM Avançado e configurações seguras da loja...</p>
      </div>
    `;

    try {
      if (!estadoEditor.rascunho || !estadoEditor.alteracoesNaoSalvas) {
        estadoEditor.rascunho = await window.RPMCms.loadDraftForEditor();
      }
      const [midia, historico] = await Promise.all([
        window.RPMCms.listMedia().catch(() => []),
        window.RPMCms.listVersions().catch(() => [])
      ]);
      estadoEditor.bibliotecaMidia = midia;
      estadoEditor.historicoVersoes = historico;
      estadoEditor.erroAvisoBanco = "";
    } catch (err) {
      estadoEditor.rascunho =
        estadoEditor.rascunho || clonar(window.RPMCms.getPublishedConfig());
      estadoEditor.erroAvisoBanco = err.message || "";
    }

    const versaoPubAtual = window.RPMCms.getPublishedConfig().version_number || 1;

    const abasEditor = [
      { id: "banners", label: "🏠 Banners & Home" },
      { id: "secoes", label: "📐 Seções & Layout" },
      { id: "midia", label: "🖼️ Biblioteca de Imagens" },
      { id: "textos", label: "✍️ Textos & Copy" },
      { id: "cores", label: "🎨 Cores" },
      { id: "fontes", label: "🔤 Fontes" },
      { id: "cabecalho", label: "🧭 Cabeçalho & Rodapé" },
      { id: "paginas", label: "📄 Páginas Internas" },
      { id: "historico", label: "🕘 Histórico & Versões" }
    ];

    container.innerHTML = `
      <datalist id="cms-destinos-datalist">
        ${DESTINOS_SUGERIDOS.map(
          (d) => `<option value="${esc(d.value)}">${esc(d.label)}</option>`
        ).join("")}
      </datalist>

      <div class="cms-editor-shell">
        <div class="cms-editor-topbar">
          <div class="cms-editor-status-group">
            <div class="cms-status-pill-row">
              <strong style="font-size:1.05rem;">MODO ADM AVANÇADO</strong>
              <span class="cms-badge">Publicado: v${Number(versaoPubAtual)}</span>
              <span id="cms-status-badge" class="cms-badge ${
                estadoEditor.alteracoesNaoSalvas ? "unsaved" : "published"
              }">
                ${
                  estadoEditor.alteracoesNaoSalvas
                    ? "● Alterações em edição (não publicadas)"
                    : "✓ Rascunho sincronizado"
                }
              </span>
            </div>
            <span style="font-size:0.8rem;color:var(--ink-soft);">
              Personalize completamente o visual e o conteúdo da RPM MODAS. Visitantes só veem após clicar em PUBLICAR ALTERAÇÕES.
            </span>
          </div>

          <div class="cms-editor-actions">
            <input
              type="text"
              id="cms-input-resumo-pub"
              class="admin-input"
              style="width:210px;padding:0.45rem 0.65rem;font-size:0.8rem;"
              placeholder="Nota desta alteração (opcional)"
              value="${esc(estadoEditor.resumoPublicacao)}"
            />
            <button type="button" class="btn btn-outline btn-sm" id="btn-cms-preview-desktop">
              💻 Prévia PC
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-cms-preview-mobile">
              📱 Prévia Celular
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-cms-salvar-rascunho">
              SALVAR RASCUNHO
            </button>
            <button type="button" class="btn btn-primary btn-sm" id="btn-cms-publicar">
              PUBLICAR ALTERAÇÕES
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-cms-descartar">
              DESCARTAR ALTERAÇÕES
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-cms-restaurar-anterior">
              RESTAURAR VERSÃO ANTERIOR
            </button>
          </div>
        </div>

        ${
          estadoEditor.erroAvisoBanco
            ? `<div style="padding:0.85rem 1rem;background:#fef3c7;border:1px solid #f59e0b;border-radius:var(--radius-sm);font-size:0.84rem;color:#92400e;">Aviso: ${esc(
                estadoEditor.erroAvisoBanco
              )}</div>`
            : ""
        }

        <div class="cms-tabs-bar" role="tablist">
          ${abasEditor
            .map(
              (ab) => `
            <button type="button" class="cms-subtab-btn ${
              estadoEditor.abaAtiva === ab.id ? "active" : ""
            }" data-cms-subtab="${esc(ab.id)}">
              ${esc(ab.label)}
            </button>
          `
            )
            .join("")}
        </div>

        <div id="cms-subtab-stage"></div>
      </div>
    `;

    const stage = container.querySelector("#cms-subtab-stage");

    function desenharSubAbaAtiva() {
      if (estadoEditor.abaAtiva === "banners") renderAbaBanners(stage);
      else if (estadoEditor.abaAtiva === "secoes") renderAbaSecoesLayout(stage);
      else if (estadoEditor.abaAtiva === "midia") renderAbaBibliotecaMidia(stage);
      else if (estadoEditor.abaAtiva === "textos") renderAbaTextos(stage);
      else if (estadoEditor.abaAtiva === "cores") renderAbaCores(stage);
      else if (estadoEditor.abaAtiva === "fontes") renderAbaFontes(stage);
      else if (estadoEditor.abaAtiva === "cabecalho") renderAbaCabecalhoRodape(stage);
      else if (estadoEditor.abaAtiva === "paginas") renderAbaPaginasInternas(stage);
      else if (estadoEditor.abaAtiva === "historico") renderAbaHistorico(stage);
    }

    desenharSubAbaAtiva();

    container.querySelectorAll("[data-cms-subtab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        estadoEditor.abaAtiva = btn.getAttribute("data-cms-subtab");
        container
          .querySelectorAll("[data-cms-subtab]")
          .forEach((b) => b.classList.toggle("active", b === btn));
        desenharSubAbaAtiva();
      });
    });

    container.querySelector("#cms-input-resumo-pub").addEventListener("input", (e) => {
      estadoEditor.resumoPublicacao = e.target.value;
    });

    // Prévia Desktop e Mobile (Rascunho isolado — visitantes não veem!)
    container.querySelector("#btn-cms-preview-desktop").addEventListener("click", async () => {
      await window.RPMCms.startPreview(estadoEditor.rascunho, "desktop");
      if (window.RPMStoreUI && window.RPMStoreUI.navigateToTab) {
        window.RPMStoreUI.navigateToTab("inicio");
      }
    });

    container.querySelector("#btn-cms-preview-mobile").addEventListener("click", async () => {
      await window.RPMCms.startPreview(estadoEditor.rascunho, "mobile");
      if (window.RPMStoreUI && window.RPMStoreUI.navigateToTab) {
        window.RPMStoreUI.navigateToTab("inicio");
      }
    });

    // SALVAR RASCUNHO
    container.querySelector("#btn-cms-salvar-rascunho").addEventListener("click", async (ev) => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      btn.textContent = "Salvando...";
      try {
        await window.RPMCms.saveDraft(estadoEditor.rascunho);
        estadoEditor.alteracoesNaoSalvas = false;
        atualizarIndicadoresTopo();
        mostrarToastEditor(
          "✓ Rascunho salvo com segurança! O site público continua inalterado até publicar."
        );
      } catch (err) {
        mostrarToastEditor("Erro ao salvar rascunho: " + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "SALVAR RASCUNHO";
      }
    });

    // PUBLICAR ALTERAÇÕES
    container.querySelector("#btn-cms-publicar").addEventListener("click", async (ev) => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      btn.textContent = "Publicando...";
      try {
        const res = await window.RPMCms.publishDraft(
          estadoEditor.rascunho,
          estadoEditor.resumoPublicacao
        );
        estadoEditor.alteracoesNaoSalvas = false;
        estadoEditor.resumoPublicacao = "";
        estadoEditor.historicoVersoes = await window.RPMCms.listVersions().catch(() => []);
        mostrarToastEditor(
          `✓ Alterações publicadas com sucesso (Versão v${res?.version_number || 1})!`
        );
        await renderizarEditorCompleto(container);
      } catch (err) {
        mostrarToastEditor("Erro ao publicar: " + err.message);
        btn.disabled = false;
        btn.textContent = "PUBLICAR ALTERAÇÕES";
      }
    });

    // DESCARTAR ALTERAÇÕES
    container.querySelector("#btn-cms-descartar").addEventListener("click", async (ev) => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      try {
        estadoEditor.rascunho = await window.RPMCms.discardDraft();
        estadoEditor.alteracoesNaoSalvas = false;
        mostrarToastEditor("✓ Rascunho descartado. Configuração publicada recarregada!");
        await renderizarEditorCompleto(container);
      } catch (err) {
        mostrarToastEditor("Erro ao descartar: " + err.message);
      } finally {
        btn.disabled = false;
      }
    });

    // RESTAURAR VERSÃO ANTERIOR (abre aba histórico ou restaura última versão anterior se houver)
    container.querySelector("#btn-cms-restaurar-anterior").addEventListener("click", async () => {
      estadoEditor.abaAtiva = "historico";
      estadoEditor.historicoVersoes = await window.RPMCms.listVersions().catch(() => []);
      container.querySelectorAll("[data-cms-subtab]").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-cms-subtab") === "historico");
      });
      renderAbaHistorico(stage);
      if (estadoEditor.historicoVersoes.length > 0) {
        mostrarToastEditor("Escolha abaixo a versão que deseja restaurar com 1 clique.");
      } else {
        mostrarToastEditor("Publique uma versão para criar pontos de restauração no histórico.");
      }
    });
  }

  window.RPMCmsEditor = Object.freeze({
    render: renderizarEditorCompleto
  });
})();
