import { syncSystem } from '@/lib/powersync/Powersync';

export async function getCategories(type?: 'income' | 'expense') {
  const { db } = syncSystem;

  let query = db
    .selectFrom('categories')
    .selectAll()
    .where((eb) => eb.or([
      eb('user_id', 'is', null),
      eb('user_id', '=', 'user_id_placeholder') // We'll replace this with actual user ID
    ]))
    .orderBy('display_order', 'asc')
    .orderBy('name', 'asc');

  // Note: For now, we'll get all categories and filter client-side
  // In a full implementation, you'd need to handle user authentication differently
  let categories = await query.execute();

  // Filter by user (simplified for now)
  categories = categories.filter(c => c.user_id === null || c.user_id === 'current_user_id');

  if (type) {
    categories = categories.filter(c => c.type === type);
  }

  return categories.map(c => ({
    id: c.id,
    userId: c.user_id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    parentId: c.parent_id,
    type: c.type,
    isActive: c.is_active,
    displayOrder: c.display_order,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));
}