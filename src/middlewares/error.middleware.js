import ApiError from '../utils/ApiError.js';

const errorMiddleware = (err, req, res, _next) => {
  console.error('🔥 ERROR:', { reqId: req.id, err });

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Internal Server Error',
  });
};

export default errorMiddleware;
