function manejoErrores(err, req, res, next) {
  console.error('Error global:', err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    mensaje: err.message || 'Error interno del servidor',
  });
}

module.exports = manejoErrores;
