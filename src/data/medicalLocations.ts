export interface MedicalLocation {
  name: string;
  city: 'Goiânia' | 'Aparecida de Goiânia';
  type: 'Público / SUS' | 'Filantrópico / SUS' | 'Privado / Convênios' | 'Especializado';
  category: string;
}

export const PROCEDURE_SUGGESTIONS = [
  'Consulta Médica',
  'Consulta com Especialista',
  'Exame de Sangue / Laboratorial',
  'Exame de Imagem (Raio-X, Tomografia, Ressonância)',
  'Exame Cardiológico (Ecocardiograma, Holter, MAPA)',
  'Exame Oftalmológico',
  'Cirurgia Geral',
  'Cirurgia Cardíaca',
  'Cirurgia Oncológica',
  'Cirurgia Ortopédica',
  'Cirurgia Pediátrica',
  'Cirurgia Oftalmológica (Catarata, Retina)',
  'Tratamento Oncológico (Quimioterapia)',
  'Tratamento Oncológico (Radioterapia)',
  'Sessão de Hemodiálise',
  'Reabilitação e Fisioterapia',
  'Retorno / Avaliação Pós-operatória',
  'Internação Hospitalar',
  'Biópsia / Punção',
  'Endoscopia / Colonoscopia',
  'Acompanhamento de Pré-operatório',
  'Transplante / Acompanhamento de Enxerto',
  'Avaliação com Junta Médica',
];

