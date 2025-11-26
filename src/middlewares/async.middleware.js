const TryCatch = (handler) => {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error); // ✔ Forward error to global handler
    }
  };
};

export default TryCatch;
