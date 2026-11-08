-- Verificação somente leitura: quais reconciliações de supabase/reconciliacao/
-- já estão aplicadas no banco remoto. Não altera nada.
-- Rodar no SQL Editor do Supabase. Cada linha diz se os objetos que o arquivo
-- cria existem. "aplicada = false" indica arquivo pendente.
SELECT arquivo, aplicada FROM (VALUES
  (1, '20261005150000_contribuicoes_metas_pix.sql',
   EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
           AND table_name = 'configuracao_instituicao' AND column_name = 'chave_pix')),
  (2, '20261005170000_diario_excluir.sql',
   to_regprocedure('public.diario_excluir_revisao(bigint,integer)') IS NOT NULL),
  (3, '20261006120000_modo_gestor.sql',
   to_regprocedure('public.gestor_alternar_modo(boolean)') IS NOT NULL),
  (4, '20261006180000_convidado.sql',
   to_regprocedure('public.e_convidado()') IS NOT NULL),
  (5, '20261019120000_atividades_arquivar.sql',
   EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
           AND table_name = 'atividades' AND column_name = 'arquivada_em')),
  (6, '20261021120000_foto_perfil.sql',
   to_regprocedure('public.perfil_foto_caminho()') IS NOT NULL),
  (7, '20261023170000_comprovantes_storage.sql',
   EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'comprovantes')),
  (8, '20261023190000_comprovantes_formatos.sql',
   to_regprocedure('public.comprovante_caminho(text)') IS NOT NULL),
  (9, '20261023200000_arrecadacao_trigger.sql (B24)',
   EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_contribuicoes_arrecadacao'
           AND tgrelid = 'public.contribuicoes'::regclass AND NOT tgisinternal)),
  (10, '20261023210000_contribuicoes_conferencia.sql (B23)',
   EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_contribuicoes_conferencia'
           AND tgrelid = 'public.contribuicoes'::regclass AND NOT tgisinternal)),
  (11, '20261026120000_dispositivos_push.sql',
   to_regclass('voluntariado_privado.dispositivos_push') IS NOT NULL),
  (12, '20261026130000_notificacoes.sql',
   to_regclass('public.notificacoes') IS NOT NULL),
  (13, '20261026140000_notificacoes_cancelamento_pendentes.sql',
   EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('voluntariado_privado.notificar_atividade_cancelada()')
           AND prosrc LIKE '%PENDENTE%')),
  (14, '20261101120000_notificacoes_entregues.sql (B29, PR #16)',
   to_regclass('voluntariado_privado.notificacoes_entregues') IS NOT NULL),
  (15, '20261108120000_diario_menores.sql (B26, PR #20)',
   to_regprocedure('public.diario_salvar_revisao(bigint,text,text,text,text,integer,boolean,boolean)') IS NOT NULL
   AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
               AND table_name = 'diario_transparencia' AND column_name = 'imagem_com_menores')),
  (16, '20261108130000_diario_paginacao.sql (RF0013, PR #24)',
   to_regprocedure('public.diario_listar_pagina(timestamptz,bigint,integer)') IS NOT NULL)
) AS v(ordem, arquivo, aplicada)
ORDER BY ordem;
