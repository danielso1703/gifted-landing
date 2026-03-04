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

  -- Return only gift item IDs; client fetches full gift_items via get_public_gift_items_by_ids
  SELECT json_agg(sg.gift_item_id ORDER BY sg.created_at NULLS LAST)
  INTO gifts_json
  FROM saved_gifts sg
  WHERE sg.search_id = link_row.search_id
    AND sg.deleted_at IS NULL;

  -- Build result: wishlist metadata + gift item IDs
  SELECT json_build_object(
    'wishlistName', COALESCE(
      search_row.search_params->>'wishlistName',
      search_row.search_params->>'recipient',
      search_row.search_name,
      'Wishlist'
    ),
    'ownerName', owner_name,
    'giftItemIds', COALESCE(gifts_json, '[]'::json)
  )
  INTO result;

  RETURN result;
END;
$fn$;

GRANT EXECUTE ON FUNCTION get_public_wishlist_by_token(text) TO anon;

-- Second RPC: fetch full gift_items by IDs; only returns rows that belong to the public wishlist for that token.
-- Call with: get_public_gift_items_by_ids(public_token, gift_item_ids) where gift_item_ids is a JSON array of UUIDs.
CREATE OR REPLACE FUNCTION get_public_gift_items_by_ids(p_public_token text, p_gift_item_ids jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn2$
DECLARE
  token_val text := p_public_token;
  link_row search_public_links%ROWTYPE;
  ids_array uuid[];
  result json;
BEGIN
  SELECT * INTO link_row
  FROM search_public_links
  WHERE search_public_links.public_token = token_val
    AND search_public_links.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN '[]'::json;
  END IF;

  -- Convert JSON array of UUID strings to uuid[]
  ids_array := ARRAY(
    SELECT elem::uuid
    FROM jsonb_array_elements_text(p_gift_item_ids) AS elem
  );

  -- Return full gift_items only for IDs that are in saved_gifts for this wishlist (same order as IDs list).
  -- url comes from gift_items.url (product link from DB).
  SELECT json_agg(gift_row ORDER BY ord)
  INTO result
  FROM (
    SELECT
      ord,
      json_build_object(
        'id', gi.id,
        'title', gi.title,
        'local_title', gi.local_title,
        'url', gi.url,
        'image_url', gi.image_url,
        'images', gi.images,
        'price', gi.price,
        'price_amount', gi.price_amount,
        'price_currency', gi.price_currency,
        'description', gi.description,
        'marketplace', gi.marketplace,
        'category', gi.category
      ) AS gift_row
    FROM unnest(ids_array) WITH ORDINALITY AS t(gi_id, ord)
    JOIN gift_items gi ON gi.id = t.gi_id
    WHERE EXISTS (
      SELECT 1
      FROM saved_gifts sg
      WHERE sg.search_id = link_row.search_id
        AND sg.gift_item_id = gi.id
        AND sg.deleted_at IS NULL
    )
  ) sub;

  RETURN COALESCE(result, '[]'::json);
END;
$fn2$;

GRANT EXECUTE ON FUNCTION get_public_gift_items_by_ids(text, jsonb) TO anon;
