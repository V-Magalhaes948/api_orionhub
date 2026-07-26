import { z } from 'zod';

export function validate(schemas) {
  return (req, res, next) => {
    const errors = [];

    for (const source of ['body', 'params', 'query']) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source]);

      if (!result.success) {
        const issues = result.error.issues ?? result.error.errors ?? [];
        errors.push(
          ...issues.map((e) => ({
            in: source,
            field: e.path.join('.') || '(root)',
            message: e.message,
          }))
        );
        continue;
      }

      if (source === 'query') {
        Object.defineProperty(req, 'query', {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else {
        req[source] = result.data;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    return next();
  };
}
