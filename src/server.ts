import app from './app.js';
const PORT: number = parseInt(process.env.PORT || '5000', 10);

app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`📚 Swagger docs: http://localhost:${PORT}/docs`);
});
