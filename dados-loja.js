/**
 * ============================================================================
 * ARQUIVO DE CONFIGURAÇÃO DA SUA LOJA (FÁCIL DE EDITAR!)
 * ============================================================================
 * Você NÃO precisa mexer no código do site para personalizar sua loja.
 * Basta alterar os textos, números, preços e produtos abaixo mantendo as aspas!
 */

const DADOS_LOJA = {
  // 1. INFORMAÇÕES BÁSICAS DA MARCA
  nomeLoja: "Atelier Aurora",
  subtituloLogo: "MODA FEMININA",
  sloganHero: "Elegância natural para iluminar os seus dias",
  descricaoHero:
    "Peças autorais em linho, alfaiataria leve e tecidos fluidos. Escolha seus tamanhos na sacola e finalize seu pedido direto em nosso WhatsApp com atendimento exclusivo.",
  tagColecao: "COLEÇÃO CÁPSULA • SOL & LINHO",

  // 2. CONTATO E REDES SOCIAIS
  // Importante: coloque 55 + DDD + número (apenas números, sem espaços ou traços)
  whatsapp: "5571999999999",
  whatsappExibicao: "(71) 99999-9999",
  instagram: "@atelieraurora",
  urlInstagram: "https://instagram.com/",
  cidadeEstado: "Salvador - BA • Enviamos para todo o Brasil",
  horarioAtendimento: "Seg a Sex das 9h às 19h • Sáb das 9h às 15h",

  // 3. REGRAS COMERCIAIS E PROMOÇÕES
  freteGratisAcimaDe: 299.0, // Valor mínimo para frete grátis (coloque 0 se não quiser)
  descontoPixPercentual: 5, // % de desconto pagando no PIX
  parcelasSemJuros: 3, // Quantidade máxima de parcelas sem juros exibida nos cards

  // Cupons de desconto ativos (Código em MAIÚSCULO : porcentagem de desconto)
  cupons: {
    BEMVINDA10: 10,
    AURORA15: 15
  },

  // Frases da barra superior do topo do site
  avisosTopo: [
    "✨ Frete Grátis nas compras acima de R$ 299",
    "💚 5% OFF imediato pagando no PIX",
    "🎁 Use o cupom BEMVINDA10 para 10% OFF na 1ª compra"
  ],

  // 4. TABELA DE MEDIDAS PADRÃO (em centímetros)
  tabelaMedidas: [
    { tamanho: "PP", manequim: "36", busto: "82 – 85 cm", cintura: "64 – 67 cm", quadril: "90 – 93 cm" },
    { tamanho: "P",  manequim: "38", busto: "86 – 90 cm", cintura: "68 – 72 cm", quadril: "94 – 98 cm" },
    { tamanho: "M",  manequim: "40", busto: "91 – 95 cm", cintura: "73 – 77 cm", quadril: "99 – 103 cm" },
    { tamanho: "G",  manequim: "42", busto: "96 – 101 cm", cintura: "78 – 83 cm", quadril: "104 – 109 cm" },
    { tamanho: "GG", manequim: "44", busto: "102 – 107 cm", cintura: "84 – 89 cm", quadril: "110 – 115 cm" }
  ],

  // 5. CATÁLOGO DE PRODUTOS
  // Para adicionar uma roupa nova:
  // 1) Coloque a foto dentro da pasta "imagens" (ex: imagens/meu-vestido.jpg)
  // 2) Copie um bloco { ... } abaixo, cole no final da lista e altere os dados!
  produtos: [
    {
      id: "vestido-midi-solare",
      nome: "Vestido Midi Linho Solare",
      categoria: "Vestidos",
      preco: 289.90,
      precoAntigo: 339.90,
      imagem: "imagens/vestido-midi-linho.jpg",
      destaque: "Mais Vendido",
      novo: true,
      tamanhos: ["PP", "P", "M", "G"],
      cores: ["Terracota", "Areia", "Off-White"],
      tecido: "70% Viscose, 30% Linho Puro • Forro interno 100% algodão",
      descricao:
        "Modelagem acinturada com saia evasê fluida e bolsos laterais invisíveis. O toque rústico e fresco do linho garante caimento impecável do almoço especial ao fim de tarde."
    },
    {
      id: "conjunto-alfaiataria-helena",
      nome: "Conjunto Colete & Pantalona Helena",
      categoria: "Conjuntos",
      preco: 369.90,
      precoAntigo: null,
      imagem: "imagens/conjunto-alfaiataria.jpg",
      destaque: "Novo",
      novo: true,
      tamanhos: ["P", "M", "G", "GG"],
      cores: ["Off-White", "Preto", "Areia"],
      tecido: "Alfaiataria Marrant encorpada • Botões tartaruga",
      descricao:
        "Conjunto de duas peças composto por colete estruturado com botões marmorizados e calça pantalona de cintura alta com pregas frontais. Sofisticação instantânea."
    },
    {
      id: "slip-dress-seda-oliva",
      nome: "Vestido Longo Cetim Oliva",
      categoria: "Vestidos",
      preco: 349.90,
      precoAntigo: null,
      imagem: "imagens/vestido-longo-seda.jpg",
      destaque: "Edição Limitada",
      novo: true,
      tamanhos: ["PP", "P", "M", "G"],
      cores: ["Verde Oliva", "Champagne"],
      tecido: "Cetim toque de seda com brilho acetinado suave",
      descricao:
        "Decote degagê delicado, alças finas com reguladores dourados e corte enviesado que acompanha a silhueta com leveza e movimento."
    },
    {
      id: "blusa-tricot-modal",
      nome: "Blusa Tricot Modal Canelada",
      categoria: "Blusas & Saias",
      preco: 159.90,
      precoAntigo: 189.90,
      imagem: "imagens/blusa-tricot-modal.jpg",
      destaque: "Oferta",
      novo: false,
      tamanhos: ["P", "M", "G"],
      cores: ["Aveia", "Caramelo", "Preto"],
      tecido: "Tricot 85% Modal Premium, 15% Poliamida",
      descricao:
        "Peça coringa indispensável no closet. Toque extremamente macio e fresco na pele, decote canoa elegante e textura canelada que valoriza o visual casual chic."
    },
    {
      id: "saia-midi-cetim-perola",
      nome: "Saia Midi Cetim Pérola",
      categoria: "Blusas & Saias",
      preco: 229.90,
      precoAntigo: null,
      imagem: "imagens/saia-midi-cetim.jpg",
      destaque: "Clássico",
      novo: false,
      tamanhos: ["PP", "P", "M", "G"],
      cores: ["Pérola", "Preto", "Verde Oliva"],
      tecido: "Cetim encorpado com corte no viés e zíper invisível",
      descricao:
        "Saia midi luminosa que transita facilmente do tênis casual com camisa de linho até produções noturnas com salto fino."
    },
    {
      id: "macacao-pantalona-noir",
      nome: "Macacão Linho Pantalona Noir",
      categoria: "Alfaiataria",
      preco: 389.90,
      precoAntigo: null,
      imagem: "imagens/macacao-linho-preto.jpg",
      destaque: "Mais Desejado",
      novo: true,
      tamanhos: ["P", "M", "G", "GG"],
      cores: ["Preto", "Linho Cru"],
      tecido: "55% Linho, 45% Viscose • Acompanha faixa do mesmo tecido",
      descricao:
        "Peça única alongadora com decote reto estruturado, faixa ajustável na cintura e pernas amplas estilo pantalona. Praticidade e presença em qualquer ocasião."
    },
    {
      id: "conjunto-resort-cacau",
      nome: "Conjunto Resort Linho Cacau",
      categoria: "Conjuntos",
      preco: 329.90,
      precoAntigo: null,
      imagem: "imagens/conjunto-resort-areia.jpg",
      destaque: "Novo",
      novo: true,
      tamanhos: ["PP", "P", "M", "G"],
      cores: ["Cacau", "Areia"],
      tecido: "Viscolinho leve pré-lavado (não encolhe)",
      descricao:
        "Camisa cropped com amarração frontal charmosa combinada à saia midi em camadas fluidas. Perfeito para viagens, dias ensolarados e produções descomplicadas."
    },
    {
      id: "blazer-linho-cru-essencial",
      nome: "Blazer Alfaiataria Linho Cru",
      categoria: "Alfaiataria",
      preco: 319.90,
      precoAntigo: 369.90,
      imagem: "imagens/blazer-linho-cru.jpg",
      destaque: "Oferta",
      novo: false,
      tamanhos: ["P", "M", "G", "GG"],
      cores: ["Linho Cru", "Off-White"],
      tecido: "Linho misto estruturado com forro leve respirável",
      descricao:
        "Corte levemente alongado com caimento despojado chic, bolsos frontais embutidos e acabamento de alfaiataria artesanal pensado para o clima brasileiro."
    }
  ]
};
