import { z } from 'zod';

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const productImageFileSchema = z.object({
  fieldname: z.literal('image'),
  mimetype: z.enum(ALLOWED_MIMETYPES),
  size: z.number().max(MAX_FILE_SIZE),
});
