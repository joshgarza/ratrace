import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    proxy: {
      // Proxy /api requests to your Node.js Express server
      '/api': {
        target: 'http://localhost:3000', // Your API server
        changeOrigin: true,
        // secure: false, // If your API server is not HTTPS
        // rewrite: (path) => path.replace(/^\/api/, '') // If your API server doesn't expect /api prefix
      }
    }
  }
});
