-- Current+ palette: the stored category catalogue is the old pastel set sharpened (docs/redesign/tokens.md).
-- Drop the check first so the rewrite below is allowed, then map every stored colour and re-add it.
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_color_catalog_check;

CREATE TEMP TABLE current_plus_colors (old_color text PRIMARY KEY, new_color text NOT NULL);
INSERT INTO current_plus_colors (old_color, new_color) VALUES
  ('#F2B8B5', '#FC7F78'), ('#F4C58B', '#FBAF51'), ('#EAD978', '#FADC35'), ('#BEDB8D', '#ADE451'),
  ('#A8D6A0', '#7CD76C'), ('#8FD3C7', '#57D8C1'), ('#A6D8F0', '#68CBFB'), ('#AEC5F5', '#75A0FB'),
  ('#C3B2EF', '#9A76F8'), ('#E4B1E4', '#E77BE7'), ('#F3B6CF', '#FC7AAF'), ('#F0C0B6', '#F8907B'),
  ('#D9C6A5', '#DAB471'), ('#C8D2A2', '#BDD170'), ('#B7C9C0', '#B7C9C0'), ('#C2CAD5', '#9AAECA'),
  ('#F3B6B2', '#FB7F77'), ('#9FD8D5', '#69DBD5'), ('#B7D5F0', '#7CBDF8'), ('#F5C397', '#FBA75E'),
  ('#E8C8A9', '#EFAE6F'), ('#E9BCA8', '#F1966D'), ('#CAD5A5', '#BED473'), ('#B5CBA0', '#9BC870'),
  ('#B7C2D3', '#8CA5CB'), ('#BFC9D6', '#95ADCD'), ('#F4B7C1', '#FC7C91'), ('#F1D0A9', '#FBB96C'),
  ('#AAD8C6', '#78D7B2'),
  -- wallet card swatches
  ('#8ECF9D', '#57D374'), ('#E8CF50', '#F9D51F'), ('#E87D72', '#FA402D'), ('#72CEC4', '#3EDBCA'),
  ('#B39AE8', '#8C5CF3'), ('#F0AD85', '#FA8A48');

UPDATE public.categories AS c
SET color = m.new_color
FROM current_plus_colors AS m
WHERE upper(c.color) = m.old_color AND c.color <> m.new_color;

UPDATE public.wallets AS w
SET color = m.new_color
FROM current_plus_colors AS m
WHERE upper(w.color) = m.old_color AND w.color <> m.new_color;

DROP TABLE current_plus_colors;

ALTER TABLE public.categories
  ADD CONSTRAINT categories_color_catalog_check CHECK (
    (user_id IS NULL AND color = ANY (ARRAY[
      '#FB7F77', '#69DBD5', '#7CBDF8', '#FBA75E', '#EFAE6F', '#F1966D',
      '#BED473', '#9BC870', '#8CA5CB', '#95ADCD', '#FC7C91', '#FBB96C',
      '#78D7B2', '#7CD76C', '#68CBFB', '#75A0FB', '#E77BE7', '#FADC35'
    ])) OR
    (user_id IS NOT NULL AND color = ANY (ARRAY[
      '#FC7F78', '#FBAF51', '#FADC35', '#ADE451', '#7CD76C', '#57D8C1',
      '#68CBFB', '#75A0FB', '#9A76F8', '#E77BE7', '#FC7AAF', '#F8907B',
      '#DAB471', '#BDD170', '#B7C9C0', '#9AAECA'
    ]))
  );

COMMENT ON TABLE public.categories IS 'Fixed system categories and user-owned custom categories. Icons and colors use the curated Material icon and Current+ sharpened color catalogues; subcategories are intentionally unsupported.';
