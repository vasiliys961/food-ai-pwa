cat > vite.config.js << 'EOF'
export default {
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html'
    }
  },
  server: {
    port: 3000,
    open: true
  }
}
EOF