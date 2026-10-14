export function errorHandler(err, _req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = Number(err.statusCode || err.status) || 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  res.status(status).json({ error: message });
}
