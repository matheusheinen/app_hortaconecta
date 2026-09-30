/** Cores compartilhadas entre o acesso, a comunidade e os formulários. */
export const cores = {
  folha: '#2D6B51',
  folhaClara: '#E8F3EC',
  terra: '#6B4F3A',
  beterraba: '#A33B52',
  tinta: '#143E37',
  tintaSuave: '#60796E',
  linha: '#DCE6DF',
  fundo: '#FFFFFF',
  superficie: '#F7F5EF',
  creme: '#F7F5EF',
  mint: '#EFF7F2',
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
  secao: { fontSize: 18, fontWeight: '700' as const, color: cores.tinta },
  corpo: { fontSize: 15, color: cores.tinta, lineHeight: 22 },
  apoio: { fontSize: 13, color: cores.tintaSuave, lineHeight: 18 },
};
