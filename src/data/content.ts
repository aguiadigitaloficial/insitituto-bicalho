import { media } from './photos';
export { media } from './photos';

export const site = {
  name: 'Instituto Bicalho',
  tagline: 'Odontologia de Precisão',
  url: import.meta.env?.PUBLIC_SITE_URL || 'https://institutobicalho.com',
};
export type Unit = { id: string; name: string; phone: string; display: string; note: string; address: string; postalCode: string; mapLocation: string; googlePlaceId: string; googleEmbed: string; latitude: number; longitude: number; landmark?: string };
export const units: Unit[] = [
  { id: 'joao-monlevade', name: 'João Monlevade', phone: '5531992957448', display: '(31) 99295-7448', note: 'Nossa equipe espera por você em João Monlevade.', address: 'Av. Gentil Bicalho, 384, 2º andar, Carneirinhos', postalCode: '35930-478', mapLocation: 'Av. Gentil Bicalho, 384, Carneirinhos, João Monlevade - MG, Brasil', googlePlaceId: 'ChIJU1SbPXMHpQARw7UoLTBid8k', latitude: -19.8076883, longitude: -43.184102, googleEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3753.761942485491!2d-43.18410199999999!3d-19.8076883!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xa507733d9b5453%3A0xc97762302d28b5c3!2sInstituto%20Bicalho%20Odontologia%20de%20Precis%C3%A3o!5e0!3m2!1spt-BR!2sbr!4v1793071332500!5m2!1spt-BR!2sbr' },
  // Both Place IDs and embed URLs were checked in the official Google Maps profiles.
  { id: 'belo-horizonte', name: 'Belo Horizonte', phone: '5531997954111', display: '(31) 99795-4111', note: 'O cuidado do Instituto também em Belo Horizonte.', address: 'Av. Barão Homem de Melo, 55, loja 12, Nova Granada', postalCode: '30431-285', mapLocation: '-19.935259,-43.9718161', landmark: 'BH Point', googlePlaceId: 'ChIJRWZqfhmXpgARwWg7SmnBfFY', latitude: -19.935259, longitude: -43.9718161, googleEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3750.742359191241!2d-43.9718161!3d-19.935259000000002!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xa697197e6a6645%3A0x567cc1694a3b68c1!2sInstituto%20Bicalho%20Odontologia%20de%20Precis%C3%A3o%20%7C%20Filial!5e0!3m2!1spt-BR!2sbr!4v1793071475238!5m2!1spt-BR!2sbr' },
];
// Official profile URLs supplied by the user.
export const socialLinks: { name: string; icon: string; url: string | null }[] = [
  { name: 'Instagram', icon: 'instagram', url: 'https://www.instagram.com/institutobicalhoodontologia/' },
  { name: 'Facebook', icon: 'facebook', url: 'https://www.facebook.com/institutobicalho/' },
];
export const agencyUrl = 'https://www.aguiadigital.com/';
export const mapQuery = (unit: Unit) => unit.mapLocation;
export const googleProfile = (unit: Unit) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.name} ${unit.name}`)}&query_place_id=${unit.googlePlaceId}`;
export const googleReviews = (unit: Unit) => `https://search.google.com/local/reviews?placeid=${unit.googlePlaceId}`;
export const directions = (unit: Unit) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery(unit))}&destination_place_id=${unit.googlePlaceId}`;
export const mapEmbed = (unit: Unit) => unit.googleEmbed;
export const whatsapp = (phone: string) => `https://wa.me/${phone}?text=${encodeURIComponent('Olá! Vim pelo site do Instituto Bicalho e gostaria de agendar uma avaliação.')}`;
export const nav = [
  { href: '/', label: 'Início' },
  { href: '/tratamentos/', label: 'Tratamentos' },
  { href: '/estetica/', label: 'Estética' },
  { href: '/ortodontia-e-cirurgia/', label: 'Ortodontia e Cirurgia' },
  { href: '/odontologia-de-precisao/', label: 'Odontologia de Precisão' },
  { href: '/contato/', label: 'Contato' },
  { href: '/conteudos/', label: 'Blog' },
];
export type Service = { id: string; title: string; text: string };
export type Area = { slug: string; title: string; short: string; homeSummary?: string; heading: string; intro: string; icon: string; image: keyof typeof media; sectionImage: keyof typeof media; services: Service[]; questions: [string, string][]; seoTitle: string; seoDescription: string; eyebrow: string; servicesHeading: string; faqIntro: string; relatedLinks: { label: string; href: string }[] };
export const areas: Area[] = [
  {
    slug: 'tratamentos', title: 'Tratamentos', short: 'Saúde e função para o seu sorriso.', icon: 'tooth', image: 'care', sectionImage: 'serviceTreatments',
    homeSummary: 'Prevenção, tratamento de canal, periodontia e reabilitação oral.',
    seoTitle: 'Tratamentos odontológicos | Instituto Bicalho',
    seoDescription: 'Tratamentos odontológicos em João Monlevade e Belo Horizonte: implantes, próteses, canal e prevenção, com avaliação individualizada no Instituto Bicalho.',
    eyebrow: 'Saúde bucal e reabilitação.',
    heading: 'Tratamentos odontológicos em João Monlevade e Belo Horizonte.',
    intro: 'Você encontra no Instituto Bicalho Odontologia de Precisão cuidados de prevenção, tratamento de canal, próteses e reabilitação oral. Na avaliação, o dentista examina sua saúde bucal e conversa sobre o que você precisa para definir as etapas do tratamento.',
    servicesHeading: 'Tratamentos odontológicos para dentes, gengivas e mastigação.',
    services: [
      { id: 'implantes-dentarios', title: 'Implantes dentários', text: 'O implante funciona como uma raiz artificial para dar suporte à reposição de dentes ausentes. O dentista avalia a gengiva, o osso e seu histórico de saúde para planejar o tratamento e a prótese que será instalada sobre ele.' },
      { id: 'proteses-dentarias', title: 'Próteses dentárias', text: 'Próteses substituem dentes ausentes e podem ajudar na mastigação e na fala. A avaliação define as possibilidades de prótese fixa, removível ou sobre implantes, considerando a condição da boca e os cuidados necessários no dia a dia.' },
      { id: 'coroas-dentarias', title: 'Coroas dentárias', text: 'A coroa recobre um dente quando sua estrutura precisa de reconstrução e proteção. A indicação depende da quantidade de dente preservada, da mordida e das condições clínicas. O planejamento considera material, formato e adaptação.' },
      { id: 'tratamento-de-canal', title: 'Tratamento de canal', text: 'O tratamento de canal cuida da parte interna do dente quando a polpa está inflamada ou infectada. A avaliação e os exames indicados orientam o procedimento e a restauração necessária para recuperar a estrutura do dente após o tratamento.' },
      { id: 'restauracoes', title: 'Restaurações dentárias', text: 'Restaurações recompõem partes do dente afetadas por cáries, fraturas ou desgaste. O dentista avalia a extensão da alteração para definir o material e a forma de reconstrução, considerando a mastigação e a aparência do dente.' },
      { id: 'prevencao', title: 'Prevenção odontológica', text: 'Consultas de prevenção permitem acompanhar dentes e gengivas, identificar alterações e orientar sua rotina de higiene. Os cuidados profissionais e o intervalo entre os retornos são definidos conforme sua saúde bucal e suas necessidades.' },
      { id: 'odontopediatria', title: 'Odontopediatria', text: 'O atendimento odontológico infantil acompanha o desenvolvimento da boca e dos dentes. A consulta considera a idade, a adaptação da criança e a participação da família, com orientações de higiene, alimentação e prevenção adequadas a cada fase.' },
      { id: 'periodontia', title: 'Periodontia: cuidado com a gengiva', text: 'A periodontia cuida da gengiva e dos tecidos que sustentam os dentes. Sangramento, inchaço ou alterações na gengiva precisam de avaliação. O diagnóstico orienta o tratamento e o acompanhamento da saúde periodontal.' },
      { id: 'reabilitacao-oral', title: 'Reabilitação oral', text: 'Quando há dentes ausentes, desgastes ou dificuldades na mastigação, a reabilitação oral organiza diferentes cuidados em um mesmo plano. As etapas podem envolver restaurações, próteses e implantes, conforme a indicação clínica e as prioridades do caso.' },
    ],
    relatedLinks: [
      { label: 'Estética do sorriso', href: '/estetica/' },
      { label: 'Ortodontia e cirurgia odontológica', href: '/ortodontia-e-cirurgia/' },
      { label: 'Recursos de odontologia de precisão', href: '/odontologia-de-precisao/' },
    ],
    faqIntro: 'Entenda como a avaliação orienta seu plano de tratamento.',
    questions: [
      ['Como saber de qual tratamento odontológico preciso?', 'Conte ao dentista o que está incomodando e quais mudanças você percebeu. O exame clínico e, quando necessários, os exames complementares ajudam a identificar as causas e definir as opções de cuidado. Você recebe explicações sobre as etapas propostas e pode esclarecer suas dúvidas.'],
      ['Posso combinar diferentes tratamentos no mesmo planejamento?', 'Sim, quando houver indicação. Um caso pode envolver cuidados com a gengiva, restaurações e reposição de dentes, por exemplo. O planejamento organiza a sequência desses atendimentos, e a equipe informa a disponibilidade dos serviços na unidade escolhida.'],
    ],
  },
  {
    slug: 'estetica', title: 'Estética', short: 'Harmonia que respeita a sua identidade.', icon: 'spark', image: 'smile', sectionImage: 'serviceAesthetics',
    homeSummary: 'Facetas dentárias, clareamento dental e harmonização orofacial.',
    seoTitle: 'Estética dental e orofacial | Instituto Bicalho',
    seoDescription: 'Estética dental em João Monlevade e Belo Horizonte: facetas, lentes de contato dental, clareamento e harmonização orofacial, com avaliação individualizada.',
    eyebrow: 'Estética do sorriso e da face.',
    heading: 'Estética dental e harmonização orofacial.',
    intro: 'Cor, formato dos dentes e características da face fazem parte da conversa sobre o que você deseja mudar. No Instituto Bicalho Odontologia de Precisão, em João Monlevade e Belo Horizonte, o planejamento considera sua saúde bucal, a mordida e as possibilidades de cada procedimento.',
    servicesHeading: 'Procedimentos de estética dental e orofacial.',
    services: [
      { id: 'facetas', title: 'Facetas dentárias', text: 'Facetas recobrem a parte da frente dos dentes e podem ser indicadas para alterações de forma ou cor. A escolha considera a estrutura dental, a mordida e os objetivos do tratamento. Na consulta, você entende o preparo necessário e os cuidados de manutenção.' },
      { id: 'lentes-de-contato-dental', title: 'Lentes de contato dental', text: 'As lentes de contato dental são laminados cerâmicos cuja indicação depende das características de cada dente. O planejamento avalia cor, forma, espessura e necessidade de preparo para discutir as possibilidades de mudança no sorriso.' },
      { id: 'clareamento-dental', title: 'Clareamento dental', text: 'O clareamento modifica a tonalidade dos dentes naturais com acompanhamento do dentista. A avaliação considera a saúde bucal, a presença de restaurações e a sensibilidade para definir a técnica e orientar os cuidados durante o tratamento.' },
      { id: 'harmonizacao-orofacial', title: 'Harmonização orofacial', text: 'A harmonização orofacial reúne procedimentos voltados às características e proporções da face, dentro da atuação odontológica. A avaliação considera suas expectativas e seu histórico de saúde. O profissional explica as opções, os cuidados e as indicações para o seu caso.' },
    ],
    relatedLinks: [
      { label: 'Cuidados com a saúde bucal', href: '/tratamentos/' },
      { label: 'Ortodontia e alinhadores', href: '/ortodontia-e-cirurgia/' },
      { label: 'Planejamento digital do sorriso', href: '/odontologia-de-precisao/#planejamento-digital-do-sorriso' },
    ],
    faqIntro: 'Conheça os critérios usados para conversar sobre mudanças no sorriso.',
    questions: [
      ['Facetas e lentes de contato dental são a mesma coisa?', 'Os dois nomes se relacionam a revestimentos aplicados sobre a superfície dos dentes, mas o planejamento e o preparo podem variar. O nome do procedimento, sozinho, não define quanto desgaste será necessário. O dentista examina cada dente e explica a opção proposta.'],
      ['Como escolher entre clareamento e outros procedimentos estéticos?', 'A escolha depende do que você deseja modificar e das condições dos dentes e da gengiva. Cor, forma e posição podem exigir abordagens diferentes. Na avaliação, você conversa sobre essas possibilidades, os cuidados envolvidos e as expectativas para o tratamento.'],
    ],
  },
  {
    slug: 'ortodontia-e-cirurgia', title: 'Ortodontia e Cirurgia', short: 'Planejamento e cuidado em cada etapa.', icon: 'align', image: 'aligners', sectionImage: 'serviceOrthodontics',
    homeSummary: 'Aparelho fixo, alinhadores invisíveis, implante dentário e cirurgia bucomaxilofacial.',
    seoTitle: 'Ortodontia e cirurgia odontológica | Instituto Bicalho',
    seoDescription: 'Ortodontia e cirurgia odontológica em João Monlevade e Belo Horizonte: aparelhos, alinhadores, sisos e avaliação de DTM no Instituto Bicalho.',
    eyebrow: 'Alinhamento, mordida e cuidados cirúrgicos.',
    heading: 'Ortodontia e cirurgia odontológica.',
    intro: 'O posicionamento dos dentes, a mordida e as condições da boca orientam o planejamento de cada atendimento. No Instituto Bicalho Odontologia de Precisão, em João Monlevade e Belo Horizonte, você recebe avaliação para cuidados ortodônticos e cirúrgicos, conforme a necessidade do seu caso.',
    servicesHeading: 'Cuidados em ortodontia e cirurgia odontológica.',
    services: [
      { id: 'ortodontia', title: 'Ortodontia e aparelho fixo', text: 'A ortodontia avalia a posição dos dentes e a forma como eles se encaixam ao fechar a boca. O aparelho fixo pode integrar o tratamento quando indicado. O planejamento considera os movimentos necessários, a saúde bucal e o acompanhamento durante as etapas.' },
      { id: 'alinhadores-transparentes', title: 'Alinhadores transparentes', text: 'Alinhadores são dispositivos removíveis usados em uma sequência planejada para movimentar os dentes. A indicação depende da avaliação ortodôntica. O uso conforme a orientação e os retornos ao dentista fazem parte do acompanhamento.' },
      { id: 'extracao-de-sisos', title: 'Extração de sisos', text: 'A retirada dos dentes do siso depende de avaliação clínica e, quando indicados, exames de imagem. O dentista verifica a posição dos dentes e as condições da região para explicar a indicação, o procedimento e os cuidados após a cirurgia.' },
      { id: 'cirurgia-bucomaxilofacial', title: 'Cirurgia bucomaxilofacial', text: 'A área bucomaxilofacial avalia condições da boca, dos maxilares e de estruturas relacionadas. Quando há indicação cirúrgica, o diagnóstico orienta o procedimento, o local adequado para realizá-lo e o acompanhamento necessário.' },
      { id: 'cirurgias-com-sedacao', title: 'Cirurgias com sedação', text: 'A sedação pode fazer parte de procedimentos selecionados, conforme a avaliação de saúde e o planejamento da equipe responsável. Na consulta, você recebe orientações sobre a indicação e os cuidados necessários. Confirme a disponibilidade na unidade de sua preferência.' },
      { id: 'biopsias', title: 'Biópsias de lesões da boca', text: 'A biópsia consiste na coleta de uma amostra de tecido para ajudar a investigar uma alteração na boca. O profissional avalia a lesão e, quando indica o exame, explica a coleta, a análise do material e como será o retorno para discutir o resultado.' },
      { id: 'tratamento-de-dtm', title: 'Tratamento de DTM', text: 'As disfunções temporomandibulares podem envolver a articulação da mandíbula e os músculos da mastigação. A avaliação considera dor, movimentos e outras queixas para orientar o cuidado. As abordagens são definidas conforme o diagnóstico.' },
      { id: 'avaliacao-da-atm', title: 'Avaliação e tratamento da ATM', text: 'ATM é a articulação que liga a mandíbula ao crânio. Dor ou dificuldade para abrir e movimentar a boca são motivos para avaliação. O dentista examina a região e investiga a queixa para orientar o acompanhamento e as possibilidades de tratamento.' },
      { id: 'bruxismo', title: 'Bruxismo', text: 'Bruxismo é o hábito de apertar ou ranger os dentes, que pode ocorrer durante o sono ou enquanto você está acordado. A avaliação investiga os sinais e possíveis efeitos sobre dentes e músculos para orientar medidas de cuidado e proteção quando indicadas.' },
    ],
    relatedLinks: [
      { label: 'Tratamentos e reabilitação oral', href: '/tratamentos/' },
      { label: 'Estética dental e orofacial', href: '/estetica/' },
      { label: 'Planejamento com recursos digitais', href: '/odontologia-de-precisao/' },
    ],
    faqIntro: 'Veja o que considerar ao conversar sobre aparelhos e procedimentos cirúrgicos.',
    questions: [
      ['Como saber se preciso de aparelho fixo ou alinhadores?', 'A avaliação ortodôntica considera a mordida, a posição dos dentes e os movimentos necessários. O profissional apresenta as alternativas indicadas e explica o uso, a higiene e o acompanhamento de cada opção. A escolha combina as necessidades clínicas e sua rotina.'],
      ['O que preciso saber para agendar uma avaliação cirúrgica?', 'Informe sua queixa e a unidade em que deseja atendimento. A equipe orienta o agendamento e confirma a disponibilidade do serviço. Na avaliação, o profissional analisa seu histórico de saúde e informa os exames, o local do procedimento e os cuidados indicados.'],
    ],
  },
  {
    slug: 'odontologia-de-precisao', title: 'Odontologia de Precisão', short: 'Tecnologia a serviço de um cuidado individual.', icon: 'scan', image: 'precision', sectionImage: 'servicePrecision',
    homeSummary: 'Escaneamento digital e planejamento guiado por tecnologia, do diagnóstico à execução.',
    seoTitle: 'Odontologia de precisão e digital | Instituto Bicalho',
    seoDescription: 'Odontologia de precisão com escaneamento intraoral, planejamento digital e próteses. Conheça o Instituto Bicalho em João Monlevade e Belo Horizonte.',
    eyebrow: 'Registros, planejamento e execução.',
    heading: 'Odontologia de precisão com planejamento digital.',
    intro: 'Registros digitais ajudam o dentista a estudar sua boca, discutir as possibilidades de tratamento e compartilhar informações entre as etapas clínicas e laboratoriais. Conheça os recursos do Instituto Bicalho Odontologia de Precisão, com unidades em João Monlevade e Belo Horizonte.',
    servicesHeading: 'Recursos de odontologia de precisão no seu tratamento.',
    services: [
      { id: 'escaneamento-intraoral', title: 'Escaneamento intraoral', text: 'O scanner intraoral registra digitalmente a superfície dos dentes e da gengiva. Essas imagens ajudam no planejamento e podem substituir moldagens em situações indicadas. A escolha do recurso depende do tipo de tratamento e da avaliação clínica.' },
      { id: 'planejamento-digital-do-sorriso', title: 'Planejamento digital do sorriso', text: 'Imagens e registros digitais permitem analisar características do sorriso e conversar sobre as mudanças propostas. As simulações ajudam a discutir objetivos e possibilidades. O planejamento considera também a saúde bucal, a mordida e a resposta individual ao tratamento.' },
      { id: 'laboratorio-digital', title: 'Laboratório digital', text: 'O fluxo digital conecta os registros feitos na clínica ao planejamento e à confecção de peças odontológicas. O compartilhamento dessas informações apoia a comunicação entre dentista e laboratório durante o desenvolvimento e os ajustes do trabalho.' },
      { id: 'proteses-e-restauracoes-digitais', title: 'Próteses e restaurações digitais', text: 'Recursos digitais podem apoiar o desenho e a confecção de próteses e restaurações. A avaliação define quando esse fluxo é indicado, e o dentista verifica adaptação, contato entre os dentes e características da peça nas etapas clínicas.' },
    ],
    relatedLinks: [
      { label: 'Implantes, próteses e restaurações', href: '/tratamentos/' },
      { label: 'Facetas e estética do sorriso', href: '/estetica/' },
      { label: 'Ortodontia e cirurgia', href: '/ortodontia-e-cirurgia/' },
    ],
    faqIntro: 'Entenda como os registros digitais participam do planejamento.',
    questions: [
      ['O escaneamento intraoral é utilizado em todo tratamento?', 'O dentista escolhe os registros conforme o procedimento e as condições clínicas. Em casos indicados, o escaneamento pode substituir a moldagem tradicional. Outros exames e formas de registro podem ser necessários para completar o planejamento.'],
      ['A simulação digital mostra exatamente como ficará o resultado?', 'A simulação é uma referência para discutir possibilidades e alinhar expectativas. A execução e a resposta ao tratamento dependem das condições clínicas de cada pessoa. O dentista explica como os registros digitais serão usados no seu planejamento.'],
    ],
  },
];
export const team = [
  { name: 'Dr. Bruno Bicalho', role: 'Sócio-proprietário', kind: 'Especialidades', work: 'Implantodontia e Cirurgia Bucomaxilofacial.' },
  { name: 'Dra. Roberta Souza Carneiro', role: 'Sócia-proprietária', kind: 'Especialidades', work: 'Ortodontia e tratamento com alinhadores invisíveis.' },
  { name: 'Dra. Isabella Mazarelo', role: '', kind: 'Áreas de atuação', work: 'Harmonização Orofacial (HOF) e Clínica Geral.' },
  { name: 'Dra. Jéssica Bonfim', role: '', kind: 'Áreas de atuação', work: 'Implantodontia, Próteses Dentárias, Reabilitação Oral e Próteses sobre Implantes.' },
  { name: 'Dra. Lívia Teixeira', role: '', kind: 'Áreas de atuação', work: 'Prótese Dentária, Dentística, Facetas e Odontologia Estética.' },
  { name: 'Dra. Daniele', role: '', kind: 'Áreas de atuação', work: 'Cirurgias Odontológicas e Clínica Geral.' },
  { name: 'Dra. Mariane Barros', role: '', kind: 'Áreas de atuação', work: 'Clínica Geral, Clareamento Dental, Prevenção e Saúde Bucal e Restaurações.' },
  { name: 'Dra. Thaís dos Anjos', role: '', kind: 'Especialidades', work: 'Periodontia, ATM e DTM e tratamento do Bruxismo.' },
  { name: 'Dr. Paulo', role: '', kind: 'Especialidade', work: 'Ortodontia.' },
  { name: 'Dra. Ana Luiza Perdigão', role: '', kind: 'Especialidade', work: 'Odontopediatria.' },
  { name: 'Dra. Anne Sousa', role: '', kind: 'Especialidade', work: 'Endodontia, tratamento de canal.' },
  { name: 'Dra. Luísa Lima', role: 'Equipe de Belo Horizonte', kind: 'Áreas de atuação', work: 'Prótese Dentária, Clínica Geral e Harmonização Orofacial (HOF).' },
  { name: 'Dra. Stefany de Oliveira Lima', role: 'Equipe de Belo Horizonte', kind: 'Especialidade', work: 'Próteses Dentárias.' },
  { name: 'Dra. Veridiana Salles', role: 'Equipe de Belo Horizonte', kind: 'Especialidade', work: 'Odontopediatria.' },
];
export const homeQuestions: [string, string][] = [
  ['Como agendar uma avaliação?', 'Escolha João Monlevade ou Belo Horizonte e fale pelo WhatsApp da unidade. Nossa equipe orienta você, esclarece suas dúvidas e ajuda a agendar sua avaliação.'],
  ['O Instituto atende nas duas cidades?', 'Sim. O Instituto Bicalho está presente em João Monlevade e Belo Horizonte. Consulte a equipe sobre a disponibilidade do procedimento na unidade de sua preferência.'],
  ['Como funciona a primeira consulta?', 'É o momento de conhecer suas necessidades, conversar sobre sua saúde bucal e avaliar as possibilidades de cuidado. A equipe explica as próximas etapas e os exames necessários, quando indicados.'],
  ['Como consultar valores e formas de pagamento?', 'O planejamento e o orçamento dependem da avaliação individual. A equipe apresenta as etapas propostas e as condições de pagamento antes de você decidir pelo tratamento.'],
];
