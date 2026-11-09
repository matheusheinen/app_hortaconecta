export type Publicacao = {
  revisao: number;
  id: number;
  titulo: string;
  texto: string | null;
  descricao_curta: string | null;
  status: 'PUBLICADA' | 'OCULTA';
  imagem_caminho: string | null;
  /** B26: a imagem mostra crianças ou adolescentes. */
  imagem_com_menores: boolean;
  /** B26: a gestão declarou ter a autorização dos responsáveis. */
  autorizacao_responsaveis: boolean;
  data_publicacao: string;
  autor_id: string;
  atualizado_em: string;
};

/** Identidade mínima exibida na assinatura de uma publicação pública. */
export type AutorPublicacao = {
  id: string;
  nome: string;
  foto_perfil: string | null;
  foto_url: string | null;
};
