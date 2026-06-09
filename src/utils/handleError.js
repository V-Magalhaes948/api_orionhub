export const handleError = (res, error) => {
  if (
    error.name === 'SequelizeValidationError' ||
    error.name === 'SequelizeUniqueConstraintError'
  ) {
    const messages = error.errors.map((e) => e.message);
    return res.status(400).json({ errors: messages });
  }
  return res.status(500).json({ message: 'Internal server error' });
};
