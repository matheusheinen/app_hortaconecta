/**
 * Gerado a partir do schema remoto (mcp__supabase__generate_typescript_types).
 * Não editar à mão — depois de uma migration, gerar de novo.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      atividades: {
        Row: {
          atualizado_em: string;
          autor_id: string;
          carga_horaria: number;
          criado_em: string;
          data_hora_prevista: string;
          descricao: string;
          id: number;
          status: Database['public']['Enums']['status_atividade'];
          tipo: Database['public']['Enums']['tipo_atividade'];
          titulo: string;
          vagas_totais: number;
        };
        Insert: {
          atualizado_em?: string;
          autor_id: string;
          carga_horaria: number;
          criado_em?: string;
          data_hora_prevista: string;
          descricao: string;
          id?: never;
          status?: Database['public']['Enums']['status_atividade'];
          tipo: Database['public']['Enums']['tipo_atividade'];
          titulo: string;
          vagas_totais: number;
        };
        Update: {
          atualizado_em?: string;
          autor_id?: string;
          carga_horaria?: number;
          criado_em?: string;
          data_hora_prevista?: string;
          descricao?: string;
          id?: never;
          status?: Database['public']['Enums']['status_atividade'];
          tipo?: Database['public']['Enums']['tipo_atividade'];
          titulo?: string;
          vagas_totais?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'atividades_autor_id_fkey';
            columns: ['autor_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      configuracao_instituicao: {
        Row: {
          atualizado_em: string;
          chamada: string | null;
          cidade: string;
          cor_acento: string | null;
          cor_primaria: string | null;
          email_contato: string | null;
          id: number;
          nome_completo: string;
          nome_curto: string;
          site: string | null;
          sobre: string | null;
          telefone: string | null;
          uf: string;
          url_logo: string | null;
          whatsapp: string | null;
        };
        Insert: {
          atualizado_em?: string;
          chamada?: string | null;
          cidade: string;
          cor_acento?: string | null;
          cor_primaria?: string | null;
          email_contato?: string | null;
          id?: number;
          nome_completo: string;
          nome_curto: string;
          site?: string | null;
          sobre?: string | null;
          telefone?: string | null;
          uf: string;
          url_logo?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          atualizado_em?: string;
          chamada?: string | null;
          cidade?: string;
          cor_acento?: string | null;
          cor_primaria?: string | null;
          email_contato?: string | null;
          id?: number;
          nome_completo?: string;
          nome_curto?: string;
          site?: string | null;
          sobre?: string | null;
          telefone?: string | null;
          uf?: string;
          url_logo?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      contribuicoes: {
        Row: {
          data_envio: string;
          id: number;
          meta_id: number;
          observacao_validacao: string | null;
          quantidade_oferecida: number;
          status_validacao: Database['public']['Enums']['status_validacao'];
          url_comprovante: string;
          usuario_id: string;
          validado_em: string | null;
          validado_por: string | null;
        };
        Insert: {
          data_envio?: string;
          id?: never;
          meta_id: number;
          observacao_validacao?: string | null;
          quantidade_oferecida: number;
          status_validacao?: Database['public']['Enums']['status_validacao'];
          url_comprovante: string;
          usuario_id: string;
          validado_em?: string | null;
          validado_por?: string | null;
        };
        Update: {
          data_envio?: string;
          id?: never;
          meta_id?: number;
          observacao_validacao?: string | null;
          quantidade_oferecida?: number;
          status_validacao?: Database['public']['Enums']['status_validacao'];
          url_comprovante?: string;
          usuario_id?: string;
          validado_em?: string | null;
          validado_por?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'contribuicoes_meta_id_fkey';
            columns: ['meta_id'];
            isOneToOne: false;
            referencedRelation: 'metas_demandas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contribuicoes_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contribuicoes_validado_por_fkey';
            columns: ['validado_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      diario_transparencia: {
        Row: {
          atividade_id: number | null;
          autor_id: string;
          data_publicacao: string;
          descricao_curta: string | null;
          id: number;
          titulo: string;
          url_imagem: string | null;
        };
        Insert: {
          atividade_id?: number | null;
          autor_id: string;
          data_publicacao?: string;
          descricao_curta?: string | null;
          id?: never;
          titulo: string;
          url_imagem?: string | null;
        };
        Update: {
          atividade_id?: number | null;
          autor_id?: string;
          data_publicacao?: string;
          descricao_curta?: string | null;
          id?: never;
          titulo?: string;
          url_imagem?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'diario_transparencia_atividade_id_fkey';
            columns: ['atividade_id'];
            isOneToOne: false;
            referencedRelation: 'atividades';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'diario_transparencia_autor_id_fkey';
            columns: ['autor_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      habilidades: {
        Row: {
          categoria: string | null;
          id: number;
          nome_habilidade: string;
        };
        Insert: {
          categoria?: string | null;
          id?: never;
          nome_habilidade: string;
        };
        Update: {
          categoria?: string | null;
          id?: never;
          nome_habilidade?: string;
        };
        Relationships: [];
      };
      inscricoes_atividades: {
        Row: {
          atividade_id: number;
          data_inscricao: string;
          id: number;
          presenca_confirmada: boolean;
          status_inscricao: Database['public']['Enums']['status_inscricao'];
          usuario_id: string;
        };
        Insert: {
          atividade_id: number;
          data_inscricao?: string;
          id?: never;
          presenca_confirmada?: boolean;
          status_inscricao?: Database['public']['Enums']['status_inscricao'];
          usuario_id: string;
        };
        Update: {
          atividade_id?: number;
          data_inscricao?: string;
          id?: never;
          presenca_confirmada?: boolean;
          status_inscricao?: Database['public']['Enums']['status_inscricao'];
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inscricoes_atividades_atividade_id_fkey';
            columns: ['atividade_id'];
            isOneToOne: false;
            referencedRelation: 'atividades';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inscricoes_atividades_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      metas_demandas: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          data_limite: string | null;
          descricao: string;
          id: number;
          quantidade_arrecadada: number;
          quantidade_meta: number;
          status: Database['public']['Enums']['status_meta'];
          tipo: Database['public']['Enums']['tipo_meta'];
          titulo: string;
          unidade_medida: string | null;
          url_imagem_capa: string | null;
        };
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          data_limite?: string | null;
          descricao: string;
          id?: never;
          quantidade_arrecadada?: number;
          quantidade_meta: number;
          status?: Database['public']['Enums']['status_meta'];
          tipo: Database['public']['Enums']['tipo_meta'];
          titulo: string;
          unidade_medida?: string | null;
          url_imagem_capa?: string | null;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          data_limite?: string | null;
          descricao?: string;
          id?: never;
          quantidade_arrecadada?: number;
          quantidade_meta?: number;
          status?: Database['public']['Enums']['status_meta'];
          tipo?: Database['public']['Enums']['tipo_meta'];
          titulo?: string;
          unidade_medida?: string | null;
          url_imagem_capa?: string | null;
        };
        Relationships: [];
      };
      ongs: {
        Row: {
          atualizado_em: string;
          chave_pix: string | null;
          cnpj: string | null;
          data_criacao: string | null;
          nome_beneficiario_pix: string | null;
          razao_social: string | null;
          responsavel_legal: string | null;
          usuario_id: string;
          whatsapp: string | null;
        };
        Insert: {
          atualizado_em?: string;
          chave_pix?: string | null;
          cnpj?: string | null;
          data_criacao?: string | null;
          nome_beneficiario_pix?: string | null;
          razao_social?: string | null;
          responsavel_legal?: string | null;
          usuario_id: string;
          whatsapp?: string | null;
        };
        Update: {
          atualizado_em?: string;
          chave_pix?: string | null;
          cnpj?: string | null;
          data_criacao?: string | null;
          nome_beneficiario_pix?: string | null;
          razao_social?: string | null;
          responsavel_legal?: string | null;
          usuario_id?: string;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ongs_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: true;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      usuario_habilidades: {
        Row: {
          habilidade_id: number;
          usuario_id: string;
        };
        Insert: {
          habilidade_id: number;
          usuario_id: string;
        };
        Update: {
          habilidade_id?: number;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'usuario_habilidades_habilidade_id_fkey';
            columns: ['habilidade_id'];
            isOneToOne: false;
            referencedRelation: 'habilidades';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'usuario_habilidades_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      usuarios: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          descricao: string | null;
          endereco: string | null;
          exclusao_solicitada_em: string | null;
          foto_perfil: string | null;
          id: string;
          nome: string;
          perfil_instagram: string | null;
          telefone: string | null;
          tipo_perfil: Database['public']['Enums']['tipo_perfil'];
        };
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          descricao?: string | null;
          endereco?: string | null;
          exclusao_solicitada_em?: string | null;
          foto_perfil?: string | null;
          id: string;
          nome: string;
          perfil_instagram?: string | null;
          telefone?: string | null;
          tipo_perfil?: Database['public']['Enums']['tipo_perfil'];
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          descricao?: string | null;
          endereco?: string | null;
          exclusao_solicitada_em?: string | null;
          foto_perfil?: string | null;
          id?: string;
          nome?: string;
          perfil_instagram?: string | null;
          telefone?: string | null;
          tipo_perfil?: Database['public']['Enums']['tipo_perfil'];
        };
        Relationships: [];
      };
      voluntarios: {
        Row: {
          atualizado_em: string;
          cpf: string | null;
          data_nascimento: string | null;
          disponibilidade_horarios: Json;
          profissao: string | null;
          usuario_id: string;
        };
        Insert: {
          atualizado_em?: string;
          cpf?: string | null;
          data_nascimento?: string | null;
          disponibilidade_horarios?: Json;
          profissao?: string | null;
          usuario_id: string;
        };
        Update: {
          atualizado_em?: string;
          cpf?: string | null;
          data_nascimento?: string | null;
          disponibilidade_horarios?: Json;
          profissao?: string | null;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'voluntarios_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: true;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      e_ong: { Args: { uid?: string }; Returns: boolean };
      perfil_completo: { Args: { uid?: string }; Returns: boolean };
      solicitar_exclusao_conta: { Args: never; Returns: undefined };
    };
    Enums: {
      status_atividade:
        | 'PENDENTE_APROVACAO'
        | 'ABERTA'
        | 'ENCERRADA'
        | 'REALIZADA'
        | 'CANCELADA'
        | 'RECUSADA';
      status_inscricao: 'PENDENTE' | 'APROVADA' | 'RECUSADA' | 'CANCELADA';
      status_meta: 'ABERTA' | 'ENCERRADA' | 'CANCELADA';
      status_validacao: 'PENDENTE' | 'APROVADA' | 'RECUSADA';
      tipo_atividade: 'TAREFA_ONG' | 'OFICINA_AUTORAL';
      tipo_meta: 'FINANCEIRA' | 'MATERIAL';
      tipo_perfil: 'VOLUNTARIO' | 'ONG';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;
type DefaultSchema = DatabaseWithoutInternals['public'];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;
