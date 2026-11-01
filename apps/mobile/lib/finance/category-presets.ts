/** The fields that decide whether a user's own category stands in for a preset. */
export type CategoryIdentity = {
  userId: string | null;
  name: string | null;
  type: string | null;
  isActive: boolean;
};

/**
 * A preset is one row for everyone, so a preset added later can share a name with a category a user
 * already made. That user keeps their own, and the preset stays out of their lists.
 */
export function hideShadowedPresets<T>(rows: readonly T[], identity: (row: T) => CategoryIdentity): T[] {
  const key = ({ name, type }: CategoryIdentity) => `${type}:${name?.trim().toLocaleLowerCase()}`;
  const own = new Set(
    rows
      .map(identity)
      .filter((row) => row.userId !== null && row.isActive)
      .map(key),
  );
  return rows.filter((row) => {
    const category = identity(row);
    return category.userId !== null || !own.has(key(category));
  });
}
