import { supabase } from '@/lib/supabase/client';

export async function getCategories(type?: 'income' | 'expense') {
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from('categories')
    .select('*')
    .or(`user_id.is.null${user ? `,user_id.eq.${user.id}` : ''}`)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(c => ({
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