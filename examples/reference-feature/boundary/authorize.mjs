export function authorize(context, permission) {
  if (!context || typeof context.userId !== 'string' || !context.userId.trim()) {
    throw new Error('UNAUTHENTICATED');
  }
  if (!Array.isArray(context.permissions) || !context.permissions.includes(permission)) {
    throw new Error('FORBIDDEN');
  }
  return context.userId;
}
