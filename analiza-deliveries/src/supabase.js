import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "⚠️ Faltan variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // No buscar tokens en la URL — reduce trabajo de init en PWA
    detectSessionInUrl: false,
    // Persistir sesión en localStorage (comportamiento normal)
    persistSession: true,
    // Refrescar JWT automáticamente — pero con NetworkOnly en el SW
    // las peticiones de refresh van directo a la red sin pasar por caché
    autoRefreshToken: true,
  },
});
