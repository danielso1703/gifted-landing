/**
 * Public wishlist page: reads token from URL path, fetches wishlist via Supabase RPC,
 * renders loading / error / content (with optional empty state).
 */
(function () {
  function escapeHtml(text) {
    if (text == null || text === '') return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    var t = url.trim();
    if (t.indexOf('http://') === 0 || t.indexOf('https://') === 0) return t;
    return '';
  }

  function getTokenFromPath() {
    var pathname = window.location.pathname;
    var parts = pathname.split('/').filter(Boolean);
    var hash = window.location.hash ? window.location.hash.slice(1) : '';
    if (parts[0] !== 'wishlist') return null;
    if (parts.length >= 2 && parts[parts.length - 1] !== 'wishlist') return parts[parts.length - 1];
    if (hash) return hash;
    return null;
  }

  function showLoading() {
    setVisible('wishlist-loading', true);
    setVisible('wishlist-error', false);
    setVisible('wishlist-content', false);
  }

  function showError() {
    setVisible('wishlist-loading', false);
    setVisible('wishlist-error', true);
    setVisible('wishlist-content', false);
  }

  function showContent(data) {
    setVisible('wishlist-loading', false);
    setVisible('wishlist-error', false);
    setVisible('wishlist-content', true);

    var titleEl = document.getElementById('wishlist-title');
    var ownerEl = document.getElementById('wishlist-owner');
    var giftsEl = document.getElementById('wishlist-gifts');
    var emptyEl = document.getElementById('wishlist-empty');
    var ctaEl = document.getElementById('wishlist-cta');

    if (titleEl) {
      titleEl.textContent = data.wishlistName || 'Wishlist';
      document.title = (data.wishlistName || 'Wishlist') + ' — Top Notch Gifts';
    }
    if (ownerEl) {
      if (data.ownerName) {
        ownerEl.textContent = 'Wishlist by ' + data.ownerName;
        ownerEl.style.display = '';
      } else {
        ownerEl.style.display = 'none';
      }
    }

    var gifts = data.gifts || [];
    if (giftsEl) {
      giftsEl.innerHTML = '';
      if (gifts.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
      } else {
        if (emptyEl) emptyEl.style.display = 'none';
        gifts.forEach(function (gift) {
          giftsEl.appendChild(buildGiftCard(gift));
        });
      }
    }
    if (ctaEl) ctaEl.style.display = '';
  }

  function setVisible(id, visible) {
    var el = document.getElementById(id);
    if (el) el.style.display = visible ? '' : 'none';
  }

  var PLACEHOLDER_IMAGE_SVG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23E6E8EF" width="200" height="200"/%3E%3Ctext fill="%23707487" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';

  function formatPrice(gift) {
    if (gift.price_amount != null && gift.price_amount > 0 && gift.price_currency) {
      try {
        return new Intl.NumberFormat('en-CA', { style: 'currency', currency: gift.price_currency || 'CAD' }).format(gift.price_amount);
      } catch (e) {
        return String(gift.price);
      }
    }
    if (gift.price != null && gift.price !== '' && gift.price !== '0' && gift.price !== 0) {
      if (typeof gift.price === 'number' && !isNaN(gift.price)) return '$' + Math.round(gift.price).toLocaleString();
      if (typeof gift.price === 'string') return gift.price;
    }
    return '';
  }

  function buildGiftCard(gift) {
    var title = gift.title || 'Gift';
    var priceText = formatPrice(gift) || 'View price';
    var imageUrl = gift.image && gift.image.trim ? gift.image.trim() : '';
    if (!imageUrl) imageUrl = PLACEHOLDER_IMAGE_SVG;
    var url = sanitizeUrl(gift.url);
    var marketplace = (gift.marketplace || '').toLowerCase();

    var providerBadgeHtml = '';
    if (marketplace === 'ebay') providerBadgeHtml = '<span class="provider-badge provider-badge--ebay">eBay</span>';
    else if (marketplace === 'etsy') providerBadgeHtml = '<span class="provider-badge provider-badge--etsy">Etsy</span>';

    var imgHtml = '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(title) + '" loading="lazy">';

    var shopHtml = url
      ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="item-shop-btn">View</a>'
      : '';

    var card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML =
      '<div class="item-image">' + providerBadgeHtml + imgHtml + '</div>' +
      '<div class="item-content">' +
      '<h3 class="item-title">' + escapeHtml(title) + '</h3>' +
      '<p class="item-price">' + escapeHtml(priceText) + '</p>' +
      shopHtml +
      '</div>';
    return card;
  }

  function initSupabase() {
    if (typeof SUPABASE_CONFIG === 'undefined' || !SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) return null;
    if (typeof window.supabase === 'undefined') return null;
    return window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }

  function run() {
    var token = getTokenFromPath();
    if (!token) {
      showError();
      return;
    }

    var supabaseClient = initSupabase();
    if (!supabaseClient) {
      showError();
      return;
    }

    showLoading();

    supabaseClient
      .rpc('get_public_wishlist_by_token', { public_token: token })
      .then(function (result) {
        var err = result.error;
        var data = result.data;
        if (err || data == null) {
          if (err) {
            console.warn('Wishlist RPC error:', err.code, err.message, err.details);
          }
          showError();
          return;
        }
        showContent(data);
      })
      .catch(function (e) {
        console.warn('Wishlist RPC request failed:', e);
        showError();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
