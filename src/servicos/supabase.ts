import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { DatabaseAplicativo } from './database.api.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chave = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !chave) {
  throw new Error(
    'Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_KEY. ' +
      'Copie .env.example para .env e preencha com os dados do painel.',
  );
}

export const supabase = createClient<DatabaseAplicativo>(url, chave, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Não há redirect de URL em app nativo.
    detectSessionInUrl: false,
  },
});

// Fora do navegador a renovação do token rodaria sem parar em segundo plano;
// a documentação do Supabase manda ligá-la só com o app em primeiro plano.
// No web o próprio cliente já acompanha a visibilidade da aba.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', estado => {
    if (estado === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
