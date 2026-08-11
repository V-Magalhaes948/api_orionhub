import Product from '../models/Product.js';
import User from '../models/User.js';

const CATALOG_ATTRIBUTES = [
  'name',
  'brand',
  'category',
  'pricing_mode',
  'unit_label',
  'price',
  'price_per_unit',
  'stock_quantity',
  'min_sale_quantity',
  'metadata',
];
const MAX_CATALOG_ITEMS = 50;

function formatMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;

  const entries = Object.entries(metadata)
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== ''
    )
    .map(([key, value]) => {
      const formattedValue = Array.isArray(value) ? value.join(', ') : value;
      return `${key}: ${formattedValue}`;
    });

  return entries.length > 0 ? entries.join(', ') : null;
}

function formatProductLine(p) {
  const parts = [p.name];

  if (p.brand) parts.push(p.brand);
  if (p.category) parts.push(p.category);

  if (p.pricing_mode === 'measured') {
    if (p.price_per_unit) {
      parts.push(`R$${Number(p.price_per_unit).toFixed(2)}/${p.unit_label}`);
    }
    if (p.min_sale_quantity) {
      parts.push(`mín. ${p.min_sale_quantity}${p.unit_label}`);
    }
    if (p.stock_quantity != null) {
      parts.push(`estoque: ${p.stock_quantity}${p.unit_label}`);
    }
  } else if (p.price != null) {
    parts.push(`R$${Number(p.price).toFixed(2)}`);
  }

  const metadataText = formatMetadata(p.metadata);
  if (metadataText) parts.push(metadataText);

  return `- ${parts.join(' | ')}`;
}
export async function getCatalogText(userId) {
  try {
    const user = await User.findByPk(userId, {
      attributes: ['id', 'product_selection_pending'],
    });

    if (!user || user.product_selection_pending) {
      return null;
    }

    const products = await Product.findAll({
      where: { user_id: userId, active: true },
      attributes: CATALOG_ATTRIBUTES,
      limit: MAX_CATALOG_ITEMS,
      order: [['updated_at', 'DESC']],
    });

    if (products.length === 0) return null;

    return products.map(formatProductLine).join('\n');
  } catch (error) {
    console.error('[PromptBuilder] Erro ao montar catálogo:', error.message);
    return null;
  }
}
