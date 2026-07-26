import ActivityLog from '../models/ActivityLog.js';

export async function logActivity({
  userId,
  action,
  resourceType,
  resourceId,
  metadata,
  ip,
}) {
  try {
    await ActivityLog.create({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata,
      ip_address: ip,
    });
  } catch (err) {
    console.error('[logActivity] Falha ao registrar atividade:', err.message);
  }
}
