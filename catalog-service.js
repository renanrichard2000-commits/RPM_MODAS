/**
 * ============================================================================
 * SERVIÇO DE CATÁLOGO, ESTOQUE POR VARIANTE E STORAGE SUPABASE — RPM MODAS
 * ============================================================================
 * Centraliza a leitura dinâmica do catálogo, páginas individuais de produtos,
 * controle de estoque por (Cor + Tamanho), revalidação antes da compra e
 * operações administrativas protegidas por RLS no Supabase.
 */
(function () {
  "use strict";

  const MAPA_HEX_PADRAO = {
    preto: "#1c1c1c",
    branco: "#ffffff",
    "off-white": "#f7f3eb",
    bege: "#d8c7b4",
    areia: "#d9cab8",
    terracota: "#b8644f",
    rosa: "#d98a9c",
    azul: "#3e5c76",
    vermelho: "#9e2a2b",
    marrom: "#6e473b",
    cacau: "#6e473b",
    caramelo: "#b67b4c",
    aveia: "#e5dccf",
    champagne: "#eadbc8",
    perola: "#efeae2",
    pérola: "#efeae2",
    "verde oliva": "#5f6b4e",
    "linho cru": "#ded3c1"
  };

  const ORDEM_TAMANHOS_PADRAO = {
    PP: 1,
    P: 2,
    M: 3,
    G: 4,
    GG: 5,
    XG: 6,
    "Tamanho único": 7,
    Único: 7
  };

  const estadoCatalogo = {
    carregado: false,
    usandoBancoSupabase: false,
    produtosPublicos: [],
    todosProdutosAdmin: [],
    categorias: [],
    cores: [],
    tamanhos: [],
    configuracoes: null
  };

  function normalizarSlug(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function obterHexCor(nomeCor, hexInformado) {
    if (hexInformado && /^#[0-9a-f]{3,8}$/i.test(hexInformado.trim())) {
      return hexInformado.trim();
    }
    const corCadastrada = estadoCatalogo.cores.find(
      (c) => c.name.toLowerCase() === String(nomeCor || "").trim().toLowerCase()
    );
    if (corCadastrada && corCadastrada.hex_code) {
      return corCadastrada.hex_code;
    }
    const chave = String(nomeCor || "").trim().toLowerCase();
    return MAPA_HEX_PADRAO[chave] || "#cfc3b4";
  }

  function ordenarTamanhos(listaCodigos) {
    const mapaOrdem = {};
    estadoCatalogo.tamanhos.forEach((s, idx) => {
      mapaOrdem[s.code] = typeof s.display_order === "number" ? s.display_order : idx + 1;
    });

    return [...listaCodigos].sort((a, b) => {
      const oa = mapaOrdem[a] ?? ORDEM_TAMANHOS_PADRAO[a] ?? 99;
      const ob = mapaOrdem[b] ?? ORDEM_TAMANHOS_PADRAO[b] ?? 99;
      if (oa !== ob) return oa - ob;
      return String(a).localeCompare(String(b), "pt-BR");
    });
  }

  // Transforma registro bruto do Supabase no modelo rico da loja
  function normalizarProdutoDoBanco(raw, incluirInativosParaAdmin = false) {
    const coresGlobaisInativas = new Set(
      estadoCatalogo.cores.filter((c) => c.is_active === false).map((c) => c.name.toLowerCase())
    );
    const tamanhosGlobaisInativos = new Set(
      estadoCatalogo.tamanhos.filter((s) => s.is_active === false).map((s) => s.code.toLowerCase())
    );

    const precoVenda = Number(raw.price || 0);
    const precoPromoRaw =
      raw.promo_price !== null && raw.promo_price !== undefined && raw.promo_price !== ""
        ? Number(raw.promo_price)
        : null;
    const temPromocao = Boolean(precoPromoRaw && precoPromoRaw > 0 && precoPromoRaw < precoVenda);

    const precoVigente = temPromocao ? precoPromoRaw : precoVenda;
    const precoAntigo = temPromocao ? precoVenda : null;
    const percDesconto = temPromocao
      ? Math.round(((precoVenda - precoPromoRaw) / precoVenda) * 100)
      : 0;

    // Galeria ordenada de imagens
    const imagensBrutas = Array.isArray(raw.product_images) ? [...raw.product_images] : [];
    imagensBrutas.sort((a, b) => {
      if (Boolean(b.is_primary) !== Boolean(a.is_primary)) {
        return Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary));
      }
      return (a.display_order || 0) - (b.display_order || 0);
    });

    const imagens = imagensBrutas.map((img) => ({
      id: img.id,
      url: window.resolveRpmAssetUrl(img.image_url),
      rawUrl: img.image_url,
      storagePath: img.storage_path || null,
      colorName: img.color_name || "",
      isPrimary: Boolean(img.is_primary),
      displayOrder: img.display_order || 0
    }));

    if (imagens.length === 0 && raw.main_image_url) {
      imagens.push({
        id: "main",
        url: window.resolveRpmAssetUrl(raw.main_image_url),
        rawUrl: raw.main_image_url,
        storagePath: null,
        colorName: "",
        isPrimary: true,
        displayOrder: 0
      });
    }

    const imagemPrincipal =
      (imagens[0] && imagens[0].url) || window.resolveRpmAssetUrl("vestido-midi-linho.jpg");

    // Variantes por Cor + Tamanho
    const variantesBrutas = Array.isArray(raw.product_variants) ? [...raw.product_variants] : [];
    const todasVariantes = variantesBrutas.map((v) => ({
      id: v.id,
      colorName: String(v.color_name || "Única").trim(),
      colorHex: obterHexCor(v.color_name, v.color_hex),
      sizeCode: String(v.size_code || "Único").trim(),
      stockQuantity: Math.max(0, Number(v.stock_quantity || 0)),
      isActive: v.is_active !== false
    }));

    const variantesAtivasLoja = todasVariantes.filter(
      (v) =>
        v.isActive &&
        !coresGlobaisInativas.has(v.colorName.toLowerCase()) &&
        !tamanhosGlobaisInativos.has(v.sizeCode.toLowerCase())
    );

    const variantesReferencia = incluirInativosParaAdmin ? todasVariantes : variantesAtivasLoja;

    // Agrupa cores disponíveis
    const mapaCores = new Map();
    variantesAtivasLoja.forEach((v) => {
      const chave = v.colorName;
      if (!mapaCores.has(chave)) {
        mapaCores.set(chave, {
          name: v.colorName,
          nome: v.colorName,
          hex: v.colorHex,
          estoqueTotalCor: 0
        });
      }
      mapaCores.get(chave).estoqueTotalCor += v.stockQuantity;
    });

    const coresDisponiveis = Array.from(mapaCores.values());
    const coresNomes = coresDisponiveis.map((c) => c.nome);

    // Agrupa tamanhos disponíveis ordenados
    const setTamanhos = new Set();
    variantesAtivasLoja.forEach((v) => setTamanhos.add(v.sizeCode));
    const tamanhosDisponiveis = ordenarTamanhos(Array.from(setTamanhos));

    // T- tamanhos com estoque > 0 (em ao menos 1 cor ativa) para atalho nos cards da vitrine
    const tamanhosComEstoque = tamanhosDisponiveis.filter((tam) =>
      variantesAtivasLoja.some((v) => v.sizeCode === tam && v.stockQuantity > 0)
    );

    const estoqueTotal = variantesAtivasLoja.reduce((soma, v) => soma + v.stockQuantity, 0);

    let destaqueBadge = String(raw.badge_label || "").trim();
    if (!destaqueBadge) {
      if (temPromocao) destaqueBadge = `-${percDesconto}% OFF`;
      else if (raw.is_bestseller) destaqueBadge = "Mais Vendido";
    }

    const status = raw.status || (raw.is_active === false ? "draft" : "published");

    return {
      id: raw.id,
      slug: raw.slug || normalizarSlug(raw.name || raw.id),
      nome: raw.name,
      categoria: raw.category_name || raw.category || "Coleção",
      categoryId: raw.category_id || null,
      preco: precoVigente,
      precoVendaBase: precoVenda,
      precoPromocional: temPromocao ? precoPromoRaw : null,
      precoAntigo,
      percDesconto,
      parcelasMax: Number(raw.installments_max || DADOS_LOJA.parcelasSemJuros || 3),
      imagem: imagemPrincipal,
      imagens,
      destaque: destaqueBadge,
      maisVendido: Boolean(raw.is_bestseller),
      status,
      publicado: status === "published" && raw.is_active !== false,
      tecido: raw.fabric_details || "",
      descricao: raw.description || "",
      cores: coresNomes,
      coresDetalhes: coresDisponiveis,
      tamanhos: tamanhosDisponiveis,
      tamanhosComEstoque,
      variantes: variantesReferencia,
      variantesLoja: variantesAtivasLoja,
      todasVariantesAdmin: todasVariantes,
      estoqueTotal,
      esgotadoGeral: estoqueTotal <= 0
    };
  }

  // Fallback local caso as tabelas do Supabase ainda não tenham sido executadas no SQL Editor
  function carregarFallbackLocal() {
    const catsUnicas = [];
    (DADOS_LOJA.produtos || []).forEach((p, idx) => {
      if (p.categoria && !catsUnicas.some((c) => c.name === p.categoria)) {
        catsUnicas.push({
          id: `cat-${idx + 1}`,
          name: p.categoria,
          slug: normalizarSlug(p.categoria),
          display_order: idx + 1,
          is_active: true
        });
      }
    });

    estadoCatalogo.categorias = catsUnicas;
    estadoCatalogo.cores = Object.entries(MAPA_HEX_PADRAO)
      .slice(0, 12)
      .map(([nome, hex], i) => ({
        id: `cor-${i + 1}`,
        name: nome.charAt(0).toUpperCase() + nome.slice(1),
        hex_code: hex,
        is_active: true,
        display_order: i + 1
      }));

    estadoCatalogo.tamanhos = ["PP", "P", "M", "G", "GG", "XG", "Tamanho único"].map(
      (code, i) => ({
        id: `tam-${i + 1}`,
        code,
        label: code,
        display_order: i + 1,
        is_active: true
      })
    );

    const convertidos = (DADOS_LOJA.produtos || []).map((p) => {
      const temPromo = Boolean(p.precoAntigo && p.precoAntigo > p.preco);
      const cores = Array.isArray(p.cores) && p.cores.length ? p.cores : ["Única"];
      const tamanhos = Array.isArray(p.tamanhos) && p.tamanhos.length ? p.tamanhos : ["Único"];
      const variantes = [];

      cores.forEach((cor) => {
        tamanhos.forEach((tam) => {
          variantes.push({
            id: `${p.id}-${normalizarSlug(cor)}-${normalizarSlug(tam)}`,
            color_name: cor,
            color_hex: obterHexCor(cor),
            size_code: tam,
            stock_quantity: 5,
            is_active: true
          });
        });
      });

      return normalizarProdutoDoBanco({
        id: p.id,
        slug: normalizarSlug(p.id || p.nome),
        name: p.nome,
        category_name: p.categoria,
        price: temPromo ? p.precoAntigo : p.preco,
        promo_price: temPromo ? p.preco : null,
        installments_max: DADOS_LOJA.parcelasSemJuros || 3,
        badge_label: p.destaque,
        is_bestseller: Boolean(p.maisVendido),
        status: "published",
        is_active: true,
        fabric_details: p.tecido,
        description: p.descricao,
        main_image_url: p.imagem,
        product_images: [
          {
            id: `img-${p.id}`,
            image_url: p.imagem,
            is_primary: true,
            display_order: 0
          }
        ],
        product_variants: variantes
      });
    });

    estadoCatalogo.produtosPublicos = convertidos;
    estadoCatalogo.todosProdutosAdmin = convertidos;
    estadoCatalogo.usandoBancoSupabase = false;
    estadoCatalogo.carregado = true;
    return estadoCatalogo;
  }

  function aplicarConfiguracoesEmDadosLoja(cfg) {
    if (!cfg) return;
    estadoCatalogo.configuracoes = cfg;
    if (cfg.store_name) DADOS_LOJA.nomeLoja = cfg.store_name;
    if (cfg.store_subtitle) DADOS_LOJA.subtituloLogo = cfg.store_subtitle;
    if (cfg.whatsapp) DADOS_LOJA.whatsapp = cfg.whatsapp;
    if (cfg.whatsapp_display) DADOS_LOJA.whatsappExibicao = cfg.whatsapp_display;
    if (cfg.instagram) DADOS_LOJA.instagram = cfg.instagram;
    if (cfg.instagram_url) DADOS_LOJA.urlInstagram = cfg.instagram_url;
    if (cfg.free_shipping_min !== null && cfg.free_shipping_min !== undefined) {
      DADOS_LOJA.freteGratisAcimaDe = Number(cfg.free_shipping_min);
    }
    if (cfg.pix_discount_percent !== null && cfg.pix_discount_percent !== undefined) {
      DADOS_LOJA.descontoPixPercentual = Number(cfg.pix_discount_percent);
    }
    if (cfg.default_installments) {
      DADOS_LOJA.parcelasSemJuros = Number(cfg.default_installments);
    }
    if (cfg.hero_tag) DADOS_LOJA.tagColecao = cfg.hero_tag;
    if (cfg.hero_title) DADOS_LOJA.sloganHero = cfg.hero_title;
    if (cfg.hero_description) DADOS_LOJA.descricaoHero = cfg.hero_description;
    if (cfg.opening_hours) DADOS_LOJA.horarioAtendimento = cfg.opening_hours;
    if (cfg.shipping_info) DADOS_LOJA.cidadeEstado = cfg.shipping_info;
  }

  // Carrega catálogo completo do Supabase (público ou administrativo)
  async function carregarCatalogo(modoAdmin = false) {
    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();
    if (!supabase) {
      return carregarFallbackLocal();
    }

    try {
      const [resCats, resCores, resTams, resCfg, resProds] = await Promise.all([
        supabase.from("categories").select("*").order("display_order", { ascending: true }),
        supabase.from("colors").select("*").order("display_order", { ascending: true }),
        supabase.from("sizes").select("*").order("display_order", { ascending: true }),
        supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
        supabase
          .from("products")
          .select("*, product_images(*), product_variants(*)")
          .order("created_at", { ascending: false })
      ]);

      // Se a tabela products ainda não existir no banco (antes de rodar o SQL), usa o fallback local
      if (resProds.error) {
        if (resProds.error.code === "PGRST205") {
          return carregarFallbackLocal();
        }
        console.warn("[RPM Catalog] Aviso ao carregar produtos:", resProds.error.message);
        return carregarFallbackLocal();
      }

      estadoCatalogo.categorias = Array.isArray(resCats.data) ? resCats.data : [];
      estadoCatalogo.cores = Array.isArray(resCores.data) ? resCores.data : [];
      estadoCatalogo.tamanhos = Array.isArray(resTams.data) ? resTams.data : [];

      if (resCfg && resCfg.data) {
        aplicarConfiguracoesEmDadosLoja(resCfg.data);
      }

      const listaBruta = Array.isArray(resProds.data) ? resProds.data : [];
      const todosNormalizados = listaBruta.map((p) => normalizarProdutoDoBanco(p, true));
      const publicosNormalizados = listaBruta
        .filter((p) => p.status === "published" && p.is_active !== false)
        .map((p) => normalizarProdutoDoBanco(p, false));

      estadoCatalogo.todosProdutosAdmin = todosNormalizados;
      estadoCatalogo.produtosPublicos = publicosNormalizados;
      estadoCatalogo.usandoBancoSupabase = true;
      estadoCatalogo.carregado = true;

      if (modoAdmin) {
        return estadoCatalogo;
      }

      return estadoCatalogo;
    } catch (err) {
      console.warn("[RPM Catalog] Falha de rede ao consultar Supabase, usando fallback:", err);
      return carregarFallbackLocal();
    }
  }

  function dispararEventoAtualizacao() {
    window.dispatchEvent(new CustomEvent("rpm:catalogo-atualizado"));
  }

  // Busca um produto específico por slug ou id (inclusive verificando se foi despublicado/excluído)
  async function buscarProdutoPorSlugOuId(slugOuId) {
    if (!estadoCatalogo.carregado) {
      await carregarCatalogo(false);
    }

    const alvo = String(slugOuId || "").trim().toLowerCase();
    if (!alvo) return { status: "not_found", produto: null };

    const encontradoPublico = estadoCatalogo.produtosPublicos.find(
      (p) => p.slug.toLowerCase() === alvo || String(p.id).toLowerCase() === alvo
    );

    if (encontradoPublico) {
      return { status: "published", produto: encontradoPublico };
    }

    // Se não achou na lista em memória e o banco está ativo, consulta diretamente no Supabase
    if (estadoCatalogo.usandoBancoSupabase) {
      const supabase = window.getRpmSupabaseClient();
      const { data } = await supabase
        .from("products")
        .select("*, product_images(*), product_variants(*)")
        .eq("slug", alvo)
        .maybeSingle();

      if (data) {
        const prod = normalizarProdutoDoBanco(data, false);
        if (prod.publicado) {
          return { status: "published", produto: prod };
        }
        return { status: "unavailable", produto: prod };
      }
    }

    return { status: "unavailable", produto: null };
  }

  function resolverProdutoInterno(produtoOuId) {
    if (!produtoOuId) return null;
    if (typeof produtoOuId === "object" && Array.isArray(produtoOuId.variantesLoja)) {
      return produtoOuId;
    }
    const alvo = String(produtoOuId || "").trim().toLowerCase();
    return (
      estadoCatalogo.produtosPublicos.find(
        (p) => String(p.id).toLowerCase() === alvo || String(p.slug).toLowerCase() === alvo
      ) || null
    );
  }

  function obterProdutoPublicadoPorSlugOuId(slugOuId) {
    return resolverProdutoInterno(slugOuId);
  }

  function obterEstoqueVariante(produtoOuId, corNome, tamanhoCodigo) {
    const produto = resolverProdutoInterno(produtoOuId);
    if (!produto || !Array.isArray(produto.variantesLoja)) return 0;
    const variante = produto.variantesLoja.find(
      (v) =>
        v.colorName.toLowerCase() === String(corNome || "").trim().toLowerCase() &&
        v.sizeCode.toLowerCase() === String(tamanhoCodigo || "").trim().toLowerCase()
    );
    return variante ? variante.stockQuantity : 0;
  }

  function verificarCorComEstoque(produtoOuId, corNome) {
    const produto = resolverProdutoInterno(produtoOuId);
    if (!produto || !Array.isArray(produto.variantesLoja)) return false;
    const alvoCor = String(corNome || "").trim().toLowerCase();
    return produto.variantesLoja.some(
      (v) => v.colorName.toLowerCase() === alvoCor && v.stockQuantity > 0
    );
  }

  // Revalida preço vigente e disponibilidade real no Supabase antes de concluir pedido
  async function revalidarItensSacola(itensSacola) {
    await carregarCatalogo(false);

    const problemasEstoque = [];
    const alteracoesPreco = [];
    const itensValidados = [];

    for (const item of itensSacola) {
      const prod = estadoCatalogo.produtosPublicos.find(
        (p) => String(p.id) === String(item.id) || p.slug === item.slug
      );

      if (!prod || !prod.publicado) {
        problemasEstoque.push(
          `A peça "${item.nome}" não está mais disponível para venda.`
        );
        continue;
      }

      const estoqueAtual = obterEstoqueVariante(prod, item.cor, item.tamanho);
      if (estoqueAtual <= 0) {
        problemasEstoque.push(
          `"${prod.nome}" na cor ${item.cor} (Tam ${item.tamanho}) esgotou.`
        );
        continue;
      }

      if (item.qtd > estoqueAtual) {
        problemasEstoque.push(
          `"${prod.nome}" (${item.cor} • Tam ${item.tamanho}) possui apenas ${estoqueAtual} unidade(s) em estoque.`
        );
        itensValidados.push({
          ...item,
          id: prod.id,
          slug: prod.slug,
          nome: prod.nome,
          imagem: prod.imagem,
          preco: prod.preco,
          qtd: estoqueAtual
        });
        continue;
      }

      if (Math.abs(Number(item.preco) - Number(prod.preco)) > 0.009) {
        alteracoesPreco.push(`O preço de "${prod.nome}" foi atualizado para o valor vigente.`);
      }

      itensValidados.push({
        ...item,
        id: prod.id,
        slug: prod.slug,
        nome: prod.nome,
        imagem: prod.imagem,
        preco: prod.preco
      });
    }

    return {
      valido: problemasEstoque.length === 0,
      problemasEstoque,
      alteracoesPreco,
      alteracoes: [...problemasEstoque, ...alteracoesPreco],
      itensAtualizados: itensValidados
    };
  }

  // ==========================================================================
  // OPERAÇÕES ADMINISTRATIVAS (PROTEGIDAS POR RLS NO SUPABASE)
  // ==========================================================================
  async function uploadFotoStorage(arquivo, slugProduto) {
    const supabase = window.getRpmSupabaseClient();
    if (!supabase) throw new Error("Cliente Supabase indisponível.");

    const bucket = window.RPM_SUPABASE_CONFIG.storageBucket || "product-images";
    const ext = (arquivo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const baseLimpa = normalizarSlug(arquivo.name.replace(/\.[^.]+$/, "")) || "foto";
    const pasta = normalizarSlug(slugProduto) || "peca";
    const caminho = `products/${pasta}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}-${baseLimpa}.${ext}`;

    const { error: erroUp } = await supabase.storage.from(bucket).upload(caminho, arquivo, {
      cacheControl: "3600",
      upsert: false
    });

    if (erroUp) {
      throw new Error(`Falha ao enviar imagem "${arquivo.name}": ${erroUp.message}`);
    }

    const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(caminho);
    return {
      storagePath: caminho,
      imageUrl: pubData.publicUrl
    };
  }

  async function excluirFotoStorage(storagePath) {
    if (!storagePath) return;
    const supabase = window.getRpmSupabaseClient();
    const bucket = window.RPM_SUPABASE_CONFIG.storageBucket || "product-images";
    await supabase.storage.from(bucket).remove([storagePath]);
  }

  async function garantirSlugUnico(slugBase, ignorarId = null) {
    const supabase = window.getRpmSupabaseClient();
    const base = normalizarSlug(slugBase) || `produto-${Date.now()}`;
    let candidato = base;
    let contador = 2;

    while (true) {
      const { data } = await supabase
        .from("products")
        .select("id")
        .eq("slug", candidato)
        .maybeSingle();

      if (!data || (ignorarId && String(data.id) === String(ignorarId))) {
        return candidato;
      }
      candidato = `${base}-${contador}`;
      contador += 1;
    }
  }

  async function salvarProdutoAdmin(payload) {
    const supabase = window.getRpmSupabaseClient();
    const editandoId = payload.id || null;
    const slugFinal = await garantirSlugUnico(payload.slug || payload.name, editandoId);

    // 1. Faz upload de eventuais novos arquivos de imagem para o Supabase Storage
    const imagensFinais = [];
    for (let i = 0; i < (payload.images || []).length; i += 1) {
      const itemImg = payload.images[i];
      if (itemImg.file) {
        const up = await uploadFotoStorage(itemImg.file, slugFinal);
        imagensFinais.push({
          image_url: up.imageUrl,
          storage_path: up.storagePath,
          color_name: itemImg.colorName || null,
          is_primary: i === 0,
          display_order: i
        });
      } else if (itemImg.imageUrl) {
        imagensFinais.push({
          id: itemImg.id || null,
          image_url: itemImg.imageUrl,
          storage_path: itemImg.storagePath || null,
          color_name: itemImg.colorName || null,
          is_primary: i === 0,
          display_order: i
        });
      }
    }

    const urlPrincipal =
      (imagensFinais[0] && imagensFinais[0].image_url) || "vestido-midi-linho.jpg";

    const variantesLimpas = (payload.variants || []).map((v) => ({
      color_name: String(v.colorName || "Única").trim(),
      color_hex: obterHexCor(v.colorName, v.colorHex),
      size_code: String(v.sizeCode || "Único").trim(),
      stock_quantity: Math.max(0, Math.floor(Number(v.stockQuantity || 0))),
      is_active: v.isActive !== false
    }));

    const estoqueTotalCalculado = variantesLimpas
      .filter((v) => v.is_active)
      .reduce((acc, v) => acc + v.stock_quantity, 0);

    const dadosTabelaProduto = {
      slug: slugFinal,
      name: String(payload.name || "").trim(),
      category_id: payload.categoryId || null,
      category_name: String(payload.categoryName || "Coleção").trim(),
      description: String(payload.description || "").trim(),
      fabric_details: String(payload.fabricDetails || "").trim(),
      price: Number(payload.price || 0),
      promo_price:
        payload.promoPrice !== null && payload.promoPrice !== "" && Number(payload.promoPrice) > 0
          ? Number(payload.promoPrice)
          : null,
      installments_max: Math.max(1, Math.floor(Number(payload.installmentsMax || 3))),
      badge_label: String(payload.badgeLabel || "").trim() || null,
      is_bestseller: Boolean(payload.isBestseller),
      status: payload.status === "draft" ? "draft" : "published",
      is_active: payload.status !== "draft" && payload.status !== "archived",
      main_image_url: urlPrincipal,
      total_stock: estoqueTotalCalculado
    };

    let prodId = editandoId;
    if (editandoId) {
      const { error: errUpd } = await supabase
        .from("products")
        .update(dadosTabelaProduto)
        .eq("id", editandoId);
      if (errUpd) throw new Error(errUpd.message);
    } else {
      const { data: criado, error: errIns } = await supabase
        .from("products")
        .insert(dadosTabelaProduto)
        .select("id")
        .single();
      if (errIns) throw new Error(errIns.message);
      prodId = criado.id;
    }

    // 2. Remove imagens antigas excluídas da galeria e sincroniza product_images
    if (Array.isArray(payload.removedStoragePaths)) {
      for (const pathAntigo of payload.removedStoragePaths) {
        await excluirFotoStorage(pathAntigo);
      }
    }

    await supabase.from("product_images").delete().eq("product_id", prodId);
    if (imagensFinais.length > 0) {
      const rowsImgs = imagensFinais.map((img, idx) => ({
        product_id: prodId,
        image_url: img.image_url,
        storage_path: img.storage_path || null,
        color_name: img.color_name || null,
        is_primary: idx === 0,
        display_order: idx
      }));
      const { error: errImgs } = await supabase.from("product_images").insert(rowsImgs);
      if (errImgs) throw new Error(errImgs.message);
    }

    // 3. Sincroniza variantes (Cor + Tamanho + Estoque individual)
    const { data: existentes } = await supabase
      .from("product_variants")
      .select("id, color_name, size_code")
      .eq("product_id", prodId);

    const chavesMantidas = new Set(
      variantesLimpas.map((v) => `${v.color_name.toLowerCase()}__${v.size_code.toLowerCase()}`)
    );

    const idsParaRemover = (existentes || [])
      .filter(
        (ex) =>
          !chavesMantidas.has(`${ex.color_name.toLowerCase()}__${ex.size_code.toLowerCase()}`)
      )
      .map((ex) => ex.id);

    if (idsParaRemover.length > 0) {
      await supabase.from("product_variants").delete().in("id", idsParaRemover);
    }

    if (variantesLimpas.length > 0) {
      const rowsVars = variantesLimpas.map((v) => ({
        product_id: prodId,
        color_name: v.color_name,
        color_hex: v.color_hex,
        size_code: v.size_code,
        stock_quantity: v.stock_quantity,
        is_active: v.is_active
      }));

      const { error: errVars } = await supabase
        .from("product_variants")
        .upsert(rowsVars, { onConflict: "product_id,color_name,size_code" });
      if (errVars) throw new Error(errVars.message);
    }

    await carregarCatalogo(true);
    dispararEventoAtualizacao();
    return prodId;
  }

  async function alterarStatusProdutoAdmin(productId, novoStatus) {
    const supabase = window.getRpmSupabaseClient();
    const ativo = novoStatus === "published";
    const { error } = await supabase
      .from("products")
      .update({ status: novoStatus, is_active: ativo })
      .eq("id", productId);
    if (error) throw new Error(error.message);
    await carregarCatalogo(true);
    dispararEventoAtualizacao();
  }

  // Exclui produto ou arquiva com segurança caso haja pedidos antigos vinculados (Item 10)
  async function excluirProdutoAdmin(productId) {
    const supabase = window.getRpmSupabaseClient();

    const { count } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);

    if (count && count > 0) {
      const { error: errArc } = await supabase
        .from("products")
        .update({ status: "archived", is_active: false })
        .eq("id", productId);
      if (errArc) throw new Error(errArc.message);
      await carregarCatalogo(true);
      dispararEventoAtualizacao();
      return { acao: "archived" };
    }

    const { data: imgs } = await supabase
      .from("product_images")
      .select("storage_path")
      .eq("product_id", productId);

    for (const img of imgs || []) {
      if (img.storage_path) await excluirFotoStorage(img.storage_path);
    }

    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) throw new Error(error.message);

    await carregarCatalogo(true);
    dispararEventoAtualizacao();
    return { acao: "deleted" };
  }

  async function atualizarEstoqueVarianteAdmin(variantId, novaQtd, isAtiva = true) {
    const supabase = window.getRpmSupabaseClient();
    const qtdSegura = Math.max(0, Math.floor(Number(novaQtd || 0)));

    const { data: varRow, error } = await supabase
      .from("product_variants")
      .update({ stock_quantity: qtdSegura, is_active: Boolean(isAtiva) })
      .eq("id", variantId)
      .select("product_id")
      .single();

    if (error) throw new Error(error.message);

    // Recalcula estoque total do produto
    if (varRow && varRow.product_id) {
      const { data: varsProd } = await supabase
        .from("product_variants")
        .select("stock_quantity, is_active")
        .eq("product_id", varRow.product_id);

      const soma = (varsProd || [])
        .filter((v) => v.is_active !== false)
        .reduce((acc, v) => acc + Math.max(0, Number(v.stock_quantity || 0)), 0);

      await supabase.from("products").update({ total_stock: soma }).eq("id", varRow.product_id);
    }

    await carregarCatalogo(true);
    dispararEventoAtualizacao();
  }

  async function removerVarianteIndividualAdmin(variantId) {
    const supabase = window.getRpmSupabaseClient();
    const { data: varRow } = await supabase
      .from("product_variants")
      .select("product_id")
      .eq("id", variantId)
      .maybeSingle();

    const { error } = await supabase.from("product_variants").delete().eq("id", variantId);
    if (error) throw new Error(error.message);

    if (varRow && varRow.product_id) {
      const { data: varsProd } = await supabase
        .from("product_variants")
        .select("stock_quantity, is_active")
        .eq("product_id", varRow.product_id);
      const soma = (varsProd || [])
        .filter((v) => v.is_active !== false)
        .reduce((acc, v) => acc + Math.max(0, Number(v.stock_quantity || 0)), 0);
      await supabase.from("products").update({ total_stock: soma }).eq("id", varRow.product_id);
    }

    await carregarCatalogo(true);
    dispararEventoAtualizacao();
  }

  // Categorias, Cores, Tamanhos e Configurações da Loja
  async function salvarCategoriaAdmin({ id, name, displayOrder, isActive }) {
    const supabase = window.getRpmSupabaseClient();
    const nomeLimpo = String(name || "").trim();
    const payload = {
      name: nomeLimpo,
      slug: normalizarSlug(nomeLimpo),
      display_order: Number(displayOrder || 1),
      is_active: isActive !== false
    };
    const res = id
      ? await supabase.from("categories").update(payload).eq("id", id)
      : await supabase.from("categories").insert(payload);
    if (res.error) throw new Error(res.error.message);
    await carregarCatalogo(true);
    dispararEventoAtualizacao();
  }

  async function excluirCategoriaAdmin(id) {
    const supabase = window.getRpmSupabaseClient();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await carregarCatalogo(true);
    dispararEventoAtualizacao();
  }

  async function salvarCorAdmin({ id, name, hexCode, isActive, displayOrder }) {
    const supabase = window.getRpmSupabaseClient();
    const payload = {
      name: String(name || "").trim(),
      hex_code: obterHexCor(name, hexCode),
      is_active: isActive !== false,
      display_order: Number(displayOrder || estadoCatalogo.cores.length + 1)
    };
    const res = id
      ? await supabase.from("colors").update(payload).eq("id", id)
      : await supabase.from("colors").insert(payload);
    if (res.error) throw new Error(res.error.message);
    await carregarCatalogo(true);
    dispararEventoAtualizacao();
  }

  async function excluirCorAdmin(id) {
    const supabase = window.getRpmSupabaseClient();
    const { error } = await supabase.from("colors").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await carregarCatalogo(true);
    dispararEventoAtualizacao();
  }

  async function salvarTamanhoAdmin({ id, code, label, isActive, displayOrder }) {
    const supabase = window.getRpmSupabaseClient();
    const codLimpo = String(code || "").trim();
    const payload = {
      code: codLimpo,
      label: String(label || codLimpo).trim(),
      is_active: isActive !== false,
      display_order: Number(displayOrder || estadoCatalogo.tamanhos.length + 1)
    };
    const res = id
      ? await supabase.from("sizes").update(payload).eq("id", id)
      : await supabase.from("sizes").insert(payload);
    if (res.error) throw new Error(res.error.message);
    await carregarCatalogo(true);
    dispararEventoAtualizacao();
  }

  async function excluirTamanhoAdmin(id) {
    const supabase = window.getRpmSupabaseClient();
    const { error } = await supabase.from("sizes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await carregarCatalogo(true);
    dispararEventoAtualizacao();
  }

  async function salvarConfiguracoesAdmin(novasCfg) {
    const supabase = window.getRpmSupabaseClient();
    const payload = {
      id: 1,
      ...novasCfg,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from("store_settings")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    aplicarConfiguracoesEmDadosLoja(data);
    await carregarCatalogo(true);
    dispararEventoAtualizacao();
  }

  // Inicializa o fallback local imediatamente para renderização instantânea
  carregarFallbackLocal();

  window.RpmCatalog = Object.freeze({
    slugify: normalizarSlug,
    getColorHex: obterHexCor,
    loadCatalog: carregarCatalogo,
    getPublishedProducts: () => estadoCatalogo.produtosPublicos,
    getPublicProducts: () => estadoCatalogo.produtosPublicos,
    getAllAdminProducts: () => estadoCatalogo.todosProdutosAdmin.filter((p) => p.status !== "archived"),
    getActiveCategories: () => estadoCatalogo.categorias.filter((c) => c.is_active !== false),
    getAllCategoriesAdmin: () => estadoCatalogo.categorias,
    getAllColorsAdmin: () => estadoCatalogo.cores,
    getActiveColors: () => estadoCatalogo.cores.filter((c) => c.is_active !== false),
    getAllSizesAdmin: () => estadoCatalogo.tamanhos,
    getActiveSizes: () => estadoCatalogo.tamanhos.filter((s) => s.is_active !== false),
    getStoreSettings: () => estadoCatalogo.configuracoes,
    isUsingSupabaseDb: () => estadoCatalogo.usandoBancoSupabase,
    getProductBySlugOrId: obterProdutoPublicadoPorSlugOuId,
    findProductBySlugOrId: buscarProdutoPorSlugOuId,
    getVariantStock: obterEstoqueVariante,
    hasColorAnyStock: verificarCorComEstoque,
    revalidateCart: revalidarItensSacola,
    // Métodos administrativos
    saveProduct: salvarProdutoAdmin,
    setProductStatus: alterarStatusProdutoAdmin,
    deleteProduct: excluirProdutoAdmin,
    updateVariantStock: atualizarEstoqueVarianteAdmin,
    deleteSingleVariant: removerVarianteIndividualAdmin,
    saveCategory: salvarCategoriaAdmin,
    deleteCategory: excluirCategoriaAdmin,
    saveColor: salvarCorAdmin,
    deleteColor: excluirCorAdmin,
    saveSize: salvarTamanhoAdmin,
    deleteSize: excluirTamanhoAdmin,
    saveSettings: salvarConfiguracoesAdmin
  });
})();
