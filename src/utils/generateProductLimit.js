export function getEffectiveProductLimit(user) {
  const base = user.plan?.max_products ?? 0;
  const bonus =
    user.addon_status === 'active' && user.addon
      ? user.addon.extra_products
      : 0;
  return base + bonus;
}
