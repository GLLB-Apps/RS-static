import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    // Guarantee a single React instance in the bundle/dev graph
    // (prevents "Invalid hook call" / duplicate-React issues).
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    server: {
      // `npm run dev` serverar bara frontend — /api finns inte, så kontaktformulär
      // och administratörsrättigheter går inte att prova lokalt. Kör PHP-API:t
      // separat (`php -S 127.0.0.1:8123 server/index.php`) och sätt API_PROXY i
      // .env.local dit, så går api-anropen dit utan CORS-konfiguration.
      //
      //   API_PROXY=http://127.0.0.1:8123
      proxy: env.API_PROXY
        ? { '/api': { target: env.API_PROXY, changeOrigin: true } }
        : undefined,
    },
  }
})
