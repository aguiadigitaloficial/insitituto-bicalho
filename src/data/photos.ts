export type PhotoDefinition = { src: string; title: string; alt: string; position: string; width: number; height: number; original: string; widths?: number[] };
export const photoCopyright = 'Instituto Bicalho Odontologia de Precisão';

// Descriptions identify what is visible; they do not infer procedures or authorship.
export const media = {
  smile: { src: 'official-consultation', title: 'Conversa com uma paciente no Instituto Bicalho', alt: 'Profissional conversa com uma paciente no Instituto Bicalho', position: '64% 44%', width: 1600, height: 1066, original: 'official-20261026/THA03256.jpg' },
  hero: { src: 'official-entrance', title: 'Recepção do Instituto Bicalho', alt: 'Recepção do Instituto Bicalho com o letreiro da clínica', position: '72% 48%', width: 1600, height: 1066, original: 'official-20261026/DSC01005.jpg' },
  aligners: { src: 'official-treatment-room', title: 'Consultório odontológico do Instituto Bicalho', alt: 'Consultório do Instituto Bicalho com cadeira odontológica e bancada clínica', position: '65% 56%', width: 1600, height: 1066, original: 'official-20261026/DSC01046.jpg' },
  precision: { src: 'official-consulting-room', title: 'Estrutura do consultório do Instituto Bicalho', alt: 'Consultório odontológico do Instituto Bicalho com mesa de atendimento e cadeira clínica', position: '62% 50%', width: 1600, height: 1066, original: 'official-20261026/DSC01027.jpg' },
  care: { src: 'official-dental-care-close', title: 'Atendimento odontológico no Instituto Bicalho', alt: 'Profissional realiza atendimento odontológico no Instituto Bicalho', position: '50% 57%', width: 1600, height: 2400, original: 'official-20261026/THA03292.jpg' },
  careOverview: { src: 'official-dental-care-wide', title: 'Profissional e paciente durante atendimento odontológico', alt: 'Atendimento odontológico com profissional e paciente no consultório do Instituto Bicalho', position: '50% 58%', width: 1600, height: 2400, original: 'official-20261026/THA03288.jpg' },
  clinic: { src: 'official-care-room', title: 'Ambiente de atendimento do Instituto Bicalho', alt: 'Vista do consultório odontológico do Instituto Bicalho, com cadeira clínica, mesa e bancada', position: '50% 54%', width: 1600, height: 1066, original: 'official-20261026/DSC01016.jpg' },
  team: { src: 'official-team-meeting', title: 'Reunião da equipe do Instituto Bicalho', alt: 'Equipe do Instituto Bicalho reunida à mesa', position: 'center', width: 1600, height: 1066, original: 'official-20261026/THA03124.jpg' },
  teamWanuza: { src: 'official-team-jm-wanuza', title: 'Wanuza — Gerente', alt: 'Retrato de Wanuza, gerente da equipe de João Monlevade do Instituto Bicalho', position: '50% 15%', width: 1066, height: 1600, original: 'team-jm-20261104/photo-13.jpg', widths: [480, 800, 1066] },
  teamLivia: { src: 'official-team-jm-livia-teixeira', title: 'Dra. Lívia Teixeira — Estética e Reabilitação oral', alt: 'Retrato da Dra. Lívia Teixeira, da equipe de João Monlevade do Instituto Bicalho', position: '50% 15%', width: 1066, height: 1600, original: 'team-jm-20261104/photo-12.jpg', widths: [480, 800, 1066] },
  teamIrlam: { src: 'official-team-jm-irlam', title: 'Irlam — Diretora Clínica e ASB', alt: 'Retrato de Irlam, Diretora Clínica e ASB da equipe de João Monlevade do Instituto Bicalho', position: '50% 15%', width: 1066, height: 1600, original: 'team-jm-20261104/photo-11.jpg', widths: [480, 800, 1066] },
  teamIara: { src: 'official-team-jm-iara', title: 'Iara — CRM', alt: 'Retrato de Iara, CRM da equipe de João Monlevade do Instituto Bicalho', position: '50% 15%', width: 1066, height: 1600, original: 'team-jm-20261104/photo-10.jpg', widths: [480, 800, 1066] },
  teamBianca: { src: 'official-team-jm-bianca', title: 'Bianca — CRC', alt: 'Retrato de Bianca, CRC da equipe de João Monlevade do Instituto Bicalho', position: '50% 15%', width: 1067, height: 1600, original: 'team-jm-20261104/photo-09.jpg', widths: [480, 800, 1067] },
  teamEloiza: { src: 'official-team-jm-eloiza', title: 'Eloiza — Auxiliar de saúde bucal', alt: 'Retrato de Eloiza, auxiliar de saúde bucal da equipe de João Monlevade do Instituto Bicalho', position: '50% 15%', width: 1066, height: 1600, original: 'team-jm-20261104/photo-08.jpg', widths: [480, 800, 1066] },
  teamMatheus: { src: 'official-team-jm-matheus-souza', title: 'Matheus Souza — Protético', alt: 'Retrato de Matheus Souza, protético da equipe de João Monlevade do Instituto Bicalho', position: '50% 15%', width: 1066, height: 1600, original: 'team-jm-20261104/photo-07.jpg', widths: [480, 800, 1066] },
  teamJessica: { src: 'official-team-bh-jessica', title: 'Jessica — Recepção', alt: 'Retrato de Jessica, recepção da equipe de Belo Horizonte do Instituto Bicalho', position: '50% 15%', width: 1068, height: 1600, original: 'team-bh-20261105/jessica.jpeg', widths: [240, 480, 800, 1068] },
  teamVeridiana: { src: 'official-team-bh-veridiana-salles', title: 'Dra. Veridiana Salles — Odontopediatra', alt: 'Retrato da Dra. Veridiana Salles, da equipe de Belo Horizonte do Instituto Bicalho', position: '50% 15%', width: 1064, height: 1600, original: 'team-bh-20261105/veridiana-salles.jpeg', widths: [240, 480, 800, 1064] },
  teamNicoly: { src: 'official-team-bh-nicoly-santos', title: 'Nicoly Santos — ABS', alt: 'Retrato de Nicoly Santos, ABS da equipe de Belo Horizonte do Instituto Bicalho', position: '50% 15%', width: 1064, height: 1600, original: 'team-bh-20261105/nicoly-santos.jpeg', widths: [240, 480, 800, 1064] },
  teamLuisa: { src: 'official-team-bh-luisa-lima', title: 'Dra. Luísa Lima — Reabilitação oral', alt: 'Retrato da Dra. Luísa Lima, da equipe de Belo Horizonte do Instituto Bicalho', position: '50% 15%', width: 852, height: 1280, original: 'team-bh-20261105/luisa-lima.jpeg', widths: [240, 480, 800, 852] },
  teamAnaLuiza: { src: 'official-team-bh-ana-luiza-perdigao', title: 'Dra. Ana Luiza Perdigão — Odontopediatra', alt: 'Retrato da Dra. Ana Luiza Perdigão, da equipe de Belo Horizonte do Instituto Bicalho', position: '50% 15%', width: 1118, height: 1600, original: 'team-bh-20261105/ana-luiza-perdigao.jpeg', widths: [240, 480, 800, 1118] },
  teamAlice: { src: 'official-team-bh-alice', title: 'Alice — Financeiro', alt: 'Retrato de Alice, financeiro da equipe de Belo Horizonte do Instituto Bicalho', position: '50% 15%', width: 1066, height: 1600, original: 'team-bh-20261105/alice.jpeg', widths: [240, 480, 800, 1066] },
  serviceTreatments: { src: 'official-service-tratamentos', title: 'Consultório com painel de anatomia dental do Instituto Bicalho', alt: 'Consultório do Instituto Bicalho com painel de anatomia dental, cadeira odontológica e mesa de atendimento', position: '32% 58%', width: 1600, height: 1066, original: 'official-20261026/DSC01076.jpg' },
  serviceAesthetics: { src: 'official-service-estetica', title: 'Consultório com espelho do Instituto Bicalho', alt: 'Consultório do Instituto Bicalho com espelho, cadeira odontológica e bancada clínica', position: '42% 58%', width: 1600, height: 1066, original: 'official-20261026/DSC01054.jpg' },
  serviceOrthodontics: { src: 'official-service-ortodontia', title: 'Estrutura clínica do Instituto Bicalho', alt: 'Cadeira odontológica, equipamentos e mesa de atendimento em um consultório do Instituto Bicalho', position: '60% 72%', width: 1600, height: 1066, original: 'official-20261026/DSC00998.jpg' },
  servicePrecision: { src: 'official-service-precisao', title: 'Consultório com mesa de avaliação do Instituto Bicalho', alt: 'Consultório do Instituto Bicalho com mesa de avaliação, bancada e cadeira odontológica', position: '65% 56%', width: 1600, height: 1066, original: 'official-20261026/DSC00991.jpg' },
  partnerOne: { src: 'partner-01', title: 'Retrato institucional de sócio do Instituto Bicalho', alt: 'Sócio do Instituto Bicalho em retrato institucional', position: '50% 27%', width: 1600, height: 2400, original: 'partner-01.jpg' },
  partnerTwo: { src: 'partner-02', title: 'Retrato institucional de sócia do Instituto Bicalho', alt: 'Sócia do Instituto Bicalho em retrato institucional', position: '50% 28%', width: 1600, height: 2400, original: 'partner-02.jpg' },
  partnersTogether: { src: 'official-partners-together', title: 'Dr. Bruno Bicalho e Dra. Roberta Souza Carneiro', alt: 'Dr. Bruno Bicalho e Dra. Roberta Souza Carneiro juntos em retrato institucional', position: '50% 30%', width: 1600, height: 2400, original: 'official-20261026/THA02227-Editar-Editar.jpg' },
  professional: { src: 'professional-01', title: 'Retrato de profissional do Instituto Bicalho', alt: 'Profissional do Instituto Bicalho em retrato institucional', position: '50% 28%', width: 1600, height: 2400, original: 'professional-01.jpg' },
} satisfies Record<string, PhotoDefinition>;

