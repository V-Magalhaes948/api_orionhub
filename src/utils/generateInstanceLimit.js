export function getEffectiveInstanceLimit(user) {
  return user.plan?.max_instances ?? 0;
}
