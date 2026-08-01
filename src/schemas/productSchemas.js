import { z } from 'zod';
import { uuidParam } from './common.js';

const emptyableUrl = z
  .union([z.string().url(), z.literal('')])
  .optional()
  .nullable();

const productBodyBase = {
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  brand: z.string().trim().max(100).optional().nullable(),
  pricing_mode: z.enum(['unit', 'measured']).optional(),
  unit_label: z.enum(['ml', 'kg', 'cm', 'm', 'un', 'g', 'l']).optional(),
  price: z.coerce.number().min(0).max(10000).optional().nullable(),
  price_per_unit: z.coerce.number().min(0).max(10000).optional().nullable(),
  stock_quantity: z.coerce.number().min(0).max(999).optional().nullable(),
  min_sale_quantity: z.coerce.number().min(0).max(999).optional().nullable(),
  image_catalog_url: emptyableUrl,
  is_featured: z.boolean().optional(),
  image_vitrine_url: emptyableUrl,
  metadata: z.record(z.any()).optional().nullable(),
};

export const listProductsSchema = {
  query: z.object({
    category: z.string().trim().max(100).optional(),
    active: z.enum(['true', 'false']).optional(),
  }),
};

export const createProductSchema = {
  body: z.object(productBodyBase),
};

export const updateProductSchema = {
  params: uuidParam(),
  body: z.object({
    ...productBodyBase,
    name: productBodyBase.name.optional(),
    active: z.boolean().optional(),
  }),
};

export const productIdParamSchema = {
  params: uuidParam(),
};