export const photoWidths = (photo: PhotoDefinition) => photo.widths ?? (photo.src.startsWith('official-')
  ? photo.width > photo.height ? [480, 800, 1200, 1600, 1920, 2560, 2936] : [480, 800, 1200, 1600, 1920]
  : [480, 800, 1200, 1600]);
export const photoWidthAt = (photo: PhotoDefinition, preferred: number) => photoWidths(photo).filter(width => width <= preferred).at(-1) ?? photoWidths(photo)[0];

// Account for the full raster behind object-fit:cover, including the approved zoomed crops.
// These server-rendered fallbacks also work before JavaScript and with scripts disabled.
export const photoSizes = {
  hero: '(min-width: 1200px) 571px, (min-width: 600px) calc(100vw - 56px), max(calc(100vw - 40px), 421px)',
  partnersTogether: '(min-width: 1024px) min(560px, calc((min(100vw - 56px, 1240px) - 40px) / 2.12)), (min-width: 600px) min(640px, calc(100vw - 56px)), calc(100vw - 40px)',
  teamPortrait: '(min-width: 600px) 6rem, 5rem',
  innerLandscape: '(min-width: 1200px) 721px, (min-width: 600px) max(calc(100vw - 56px), 511px), max(calc(100vw - 40px), 511px)',
  innerPortrait: '(min-width: 1304px) 567px, (min-width: 1200px) calc((100vw - 104px) / 2.12), (min-width: 600px) calc(100vw - 56px), calc(100vw - 40px)',
  area: [
    '(min-width: 1024px) 735px, (min-width: 768px) max(calc((100vw - 82px) / 2), 374px), (min-width: 600px) calc(100vw - 64px), max(calc(100vw - 40px), 374px)',
    '(min-width: 768px) 841px, (min-width: 600px) max(calc(100vw - 64px), 631px), max(calc(100vw - 40px), 586px)',
    '(min-width: 600px) 1009px, 937px',
    '(min-width: 600px) 946px, 879px',
  ],
  wide: '(min-width: 1328px) 1240px, (min-width: 1024px) calc(100vw - 88px), (min-width: 600px) max(calc(100vw - 64px), 481px), max(calc(100vw - 40px), 481px)',
};
