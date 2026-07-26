import { Router } from 'express';
import multer from 'multer';

import upload from '../middlewares/upload.js';
import authMiddleware from '../middlewares/auth.js';
import { validateFile } from '../middlewares/validateFile.js';
import { productImageFileSchema } from '../schemas/uploadSchemas.js';
import { processProductImage } from '../middlewares/processProductImage.js';

const router = Router();

router.post(
  '/upload/product-image',
  authMiddleware,
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'Arquivo excede 5MB' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res
            .status(400)
            .json({ message: 'Formato de imagem não suportado' });
        }
        return res.status(400).json({ message: 'Erro no upload' });
      }
      if (err) return next(err);
      next();
    });
  },
  validateFile(productImageFileSchema),
  processProductImage(),
  (req, res) => {
    const publicUrl = `${process.env.APP_URL}/uploads/products/${req.file.filename}`;
    return res.status(201).json({ url: publicUrl });
  }
);

export default router;
