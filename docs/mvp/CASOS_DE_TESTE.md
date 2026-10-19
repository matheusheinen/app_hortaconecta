# Casos de teste do MVP

Registro de 3 casos por funcionalidade, para execução manual em aparelho Android (Expo Go) com dados fictícios. A coluna **Auto** indica se há teste automatizado em `tests/` cobrindo a regra (não a tela). Resultado em branco = ainda não executado.

Legenda: **V** = conta de voluntário, **G** = conta da gestão (ONG).

## 1. Autenticação e perfil progressivo (RF0001)

| ID | Caso | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- |
| AUT-01 | Cadastrar com nome, e-mail e senha | Entra na navegação básica sem pedir CPF; e-mail de confirmação enviado | Parcial (`auth-perfil`) | |
| AUT-02 | Login com senha errada e sem rede | Mensagem clara em ambos; o loading sempre termina | Sim (`auth-perfil`) | |
| AUT-03 | V com cadastro incompleto tenta se candidatar | Bloqueia e orienta a completar CPF, nascimento, profissão, disponibilidade e habilidades | Parcial (`regras-voluntariado`) | |

## 2. Perfil do voluntário e LGPD (B02)

| ID | Caso | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- |
| PER-01 | Salvar endereço com CEP/UF válidos | Grava os sete campos normalizados | Sim (`perfis-app-remoto`) | |
| PER-02 | CEP ou UF inválido; CPF já usado | Barra a gravação com mensagem; CPF duplicado informa "já cadastrado" | Sim / Parcial | |
| PER-03 | Solicitar exclusão de dados | Grava `exclusao_solicitada_em`, exibe a data e não apaga a conta | Não | |

## 3. Atividades e tarefas (RF0002, B03)

| ID | Caso | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- |
| ATV-01 | G publica tarefa com data e hora em campos separados | Aparece na lista com a data correta | Sim (`data-hora-atividade`) | |
| ATV-02 | G informa hora `25:99` ou data `31/02` | Rejeita; ano bissexto aceito | Sim (`regras-voluntariado`) | |
| ATV-03 | V não consegue editar nem publicar tarefa | Botões de gestão ausentes; escrita direta negada pelo RLS | Parcial (`banco-voluntariado`) | |

## 4. Candidatura, triagem e check-in (B04, B07)

| ID | Caso | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- |
| CAN-01 | V cadastrado se candidata; tenta de novo | Primeira cria; segunda avisa "já existe" | Sim (`banco-voluntariado`) | |
| CAN-02 | G aprova e recusa candidatos; atividade lota | Status muda; ao lotar, nova aprovação é barrada | Sim (`banco-voluntariado`) | |
| CAN-03 | V aprovado lê o QR de check-in da atividade errada | Rejeita (versão, atividade e token são validados) | Sim (`regras-voluntariado`) | |

## 5. WhatsApp (RF0003, B10)

| ID | Caso | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- |
| WPP-01 | V aprovado toca no botão de WhatsApp | Abre `wa.me` com o número da instituição e mensagem pronta | Não | |
| WPP-02 | V com candidatura pendente ou recusada | Botão não aparece | Não | |
| WPP-03 | Número ausente ou WhatsApp não instalado | Sem travar; mensagem de falha | Não | |

## 6. Materiais (Prioridade 2)

| ID | Caso | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- |
| MAT-01 | G cria solicitação; V vê só as abertas | Lista correta por perfil; sem erro de migrations | Sim (`materiais`) | |
| MAT-02 | V oferece quantidade `0`, `1.5` e acima do limite | Rejeita; só inteiros positivos | Sim (`regras-materiais`) | |
| MAT-03 | G confirma entrega | Quantidade recebida soma; ao completar, status `CONCLUIDA`; escrita direta bloqueada | Sim (`materiais`) | |

## 7. Diário de Transparência (RF0005, B05)

