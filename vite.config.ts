import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server:{watch:{ignored:['**/releases/**','**/docs/**','**/backend/**','**/*.zip']},proxy:{'/connect':{target:'http://127.0.0.1:8788',changeOrigin:false},'/v2-api':{target:'https://n8n.eightbitsolutions.com',changeOrigin:true,rewrite:()=>'/webhook/eightbit-outreach/v2/api'},'/v2-import':{target:'https://n8n.eightbitsolutions.com',changeOrigin:true,rewrite:()=>'/webhook/eightbit-outreach/v2/import'}}},
})
