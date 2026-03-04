-- RPC for the public wishlist page (topnotchgifts.ca/wishlist/<token>).
-- Run this in the Supabase SQL editor for the project that backs the Gifted app.
-- Adapt column names to match your schema (saved_searches, saved_gifts, gift_items, user_profiles).

CREATE OR REPLACE FUNCTION get_public_wishlist_by_token(public_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  token_val text := public_token;
  link_row search_public_links%ROWTYPE;
  search_row saved_searches%ROWTYPE;
  owner_name text;
  gifts_json json;
  result json;
BEGIN
  SELECT * INTO link_row
  FROM search_public_links
  WHERE search_public_links.public_token = token_val
    AND search_public_links.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO search_row
  FROM saved_searches
  WHERE saved_searches.id = link_row.search_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Owner name (optional; use only columns that exist on user_profiles)
  SELECT up.display_name
  INTO owner_name
  FROM user_profiles up
  WHERE up.user_id = search_row.user_id
  LIMIT 1;

  -- Gifts array: image supports first element as object with url, or as string URL, or image_url
  SELECT json_agg(json_build_object(
    'id', gi.id,
    'title', COALESCE(gi.local_title, gi.title, ''),
    'price', gi.price,
    'price_amount', gi.price_amount,
    'price_currency', gi.price_currency,
    'image', CASE
      WHEN jsonb_typeof(gi.images) = 'array' AND jsonb_array_length(gi.images) > 0
      THEN COALESCE(gi.images->0->>'url', gi.images->>0, gi.image_url)
      ELSE gi.image_url
    END,
    'url', gi.url,
    'marketplace', gi.marketplace
  ))
  INTO gifts_json
  FROM saved_gifts sg
  JOIN gift_items gi ON gi.id = sg.gift_item_id
  WHERE sg.search_id = link_row.search_id
    AND sg.deleted_at IS NULL;

  -- Build result with wishlist name and gifts
  SELECT json_build_object(
    'wishlistName', COALESCE(
      search_row.search_params->>'wishlistName',
      search_row.search_params->>'recipient',
      search_row.search_name,
      'Wishlist'
    ),
    'ownerName', owner_name,
    'gifts', COALESCE(gifts_json, '[]'::json)
  )
  INTO result;

  RETURN result;
END;
$fn$;

GRANT EXECUTE ON FUNCTION get_public_wishlist_by_token(text) TO anon;
