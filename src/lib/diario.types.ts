export type Publicacao = {
 revisao: number; id: number; titulo: string; texto: string | null; descricao_curta: string | null;
 status: 'PUBLICADA' | 'OCULTA'; imagem_caminho: string | null;
 data_publicacao: string; autor_id: string; atualizado_em: string;
};
