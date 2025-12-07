export const extendTimeout = (milliseconds) => {
  return (req, res, next) => {
    req.setTimeout(milliseconds);
    res.setTimeout(milliseconds);
    next();
  };
};
