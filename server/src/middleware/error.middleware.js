class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'ERROR';
  }
}

function errorMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const code = err.code || 'INTERNAL_ERROR';

  if (statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({ error: { message, code } });
}

module.exports = { AppError, errorMiddleware };
