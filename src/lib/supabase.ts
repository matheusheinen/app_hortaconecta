import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { DatabaseCertificados } from './certificados.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chave = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !chave) {
  throw new Error(
    'Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_KEY. ' +
      'Copie .env.example para .env e preencha com os dados do painel.',
  );
}

export const supabase = createClient<DatabaseCertificados>(url, chave, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Não há redirect de URL em app nativo.
    detectSessionInUrl: false,
  },
});
