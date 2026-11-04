/**
 * ============================================================================
 * RPM MODAS — SERVIÇO CENTRAL DO CMS VISUAL (FASE 1: ESTRUTURA, TEMA, SEÇÕES,
 * RASCUNHOS ISOLADOS, PUBLICAÇÃO ATÔMICA, MÍDIA E HISTÓRICO DE VERSÕES)
 * ============================================================================
 * Regras de Segurança:
 * - Visitantes e clientes comuns leem SOMENTE public.site_cms_published.
 * - Rascunhos (site_cms_drafts), biblioteca (site_media_library) e histórico
 *   (site_cms_versions) exigem permissão real public.is_admin() via RLS.
 * - Todo texto editável é escapado contra XSS (nenhum HTML/JS arbitrário executa).
 * - Imagens em uso no site publicado, rascunho, produtos ou histórico são
 *   protegidas contra exclusão automática/acidental.
 */
(function () {
  "use strict";

  const BUCKET_SITE_MEDIA = "site-media";
  const TIPOS_IMAGEM_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const TAMANHO_MAXIMO_BYTES = 8 * 1024 * 1024; // 8 MB

  const FONTES_DISPONIVEIS = {
    "Cormorant Garamond": '"Cormorant Garamond", Georgia, serif',
    "Playfair Display": '"Playfair Display", Georgia, serif',
    Lora: '"Lora", Georgia, serif',
    "Libre Baskerville": '"Libre Baskerville", Georgia, serif',
    "Plus Jakarta Sans":
      '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    Montserrat: '"Montserrat", -apple-system, BlinkMacSystemFont, sans-serif',
    Inter: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    Lato: '"Lato", -apple-system, BlinkMacSystemFont, sans-serif',
    Georgia: "Georgia, 'Times New Roman', serif"
  };

  const FONTES_GOOGLE_URL =
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600;700&family=Lato:ital,wght@0,400;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,400&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap";

  function clonarProfundo(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function escaparHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function validarCorCss(valor, padrao) {
    const limpo = String(valor || "").trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(limpo)) return limpo;
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(limpo)) {
      return limpo;
    }
    return padrao;
  }

  function sanitizarUrlSegura(url, fallback = "#inicio") {
    const raw = String(url || "").trim();
    if (!raw) return fallback;
    const lower = raw.toLowerCase();
    if (
      lower.startsWith("javascript:") ||
      lower.startsWith("vbscript:") ||
      lower.startsWith("data:text/")
    ) {
      return fallback;
    }
    return raw;
  }

  function resolverUrlMidia(caminhoOuUrl) {
    const limpa = sanitizarUrlSegura(caminhoOuUrl, "");
    if (!limpa) return "";
    if (window.resolveRpmAssetUrl) {
      return window.resolveRpmAssetUrl(limpa);
    }
    return limpa;
  }

  // ==========================================================================
  // CONFIGURAÇÃO PADRÃO ORIGINAL DA RPM MODAS (100% FIEL AO DESIGN DE LUXO)
  // ==========================================================================
  function obterConfigPadraoOriginal() {
    return {
      version_number: 1,
      theme_config: {
        colors: {
          primary: "#231b16",
          secondary: "#f3ece2",
          accent: "#b8644f",
          accentDark: "#9c4f3b",
          buttonBg: "#231b16",
          buttonText: "#ffffff",
          headingColor: "#231b16",
          textColor: "#66584e",
          pageBg: "#faf7f2",
          surfaceBg: "#ffffff",
          menuBg: "#faf7f2",
          menuText: "#231b16",
          cardBg: "#ffffff",
          borderColor: "#e5dcd0",
          iconColor: "#231b16",
          priceColor: "#231b16",
          promoColor: "#b84a32",
          topbarBg: "#231b16",
          topbarText: "#f7f1e8",
          footerBg: "#231b16",
          footerText: "#f7f1e8"
        },
        typography: {
          headingFont: "Cormorant Garamond",
          bodyFont: "Plus Jakarta Sans",
          buttonFont: "Plus Jakarta Sans",
          baseFontSize: 16,
          headingScale: 100,
          buttonFontSize: 13,
          fontWeightHeading: "600",
          fontWeightBody: "400",
          fontWeightButton: "600",
          lineHeight: 1.55,
          letterSpacing: 0,
          headingStyle: "normal",
          bodyStyle: "normal"
        }
      },
      header_config: {
        showTopbar: true,
        topbarMessages: [
          "✨ Frete Grátis nas compras acima de R$ 299",
          "💚 5% OFF imediato no PIX",
          "📦 Enviamos para todo o Brasil"
        ],
        storeName: "RPM MODAS",
        storeSubtitle: "MODA FEMININA",
        showSubtitle: true,
        logoImageUrl: "",
        logoAlt: "Logo RPM MODAS",
        showLogoImage: false,
        logoSize: 25,
        headerLayout: "classic",
        showMenu: true,
        bagLabel: "Sacola",
        menuItems: [
          { id: "nav-inicio", label: "Início", target: "aba:inicio", visible: true },
          { id: "nav-catalogo", label: "Catálogo", target: "aba:catalogo", visible: true },
          { id: "nav-contato", label: "Contato", target: "aba:contato", visible: true },
          { id: "nav-sobre", label: "Sobre Nós", target: "pagina:sobre-nos", visible: false },
          { id: "nav-entrega", label: "Entrega", target: "pagina:entrega", visible: false },
          {
            id: "nav-trocas",
            label: "Trocas",
            target: "pagina:trocas-devolucoes",
            visible: false
          },
          { id: "nav-politicas", label: "Políticas", target: "pagina:politicas", visible: false }
        ]
      },
      footer_config: {
        visible: true,
        storeName: "RPM MODAS",
        storeSubtitle: "MODA FEMININA",
        tagline: "Elegância feminina com curadoria especial e atendimento próximo.",
        showTagline: false,
        showSocial: true,
        whatsappDisplay: "+55 (71) 99140-2776",
        instagramHandle: "@rpmmoda",
        instagramUrl: "https://instagram.com/rpmmoda",
        copyrightText: "Todos os direitos reservados.",
        layoutAlign: "space-between",
        links: [
          { id: "ft-inicio", label: "Início", target: "aba:inicio", visible: true },
          { id: "ft-catalogo", label: "Catálogo", target: "aba:catalogo", visible: true },
          { id: "ft-contato", label: "Contato", target: "aba:contato", visible: true },
          { id: "ft-sobre", label: "Sobre Nós", target: "pagina:sobre-nos", visible: false },
          { id: "ft-entrega", label: "Entrega", target: "pagina:entrega", visible: false },
          {
            id: "ft-trocas",
            label: "Trocas e Devoluções",
            target: "pagina:trocas-devolucoes",
            visible: false
          },
          {
            id: "ft-politicas",
            label: "Políticas da Loja",
            target: "pagina:politicas",
            visible: false
          }
        ]
      },
      banners_config: [
        {
          id: "banner-1",
          visible: true,
          imageUrl: "hero-colecao.jpg",
          imageAlt: "Coleção feminina RPM MODAS",
          objectFit: "cover",
          objectPosition: "50% 18%",
          imageScale: 100,
          minHeight: 540,
          sectionWidth: "full",
          contentPosition: "left",
          textAlign: "left",
          paddingY: 56,
          cardBg: "#faf7f2",
          cardOpacity: 93,
          textColor: "#231b16",
          eyebrow: "NOVA COLEÇÃO • ELEGÂNCIA & CONFORTO",
          title: "Estilo e sofisticação para valorizar cada momento seu",
          description:
            "Bem-vinda à RPM MODAS! Confira nossas peças mais vendidas, aproveite as ofertas da semana e finalize seu pedido com praticidade direto pelo nosso WhatsApp.",
          primaryBtnText: "Ver Catálogo Completo",
          primaryBtnLink: "aba:catalogo",
          secondaryBtnText: "Nossos Contatos",
          secondaryBtnLink: "aba:contato"
        }
      ],
      sections_config: [
        {
          id: "sec-hero",
          type: "hero",
          label: "Banner Principal",
          visible: true,
          paddingY: 0,
          marginBottom: 0,
          sectionWidth: "full"
        },
        {
          id: "sec-search",
          type: "search",
          label: "Guia de Pesquisa Rápida",
          visible: true,
          eyebrow: "BUSCA RÁPIDA",
          title: "Encontre sua peça ideal",
          placeholder: "Pesquise por vestido, conjunto, blazer, linho, cor...",
          buttonText: "Buscar no Catálogo",
          bgColor: "",
          textColor: "",
          paddingY: 28,
          marginBottom: 0,
          sectionWidth: "contained",
          alignment: "left"
        },
        {
          id: "sec-bestsellers",
          type: "products",
          source: "bestsellers",
          label: "Roupas Mais Vendidas",
          visible: true,
          eyebrow: "AS QUERIDINHAS DAS CLIENTES",
          title: "Roupas Mais Vendidas",
          subtitle: "",
          ctaText: "Ver todo o catálogo →",
          ctaLink: "aba:catalogo",
          limit: 4,
          bgColor: "",
          textColor: "",
          paddingY: 56,
          marginBottom: 0,
          sectionWidth: "contained",
          alignment: "left"
        },
        {
          id: "sec-promotions",
          type: "products",
          source: "promotions",
          label: "Peças em Promoção",
          visible: true,
          eyebrow: "OFERTAS ESPECIAIS DA SEMANA",
          title: "Peças em Promoção",
          subtitle: "",
          ctaText: "Filtrar promoções no catálogo →",
          ctaLink: "filtro:promocao",
          limit: 4,
          bgColor: "#f3ece2",
          textColor: "",
          paddingY: 56,
          marginBottom: 0,
          sectionWidth: "contained",
          alignment: "left"
        },
        {
          id: "sec-novidades",
          type: "products",
          source: "newest",
          label: "Novidades",
          visible: false,
          eyebrow: "ACABARAM DE CHEGAR",
          title: "Novidades da Semana",
          subtitle: "As últimas peças adicionadas ao nosso acervo.",
          ctaText: "Explorar catálogo →",
          ctaLink: "aba:catalogo",
          limit: 4,
          bgColor: "",
          textColor: "",
          paddingY: 56,
          marginBottom: 0,
          sectionWidth: "contained",
          alignment: "left"
        },
        {
          id: "sec-featured-categories",
          type: "categories_grid",
          label: "Categorias em Destaque",
          visible: false,
          eyebrow: "NAVEGUE POR ESTILO",
          title: "Categorias em Destaque",
          subtitle: "Escolha sua categoria favorita para filtrar as peças.",
          bgColor: "",
          textColor: "",
          paddingY: 48,
          marginBottom: 0,
          sectionWidth: "contained",
          alignment: "center"
        },
        {
          id: "sec-collections",
          type: "collection_banner",
          label: "Coleções Especiais",
          visible: false,
          eyebrow: "COLEÇÃO CÁPSULA",
          title: "Alfaiataria & Linho Natural",
          subtitle:
            "Modelagens estruturadas e tecidos respiráveis que transitam do trabalho aos momentos especiais.",
          imageUrl: "conjunto-alfaiataria.jpg",
          imageAlt: "Coleção Alfaiataria RPM MODAS",
          objectFit: "cover",
          objectPosition: "50% 25%",
          minHeight: 380,
          ctaText: "Ver Peças da Coleção",
          ctaLink: "aba:catalogo",
          bgColor: "#f3ece2",
          textColor: "#231b16",
          paddingY: 52,
          marginBottom: 0,
          sectionWidth: "contained",
          alignment: "left"
        },
        {
          id: "sec-recommended",
          type: "products",
          source: "recommended",
          label: "Produtos Recomendados",
          visible: false,
          eyebrow: "CURADORIA RPM MODAS",
          title: "Recomendados Para Você",
          subtitle: "",
          ctaText: "Ver todo o catálogo →",
          ctaLink: "aba:catalogo",
          limit: 4,
          bgColor: "",
          textColor: "",
          paddingY: 56,
          marginBottom: 0,
          sectionWidth: "contained",
          alignment: "left"
        },
        {
          id: "sec-about-home",
          type: "about_block",
          label: "Sobre a RPM MODAS",
          visible: false,
          eyebrow: "NOSSA ESSÊNCIA",
          title: "Moda Feminina com Identidade e Sofisticação",
          subtitle:
            "Na RPM MODAS cada detalhe é pensado para oferecer caimento impecável, conforto e atendimento próximo pelo WhatsApp.",
          imageUrl: "vestido-midi-linho.jpg",
          imageAlt: "Sobre a RPM MODAS",
          objectFit: "cover",
          objectPosition: "50% 20%",
          minHeight: 360,
          ctaText: "Conhecer Nossa História",
          ctaLink: "pagina:sobre-nos",
          bgColor: "#ffffff",
          textColor: "#231b16",
          paddingY: 56,
          marginBottom: 0,
          sectionWidth: "contained",
          alignment: "left"
        },
        {
          id: "sec-shipping-info",
          type: "info_cards",
          label: "Informações de Entrega & Benefícios",
          visible: false,
          eyebrow: "EXPERIÊNCIA RPM MODAS",
          title: "Compre com Segurança e Praticidade",
          subtitle: "",
          bgColor: "#f3ece2",
          textColor: "#231b16",
          paddingY: 48,
          marginBottom: 0,
          sectionWidth: "contained",
          alignment: "center",
          cards: [
            {
              id: "inf-1",
              icon: "📦",
              title: "Envio para Todo o Brasil",
              text: "Seu pedido segue bem embalado e com acompanhamento até chegar a você."
            },
            {
              id: "inf-2",
              icon: "✨",
              title: "Frete Grátis acima de R$ 299",
              text: "Condição especial automática ao atingir o valor mínimo na sacola."
            },
            {
              id: "inf-3",
              icon: "💚",
              title: "5% OFF no PIX ou até 3x",
              text: "Economia imediata no PIX ou parcelamento sem juros no cartão."
            }
          ]
        }
      ],
      texts_config: {
        welcomeModalTitle: "Bem-vinda à RPM MODAS",
        welcomeModalSubtitle: "Entre na sua conta para continuar.",
        bagDrawerTitle: "Sua Sacola",
        promoHighlightMessage: "✨ Frete Grátis nas compras acima de R$ 299 • 5% OFF no PIX",
        searchPlaceholderCatalog: "Pesquisar roupa por nome, cor, tecido ou estilo...",
        customTextBlocks: []
      },
      pages_config: {
        categorias: {
          slug: "categorias",
          eyebrow: "COLEÇÃO COMPLETA RPM MODAS",
          title: "Catálogo de Roupas",
          subtitle:
            "Use a guia de pesquisa e os filtros abaixo para encontrar rapidamente o modelo, tamanho e valor ideal."
        },
        contato: {
          slug: "contato",
          eyebrow: "ATENDIMENTO RPM MODAS",
          title: "Fale Conosco",
          subtitle:
            "Entre em contato pelo nosso WhatsApp para dúvidas e pedidos, ou acompanhe nossas novidades diárias no Instagram!",
          waTag: "ATENDIMENTO RÁPIDO E PEDIDOS",
          waTitle: "WhatsApp Oficial",
          waDesc:
            "Tire dúvidas sobre tamanhos, tecidos, formas de pagamento, frete ou feche seu pedido diretamente com nossa equipe.",
          waBtnText: "Chamar no WhatsApp Agora",
          instaTag: "PROVADORES, LOOKS E NOVIDADES",
          instaTitle: "Nosso Instagram",
          instaDesc:
            "Siga a RPM MODAS no Instagram para acompanhar lançamentos em primeira mão, vídeos no corpo e promoções relâmpago nos Stories!",
          instaBtnText: "Seguir no Instagram",
          hoursTitle: "Horário de Funcionamento",
          hoursText: "Segunda a Sexta: 9h às 19h • Sábado: 9h às 15h",
          shippingTitle: "Envios & Entregas",
          shippingText: "Enviamos para todo o Brasil • Consulte entrega rápida na região",
          paymentTitle: "Formas de Pagamento",
          paymentText:
            "PIX com 5% de desconto imediato ou Cartão de Crédito em até 3x sem juros via link seguro."
        },
        "sobre-nos": {
          slug: "sobre-nos",
          eyebrow: "NOSSA ESSÊNCIA",
          title: "Sobre a RPM MODAS",
          subtitle: "Sofisticação feminina, caimento impecável e curadoria pensada para você.",
          imageUrl: "hero-colecao.jpg",
          imageAlt: "Coleção RPM MODAS",
          showImage: true,
          bgColor: "",
          textColor: "",
          alignment: "left",
          blocks: [
            {
              id: "sb-1",
              heading: "Nossa História",
              body: "A RPM MODAS nasceu em Salvador com o desejo de unir elegância atemporal, conforto e tecidos de alta qualidade para valorizar a mulher em todas as ocasiões.",
              visible: true
            },
            {
              id: "sb-2",
              heading: "Atendimento Consultivo",
              body: "Acreditamos em uma experiência acolhedora: nossa equipe auxilia na escolha de tamanhos, medidas e combinações diretamente pelo WhatsApp.",
              visible: true
            }
          ]
        },
        politicas: {
          slug: "politicas",
          eyebrow: "TRANSPARÊNCIA & CONFIANÇA",
          title: "Políticas da Loja",
          subtitle: "Diretrizes claras para uma experiência segura do início ao fim.",
          imageUrl: "",
          imageAlt: "",
          showImage: false,
          bgColor: "",
          textColor: "",
          alignment: "left",
          blocks: [
            {
              id: "pl-1",
              heading: "Privacidade e Segurança",
              body: "Seus dados de identificação e sacola são armazenados com criptografia e controle de acesso individual no Supabase, sem compartilhamento com terceiros.",
              visible: true
            },
            {
              id: "pl-2",
              heading: "Disponibilidade de Estoque",
              body: "O estoque de cada cor e tamanho é validado em tempo real antes da finalização do pedido.",
              visible: true
            }
          ]
        },
        entrega: {
          slug: "entrega",
          eyebrow: "LOGÍSTICA & PRAZOS",
          title: "Informações de Entrega",
          subtitle: "Receba suas peças no conforto do seu endereço em qualquer região do Brasil.",
          imageUrl: "",
          imageAlt: "",
          showImage: false,
          bgColor: "",
          textColor: "",
          alignment: "left",
          blocks: [
            {
              id: "en-1",
              heading: "Modalidades de Envio",
              body: "Enviamos via Correios (PAC e SEDEX) para todo o território nacional e contamos com entrega expressa/motoboy para Salvador e região.",
              visible: true
            },
            {
              id: "en-2",
              heading: "Benefício de Frete Grátis",
              body: "Pedidos acima de R$ 299,00 ganham Frete Grátis automaticamente no resumo da sacola.",
              visible: true
            }
          ]
        },
        "trocas-devolucoes": {
          slug: "trocas-devolucoes",
          eyebrow: "COMPRA SEM PREOCUPAÇÃO",
          title: "Trocas e Devoluções",
          subtitle: "Política simples e respeitosa conforme o Código de Defesa do Consumidor.",
          imageUrl: "",
          imageAlt: "",
          showImage: false,
          bgColor: "",
          textColor: "",
          alignment: "left",
          blocks: [
            {
              id: "tr-1",
              heading: "Prazo de 7 Dias",
              body: "Solicitações de troca ou devolução por arrependimento podem ser feitas em até 7 dias corridos após o recebimento, com a peça sem uso e com etiqueta afixada.",
              visible: true
            },
            {
              id: "tr-2",
              heading: "Como Solicitar",
              body: "Entre em contato pelo nosso WhatsApp oficial informando seu nome e o item adquirido para atendimento prioritário.",
              visible: true
            }
          ]
        }
      }
    };
  }

  // Mescla segura de um registro parcial vindo do banco com todos os padrões garantidos
  function normalizarSnapshotCompleto(raw) {
    const base = obterConfigPadraoOriginal();
    if (!raw || typeof raw !== "object") return base;

    const temaRaw = raw.theme_config || {};
    base.version_number = Number(raw.version_number || raw.based_on_version || 1);
    base.theme_config = {
      colors: { ...base.theme_config.colors, ...(temaRaw.colors || {}) },
      typography: { ...base.theme_config.typography, ...(temaRaw.typography || {}) }
    };
    base.header_config = {
      ...base.header_config,
      ...(raw.header_config || {}),
      topbarMessages: Array.isArray(raw.header_config?.topbarMessages)
        ? raw.header_config.topbarMessages
        : base.header_config.topbarMessages,
      menuItems: Array.isArray(raw.header_config?.menuItems)
        ? raw.header_config.menuItems
        : base.header_config.menuItems
    };
    base.footer_config = {
      ...base.footer_config,
      ...(raw.footer_config || {}),
      links: Array.isArray(raw.footer_config?.links)
        ? raw.footer_config.links
        : base.footer_config.links
    };
    if (Array.isArray(raw.banners_config) && raw.banners_config.length > 0) {
      base.banners_config = raw.banners_config.map((b, i) => ({
        ...base.banners_config[0],
        ...b,
        id: b.id || `banner-${i + 1}`
      }));
    }
    if (Array.isArray(raw.sections_config) && raw.sections_config.length > 0) {
      base.sections_config = raw.sections_config;
    }
    base.texts_config = {
      ...base.texts_config,
      ...(raw.texts_config || {}),
      customTextBlocks: Array.isArray(raw.texts_config?.customTextBlocks)
        ? raw.texts_config.customTextBlocks
        : []
    };
    if (raw.pages_config && typeof raw.pages_config === "object") {
      Object.keys(raw.pages_config).forEach((k) => {
        base.pages_config[k] = {
          ...(base.pages_config[k] || {}),
          ...raw.pages_config[k]
        };
      });
    }
    return base;
  }

  // ==========================================================================
  // ESTADO EM MEMÓRIA DO SERVIÇO CMS
  // ==========================================================================
  const estadoCms = {
    carregado: false,
    tabelaPublicadaAtiva: false,
    publicado: obterConfigPadraoOriginal(),
    rascunhoAdmin: null, // carregado SOMENTE para admin verificado
    modoPreviewRascunho: false, // true somente quando admin ativa pré-visualização
    dispositivoPreview: "desktop", // "desktop" | "mobile"
    indiceBannerAtivo: 0
  };

  function obterConfigAtivaNaVitrine() {
    if (
      estadoCms.modoPreviewRascunho &&
      estadoCms.rascunhoAdmin &&
      window.RPMAuth &&
      window.RPMAuth.isAdminVerified()
    ) {
      return estadoCms.rascunhoAdmin;
    }
    return estadoCms.publicado;
  }

  // ==========================================================================
  // APLICAÇÃO DINÂMICA DE FONTES, CORES, CABEÇALHO, RODAPÉ, SEÇÕES E PÁGINAS
  // ==========================================================================
  function garantirFontesGoogleCarregadas() {
    if (document.getElementById("rpm-cms-google-fonts")) return;
    const link = document.createElement("link");
    link.id = "rpm-cms-google-fonts";
    link.rel = "stylesheet";
    link.href = FONTES_GOOGLE_URL;
    document.head.appendChild(link);
  }

  function aplicarTemaVisualECores(cfg) {
    garantirFontesGoogleCarregadas();

    const c = cfg.theme_config.colors;
    const t = cfg.theme_config.typography;

    const famTitulo = FONTES_DISPONIVEIS[t.headingFont] || FONTES_DISPONIVEIS["Cormorant Garamond"];
    const famTexto = FONTES_DISPONIVEIS[t.bodyFont] || FONTES_DISPONIVEIS["Plus Jakarta Sans"];
    const famBotao = FONTES_DISPONIVEIS[t.buttonFont] || famTexto;

    const escala = Math.min(140, Math.max(75, Number(t.headingScale || 100))) / 100;
    const tamBase = Math.min(20, Math.max(13, Number(t.baseFontSize || 16)));
    const tamBotao = Math.min(17, Math.max(11, Number(t.buttonFontSize || 13)));
    const altLinha = Math.min(2.1, Math.max(1.15, Number(t.lineHeight || 1.55)));
    const espLetras = Math.min(0.15, Math.max(-0.04, Number(t.letterSpacing || 0)));

    const pesoTitulo =
      t.headingStyle === "bold" ? "700" : String(t.fontWeightHeading || "600");
    const estiloTitulo = t.headingStyle === "italic" ? "italic" : "normal";
    const pesoTexto = t.bodyStyle === "bold" ? "600" : String(t.fontWeightBody || "400");
    const estiloTexto = t.bodyStyle === "italic" ? "italic" : "normal";

    let styleTag = document.getElementById("rpm-cms-dynamic-theme");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "rpm-cms-dynamic-theme";
      document.head.appendChild(styleTag);
    }

    styleTag.textContent = `
      :root {
        --bg: ${validarCorCss(c.pageBg, "#faf7f2")};
        --surface: ${validarCorCss(c.surfaceBg, "#ffffff")};
        --surface-soft: ${validarCorCss(c.secondary, "#f3ece2")};
        --ink: ${validarCorCss(c.primary, "#231b16")};
        --ink-soft: ${validarCorCss(c.textColor, "#66584e")};
        --accent: ${validarCorCss(c.accent, "#b8644f")};
        --accent-dark: ${validarCorCss(c.accentDark, "#9c4f3b")};
        --border: ${validarCorCss(c.borderColor, "#e5dcd0")};
        --font-serif: ${famTitulo};
        --font-sans: ${famTexto};
      }
      html {
        font-size: ${tamBase}px;
      }
      body {
        font-family: var(--font-sans);
        font-weight: ${pesoTexto};
        font-style: ${estiloTexto};
        line-height: ${altLinha};
        letter-spacing: ${espLetras}em;
        background-color: var(--bg);
        color: var(--ink);
      }
      h1, h2, h3, .product-title, .brand-name {
        font-family: var(--font-serif);
        color: ${validarCorCss(c.headingColor, "#231b16")};
        font-weight: ${pesoTitulo};
        font-style: ${estiloTitulo};
      }
      .hero-card h1 {
        font-size: calc(clamp(2.1rem, 4.3vw, 3.35rem) * ${escala});
      }
      .section-header h2, .page-hero-compact h1 {
        font-size: calc(clamp(1.75rem, 3vw, 2.35rem) * ${escala});
      }
      .topbar {
        background-color: ${validarCorCss(c.topbarBg, "#231b16")};
        color: ${validarCorCss(c.topbarText, "#f7f1e8")};
      }
      .site-header {
        background-color: ${validarCorCss(c.menuBg, "#faf7f2")};
        color: ${validarCorCss(c.menuText, "#231b16")};
      }
      .site-header .tab-nav-btn {
        color: ${validarCorCss(c.menuText, "#231b16")};
      }
      .site-header .tab-nav-btn.active {
        background-color: ${validarCorCss(c.primary, "#231b16")};
        color: ${validarCorCss(c.buttonText, "#ffffff")};
      }
      .site-header .icon-btn,
      .search-input-group svg {
        color: ${validarCorCss(c.iconColor, "#231b16")};
      }
      .btn, .btn-card-buy, .bag-trigger, .btn-header-entrar {
        font-family: ${famBotao};
        font-size: ${tamBotao}px;
        font-weight: ${String(t.fontWeightButton || "600")};
      }
      .btn-primary, .bag-trigger {
        background-color: ${validarCorCss(c.buttonBg, "#231b16")};
        border-color: ${validarCorCss(c.buttonBg, "#231b16")};
        color: ${validarCorCss(c.buttonText, "#ffffff")};
      }
      .btn-card-buy {
        border-color: ${validarCorCss(c.buttonBg, "#231b16")};
        color: ${validarCorCss(c.buttonBg, "#231b16")};
      }
      .btn-card-buy:hover {
        background-color: ${validarCorCss(c.buttonBg, "#231b16")};
        color: ${validarCorCss(c.buttonText, "#ffffff")};
      }
      .product-card {
        background-color: ${validarCorCss(c.cardBg, "#ffffff")};
      }
      .current-price {
        color: ${validarCorCss(c.priceColor, "#231b16")};
      }
      .product-badge.sale, .eyebrow-sale {
        background-color: ${validarCorCss(c.promoColor, "#b84a32")};
        color: #ffffff;
      }
      .eyebrow.eyebrow-sale {
        background-color: transparent;
        color: ${validarCorCss(c.promoColor, "#b84a32")};
      }
      .site-footer {
        background-color: ${validarCorCss(c.footerBg, "#231b16")};
        color: ${validarCorCss(c.footerText, "#f7f1e8")};
      }
      .site-footer .brand-name,
      .site-footer .footer-tab-btn,
      .site-footer .footer-social-quick,
      .site-footer .footer-bottom {
        color: ${validarCorCss(c.footerText, "#f7f1e8")};
      }
    `;
  }

  function executarDestinoLink(alvoBruto) {
    const alvo = sanitizarUrlSegura(alvoBruto, "aba:inicio");
    const ui = window.RPMStoreUI;

    if (alvo.startsWith("aba:")) {
      const aba = alvo.slice(4);
      if (ui && ui.navigateToTab) ui.navigateToTab(aba);
      return;
    }
    if (alvo.startsWith("pagina:")) {
      const slug = alvo.slice(7);
      if (ui && ui.openInstitutionalPage) ui.openInstitutionalPage(slug);
      return;
    }
    if (alvo === "filtro:promocao") {
      if (ui && ui.openPromoFilter) ui.openPromoFilter();
      return;
    }
    if (alvo.startsWith("categoria:")) {
      const cat = alvo.slice(10);
      if (ui && ui.openCategoryFilter) ui.openCategoryFilter(cat);
      return;
    }
    if (alvo.startsWith("/produto/") || alvo.startsWith("produto/")) {
      const slugProd = alvo.replace(/^\/?produto\//, "");
      window.dispatchEvent(new CustomEvent("rpm:abrir-pagina-produto", { detail: { slug: slugProd } }));
      return;
    }
    if (alvo.startsWith("http://") || alvo.startsWith("https://")) {
      window.open(alvo, "_blank", "noopener");
      return;
    }
    if (ui && ui.navigateToTab) ui.navigateToTab("inicio");
  }

  function aplicarCabecalhoERodape(cfg) {
    const h = cfg.header_config;
    const f = cfg.footer_config;
    const tx = cfg.texts_config;

    // 1. Topbar
    const topbarEl = document.querySelector(".topbar");
    const topbarInner = document.getElementById("topbar-avisos");
    if (topbarEl) {
      topbarEl.classList.toggle("hidden", h.showTopbar === false);
    }
    if (topbarInner && Array.isArray(h.topbarMessages)) {
      const msgs = h.topbarMessages.map((m) => String(m || "").trim()).filter(Boolean);
      topbarInner.innerHTML = msgs
        .map((m, idx) =>
          idx === 0
            ? `<span>${escaparHtml(m)}</span>`
            : `<span class="topbar-sep">•</span><span>${escaparHtml(m)}</span>`
        )
        .join("");
    }

    // 2. Logo e Nome no Cabeçalho
    const brandAnchor = document.querySelector(".site-header .brand-logo");
    if (brandAnchor) {
      const tamanhoLogo = Math.min(48, Math.max(16, Number(h.logoSize || 25)));
      const urlLogo = h.showLogoImage && h.logoImageUrl ? resolverUrlMidia(h.logoImageUrl) : "";
      brandAnchor.innerHTML = `
        ${
          urlLogo
            ? `<img src="${escaparHtml(urlLogo)}" alt="${escaparHtml(
                h.logoAlt || h.storeName
              )}" style="height:${tamanhoLogo + 10}px;width:auto;object-fit:contain;margin-bottom:2px;" />`
            : ""
        }
        <span class="brand-name" id="header-nome-loja" style="font-size:${(
          tamanhoLogo / 16
        ).toFixed(2)}rem">${escaparHtml(h.storeName || "RPM MODAS")}</span>
        ${
          h.showSubtitle !== false
            ? `<span class="brand-sub" id="header-sub-loja">${escaparHtml(
                h.storeSubtitle || ""
              )}</span>`
            : `<span class="brand-sub hidden" id="header-sub-loja"></span>`
        }
      `;
    }

    const headerInner = document.querySelector(".site-header .header-inner");
    if (headerInner) {
      headerInner.setAttribute("data-header-layout", h.headerLayout || "classic");
    }

    // 3. Menus Desktop e Mobile
    const navDesktop = document.querySelector(".desktop-nav");
    const navMobile = document.querySelector(".mobile-nav-links");
    const itensVisiveisMenu = (h.menuItems || []).filter((m) => m && m.visible !== false);

    if (navDesktop) {
      navDesktop.classList.toggle("hidden", h.showMenu === false);
      navDesktop.innerHTML = itensVisiveisMenu
        .map((item) => {
          const abaRef = item.target && item.target.startsWith("aba:") ? item.target.slice(4) : "";
          return `<button type="button" class="tab-nav-btn" ${
            abaRef ? `data-aba-link="${escaparHtml(abaRef)}"` : ""
          } data-cms-nav="${escaparHtml(item.target)}">${escaparHtml(item.label)}</button>`;
        })
        .join("");

      navDesktop.querySelectorAll("[data-cms-nav]").forEach((btn) => {
        btn.addEventListener("click", () => {
          executarDestinoLink(btn.getAttribute("data-cms-nav"));
        });
      });
    }

    if (navMobile) {
      navMobile.innerHTML = itensVisiveisMenu
        .map((item) => {
          const abaRef = item.target && item.target.startsWith("aba:") ? item.target.slice(4) : "";
          return `<button type="button" class="mobile-tab-btn" ${
            abaRef ? `data-aba-link="${escaparHtml(abaRef)}"` : ""
          } data-cms-nav="${escaparHtml(item.target)}">${escaparHtml(item.label)}</button>`;
        })
        .join("");

      navMobile.querySelectorAll("[data-cms-nav]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const menuDrawer = document.getElementById("menu-mobile");
          const backdrop = document.getElementById("backdrop");
          if (menuDrawer) menuDrawer.classList.add("hidden");
          if (backdrop) backdrop.classList.add("hidden");
          document.body.style.overflow = "";
          executarDestinoLink(btn.getAttribute("data-cms-nav"));
        });
      });
    }

    const bagLabelEl = document.querySelector(".bag-trigger .bag-label");
    if (bagLabelEl && h.bagLabel) {
      bagLabelEl.textContent = h.bagLabel;
    }

    // 4. Textos gerais (Modal Login, Sacola, Busca Catálogo)
    const loginTitulo = document.getElementById("titulo-modal-login");
    if (loginTitulo && tx.welcomeModalTitle) loginTitulo.textContent = tx.welcomeModalTitle;
    const bagDrawerH3 = document.querySelector("#sacola-drawer .drawer-header h3");
    if (bagDrawerH3 && tx.bagDrawerTitle) bagDrawerH3.textContent = tx.bagDrawerTitle;
    const inputCat = document.getElementById("input-pesquisa-catalogo");
    if (inputCat && tx.searchPlaceholderCatalog) {
      inputCat.placeholder = tx.searchPlaceholderCatalog;
    }

    // 5. Rodapé
    const footerEl = document.querySelector(".site-footer");
    if (footerEl) {
      footerEl.classList.toggle("hidden", f.visible === false);
      const setTxt = (id, v) => {
        const el = document.getElementById(id);
        if (el && v !== undefined) el.textContent = v;
      };
      setTxt("footer-nome-loja", f.storeName || h.storeName);
      setTxt("footer-sub-loja", f.storeSubtitle || h.storeSubtitle);
      setTxt("copy-nome-loja", f.storeName || h.storeName);
      setTxt("copy-sub-loja", f.storeSubtitle || h.storeSubtitle);
      setTxt("footer-whatsapp", f.whatsappDisplay || DADOS_LOJA.whatsappExibicao);

      let taglineEl = document.getElementById("footer-cms-tagline");
      const footerBrand = footerEl.querySelector(".footer-brand");
      if (footerBrand) {
        if (!taglineEl) {
          taglineEl = document.createElement("p");
          taglineEl.id = "footer-cms-tagline";
          taglineEl.style.fontSize = "0.8rem";
          taglineEl.style.opacity = "0.82";
          taglineEl.style.marginTop = "0.3rem";
          footerBrand.appendChild(taglineEl);
        }
        taglineEl.textContent = f.tagline || "";
        taglineEl.classList.toggle("hidden", !f.showTagline || !f.tagline);
      }

      const socialWrap = footerEl.querySelector(".footer-social-quick");
      if (socialWrap) {
        socialWrap.classList.toggle("hidden", f.showSocial === false);
      }
      const instaLink = document.getElementById("footer-instagram");
      if (instaLink) {
        if (f.instagramHandle) instaLink.textContent = f.instagramHandle;
        if (f.instagramUrl) instaLink.href = sanitizarUrlSegura(f.instagramUrl, "#");
      }

      const footerTabs = footerEl.querySelector(".footer-tabs");
      if (footerTabs) {
        const linksVisiveis = (f.links || []).filter((l) => l && l.visible !== false);
        footerTabs.innerHTML = linksVisiveis
          .map(
            (l) =>
              `<button type="button" class="footer-tab-btn" data-cms-footer-nav="${escaparHtml(
                l.target
              )}">${escaparHtml(l.label)}</button>`
          )
          .join("");
        footerTabs.querySelectorAll("[data-cms-footer-nav]").forEach((btn) => {
          btn.addEventListener("click", () => {
            executarDestinoLink(btn.getAttribute("data-cms-footer-nav"));
          });
        });
      }

      const copyP = footerEl.querySelector(".footer-bottom p");
      if (copyP) {
        const ano = new Date().getFullYear();
        copyP.innerHTML = `&copy; <span id="ano-atual">${ano}</span> <span id="copy-nome-loja">${escaparHtml(
          f.storeName || h.storeName
        )}</span> — <span id="copy-sub-loja">${escaparHtml(
          f.storeSubtitle || h.storeSubtitle
        )}</span>. ${escaparHtml(f.copyrightText || "Todos os direitos reservados.")}`;
      }
    }
  }

  // ==========================================================================
  // RENDERIZADOR DINÂMICO DE SEÇÕES DA PÁGINA INICIAL (#aba-inicio)
  // ==========================================================================
  function hexParaRgba(hex, opacidadePerc = 93) {
    const limpo = String(hex || "#faf7f2").replace("#", "");
    const alfa = Math.min(1, Math.max(0.15, Number(opacidadePerc || 93) / 100));
    if (limpo.length === 6) {
      const r = parseInt(limpo.slice(0, 2), 16);
      const g = parseInt(limpo.slice(2, 4), 16);
      const b = parseInt(limpo.slice(4, 6), 16);
      if (!Number.isNaN(r)) return `rgba(${r}, ${g}, ${b}, ${alfa})`;
    }
    return `rgba(250, 247, 242, ${alfa})`;
  }

  function selecionarProdutosParaSecao(secao) {
    const todos =
      window.RpmCatalog && window.RpmCatalog.getPublishedProducts
        ? window.RpmCatalog.getPublishedProducts()
        : DADOS_LOJA.produtos || [];
    const limite = Math.max(1, Math.min(24, Number(secao.limit || 4)));
    let filtrados = [...todos];

    if (secao.source === "bestsellers") {
      const mv = filtrados.filter((p) => Boolean(p.maisVendido));
      filtrados = mv.length ? mv : filtrados;
    } else if (secao.source === "promotions") {
      filtrados = filtrados.filter((p) => Boolean(p.precoAntigo && p.precoAntigo > p.preco));
    } else if (secao.source === "newest") {
      filtrados = [...todos];
    } else if (secao.source === "recommended") {
      filtrados = [...todos].reverse();
    } else if (secao.source && secao.source.startsWith("cat:")) {
      const nomeCat = secao.source.slice(4).toLowerCase();
      filtrados = filtrados.filter((p) => String(p.categoria || "").toLowerCase() === nomeCat);
    }

    return filtrados.slice(0, limite);
  }

  function renderizarSecaoHero(bannersVisiveis, secao) {
    if (!bannersVisiveis.length) return "";
    if (estadoCms.indiceBannerAtivo >= bannersVisiveis.length) {
      estadoCms.indiceBannerAtivo = 0;
    }
    const b = bannersVisiveis[estadoCms.indiceBannerAtivo] || bannersVisiveis[0];
    const minH = Math.max(280, Math.min(820, Number(b.minHeight || 540)));
    const padY = Math.max(20, Math.min(140, Number(b.paddingY ?? 56)));
    const escalaImg = Math.max(80, Math.min(160, Number(b.imageScale || 100))) / 100;
    const justifyMap = { left: "flex-start", center: "center", right: "flex-end" };
    const justify = justifyMap[b.contentPosition] || "flex-start";
    const textAlign = ["left", "center", "right"].includes(b.textAlign) ? b.textAlign : "left";
    const cardBgRgba = hexParaRgba(b.cardBg || "#faf7f2", b.cardOpacity ?? 93);
    const contido = (b.sectionWidth || secao.sectionWidth) === "contained";

    return `
      <div class="hero-section ${contido ? "container" : ""}" data-cms-section-id="${escaparHtml(
      secao.id
    )}" style="min-height:${minH}px;margin-bottom:${Number(
      secao.marginBottom || 0
    )}px;${contido ? "border-radius:var(--radius-lg);overflow:hidden;margin-top:1.25rem;" : ""}">
        <div class="hero-media">
          <img
            src="${escaparHtml(resolverUrlMidia(b.imageUrl || "hero-colecao.jpg"))}"
            alt="${escaparHtml(b.imageAlt || b.title || "RPM MODAS")}"
            class="hero-img"
            style="object-fit:${escaparHtml(b.objectFit || "cover")};object-position:${escaparHtml(
      b.objectPosition || "50% 18%"
    )};transform:scale(${escalaImg});"
          />
          <div class="hero-gradient"></div>
        </div>

        <div class="container hero-content-wrap" style="display:flex;justify-content:${justify};padding:${padY}px 0;">
          <div class="hero-card" style="background-color:${cardBgRgba};color:${validarCorCss(
      b.textColor,
      "#231b16"
    )};text-align:${textAlign};">
            ${
              b.eyebrow
                ? `<span class="eyebrow" id="hero-tag">${escaparHtml(b.eyebrow)}</span>`
                : ""
            }
            <h1 id="hero-titulo" style="color:${validarCorCss(b.textColor, "#231b16")}">${escaparHtml(
      b.title || ""
    )}</h1>
            ${
              b.description
                ? `<p id="hero-descricao" style="color:${validarCorCss(
                    b.textColor,
                    "#66584e"
                  )};opacity:0.9;">${escaparHtml(b.description)}</p>`
                : ""
            }
            <div class="hero-actions" style="justify-content:${justify};">
              ${
                b.primaryBtnText
                  ? `<button type="button" class="btn btn-primary" data-cms-cta="${escaparHtml(
                      b.primaryBtnLink || "aba:catalogo"
                    )}">${escaparHtml(b.primaryBtnText)}</button>`
                  : ""
              }
              ${
                b.secondaryBtnText
                  ? `<button type="button" class="btn btn-outline" data-cms-cta="${escaparHtml(
                      b.secondaryBtnLink || "aba:contato"
                    )}">${escaparHtml(b.secondaryBtnText)}</button>`
                  : ""
              }
            </div>

            ${
              bannersVisiveis.length > 1
                ? `
              <div class="cms-banner-dots" role="tablist" aria-label="Banners da página inicial">
                ${bannersVisiveis
                  .map(
                    (_, i) => `
                  <button
                    type="button"
                    class="cms-banner-dot ${i === estadoCms.indiceBannerAtivo ? "active" : ""}"
                    data-cms-banner-idx="${i}"
                    aria-label="Banner ${i + 1}"
                  ></button>
                `
                  )
                  .join("")}
              </div>
            `
                : ""
            }
          </div>
        </div>
      </div>
    `;
  }

  function renderizarSecoesPaginaInicial(cfg) {
    const homeEl = document.getElementById("aba-inicio");
    if (!homeEl) return;

    const bannersVisiveis = (cfg.banners_config || []).filter((b) => b && b.visible !== false);
    const secoesVisiveis = (cfg.sections_config || []).filter((s) => s && s.visible !== false);
    const blocosExtras = (cfg.texts_config?.customTextBlocks || []).filter(
      (bl) => bl && bl.visible !== false
    );

    const htmlSecoes = secoesVisiveis
      .map((sec) => {
        const padY = Math.max(0, Math.min(140, Number(sec.paddingY ?? 48)));
        const margB = Math.max(0, Math.min(120, Number(sec.marginBottom ?? 0)));
        const bgStyle = sec.bgColor ? `background-color:${validarCorCss(sec.bgColor, "")};` : "";
        const txtStyle = sec.textColor ? `color:${validarCorCss(sec.textColor, "")};` : "";
        const align = ["left", "center", "right"].includes(sec.alignment) ? sec.alignment : "left";
        const estiloWrapper = `${bgStyle}${txtStyle}padding:${padY}px 0;margin-bottom:${margB}px;`;

        if (sec.type === "hero") {
          return renderizarSecaoHero(bannersVisiveis, sec);
        }

        if (sec.type === "search") {
          const cats =
            window.RpmCatalog && window.RpmCatalog.getActiveCategories
              ? window.RpmCatalog.getActiveCategories()
              : [];
          const nomesCats = cats.length
            ? cats.map((c) => c.name)
            : ["Vestidos", "Conjuntos", "Alfaiataria", "Blusas & Saias"];
          return `
            <div class="home-search-wrapper" data-cms-section-id="${escaparHtml(
              sec.id
            )}" style="${estiloWrapper}">
              <div class="container">
                <div class="home-search-card" style="text-align:${align};">
                  <div class="home-search-header">
                    ${
                      sec.eyebrow
                        ? `<span class="search-kicker">${escaparHtml(sec.eyebrow)}</span>`
                        : ""
                    }
                    <h2>${escaparHtml(sec.title || "Encontre sua peça ideal")}</h2>
                  </div>
                  <form class="home-search-form" id="form-pesquisa-inicio">
                    <div class="search-input-group">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                      <input
                        type="search"
                        id="input-pesquisa-inicio"
                        placeholder="${escaparHtml(
                          sec.placeholder || "Pesquise por vestido, conjunto, blazer, linho, cor..."
                        )}"
                        autocomplete="off"
                        aria-label="Pesquisar roupas no site"
                      />
                    </div>
                    <button type="submit" class="btn btn-primary">${escaparHtml(
                      sec.buttonText || "Buscar no Catálogo"
                    )}</button>
                  </form>
                  <div class="quick-tags-row">
                    <span class="quick-tags-label">Sugestões:</span>
                    ${nomesCats
                      .map(
                        (cat) =>
                          `<button type="button" class="quick-tag" data-cms-cta="categoria:${escaparHtml(
                            cat
                          )}">${escaparHtml(cat)}</button>`
                      )
                      .join("")}
                    <button type="button" class="quick-tag quick-tag-sale" data-cms-cta="filtro:promocao">🔥 Em Promoção</button>
                  </div>
                  <div class="home-live-results hidden" id="resultados-rapidos-inicio"></div>
                </div>
              </div>
            </div>
          `;
        }

        if (sec.type === "products") {
          const isPromo = sec.source === "promotions";
          return `
            <div class="home-showcase-section" data-cms-section-id="${escaparHtml(
              sec.id
            )}" style="${estiloWrapper}">
              <div class="container">
                <div class="section-header" style="${
                  align === "center" ? "flex-direction:column;text-align:center;" : ""
                }">
                  <div>
                    ${
                      sec.eyebrow
                        ? `<span class="eyebrow ${isPromo ? "eyebrow-sale" : ""}">${escaparHtml(
                            sec.eyebrow
                          )}</span>`
                        : ""
                    }
                    <h2 style="${txtStyle}">${escaparHtml(sec.title || "Destaques")}</h2>
                    ${
                      sec.subtitle
                        ? `<p style="font-size:0.9rem;opacity:0.85;margin-top:0.25rem;">${escaparHtml(
                            sec.subtitle
                          )}</p>`
                        : ""
                    }
                  </div>
                  ${
                    sec.ctaText
                      ? `<button type="button" class="btn-link-arrow" data-cms-cta="${escaparHtml(
                          sec.ctaLink || "aba:catalogo"
                        )}">${escaparHtml(sec.ctaText)}</button>`
                      : ""
                  }
                </div>
                <div class="products-grid" data-cms-product-grid="${escaparHtml(sec.id)}"></div>
              </div>
            </div>
          `;
        }

        if (sec.type === "categories_grid") {
          const cats =
            window.RpmCatalog && window.RpmCatalog.getActiveCategories
              ? window.RpmCatalog.getActiveCategories()
              : [];
          const listaCats = cats.length
            ? cats
            : [
                { name: "Vestidos" },
                { name: "Conjuntos" },
                { name: "Alfaiataria" },
                { name: "Blusas & Saias" }
              ];
          return `
            <div class="home-showcase-section" data-cms-section-id="${escaparHtml(
              sec.id
            )}" style="${estiloWrapper}">
              <div class="container" style="text-align:${align};">
                ${sec.eyebrow ? `<span class="eyebrow">${escaparHtml(sec.eyebrow)}</span>` : ""}
                <h2 style="margin-bottom:0.5rem;${txtStyle}">${escaparHtml(
            sec.title || "Categorias"
          )}</h2>
                ${
                  sec.subtitle
                    ? `<p style="margin-bottom:1.5rem;opacity:0.85;">${escaparHtml(
                        sec.subtitle
                      )}</p>`
                    : ""
                }
                <div class="cms-categories-showcase">
                  ${listaCats
                    .map(
                      (c) => `
                    <button type="button" class="cms-category-tile" data-cms-cta="categoria:${escaparHtml(
                      c.name
                    )}">
                      <strong>${escaparHtml(c.name)}</strong>
                      <span>Ver peças →</span>
                    </button>
                  `
                    )
                    .join("")}
                </div>
              </div>
            </div>
          `;
        }

        if (
          sec.type === "collection_banner" ||
          sec.type === "about_block" ||
          sec.type === "custom_banner"
        ) {
          const minH = Math.max(220, Math.min(680, Number(sec.minHeight || 360)));
          const temImg = Boolean(sec.imageUrl);
          return `
            <div class="home-showcase-section" data-cms-section-id="${escaparHtml(
              sec.id
            )}" style="${estiloWrapper}">
              <div class="${sec.sectionWidth === "full" ? "" : "container"}">
                <div class="cms-split-feature" style="min-height:${minH}px;${
            !temImg ? "grid-template-columns:1fr;" : ""
          }">
                  ${
                    temImg
                      ? `
                    <div class="cms-split-media">
                      <img
                        src="${escaparHtml(resolverUrlMidia(sec.imageUrl))}"
                        alt="${escaparHtml(sec.imageAlt || sec.title || "RPM MODAS")}"
                        style="object-fit:${escaparHtml(
                          sec.objectFit || "cover"
                        )};object-position:${escaparHtml(sec.objectPosition || "50% 30%")};"
                      />
                    </div>
                  `
                      : ""
                  }
                  <div class="cms-split-content" style="text-align:${align};">
                    ${sec.eyebrow ? `<span class="eyebrow">${escaparHtml(sec.eyebrow)}</span>` : ""}
                    <h2 style="${txtStyle}">${escaparHtml(sec.title || "")}</h2>
                    ${
                      sec.subtitle
                        ? `<p style="margin:0.85rem 0 1.35rem;opacity:0.9;">${escaparHtml(
                            sec.subtitle
                          )}</p>`
                        : ""
                    }
                    ${
                      sec.ctaText
                        ? `<button type="button" class="btn btn-primary" data-cms-cta="${escaparHtml(
                            sec.ctaLink || "aba:catalogo"
                          )}">${escaparHtml(sec.ctaText)}</button>`
                        : ""
                    }
                  </div>
                </div>
              </div>
            </div>
          `;
        }

        if (sec.type === "info_cards") {
          const cards = Array.isArray(sec.cards) ? sec.cards : [];
          return `
            <div class="home-showcase-section" data-cms-section-id="${escaparHtml(
              sec.id
            )}" style="${estiloWrapper}">
              <div class="container" style="text-align:${align};">
                ${sec.eyebrow ? `<span class="eyebrow">${escaparHtml(sec.eyebrow)}</span>` : ""}
                <h2 style="margin-bottom:1.5rem;${txtStyle}">${escaparHtml(sec.title || "")}</h2>
                <div class="cms-info-cards-grid">
                  ${cards
                    .map(
                      (c) => `
                    <div class="cms-info-card">
                      ${c.icon ? `<div class="cms-info-icon">${escaparHtml(c.icon)}</div>` : ""}
                      <h3>${escaparHtml(c.title || "")}</h3>
                      <p>${escaparHtml(c.text || "")}</p>
                    </div>
                  `
                    )
                    .join("")}
                </div>
              </div>
            </div>
          `;
        }

        // custom_text
        return `
          <div class="home-showcase-section" data-cms-section-id="${escaparHtml(
            sec.id
          )}" style="${estiloWrapper}">
            <div class="container" style="text-align:${align};max-width:${Number(
          sec.maxWidth || 920
        )}px;">
              ${sec.eyebrow ? `<span class="eyebrow">${escaparHtml(sec.eyebrow)}</span>` : ""}
              ${sec.title ? `<h2 style="margin-bottom:0.75rem;${txtStyle}">${escaparHtml(sec.title)}</h2>` : ""}
              ${
                sec.subtitle
                  ? `<p style="white-space:pre-line;opacity:0.92;">${escaparHtml(sec.subtitle)}</p>`
                  : ""
              }
              ${
                sec.ctaText
                  ? `<div style="margin-top:1.25rem;"><button type="button" class="btn btn-outline" data-cms-cta="${escaparHtml(
                      sec.ctaLink || "aba:catalogo"
                    )}">${escaparHtml(sec.ctaText)}</button></div>`
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");

    const htmlBlocosTextoExtras = blocosExtras
      .map(
        (bl) => `
      <div class="home-showcase-section" style="padding:2rem 0;">
        <div class="container" style="text-align:${escaparHtml(bl.align || "center")};">
          ${bl.eyebrow ? `<span class="eyebrow">${escaparHtml(bl.eyebrow)}</span>` : ""}
          ${bl.title ? `<h2 style="margin-bottom:0.5rem;">${escaparHtml(bl.title)}</h2>` : ""}
          ${bl.body ? `<p style="white-space:pre-line;">${escaparHtml(bl.body)}</p>` : ""}
        </div>
      </div>
    `
      )
      .join("");

    homeEl.innerHTML = htmlSecoes + htmlBlocosTextoExtras;

    // Popula cada grade de produtos mantendo os cards oficiais conectados ao estoque real
    if (window.RPMStoreUI && window.RPMStoreUI.renderProductCardsInto) {
      secoesVisiveis
        .filter((s) => s.type === "products")
        .forEach((sec) => {
          const gridEl = homeEl.querySelector(`[data-cms-product-grid="${sec.id}"]`);
          if (gridEl) {
            const lista = selecionarProdutosParaSecao(sec);
            window.RPMStoreUI.renderProductCardsInto(gridEl, lista);
          }
        });
    }

    // Reconecta formulário de busca rápida se presente
    if (window.RPMStoreUI && window.RPMStoreUI.bindHomeSearchEvents) {
      window.RPMStoreUI.bindHomeSearchEvents();
    }

    // Eventos de botões CTA e carrossel de banners
    homeEl.querySelectorAll("[data-cms-cta]").forEach((btn) => {
      btn.addEventListener("click", () => {
        executarDestinoLink(btn.getAttribute("data-cms-cta"));
      });
    });

    homeEl.querySelectorAll("[data-cms-banner-idx]").forEach((dot) => {
      dot.addEventListener("click", () => {
        estadoCms.indiceBannerAtivo = Number(dot.getAttribute("data-cms-banner-idx") || 0);
        renderizarSecoesPaginaInicial(obterConfigAtivaNaVitrine());
      });
    });
  }

  function aplicarPaginasFixasCatalogoEContato(cfg) {
    const pCat = cfg.pages_config?.categorias || {};
    const heroCat = document.querySelector("#aba-catalogo .page-hero-compact .container");
    if (heroCat) {
      heroCat.innerHTML = `
        ${pCat.eyebrow ? `<span class="eyebrow">${escaparHtml(pCat.eyebrow)}</span>` : ""}
        <h1>${escaparHtml(pCat.title || "Catálogo de Roupas")}</h1>
        <p>${escaparHtml(pCat.subtitle || "")}</p>
      `;
    }

    const pCont = cfg.pages_config?.contato || {};
    const heroCont = document.querySelector("#aba-contato .page-hero-compact .container");
    if (heroCont) {
      heroCont.innerHTML = `
        ${pCont.eyebrow ? `<span class="eyebrow">${escaparHtml(pCont.eyebrow)}</span>` : ""}
        <h1>${escaparHtml(pCont.title || "Fale Conosco")}</h1>
        <p>${escaparHtml(pCont.subtitle || "")}</p>
      `;
    }

    const cardWa = document.querySelector("#aba-contato .wa-card");
    if (cardWa && pCont.waTitle) {
      const tag = cardWa.querySelector(".channel-tag");
      const h2 = cardWa.querySelector("h2");
      const desc = cardWa.querySelector(".channel-desc");
      const linkBtn = document.getElementById("link-card-whatsapp");
      if (tag && pCont.waTag) tag.textContent = pCont.waTag;
      if (h2) h2.textContent = pCont.waTitle;
      if (desc && pCont.waDesc) desc.textContent = pCont.waDesc;
      if (linkBtn && pCont.waBtnText) linkBtn.textContent = pCont.waBtnText;
    }

    const cardInsta = document.querySelector("#aba-contato .insta-card");
    if (cardInsta && pCont.instaTitle) {
      const tag = cardInsta.querySelector(".channel-tag");
      const h2 = cardInsta.querySelector("h2");
      const desc = cardInsta.querySelector(".channel-desc");
      const linkBtn = document.getElementById("link-card-instagram");
      if (tag && pCont.instaTag) tag.textContent = pCont.instaTag;
      if (h2) h2.textContent = pCont.instaTitle;
      if (desc && pCont.instaDesc) desc.textContent = pCont.instaDesc;
      if (linkBtn && pCont.instaBtnText) linkBtn.textContent = pCont.instaBtnText;
    }

    const infoItems = document.querySelectorAll("#aba-contato .store-info-box .info-item");
    if (infoItems.length >= 3) {
      if (pCont.hoursTitle) infoItems[0].querySelector("strong").textContent = pCont.hoursTitle;
      if (pCont.hoursText) infoItems[0].querySelector("p").textContent = pCont.hoursText;
      if (pCont.shippingTitle)
        infoItems[1].querySelector("strong").textContent = pCont.shippingTitle;
      if (pCont.shippingText) infoItems[1].querySelector("p").textContent = pCont.shippingText;
      if (pCont.paymentTitle) infoItems[2].querySelector("strong").textContent = pCont.paymentTitle;
      if (pCont.paymentText) infoItems[2].querySelector("p").textContent = pCont.paymentText;
    }
  }

  function renderizarPaginaInstitucional(slug) {
    const cfg = obterConfigAtivaNaVitrine();
    const pag = cfg.pages_config?.[slug];
    const container = document.getElementById("conteudo-pagina-institucional");
    if (!container) return false;

    if (!pag) {
      container.innerHTML = `
        <div class="product-unavailable-card">
          <span class="eyebrow">PÁGINA NÃO ENCONTRADA</span>
          <h1>Conteúdo indisponível</h1>
          <p>A página solicitada não foi localizada.</p>
          <button type="button" class="btn btn-primary" id="btn-inst-voltar">Voltar ao Início</button>
        </div>
      `;
      document.getElementById("btn-inst-voltar")?.addEventListener("click", () => {
        executarDestinoLink("aba:inicio");
      });
      return true;
    }

    const blocos = (pag.blocks || []).filter((b) => b && b.visible !== false);
    const align = ["left", "center", "right"].includes(pag.alignment) ? pag.alignment : "left";
    const bgStyle = pag.bgColor ? `background-color:${validarCorCss(pag.bgColor, "")};` : "";
    const txtStyle = pag.textColor ? `color:${validarCorCss(pag.textColor, "")};` : "";

    container.innerHTML = `
      <div class="cms-institutional-card" style="${bgStyle}${txtStyle}text-align:${align};">
        <div class="cms-institutional-header">
          ${pag.eyebrow ? `<span class="eyebrow">${escaparHtml(pag.eyebrow)}</span>` : ""}
          <h1 style="${txtStyle}">${escaparHtml(pag.title || "")}</h1>
          ${pag.subtitle ? `<p class="cms-institutional-lead">${escaparHtml(pag.subtitle)}</p>` : ""}
        </div>

        ${
          pag.showImage && pag.imageUrl
            ? `
          <div class="cms-institutional-banner">
            <img
              src="${escaparHtml(resolverUrlMidia(pag.imageUrl))}"
              alt="${escaparHtml(pag.imageAlt || pag.title || "RPM MODAS")}"
            />
          </div>
        `
            : ""
        }

        <div class="cms-institutional-blocks">
          ${blocos
            .map(
              (bl) => `
            <article class="cms-inst-block">
              ${bl.heading ? `<h2 style="${txtStyle}">${escaparHtml(bl.heading)}</h2>` : ""}
              <p style="white-space:pre-line;">${escaparHtml(bl.body || "")}</p>
            </article>
          `
            )
            .join("")}
        </div>

        <div style="margin-top:2rem;">
          <button type="button" class="btn btn-outline" id="btn-inst-ir-catalogo">
            Explorar Catálogo de Peças →
          </button>
        </div>
      </div>
    `;

    document.getElementById("btn-inst-ir-catalogo")?.addEventListener("click", () => {
      executarDestinoLink("aba:catalogo");
    });
    return true;
  }

  function atualizarBarraFlutuantePreviewAdmin() {
    let barra = document.getElementById("rpm-cms-preview-bar");
    const ativo =
      estadoCms.modoPreviewRascunho &&
      Boolean(estadoCms.rascunhoAdmin) &&
      Boolean(window.RPMAuth && window.RPMAuth.isAdminVerified());

    document.body.classList.toggle(
      "cms-mobile-preview-frame",
      ativo && estadoCms.dispositivoPreview === "mobile"
    );

    if (!ativo) {
      if (barra) barra.remove();
      return;
    }

    if (!barra) {
      barra = document.createElement("div");
      barra.id = "rpm-cms-preview-bar";
      barra.className = "cms-preview-floating-bar";
      document.body.appendChild(barra);
    }

    barra.innerHTML = `
      <div class="cms-preview-bar-info">
        <span class="cms-preview-badge">MODO PRÉ-VISUALIZAÇÃO (RASCUNHO)</span>
        <span>Visitantes continuam vendo apenas a versão publicada.</span>
      </div>
      <div class="cms-preview-bar-actions">
        <button type="button" class="btn btn-sm ${
          estadoCms.dispositivoPreview === "desktop" ? "btn-primary" : "btn-outline"
        }" id="btn-prev-desk">💻 Computador</button>
        <button type="button" class="btn btn-sm ${
          estadoCms.dispositivoPreview === "mobile" ? "btn-primary" : "btn-outline"
        }" id="btn-prev-mob">📱 Celular</button>
        <button type="button" class="btn btn-sm btn-primary" id="btn-prev-voltar-editor">
          ← Voltar ao Editor ADM Avançado
        </button>
        <button type="button" class="btn btn-sm btn-outline" id="btn-prev-sair">
          Sair da Prévia
        </button>
      </div>
    `;

    document.getElementById("btn-prev-desk")?.addEventListener("click", () => {
      estadoCms.dispositivoPreview = "desktop";
      atualizarBarraFlutuantePreviewAdmin();
    });
    document.getElementById("btn-prev-mob")?.addEventListener("click", () => {
      estadoCms.dispositivoPreview = "mobile";
      atualizarBarraFlutuantePreviewAdmin();
    });
    document.getElementById("btn-prev-voltar-editor")?.addEventListener("click", () => {
      estadoCms.modoPreviewRascunho = false;
      document.body.classList.remove("cms-mobile-preview-frame");
      aplicarConfigCompletaNaVitrine();
      if (window.RPMAdmin && window.RPMAdmin.openAdvancedEditor) {
        window.RPMAdmin.openAdvancedEditor();
      }
    });
    document.getElementById("btn-prev-sair")?.addEventListener("click", () => {
      estadoCms.modoPreviewRascunho = false;
      document.body.classList.remove("cms-mobile-preview-frame");
      aplicarConfigCompletaNaVitrine();
    });
  }

  function aplicarConfigCompletaNaVitrine() {
    const cfg = obterConfigAtivaNaVitrine();
    aplicarTemaVisualECores(cfg);
    aplicarCabecalhoERodape(cfg);
    renderizarSecoesPaginaInicial(cfg);
    aplicarPaginasFixasCatalogoEContato(cfg);
    atualizarBarraFlutuantePreviewAdmin();

    // Se uma página institucional estiver aberta no momento, atualiza também
    const secInst = document.getElementById("aba-institucional");
    if (secInst && !secInst.classList.contains("hidden") && secInst.dataset.slugAtual) {
      renderizarPaginaInstitucional(secInst.dataset.slugAtual);
    }
  }

  // ==========================================================================
  // LEITURA PÚBLICA COM ATUALIZAÇÃO SEGURA (APENAS VERSÃO PUBLICADA)
  // ==========================================================================
  async function carregarVersaoPublicada(forcar = false) {
    const supabase = window.getRpmSupabaseClient && window.getRpmSupabaseClient();
    if (!supabase) {
      estadoCms.carregado = true;
      aplicarConfigCompletaNaVitrine();
      return estadoCms.publicado;
    }

    try {
      const { data, error } = await supabase
        .from("site_cms_published")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        if (error.code !== "PGRST205") {
          console.warn("[RPM CMS] Aviso ao ler site_cms_published:", error.message);
        }
        estadoCms.tabelaPublicadaAtiva = false;
      } else {
        estadoCms.tabelaPublicadaAtiva = true;
        if (data) {
          const novaVersao = Number(data.version_number || 1);
          if (forcar || !estadoCms.carregado || novaVersao !== estadoCms.publicado.version_number) {
            estadoCms.publicado = normalizarSnapshotCompleto(data);
          }
        }
      }
    } catch (err) {
      console.warn("[RPM CMS] Falha de rede ao consultar configuração publicada:", err);
    }

    estadoCms.carregado = true;
    aplicarConfigCompletaNaVitrine();
    return estadoCms.publicado;
  }

  // ==========================================================================
  // OPERAÇÕES EXCLUSIVAS DE ADMINISTRADOR (PROTEGIDAS POR is_admin() + RLS)
  // ==========================================================================
  async function exigirPermissaoAdminReal() {
    const ok = window.RPMAuth && (await window.RPMAuth.recheckAdminPermission()) === true;
    if (!ok) {
      throw new Error("Acesso negado: apenas administradores autorizados podem usar o Modo ADM Avançado.");
    }
    return true;
  }

  async function carregarRascunhoParaEditor() {
    await exigirPermissaoAdminReal();
    await carregarVersaoPublicada(true);

    const supabase = window.getRpmSupabaseClient();
    const { data, error } = await supabase
      .from("site_cms_drafts")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error && error.code !== "PGRST205") {
      throw new Error(error.message);
    }

    if (data) {
      estadoCms.rascunhoAdmin = normalizarSnapshotCompleto(data);
    } else {
      estadoCms.rascunhoAdmin = clonarProfundo(estadoCms.publicado);
    }

    return clonarProfundo(estadoCms.rascunhoAdmin);
  }

  async function salvarRascunhoNoBanco(rascunhoEditado) {
    await exigirPermissaoAdminReal();
    const normalizado = normalizarSnapshotCompleto(rascunhoEditado);
    estadoCms.rascunhoAdmin = clonarProfundo(normalizado);

    const supabase = window.getRpmSupabaseClient();
    const user = window.RPMAuth.getUser();

    const payload = {
      id: 1,
      based_on_version: Number(estadoCms.publicado.version_number || 1),
      theme_config: normalizado.theme_config,
      header_config: normalizado.header_config,
      footer_config: normalizado.footer_config,
      banners_config: normalizado.banners_config,
      sections_config: normalizado.sections_config,
      texts_config: normalizado.texts_config,
      pages_config: normalizado.pages_config,
      updated_by: user ? user.id : null
    };

    const { error } = await supabase.from("site_cms_drafts").upsert(payload, { onConflict: "id" });
    if (error) {
      if (error.code === "PGRST205") {
        throw new Error(
          "Execute o arquivo supabase-modo-adm-avancado.sql no SQL Editor do Supabase para ativar o salvamento no banco."
        );
      }
      throw new Error(error.message);
    }

    return clonarProfundo(estadoCms.rascunhoAdmin);
  }

  async function descartarRascunhoRestaurandoPublicado() {
    await exigirPermissaoAdminReal();
    await carregarVersaoPublicada(true);
    const copiaPublicado = clonarProfundo(estadoCms.publicado);
    estadoCms.rascunhoAdmin = copiaPublicado;
    estadoCms.modoPreviewRascunho = false;

    const supabase = window.getRpmSupabaseClient();
    const user = window.RPMAuth.getUser();
    const { error } = await supabase.from("site_cms_drafts").upsert(
      {
        id: 1,
        based_on_version: Number(copiaPublicado.version_number || 1),
        theme_config: copiaPublicado.theme_config,
        header_config: copiaPublicado.header_config,
        footer_config: copiaPublicado.footer_config,
        banners_config: copiaPublicado.banners_config,
        sections_config: copiaPublicado.sections_config,
        texts_config: copiaPublicado.texts_config,
        pages_config: copiaPublicado.pages_config,
        updated_by: user ? user.id : null
      },
      { onConflict: "id" }
    );

    if (error && error.code !== "PGRST205") {
      throw new Error(error.message);
    }

    aplicarConfigCompletaNaVitrine();
    return clonarProfundo(estadoCms.rascunhoAdmin);
  }

  async function publicarRascunhoNoSite(rascunhoEditado, resumoAlteracao) {
    await salvarRascunhoNoBanco(rascunhoEditado);

    const supabase = window.getRpmSupabaseClient();
    const { data, error } = await supabase.rpc("publish_site_cms_draft", {
      p_change_summary:
        String(resumoAlteracao || "").trim() || "Publicação pelo Modo ADM Avançado"
    });

    if (error) {
      throw new Error(error.message);
    }

    estadoCms.modoPreviewRascunho = false;
    await carregarVersaoPublicada(true);
    estadoCms.rascunhoAdmin = clonarProfundo(estadoCms.publicado);
    return data;
  }

  async function listarHistoricoVersoes() {
    await exigirPermissaoAdminReal();
    const supabase = window.getRpmSupabaseClient();
    const { data, error } = await supabase
      .from("site_cms_versions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      if (error.code === "PGRST205") return [];
      throw new Error(error.message);
    }
    return Array.isArray(data) ? data : [];
  }

  async function restaurarVersaoDoHistorico(versionId) {
    await exigirPermissaoAdminReal();
    const supabase = window.getRpmSupabaseClient();
    const { data, error } = await supabase.rpc("restore_site_cms_version", {
      p_version_id: versionId
    });
    if (error) throw new Error(error.message);

    estadoCms.modoPreviewRascunho = false;
    await carregarVersaoPublicada(true);
    estadoCms.rascunhoAdmin = clonarProfundo(estadoCms.publicado);
    return data;
  }

  // ==========================================================================
  // BIBLIOTECA DE MÍDIA E IMAGENS (SUPABASE STORAGE site-media + PROTEÇÃO DE USO)
  // ==========================================================================
  async function listarBibliotecaMidia() {
    await exigirPermissaoAdminReal();
    const supabase = window.getRpmSupabaseClient();
    const { data, error } = await supabase
      .from("site_media_library")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "PGRST205") return [];
      throw new Error(error.message);
    }
    return Array.isArray(data) ? data : [];
  }

  async function enviarImagemBiblioteca(arquivo, metadados = {}) {
    await exigirPermissaoAdminReal();
    if (!arquivo) throw new Error("Selecione um arquivo de imagem válido.");
    if (!TIPOS_IMAGEM_PERMITIDOS.includes(arquivo.type)) {
      throw new Error("Formato inválido. Envie apenas imagens JPG, PNG, WEBP ou GIF.");
    }
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      throw new Error("A imagem excede o limite máximo de 8 MB.");
    }

    const supabase = window.getRpmSupabaseClient();
    const user = window.RPMAuth.getUser();
    const ext = (arquivo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const nomeSeguro = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const storagePath = `biblioteca/${nomeSeguro}`;

    const { error: errUp } = await supabase.storage
      .from(BUCKET_SITE_MEDIA)
      .upload(storagePath, arquivo, {
        cacheControl: "3600",
        upsert: false,
        contentType: arquivo.type
      });

    if (errUp) throw new Error(errUp.message);

    const { data: pubData } = supabase.storage.from(BUCKET_SITE_MEDIA).getPublicUrl(storagePath);
    const publicUrl = pubData.publicUrl;

    const registro = {
      title: String(metadados.title || arquivo.name.replace(/\.[^.]+$/, "")).trim() || "Imagem",
      category: String(metadados.category || "Geral").trim(),
      image_url: publicUrl,
      storage_bucket: BUCKET_SITE_MEDIA,
      storage_path: storagePath,
      alt_text: String(metadados.alt_text || "").trim(),
      mime_type: arquivo.type,
      file_size_bytes: arquivo.size,
      object_fit: metadados.object_fit || "cover",
      object_position: metadados.object_position || "50% 50%",
      scale_percent: Number(metadados.scale_percent || 100),
      uploaded_by: user ? user.id : null
    };

    const { data, error } = await supabase
      .from("site_media_library")
      .insert(registro)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async function atualizarMetadadosMidia(idMidia, campos, arquivoSubstituto = null) {
    await exigirPermissaoAdminReal();
    const supabase = window.getRpmSupabaseClient();

    const atualizacao = {
      title: String(campos.title || "Imagem").trim(),
      category: String(campos.category || "Geral").trim(),
      alt_text: String(campos.alt_text || "").trim(),
      object_fit: ["cover", "contain", "fill"].includes(campos.object_fit)
        ? campos.object_fit
        : "cover",
      object_position: String(campos.object_position || "50% 50%").trim(),
      scale_percent: Math.min(200, Math.max(50, Number(campos.scale_percent || 100)))
    };

    if (arquivoSubstituto) {
      if (!TIPOS_IMAGEM_PERMITIDOS.includes(arquivoSubstituto.type)) {
        throw new Error("Formato inválido. Envie apenas JPG, PNG, WEBP ou GIF.");
      }
      if (arquivoSubstituto.size > TAMANHO_MAXIMO_BYTES) {
        throw new Error("A imagem excede o limite de 8 MB.");
      }
      const ext = (arquivoSubstituto.name.split(".").pop() || "jpg")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const novoPath = `biblioteca/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const { error: errUp } = await supabase.storage
        .from(BUCKET_SITE_MEDIA)
        .upload(novoPath, arquivoSubstituto, {
          cacheControl: "3600",
          upsert: false,
          contentType: arquivoSubstituto.type
        });
      if (errUp) throw new Error(errUp.message);

      const { data: pubData } = supabase.storage.from(BUCKET_SITE_MEDIA).getPublicUrl(novoPath);
      atualizacao.image_url = pubData.publicUrl;
      atualizacao.storage_path = novoPath;
      atualizacao.mime_type = arquivoSubstituto.type;
      atualizacao.file_size_bytes = arquivoSubstituto.size;
    }

    const { data, error } = await supabase
      .from("site_media_library")
      .update(atualizacao)
      .eq("id", idMidia)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async function excluirMidiaComProtecaoDeUso(itemMidia, rascunhoEmEdicao = null) {
    await exigirPermissaoAdminReal();
    if (!itemMidia || !itemMidia.id) return;

    const urlAlvo = String(itemMidia.image_url || "").trim();
    const supabase = window.getRpmSupabaseClient();

    // 1. Verificação local em memória (rascunho salvo + rascunho em edição + publicado atual)
    const strPub = JSON.stringify(estadoCms.publicado || {});
    const strDraft = JSON.stringify(estadoCms.rascunhoAdmin || {});
    const strEditando = JSON.stringify(rascunhoEmEdicao || {});
    if (
      urlAlvo &&
      (strPub.includes(urlAlvo) || strDraft.includes(urlAlvo) || strEditando.includes(urlAlvo))
    ) {
      throw new Error(
        "Esta imagem não pode ser excluída porque ainda está sendo utilizada no site publicado ou no rascunho atual."
      );
    }

    // 2. Verificação no servidor (inclui produtos e versões históricas para preservar backups!)
    const { data: usoDb, error: errRpc } = await supabase.rpc("is_site_media_referenced", {
      p_image_url: urlAlvo
    });
    if (!errRpc && usoDb && usoDb.in_use) {
      const locais = [];
      if (usoDb.in_published) locais.push("site publicado");
      if (usoDb.in_draft) locais.push("rascunho atual");
      if (usoDb.in_products) locais.push("cadastro de produtos");
      if (usoDb.in_history) locais.push("histórico de versões anteriores");
      throw new Error(
        `Proteção de mídia ativa: esta imagem está vinculada a (${locais.join(
          ", "
        )}) e não pode ser excluída.`
      );
    }

    if (itemMidia.storage_path && itemMidia.storage_bucket === BUCKET_SITE_MEDIA) {
      await supabase.storage.from(BUCKET_SITE_MEDIA).remove([itemMidia.storage_path]);
    }

    const { error } = await supabase.from("site_media_library").delete().eq("id", itemMidia.id);
    if (error) throw new Error(error.message);
  }

  // Ativa pré-visualização segura somente para administradora autenticada
  async function ativarModoPreviewRascunho(rascunhoEmMemoria, dispositivo = "desktop") {
    await exigirPermissaoAdminReal();
    estadoCms.rascunhoAdmin = normalizarSnapshotCompleto(rascunhoEmMemoria);
    estadoCms.modoPreviewRascunho = true;
    estadoCms.dispositivoPreview = dispositivo === "mobile" ? "mobile" : "desktop";
    aplicarConfigCompletaNaVitrine();
  }

  function encerrarModoPreviewRascunho() {
    estadoCms.modoPreviewRascunho = false;
    document.body.classList.remove("cms-mobile-preview-frame");
    aplicarConfigCompletaNaVitrine();
  }

  // Atualiza automaticamente se visitante retornar à aba após uma publicação
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !estadoCms.modoPreviewRascunho) {
      carregarVersaoPublicada(false);
    }
  });

  // Ao deslogar, garante saída imediata de qualquer pré-visualização administrativa
  window.addEventListener("rpm:usuario-deslogado", () => {
    estadoCms.rascunhoAdmin = null;
    estadoCms.modoPreviewRascunho = false;
    document.body.classList.remove("cms-mobile-preview-frame");
    aplicarConfigCompletaNaVitrine();
  });

  // Quando o catálogo de produtos atualiza, re-renderiza as vitrines da Home no CMS
  window.addEventListener("rpm:catalogo-atualizado", () => {
    if (estadoCms.carregado) {
      renderizarSecoesPaginaInicial(obterConfigAtivaNaVitrine());
    }
  });

  window.RPMCms = Object.freeze({
    FONTS: Object.keys(FONTES_DISPONIVEIS),
    getFactoryDefaults: obterConfigPadraoOriginal,
    getPublishedConfig: () => clonarProfundo(estadoCms.publicado),
    isPreviewActive: () => Boolean(estadoCms.modoPreviewRascunho),
    loadPublished: carregarVersaoPublicada,
    reapplyActiveConfig: aplicarConfigCompletaNaVitrine,
    renderInstitutionalPage: renderizarPaginaInstitucional,
    // Métodos administrativos (protegidos por is_admin() + RLS)
    loadDraftForEditor: carregarRascunhoParaEditor,
    saveDraft: salvarRascunhoNoBanco,
    discardDraft: descartarRascunhoRestaurandoPublicado,
    publishDraft: publicarRascunhoNoSite,
    listVersions: listarHistoricoVersoes,
    restoreVersion: restaurarVersaoDoHistorico,
    listMedia: listarBibliotecaMidia,
    uploadMedia: enviarImagemBiblioteca,
    updateMedia: atualizarMetadadosMidia,
    deleteMedia: excluirMidiaComProtecaoDeUso,
    startPreview: ativarModoPreviewRascunho,
    stopPreview: encerrarModoPreviewRascunho
  });
})();
