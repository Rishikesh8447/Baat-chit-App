const sendValidationError = (res, message, details) =>
  res.status(400).json({
    message,
    details,
  });

export const validate = (validator) => (req, res, next) => {
  const result = validator(req);

  if (!result?.ok) {
    return sendValidationError(
      res,
      result?.message || "Invalid request",
      result?.details || []
    );
  }

  if (result.value?.body) req.body = result.value.body;
  if (result.value?.params) req.params = result.value.params;
  if (result.value?.query) req.query = result.value.query;

  return next();
};
