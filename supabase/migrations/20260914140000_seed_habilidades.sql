--
-- Catálogo inicial de habilidades pro voluntário escolher no perfil.
-- Curadoria da gestão via painel fica pra depois; por ora, seed fixo.
--

INSERT INTO public.habilidades (nome_habilidade, categoria) VALUES
  ('Jardinagem e cultivo', 'Mão na terra'),
  ('Compostagem', 'Mão na terra'),
  ('Irrigação', 'Mão na terra'),
  ('Marcenaria', 'Ofícios manuais'),
  ('Costura e artesanato', 'Ofícios manuais'),
  ('Culinária', 'Ofícios manuais'),
  ('Fotografia', 'Comunicação'),
  ('Redes sociais', 'Comunicação'),
  ('Design gráfico', 'Comunicação'),
  ('Educação e oficinas', 'Educação'),
  ('Administração e financeiro', 'Administrativo'),
  ('Captação de recursos', 'Administrativo')
ON CONFLICT (nome_habilidade) DO NOTHING;
