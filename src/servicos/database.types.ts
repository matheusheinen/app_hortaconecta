export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      atividade_habilidades: {
        Row: {
          atividade_id: number
          habilidade_id: number
        }
        Insert: {
          atividade_id: number
          habilidade_id: number
        }
        Update: {
          atividade_id?: number
          habilidade_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "atividade_habilidades_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividade_habilidades_habilidade_id_fkey"
            columns: ["habilidade_id"]
            isOneToOne: false
            referencedRelation: "habilidades"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          arquivada_em: string | null
          atualizado_em: string
          autor_id: string
          carga_horaria: number
          criado_em: string
          data_hora_prevista: string
          descricao: string
          id: number
          status: Database["public"]["Enums"]["status_atividade"]
          tipo: Database["public"]["Enums"]["tipo_atividade"]
          titulo: string
          vagas_ocupadas: number
          vagas_totais: number
        }
        Insert: {
          arquivada_em?: string | null
          atualizado_em?: string
          autor_id: string
          carga_horaria: number
          criado_em?: string
          data_hora_prevista: string
          descricao: string
          id?: never
          status?: Database["public"]["Enums"]["status_atividade"]
          tipo: Database["public"]["Enums"]["tipo_atividade"]
          titulo: string
          vagas_ocupadas?: number
          vagas_totais: number
        }
        Update: {
          arquivada_em?: string | null
          atualizado_em?: string
          autor_id?: string
          carga_horaria?: number
          criado_em?: string
          data_hora_prevista?: string
          descricao?: string
          id?: never
          status?: Database["public"]["Enums"]["status_atividade"]
          tipo?: Database["public"]["Enums"]["tipo_atividade"]
          titulo?: string
          vagas_ocupadas?: number
          vagas_totais?: number
        }
        Relationships: [
          {
            foreignKeyName: "atividades_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      certificados: {
        Row: {
          atividade: string
          carga_horaria_prevista: number
          data_atividade: string
          emitido_em: string
          id: string
          instituicao: string
          nome_voluntario: string
          participacao_id: number
          usuario_id: string
        }
        Insert: {
          atividade: string
          carga_horaria_prevista: number
          data_atividade: string
          emitido_em?: string
          id?: string
          instituicao: string
          nome_voluntario: string
          participacao_id: number
          usuario_id: string
        }
        Update: {
          atividade?: string
          carga_horaria_prevista?: number
          data_atividade?: string
          emitido_em?: string
          id?: string
          instituicao?: string
          nome_voluntario?: string
          participacao_id?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificados_participacao_id_fkey"
            columns: ["participacao_id"]
            isOneToOne: true
            referencedRelation: "inscricoes_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracao_instituicao: {
        Row: {
          atualizado_em: string
          chamada: string | null
          cidade: string
          cor_acento: string | null
          cor_primaria: string | null
          email_contato: string | null
          endereco: string | null
          id: number
          nome_completo: string
          nome_curto: string
          site: string | null
          sobre: string | null
          telefone: string | null
          uf: string
          url_logo: string | null
          whatsapp: string | null
        }
        Insert: {
          atualizado_em?: string
          chamada?: string | null
          cidade: string
          cor_acento?: string | null
          cor_primaria?: string | null
          email_contato?: string | null
          endereco?: string | null
          id?: number
          nome_completo: string
          nome_curto: string
          site?: string | null
          sobre?: string | null
          telefone?: string | null
          uf: string
          url_logo?: string | null
          whatsapp?: string | null
        }
        Update: {
          atualizado_em?: string
          chamada?: string | null
          cidade?: string
          cor_acento?: string | null
          cor_primaria?: string | null
          email_contato?: string | null
          endereco?: string | null
          id?: number
          nome_completo?: string
          nome_curto?: string
          site?: string | null
          sobre?: string | null
          telefone?: string | null
          uf?: string
          url_logo?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      contribuicoes: {
        Row: {
          data_envio: string
          id: number
          meta_id: number
          observacao_validacao: string | null
          quantidade_oferecida: number
          status_validacao: Database["public"]["Enums"]["status_validacao"]
          url_comprovante: string | null
          usuario_id: string
          validado_em: string | null
          validado_por: string | null
        }
        Insert: {
          data_envio?: string
          id?: never
          meta_id: number
          observacao_validacao?: string | null
          quantidade_oferecida: number
          status_validacao?: Database["public"]["Enums"]["status_validacao"]
          url_comprovante?: string | null
          usuario_id: string
          validado_em?: string | null
          validado_por?: string | null
        }
        Update: {
          data_envio?: string
          id?: never
          meta_id?: number
          observacao_validacao?: string | null
          quantidade_oferecida?: number
          status_validacao?: Database["public"]["Enums"]["status_validacao"]
          url_comprovante?: string | null
          usuario_id?: string
          validado_em?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contribuicoes_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas_demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribuicoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribuicoes_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_transparencia: {
        Row: {
          atividade_id: number | null
          atualizado_em: string
          autor_id: string
          data_publicacao: string
          descricao_curta: string | null
          id: number
          imagem_caminho: string | null
          revisao: number
          status: string
          texto: string | null
          titulo: string
          url_imagem: string | null
        }
        Insert: {
          atividade_id?: number | null
          atualizado_em?: string
          autor_id: string
          data_publicacao?: string
          descricao_curta?: string | null
          id?: never
          imagem_caminho?: string | null
          revisao?: number
          status?: string
          texto?: string | null
          titulo: string
          url_imagem?: string | null
        }
        Update: {
          atividade_id?: number | null
          atualizado_em?: string
          autor_id?: string
          data_publicacao?: string
          descricao_curta?: string | null
          id?: never
          imagem_caminho?: string | null
          revisao?: number
          status?: string
          texto?: string | null
          titulo?: string
          url_imagem?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diario_transparencia_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_transparencia_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      habilidades: {
        Row: {
          categoria: string | null
          id: number
          nome_habilidade: string
        }
        Insert: {
          categoria?: string | null
          id?: never
          nome_habilidade: string
        }
        Update: {
          categoria?: string | null
          id?: never
          nome_habilidade?: string
        }
        Relationships: []
      }
      inscricoes_atividades: {
        Row: {
          atividade_id: number
          carga_horaria_registrada: number | null
          checkin_em: string | null
          data_inscricao: string
          decidido_em: string | null
          decidido_por: string | null
          id: number
          motivo_decisao: string | null
          presenca_confirmada: boolean
          status_inscricao: Database["public"]["Enums"]["status_inscricao"]
          usuario_id: string
        }
        Insert: {
          atividade_id: number
          carga_horaria_registrada?: number | null
          checkin_em?: string | null
          data_inscricao?: string
          decidido_em?: string | null
          decidido_por?: string | null
          id?: never
          motivo_decisao?: string | null
          presenca_confirmada?: boolean
          status_inscricao?: Database["public"]["Enums"]["status_inscricao"]
          usuario_id: string
        }
        Update: {
          atividade_id?: number
          carga_horaria_registrada?: number | null
          checkin_em?: string | null
          data_inscricao?: string
          decidido_em?: string | null
          decidido_por?: string | null
          id?: never
          motivo_decisao?: string | null
          presenca_confirmada?: boolean
          status_inscricao?: Database["public"]["Enums"]["status_inscricao"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscricoes_atividades_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_atividades_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_atividades_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_demandas: {
        Row: {
          atualizado_em: string
          criado_em: string
          data_limite: string | null
          descricao: string
          id: number
          quantidade_arrecadada: number
          quantidade_meta: number
          status: Database["public"]["Enums"]["status_meta"]
          tipo: Database["public"]["Enums"]["tipo_meta"]
          titulo: string
          unidade_medida: string | null
          url_imagem_capa: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data_limite?: string | null
          descricao: string
          id?: never
          quantidade_arrecadada?: number
          quantidade_meta: number
          status?: Database["public"]["Enums"]["status_meta"]
          tipo: Database["public"]["Enums"]["tipo_meta"]
          titulo: string
          unidade_medida?: string | null
          url_imagem_capa?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data_limite?: string | null
          descricao?: string
          id?: never
          quantidade_arrecadada?: number
          quantidade_meta?: number
          status?: Database["public"]["Enums"]["status_meta"]
          tipo?: Database["public"]["Enums"]["tipo_meta"]
          titulo?: string
          unidade_medida?: string | null
          url_imagem_capa?: string | null
        }
        Relationships: []
      }
      ongs: {
        Row: {
          atualizado_em: string
          chave_pix: string | null
          cnpj: string | null
          data_criacao: string | null
          nome_beneficiario_pix: string | null
          razao_social: string | null
          responsavel_legal: string | null
          usuario_id: string
          whatsapp: string | null
        }
        Insert: {
          atualizado_em?: string
          chave_pix?: string | null
          cnpj?: string | null
          data_criacao?: string | null
          nome_beneficiario_pix?: string | null
          razao_social?: string | null
          responsavel_legal?: string | null
          usuario_id: string
          whatsapp?: string | null
        }
        Update: {
          atualizado_em?: string
          chave_pix?: string | null
          cnpj?: string | null
          data_criacao?: string | null
          nome_beneficiario_pix?: string | null
          razao_social?: string | null
          responsavel_legal?: string | null
          usuario_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ongs_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas_oficinas: {
        Row: {
          atualizado_em: string
          autor_id: string
          cancelado_em: string | null
          conhecimentos: string | null
          criado_em: string
          decidido_em: string | null
          decidido_por: string | null
          descricao: string
          duracao_minutos: number
          id: number
          objetivo: string
          observacao_decisao: string | null
          observacoes: string | null
          revisao: number
          status: string
          tema: string
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          autor_id: string
          cancelado_em?: string | null
          conhecimentos?: string | null
          criado_em?: string
          decidido_em?: string | null
          decidido_por?: string | null
          descricao: string
          duracao_minutos: number
          id?: never
          objetivo: string
          observacao_decisao?: string | null
          observacoes?: string | null
          revisao?: number
          status?: string
          tema: string
          titulo: string
        }
        Update: {
          atualizado_em?: string
          autor_id?: string
          cancelado_em?: string | null
          conhecimentos?: string | null
          criado_em?: string
          decidido_em?: string | null
          decidido_por?: string | null
          descricao?: string
          duracao_minutos?: number
          id?: never
          objetivo?: string
          observacao_decisao?: string | null
          observacoes?: string | null
          revisao?: number
          status?: string
          tema?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "propostas_oficinas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_oficinas_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_habilidades: {
        Row: {
          habilidade_id: number
          usuario_id: string
        }
        Insert: {
          habilidade_id: number
          usuario_id: string
        }
        Update: {
          habilidade_id?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_habilidades_habilidade_id_fkey"
            columns: ["habilidade_id"]
            isOneToOne: false
            referencedRelation: "habilidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_habilidades_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          atualizado_em: string
          criado_em: string
          descricao: string | null
          exclusao_solicitada_em: string | null
          foto_perfil: string | null
          id: string
          nome: string
          perfil_instagram: string | null
          telefone: string | null
          tipo_perfil: Database["public"]["Enums"]["tipo_perfil"]
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          exclusao_solicitada_em?: string | null
          foto_perfil?: string | null
          id: string
          nome: string
          perfil_instagram?: string | null
          telefone?: string | null
          tipo_perfil?: Database["public"]["Enums"]["tipo_perfil"]
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          exclusao_solicitada_em?: string | null
          foto_perfil?: string | null
          id?: string
          nome?: string
          perfil_instagram?: string | null
          telefone?: string | null
          tipo_perfil?: Database["public"]["Enums"]["tipo_perfil"]
        }
        Relationships: []
      }
      voluntarios: {
        Row: {
          atualizado_em: string
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string | null
          data_nascimento: string | null
          disponibilidade_horarios: Json
          logradouro: string | null
          numero: string | null
          profissao: string | null
          uf: string | null
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          data_nascimento?: string | null
          disponibilidade_horarios?: Json
          logradouro?: string | null
          numero?: string | null
          profissao?: string | null
          uf?: string | null
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          data_nascimento?: string | null
          disponibilidade_horarios?: Json
          logradouro?: string | null
          numero?: string | null
          profissao?: string | null
          uf?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voluntarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      certificados_detalhe: { Args: { p_id: string }; Returns: Json }
      certificados_emitir: { Args: { p_participacao: number }; Returns: string }
      certificados_listar: { Args: never; Returns: Json }
      diario_caminho: { Args: { p_ext: string }; Returns: string }
      diario_detalhe: { Args: { p_id: number }; Returns: Json }
      diario_gestao: { Args: never; Returns: boolean }
      diario_imagem_livre: { Args: { p_caminho: string }; Returns: boolean }
      diario_imagem_visivel: { Args: { p_caminho: string }; Returns: boolean }
      diario_listar: { Args: never; Returns: Json }
      diario_salvar: {
        Args: {
          p_id: number
          p_imagem: string
          p_status: string
          p_texto: string
          p_titulo: string
        }
        Returns: number
      }
      diario_salvar_revisao: {
        Args: {
          p_id: number
          p_imagem: string
          p_revisao: number
          p_status: string
          p_texto: string
          p_titulo: string
        }
        Returns: number
      }
      diario_status: {
        Args: { p_id: number; p_status: string }
        Returns: undefined
      }
      diario_status_revisao: {
        Args: { p_id: number; p_revisao: number; p_status: string }
        Returns: undefined
      }
      e_convidado: { Args: never; Returns: boolean }
      e_ong: { Args: { uid?: string }; Returns: boolean }
      gestao_salvar_perfil: { Args: { p_dados: Json }; Returns: boolean }
      gestor_alternar_modo: { Args: { p_gestor: boolean }; Returns: string }
      gestor_pode_alternar_modo: { Args: never; Returns: boolean }
      materiais_contribuir: {
        Args: { p_quantidade: number; p_solicitacao: number }
        Returns: number
      }
      materiais_decidir: {
        Args: { p_contribuicao: number; p_status: string }
        Returns: undefined
      }
      materiais_detalhe: { Args: { p_solicitacao: number }; Returns: Json }
      materiais_listar: { Args: never; Returns: Json }
      materiais_minhas: { Args: never; Returns: Json }
      materiais_salvar: {
        Args: {
          p_descricao: string
          p_id: number
          p_nome: string
          p_quantidade: number
        }
        Returns: number
      }
      materiais_status: {
        Args: { p_solicitacao: number; p_status: string }
        Returns: undefined
      }
      oficinas_cancelar: {
        Args: { p_id: number; p_revisao: number }
        Returns: undefined
      }
      oficinas_decidir: {
        Args: {
          p_id: number
          p_observacao?: string
          p_revisao: number
          p_status: string
        }
        Returns: undefined
      }
      oficinas_detalhe: { Args: { p_id: number }; Returns: Json }
      oficinas_listar: { Args: never; Returns: Json }
      oficinas_salvar: {
        Args: {
          p_conhecimentos?: string
          p_descricao: string
          p_duracao: number
          p_id: number
          p_objetivo: string
          p_observacoes?: string
          p_revisao: number
          p_tema: string
          p_titulo: string
        }
        Returns: number
      }
      perfil_completo: { Args: { uid?: string }; Returns: boolean }
      perfil_foto_caminho: { Args: never; Returns: string }
      perfil_foto_livre: { Args: { p_caminho: string }; Returns: boolean }
      perfil_foto_propria: { Args: { p_caminho: string }; Returns: boolean }
      perfil_foto_salvar: {
        Args: { p_anterior: string; p_caminho: string; p_usuario_id: string }
        Returns: boolean
      }
      solicitar_exclusao_conta: { Args: never; Returns: undefined }
      voluntariado_arquivar_atividade: {
        Args: { p_arquivar: boolean; p_atividade: number }
        Returns: undefined
      }
      voluntariado_cancelar: {
        Args: { p_inscricao: number }
        Returns: undefined
      }
      voluntariado_candidatar: {
        Args: { p_atividade: number }
        Returns: number
      }
      voluntariado_candidatos: { Args: { p_atividade: number }; Returns: Json }
      voluntariado_checkin: {
        Args: { p_atividade: number; p_token: string }
        Returns: undefined
      }
      voluntariado_decidir: {
        Args: { p_decisao: string; p_inscricao: number; p_motivo?: string }
        Returns: undefined
      }
      voluntariado_detalhe: { Args: { p_atividade: number }; Returns: Json }
      voluntariado_elegibilidade: { Args: never; Returns: boolean }
      voluntariado_gerar_checkin: {
        Args: { p_atividade: number }
        Returns: Json
      }
      voluntariado_minhas_inscricoes: { Args: never; Returns: Json }
      voluntariado_salvar_perfil: {
        Args: { p_dados: Json; p_habilidades: number[] }
        Returns: boolean
      }
      voluntariado_status_atividade: {
        Args: { p_atividade: number; p_status: string }
        Returns: undefined
      }
    }
    Enums: {
      status_atividade:
        | "PENDENTE_APROVACAO"
        | "ABERTA"
        | "ENCERRADA"
        | "REALIZADA"
        | "CANCELADA"
        | "RECUSADA"
      status_inscricao: "PENDENTE" | "APROVADA" | "RECUSADA" | "CANCELADA"
      status_meta: "ABERTA" | "ENCERRADA" | "CANCELADA"
      status_validacao: "PENDENTE" | "APROVADA" | "RECUSADA"
      tipo_atividade: "TAREFA_ONG" | "OFICINA_AUTORAL"
      tipo_meta: "FINANCEIRA" | "MATERIAL"
      tipo_perfil: "VOLUNTARIO" | "ONG"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      status_atividade: [
        "PENDENTE_APROVACAO",
        "ABERTA",
        "ENCERRADA",
        "REALIZADA",
        "CANCELADA",
        "RECUSADA",
      ],
      status_inscricao: ["PENDENTE", "APROVADA", "RECUSADA", "CANCELADA"],
      status_meta: ["ABERTA", "ENCERRADA", "CANCELADA"],
      status_validacao: ["PENDENTE", "APROVADA", "RECUSADA"],
      tipo_atividade: ["TAREFA_ONG", "OFICINA_AUTORAL"],
      tipo_meta: ["FINANCEIRA", "MATERIAL"],
      tipo_perfil: ["VOLUNTARIO", "ONG"],
    },
  },
} as const