| ID | Caso | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- |
| DIA-01 | G publica com foto JPEG | Entra no feed com imagem | Parcial (`diario`, Storage simulado) | |
| DIA-02 | Foto acima de 5 MiB; texto fora do limite | Rejeita antes do upload | Sim (`regras-diario`) | |
| DIA-03 | Falha no upload | Não publica; sem falso sucesso | Sim (`diario`) | |

## 8. Oficinas (Prioridade 4, B07)

| ID | Caso | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- |
| OFI-01 | V cadastrado propõe oficina | Proposta privada; G a vê | Sim (`oficinas`) | |
| OFI-02 | Duração `0`, decimal ou texto acima do limite | Rejeita | Sim (`regras-oficinas`) | |
| OFI-03 | G aprova a proposta | Não cria atividade, inscrição, presença nem certificado | Sim (`oficinas`) | |

## 9. Certificados (Prioridade 5)

| ID | Caso | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- |
| CER-01 | Aprovado com check-in confirmado | Certificado emitido pelo banco | Sim (`certificados`) | |
| CER-02 | Aprovado sem check-in | Não emite | Sim (`certificados`) | |
| CER-03 | Abrir e compartilhar | Texto traz aviso de carga **prevista**; compartilha em texto, sem PDF | Sim (`texto-certificado`) | |

## 10. Início e indicadores

| ID | Caso | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- |
| INI-01 | V vê as próximas atividades abertas | Mostra as duas próximas com vagas reais | Sim (`resumo-inicio`) | |
| INI-02 | Falha de rede ao carregar | Erro com nova tentativa, sem indicadores zerados | Sim (`resumo-inicio`) | |
| INI-03 | Horas e contribuições | Horas por check-in; só entregas confirmadas contam | Sim (`resumo-inicio`) | |

## 11. Perfil da gestão e parametrização (B11, RNF0005)

| ID | Caso | Esperado | Auto | Resultado |
| --- | --- | --- | --- | --- |
| GES-01 | G salva perfil sem endereço pessoal | Grava atomicamente pela RPC | Sim (`perfis-app-remoto`) | |
| GES-02 | Falha ao carregar o complemento | Esconde Salvar; oferece tentar de novo | Sim (`auth-perfil`) | |
| GES-03 | Alterar nome, cor ou WhatsApp em `configuracao_instituicao` | App reflete sem mudar código | Não | |

## Lacunas encontradas

1. **Compressão de imagens (B06, RNF0003) não existe no código.** `expo-image-manipulator` não aparece em `src/` nem em `package.json`. O Diário só valida JPEG e o limite de 5 MiB. Falta implementar, depois testar: foto grande sai menor, e a original não é enviada.
2. **Notificações push (B12) não implementadas.** `expo-notifications` não está no projeto. Prioridade baixa no backlog.
3. **Metas e PIX são código órfão.** `TelaMetas`, `TelaFormMeta` e `PilhaMetas` não estão ligadas à navegação (`AbasPrincipais`). B08 e B09 foram substituídos por materiais. Decidir com a equipe se removem os arquivos ou reativam.
4. **Sem testes automatizados de tela.** As 19 suítes cobrem regras, banco em PGLite e alguns handlers. Fluxos como WhatsApp, LGPD (PER-03), parametrização (GES-03) e navegação por perfil só têm teste manual.
5. **Homologação em Android real pendente.** Também faltam Auth e Storage pelos serviços reais e concorrência entre conexões (já registrado em `docs/INDICE.md`).
6. **Os testes de banco rodam em fixture, não no remoto.** Hoje o remoto estava sem `solicitacoes_materiais` e `contribuicoes_materiais`, e nenhum teste acusou. Um teste de fumaça só de leitura, comparando tabelas e funções esperadas com as do remoto, evitaria repetir isso.
7. **Casos negativos de RLS entre perfis.** Falta um caso por tabela de V lendo dados de outro V (candidaturas, contribuições, certificados).
