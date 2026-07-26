export function validateFile(schema) {
  return (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    }

    const result = schema.safeParse(req.file);

    if (!result.success) {
      const issues = result.error.issues ?? result.error.errors ?? [];
      return res.status(400).json({
        errors: issues.map((e) => ({
          in: 'file',
          field: e.path.join('.') || '(root)',
          message: e.message,
        })),
      });
    }

    return next();
  };
}