export const MEDICAL_LOCATIONS: MedicalLocation[] = [
  // --- GOIÂNIA (Públicos / Grandes Hospitais) ---
  {
    name: 'Hospital Araújo Jorge (ACCG - Tratamento de Câncer)',
    city: 'Goiânia',
    type: 'Filantrópico / SUS',
    category: 'Oncologia',
  },
  {
    name: 'HGG - Hospital Geral de Goiânia Dr. Alberto Rassi',
    city: 'Goiânia',
    type: 'Público / SUS',
    category: 'Geral / Alta Complexidade',
  },
  {
    name: 'HC-UFG - Hospital das Clínicas da UFG / EBSERH',
    city: 'Goiânia',
    type: 'Público / SUS',
    category: 'Universitário / Geral',
  },
  {
    name: 'CRER - Centro Estadual de Reabilitação e Readaptação Dr. Henrique Santillo',
    city: 'Goiânia',
    type: 'Público / SUS',
    category: 'Reabilitação / Ortopedia',
  },
  {
    name: 'HECAD - Hospital Estadual da Criança e do Adolescente',
    city: 'Goiânia',
    type: 'Público / SUS',
    category: 'Pediatria / Maternidade',
  },
  {
    name: 'HDT - Hospital Estadual de Doenças Tropicais Dr. Anuar Auad',
    city: 'Goiânia',
    type: 'Público / SUS',
    category: 'Infectologia / Especialidades',
  },
  {
    name: 'HEGO - Hospital Estadual de Goiânia Dr. Geraldo Ferreira Goulart (antigo HGG/HGG Parque)',
    city: 'Goiânia',
    type: 'Público / SUS',
    category: 'Geral',
  },
  {
    name: 'HEMET - Hospital Estadual da Mulher Dr. Jurandir do Nascimento',
    city: 'Goiânia',
    type: 'Público / SUS',
    category: 'Maternidade / Saúde da Mulher',
  },
  {
    name: 'Santa Casa de Misericórdia de Goiânia',
    city: 'Goiânia',
    type: 'Filantrópico / SUS',
    category: 'Geral / Especialidades',
  },
  {
    name: 'CEROF - Centro de Referência em Oftalmologia da UFG',
    city: 'Goiânia',
    type: 'Público / SUS',
    category: 'Oftalmologia',
  },
  {
    name: 'HEMOGO - Hemocentro de Goiás',
    city: 'Goiânia',
    type: 'Público / SUS',
    category: 'Hematologia / Hemoterapia',
  },
  {
    name: 'Policlínica Estadual da Região Metropolitana (Goiânia)',
    city: 'Goiânia',
    type: 'Público / SUS',
    category: 'Consultas e Exames Especializados',
  },
  {
    name: 'CEBRAV - Centro Goiano de Radioterapia e Oncologia',
    city: 'Goiânia',
    type: 'Especializado',
    category: 'Radioterapia / Oncologia',
  },
  {
    name: 'INGOH - Instituto Goiano de Oncologia e Hematologia',
    city: 'Goiânia',
    type: 'Especializado',
    category: 'Oncologia / Quimioterapia',
  },
  {
    name: 'IPASGO - Centro Médico de Especialidades',
    city: 'Goiânia',
    type: 'Público / SUS',
    category: 'Ambulatorial / Especialidades',
  },
  {
    name: 'HUGO - Hospital de Urgências de Goiás Dr. Valdemiro Cruz',
    city: 'Goiânia',
    type: 'Público / SUS',
    category: 'Trauma / Urgência',
  },
  {
    name: 'HUGOL - Hospital Estadual de Urgências Governador Otávio Lage',
    city: 'Goiânia',
    type: 'Público / SUS',
    category: 'Queimados / Trauma / Cirurgias',
  },

  // --- GOIÂNIA (Hospitais Privados / Convênios) ---
  {
    name: 'Hospital Santa Helena',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Geral / Maternidade',
  },
  {
    name: 'Hospital São Salvador',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Geral / Cardiologia',
  },
  {
    name: 'Hospital do Coração de Goiás (Hospital Anis Rassi)',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Cardiologia',
  },
  {
    name: 'Hospital Neurológico de Goiânia',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Neurologia / Neurocirurgia',
  },
  {
    name: 'Hospital Samaritano de Goiânia',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Geral / Cirurgias',
  },
  {
    name: 'Hospital Renaissance',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Cirúrgico / Especialidades',
  },
  {
    name: 'Hospital Evangélico Goiano de Goiânia',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Geral',
  },
  {
    name: 'Hospital Oftalmológico de Goiânia (HOG)',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Oftalmologia',
  },
  {
    name: 'Hospital de Olhos de Goiás (CBCO)',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Oftalmologia',
  },
  {
    name: 'Hospital Ortopédico de Goiânia (HOG)',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Ortopedia e Traumatologia',
  },
  {
    name: 'Hospital Santa Rosa',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Geral',
  },
  {
    name: 'Hospital Premium',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Geral / Cirurgia Plástica',
  },
  {
    name: 'Hospital Santa Bárbara',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Geral',
  },
  {
    name: 'Hospital Amparo',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Geral / Maternidade',
  },
  {
    name: 'Hospital Lúcio Rebelo',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Geral',
  },
  {
    name: 'Laboratório Padrão (Unidade Central Goiânia)',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Exames e Diagnósticos',
  },
  {
    name: 'Laboratório Sabin (Goiânia)',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Exames Laboratoriais',
  },
  {
    name: 'Laboratório Citocenter',
    city: 'Goiânia',
    type: 'Privado / Convênios',
    category: 'Patologia e Exames',
  },

  // --- APARECIDA DE GOIÂNIA ---
  {
    name: 'HMAP - Hospital Municipal de Aparecida de Goiânia Iris Rezende Machado',
    city: 'Aparecida de Goiânia',
    type: 'Público / SUS',
    category: 'Geral / UTI / Cirurgias',
  },
  {
    name: 'HEAPA - Hospital Estadual de Aparecida de Goiânia Caio Louzada',
    city: 'Aparecida de Goiânia',
    type: 'Público / SUS',
    category: 'Geral / Cirurgias e Urgência',
  },
  {
    name: 'Policlínica Estadual de Aparecida de Goiânia',
    city: 'Aparecida de Goiânia',
    type: 'Público / SUS',
    category: 'Especialidades Médicas e Exames',
  },
  {
    name: 'Maternidade Municipal Marlene Teixeira',
    city: 'Aparecida de Goiânia',
    type: 'Público / SUS',
    category: 'Maternidade e Partos',
  },
  {
    name: 'Hospital Santa Mônica (Aparecida de Goiânia)',
    city: 'Aparecida de Goiânia',
    type: 'Privado / Convênios',
    category: 'Geral / Psiquiatria / Especialidades',
  },
  {
    name: 'Hospital Garavelo',
    city: 'Aparecida de Goiânia',
    type: 'Privado / Convênios',
    category: 'Geral / Pronto Atendimento',
  },
  {
    name: 'Hospital São Bernardo (Aparecida de Goiânia)',
    city: 'Aparecida de Goiânia',
    type: 'Privado / Convênios',
    category: 'Geral',
  },
  {
    name: 'Centro Clínico de Aparecida de Goiânia',
    city: 'Aparecida de Goiânia',
    type: 'Privado / Convênios',
    category: 'Consultas e Exames',
  },
  {
    name: 'UPA Brasicon (Aparecida de Goiânia)',
    city: 'Aparecida de Goiânia',
    type: 'Público / SUS',
    category: 'Pronto Atendimento 24h',
  },
  {
    name: 'UPA Buriti Sereno (Aparecida de Goiânia)',
    city: 'Aparecida de Goiânia',
    type: 'Público / SUS',
    category: 'Pronto Atendimento 24h',
  },
  {
    name: 'UPA Flamboyant (Aparecida de Goiânia)',
    city: 'Aparecida de Goiânia',
    type: 'Público / SUS',
    category: 'Pronto Atendimento 24h',
  },
  {
    name: 'Ambulatório Multiprofissional de Aparecida (AMAG)',
    city: 'Aparecida de Goiânia',
    type: 'Público / SUS',
    category: 'Especialidades',
  },
];
