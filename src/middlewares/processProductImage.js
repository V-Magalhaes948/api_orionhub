import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';

const ALLOWED_MIME_TO_SHARP_FORMAT = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const UPLOAD_DIR = path.resolve('uploads/products');

export function processProductImage() {
  return async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado' });
      }
      const detected = await fileTypeFromBuffer(req.file.buffer);

      if (!detected || !ALLOWED_MIME_TO_SHARP_FORMAT[detected.mime]) {
        return res.status(400).json({
          message:
            'O conteúdo do arquivo não corresponde a uma imagem suportada.',
        });
      }

      const format = ALLOWED_MIME_TO_SHARP_FORMAT[detected.mime];
      const cleanBuffer = await sharp(req.file.buffer)[format]().toBuffer();

      const hash = crypto.randomBytes(16).toString('hex');
      const ext = `.${format === 'jpeg' ? 'jpg' : format}`;
      const filename = `${hash}${ext}`;

      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      await fs.writeFile(path.join(UPLOAD_DIR, filename), cleanBuffer);

      req.file.filename = filename;

      return next();
    } catch (error) {
      console.error('[processProductImage] Erro ao processar imagem:', error);
      return res
        .status(400)
        .json({ message: 'Não foi possível processar a imagem enviada.' });
    }
  };
}
