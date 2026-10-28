/**
 * ============================================================================
 * ARQUIVO DE CONFIGURAÇÃO DA LOJA — RPM MODAS (FÁCIL DE EDITAR!)
 * ============================================================================
 * Altere aqui seu número de WhatsApp, @ do Instagram, preços e produtos.
 */

const DADOS_LOJA = {
  // 1. IDENTIDADE DA MARCA
  nomeLoja: "RPM MODAS",
  subtituloLogo: "MODA FEMININA",
  tagColecao: "NOVA COLEÇÃO • ELEGÂNCIA & CONFORTO",
  sloganHero: "Estilo e sofisticação para valorizar cada momento seu",
  descricaoHero:
    "Bem-vinda à RPM MODAS! Confira nossas peças mais vendidas, aproveite as ofertas da semana e finalize seu pedido com praticidade direto pelo nosso WhatsApp.",

  // 2. CANAIS DE CONTATO (Aba Contato + Checkout)
  // Importante: no campo whatsapp coloque 55 + DDD + número (apenas números)
  whatsapp: "5571991402776",
  whatsappExibicao: "(71) 99140-2776",
  instagram: "@rpmmoda",
  urlInstagram: "https://instagram.com/rpmmoda",
  cidadeEstado: "Enviamos para todo o Brasil • Consulte entrega rápida na região",
  horarioAtendimento: "Segunda a Sexta: 9h às 19h • Sábado: 9h às 15h",

  // 3. CONDIÇÕES COMERCIAIS E CUPONS
  freteGratisAcimaDe: 399.0,
  descontoPixPercentual: 5,
  parcelasSemJuros: 5,

  cupons: {
    RPM10: 10,
    BEMVINDA10: 10
  },

  avisosTopo: [
    "✨ Frete Grátis nas compras acima de R$ 399",
    "💚 5% OFF imediato no PIX",
    "🎁 Cupom RPM10 para 10% OFF na 1ª compra"
  ],

  // 4. TABELA DE MEDIDAS PADRÃO
  tabelaMedidas: [
    { tamanho: "PP", manequim: "36", busto: "82 – 85 cm", cintura: "64 – 67 cm", quadril: "90 – 93 cm" },
    { tamanho: "P",  manequim: "38", busto: "86 – 90 cm", cintura: "68 – 72 cm", quadril: "94 – 98 cm" },
    { tamanho: "M",  manequim: "40", busto: "91 – 95 cm", cintura: "73 – 77 cm", quadril: "99 – 103 cm" },
    { tamanho: "G",  manequim: "42", busto: "96 – 101 cm", cintura: "78 – 83 cm", quadril: "104 – 109 cm" },
    { tamanho: "GG", manequim: "44", busto: "102 – 107 cm", cintura: "84 – 89 cm", quadril: "110 – 115 cm" }
  ],

  // 5. CATÁLOGO DE ROUPAS
  // - maisVendido: true -> aparece na seção "Mais Vendidas" da aba Início
  // - precoAntigo maior que preco -> aparece automaticamente na seção "Promoções" da aba Início!
  produtos: [
    {
      id: "vestido-midi-solare",
      nome: "Vestido Midi Linho Solare",
      categoria: "Vestidos",
      preco: 289.90,
      precoAntigo: null,
      imagem: "imagens/vestido-midi-linho.jpg",
      destaque: "Mais Vendido",
      maisVendido: true,
      tamanhos: ["PP", "P", "M", "G"],
      cores: ["Terracota", "Areia", "Off-White"],
      tecido: "70% Viscose, 30% Linho Puro • Forro interno macio",
      descricao:
        "Modelagem acinturada com saia evasê fluida e bolsos laterais invisíveis. Caimento impecável e fresco para diversas ocasiões."
    },
    {
      id: "conjunto-alfaiataria-helena",
      nome: "Conjunto Colete & Pantalona Helena",
      categoria: "Conjuntos",
      preco: 369.90,
      precoAntigo: null,
      imagem: "imagens/conjunto-alfaiataria.jpg",
      destaque: "Mais Vendido",
      maisVendido: true,
      tamanhos: ["P", "M", "G", "GG"],
      cores: ["Off-White", "Preto", "Areia"],
      tecido: "Alfaiataria Marrant encorpada • Botões tartaruga",
      descricao:
        "Conjunto elegante de duas peças com colete estruturado e calça pantalona de cintura alta com pregas frontais."
    },
    {
      id: "macacao-pantalona-noir",
      nome: "Macacão Linho Pantalona Noir",
      categoria: "Alfaiataria",
      preco: 389.90,
      precoAntigo: null,
      imagem: "imagens/macacao-linho-preto.jpg",
      destaque: "Mais Vendido",
      maisVendido: true,
      tamanhos: ["P", "M", "G", "GG"],
      cores: ["Preto", "Linho Cru"],
      tecido: "55% Linho, 45% Viscose • Acompanha faixa na cintura",
      descricao:
        "Peça única alongadora com decote reto estruturado, faixa ajustável na cintura e pernas amplas estilo pantalona."
    },
    {
      id: "slip-dress-seda-oliva",
      nome: "Vestido Longo Cetim Oliva",
      categoria: "Vestidos",
      preco: 349.90,
      precoAntigo: null,
      imagem: "imagens/vestido-longo-seda.jpg",
      destaque: "Mais Vendido",
      maisVendido: true,
      tamanhos: ["PP", "P", "M", "G"],
      cores: ["Verde Oliva", "Champagne"],
      tecido: "Cetim toque de seda com brilho acetinado suave",
      descricao:
        "Decote degagê delicado, alças finas reguláveis e corte fluido que valoriza a silhueta com leveza."
    },
    {
      id: "blusa-tricot-modal",
      nome: "Blusa Tricot Modal Canelada",
      categoria: "Blusas & Saias",
      preco: 149.90,
      precoAntigo: 189.90,
      imagem: "imagens/blusa-tricot-modal.jpg",
      destaque: "-21% OFF",
      maisVendido: false,
      tamanhos: ["P", "M", "G"],
      cores: ["Aveia", "Caramelo", "Preto"],
      tecido: "Tricot 85% Modal Premium, 15% Poliamida",
      descricao:
        "Peça versátil indispensável no guarda-roupa. Toque macio na pele, decote canoa elegante e textura canelada."
    },
    {
      id: "conjunto-resort-cacau",
      nome: "Conjunto Resort Linho Cacau",
      categoria: "Conjuntos",
      preco: 299.90,
      precoAntigo: 359.90,
      imagem: "imagens/conjunto-resort-areia.jpg",
      destaque: "-17% OFF",
      maisVendido: false,
      tamanhos: ["PP", "P", "M", "G"],
      cores: ["Cacau", "Areia"],
      tecido: "Viscolinho leve pré-lavado (não encolhe)",
      descricao:
        "Camisa cropped com amarração frontal combinada à saia midi em camadas fluidas. Ideal para dias ensolarados e passeios."
    },
    {
      id: "blazer-linho-cru-essencial",
      nome: "Blazer Alfaiataria Linho Cru",
      categoria: "Alfaiataria",
      preco: 309.90,
      precoAntigo: 369.90,
      imagem: "imagens/blazer-linho-cru.jpg",
      destaque: "-16% OFF",
      maisVendido: false,
      tamanhos: ["P", "M", "G", "GG"],
      cores: ["Linho Cru", "Off-White"],
      tecido: "Linho misto estruturado com forro leve respirável",
      descricao:
        "Corte moderno levemente alongado com bolsos embutidos e acabamento refinado pensado para o clima brasileiro."
    },
    {
      id: "saia-midi-cetim-perola",
      nome: "Saia Midi Cetim Pérola",
      categoria: "Blusas & Saias",
      preco: 209.90,
      precoAntigo: 259.90,
      imagem: "imagens/saia-midi-cetim.jpg",
      destaque: "-19% OFF",
      maisVendido: false,
      tamanhos: ["PP", "P", "M", "G"],
      cores: ["Pérola", "Preto", "Verde Oliva"],
      tecido: "Cetim encorpado com corte no viés e zíper invisível",
      descricao:
        "Saia midi luminosa que combina tanto com propostas casuais diurnas quanto com produções noturnas elegantes."
    }
  ]
};
