/**
 * Paleta tirada do próprio assunto: folha, terra e beterraba.
 * A beterraba aparece só em ações destrutivas e avisos — é o único
 * ponto de cor forte da interface, por isso chama atenção sozinho.
 */
export const cores = {
  folha: '#1F4A34',
  folhaClara: '#E4EEE5',
  terra: '#6B4F3A',
  beterraba: '#A33B52',
  tinta: '#17211C',
  tintaSuave: '#5A6660',
  linha: '#D8E0D9',
  fundo: '#FFFFFF',
  superficie: '#F5F8F4',
};

export const espaco = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const tipo = {
  titulo: { fontSize: 26, fontWeight: '700' as const, color: cores.tinta, letterSpacing: -0.4 },
  secao: { fontSize: 18, fontWeight: '600' as const, color: cores.tinta },
  corpo: { fontSize: 15, color: cores.tinta, lineHeight: 22 },
  apoio: { fontSize: 13, color: cores.tintaSuave, lineHeight: 18 },
};
