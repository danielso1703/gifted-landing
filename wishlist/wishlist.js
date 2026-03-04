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
    var u = url.trim();
    if (!u) return '';

    if (u.indexOf('ebay.com/itm/') !== -1) {
      var match = u.match(/\/itm\/v1(?:%7C|\|)(\d+)(?:%7C|\|)(\d+)(\?.*)?$/);
      if (match) {
        var itemId = match[1];
        var varId = match[2];
        var queryParams = match[3] || '';
        var newUrl = 'https://www.ebay.com/itm/' + itemId + '?var=' + varId;
        if (queryParams) newUrl += queryParams.replace('?', '&');
        return newUrl;
      }
    }
    if (u.indexOf('ebay.com') !== -1 && (u.indexOf('%7C') !== -1 || u.indexOf('%7c') !== -1)) {
      return u.replace(/%7C/gi, '|');
    }
    return u;
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
    wishlistGifts = gifts;
    if (giftsEl) {
      giftsEl.innerHTML = '';
      if (gifts.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
      } else {
        if (emptyEl) emptyEl.style.display = 'none';
        gifts.forEach(function (gift, index) {
          giftsEl.appendChild(buildGiftCard(gift, gifts, index));
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

  function isPlaceholderUrl(url) {
    if (!url || typeof url !== 'string') return true;
    try {
      var lower = url.trim().toLowerCase();
      if (lower.indexOf('http://') !== 0 && lower.indexOf('https://') !== 0) return true;
      var host = url.split('/')[2] || '';
      host = host.toLowerCase().split(':')[0];
      return host === 'example.com' || host === 'www.example.com';
    } catch (e) {
      return true;
    }
  }

  // Resolve actual item URL from DB (gift_items.url); handle string or accidental JSON/array storage.
  // Ignores placeholder URLs (e.g. https://example.com/) from initial share.
  // Reads gift.url (from get_public_gift_items_by_ids RPC); fallback gift.item_url if key differs.
  function getItemUrl(gift) {
    if (!gift) return '';
    var u = gift.url !== undefined && gift.url !== null ? gift.url : gift.item_url;
    if (typeof u === 'string' && u.trim()) {
      u = u.trim();
      if (u.indexOf('[') === 0) {
        try {
          var parsed = JSON.parse(u);
          if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') u = parsed[0];
          else if (parsed && typeof parsed.url === 'string') u = parsed.url;
          else {
            console.warn('[Wishlist] getItemUrl empty for gift id=', gift.id, ', raw url type=', typeof gift.url, ', preview=', String(gift.url).slice(0, 40));
            return '';
          }
        } catch (e) {
          console.warn('[Wishlist] getItemUrl empty for gift id=', gift.id, ', raw url type=', typeof gift.url, ', preview=', String(gift.url).slice(0, 40));
          return '';
        }
      }
      if (u.indexOf('http://') === 0 || u.indexOf('https://') === 0) {
        if (!isPlaceholderUrl(u)) return u;
        console.warn('[Wishlist] getItemUrl empty (placeholder URL) for gift id=', gift.id, ', preview=', u.slice(0, 40));
        return '';
      }
    }
    if (u && typeof u === 'object' && typeof u.url === 'string') {
      u = u.url.trim();
      if (!isPlaceholderUrl(u)) return u;
      console.warn('[Wishlist] getItemUrl empty (placeholder URL) for gift id=', gift.id);
      return '';
    }
    if (gift.url) {
      console.warn('[Wishlist] getItemUrl empty for gift id=', gift.id, ', raw url type=', typeof gift.url, ', preview=', String(gift.url).slice(0, 40));
    }
    return '';
  }

  // Collect all actual image URLs for a gift from DB fields (image_url, images). Used to replace page per item.
  function getAllImageUrls(gift) {
    if (!gift) return [];
    var out = [];
    function addUrl(u) {
      if (typeof u === 'string' && u.trim()) {
        u = u.trim();
        if (u.indexOf('[') === 0) {
          try {
            var parsed = JSON.parse(u);
            if (Array.isArray(parsed)) {
              parsed.forEach(function (p) {
                if (typeof p === 'string' && p.trim()) out.push(p.trim());
                else if (p && typeof p.url === 'string' && p.url.trim()) out.push(p.url.trim());
              });
            }
          } catch (e) { /* ignore */ }
        } else if (u.indexOf('http://') === 0 || u.indexOf('https://') === 0) {
          out.push(u);
        }
      }
    }
    function addFromArray(arr) {
      if (!arr || !Array.isArray(arr)) return;
      arr.forEach(function (item) {
        if (typeof item === 'string') addUrl(item);
        else if (item && typeof item.url === 'string') addUrl(item.url);
      });
    }
    addUrl(gift.image_url);
    if (typeof gift.images === 'string') {
      try {
        var raw = gift.images;
        if (raw.indexOf("['") === 0 && raw.lastIndexOf("']") === raw.length - 2) raw = raw.replace(/'/g, '"');
        addFromArray(JSON.parse(raw));
      } catch (e) { /* ignore */ }
    } else {
      addFromArray(gift.images);
    }
    return out;
  }

  // Resolve single image URL: prefer precomputed _imageUrls from DB, then image_url/images, then placeholder
  function getImageUrl(gift) {
    if (!gift) return PLACEHOLDER_IMAGE_SVG;
    var url = '';
    if (gift._imageUrls && gift._imageUrls.length > 0) {
      url = gift._imageUrls[0];
    } else {
      url = gift.image_url;
      if (!url && gift.images && Array.isArray(gift.images) && gift.images.length > 0) {
        var first = gift.images[0];
        url = typeof first === 'string' ? first : (first && first.url);
      }
      if (typeof url === 'string' && url.trim().indexOf('[') === 0) {
        try {
          var parsed = JSON.parse(url);
          if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') url = parsed[0];
          else url = '';
        } catch (e) {
          url = '';
        }
      }
    }
    if (!url || (typeof url === 'string' && !url.trim())) {
      var hasImageData = gift && (
        (gift._imageUrls && gift._imageUrls.length > 0) ||
        gift.image_url ||
        (gift.images && (Array.isArray(gift.images) ? gift.images.length > 0 : (typeof gift.images === 'string' && gift.images.length > 0)))
      );
      if (hasImageData) {
        console.warn('[Wishlist] getImageUrl placeholder for gift id=', gift.id, ', _imageUrls.length=', gift._imageUrls ? gift._imageUrls.length : 0);
      }
      return PLACEHOLDER_IMAGE_SVG;
    }
    return url;
  }

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

  var wishlistGifts = [];

  function openModal(gift, list, index) {
    currentModalList = list;
    currentModalIndex = index;
    currentModalImageIndex = 0;
    updateModalContent(gift);

    var modal = document.getElementById('product-modal');
    if (modal) {
      modal.style.display = 'flex';
      modal.offsetHeight;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      var closeBtn = modal.querySelector('.modal-close-btn');
      if (closeBtn) {
        requestAnimationFrame(function () { closeBtn.focus(); });
      }
    }

    var prevBtn = document.querySelector('.modal-prev-btn');
    var nextBtn = document.querySelector('.modal-next-btn');
    if (prevBtn) prevBtn.style.display = index <= 0 ? 'none' : '';
    if (nextBtn) nextBtn.style.display = index >= list.length - 1 ? 'none' : '';
  }

  function closeModal() {
    var modal = document.getElementById('product-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    var video = document.getElementById('modal-video');
    if (video) {
      video.pause();
      video.currentTime = 0;
      video.src = '';
    }
    setTimeout(function () {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }, 300);
  }

  function setModalImageAndDots() {
    var gift = currentModalList[currentModalIndex];
    if (!gift) return;
    var urls = gift._imageUrls;
    var modalImage = document.getElementById('modal-image');
    if (!modalImage) return;
    var idx = currentModalImageIndex;
    if (urls && urls.length > 0 && idx >= 0 && idx < urls.length) {
      modalImage.src = urls[idx];
    } else {
      modalImage.src = getImageUrl(gift);
    }
    modalImage.onerror = function () {
      this.src = PLACEHOLDER_IMAGE_SVG;
      this.onerror = null;
    };
    var pagination = document.getElementById('image-pagination');
    if (pagination) {
      var dots = pagination.querySelectorAll('.modal-image-dot');
      for (var d = 0; d < dots.length; d++) {
        dots[d].setAttribute('aria-current', d === idx ? 'true' : 'false');
        dots[d].classList.toggle('is-active', d === idx);
      }
      var label = pagination.querySelector('.modal-image-label');
      if (label && urls && urls.length > 1) label.textContent = (idx + 1) + ' of ' + urls.length;
      var imgPrev = pagination.querySelector('.modal-image-prev');
      var imgNext = pagination.querySelector('.modal-image-next');
      if (imgPrev) imgPrev.style.display = (urls && urls.length > 1 && idx > 0) ? '' : 'none';
      if (imgNext) imgNext.style.display = (urls && urls.length > 1 && idx < urls.length - 1) ? '' : 'none';
    }
  }

  function updateModalContent(gift) {
    var title = (gift.local_title || gift.title || 'Gift').trim();
    var priceText = formatPrice(gift) || 'View price';
    var desc = (gift.description && gift.description.trim) ? gift.description.trim() : '';
    var marketplace = (gift.marketplace || '').toLowerCase();
    var urls = gift._imageUrls;
    if (urls && urls.length > 0 && currentModalImageIndex >= urls.length) {
      currentModalImageIndex = urls.length - 1;
    }
    var imageUrl = (urls && urls.length > 0 && currentModalImageIndex >= 0 && currentModalImageIndex < urls.length)
      ? urls[currentModalImageIndex]
      : getImageUrl(gift);

    var modalImage = document.getElementById('modal-image');
    var modalVideo = document.getElementById('modal-video');
    if (modalImage) {
      modalImage.style.display = 'block';
      modalImage.src = imageUrl;
      modalImage.alt = title;
      modalImage.onerror = function () {
        this.src = PLACEHOLDER_IMAGE_SVG;
        this.onerror = null;
      };
    }
    if (modalVideo) {
      modalVideo.style.display = 'none';
      modalVideo.pause();
      modalVideo.src = '';
    }

    var categoryEl = document.getElementById('modal-category');
    if (categoryEl) categoryEl.textContent = 'Wishlist';
    var titleEl = document.getElementById('modal-title');
    if (titleEl) titleEl.textContent = title;
    var priceEl = document.getElementById('modal-price');
    if (priceEl) priceEl.textContent = priceText;

    var providerEl = document.getElementById('modal-provider');
    if (providerEl) {
      if (marketplace === 'ebay' || marketplace === 'etsy') {
        providerEl.textContent = marketplace === 'ebay' ? 'eBay' : 'Etsy';
        providerEl.className = 'modal-provider provider-badge provider-badge--' + marketplace;
        providerEl.style.display = '';
      } else {
        providerEl.style.display = 'none';
      }
    }

    var descEl = document.getElementById('modal-description');
    var descToggle = document.getElementById('modal-description-toggle');
    if (descEl) descEl.textContent = desc;
    if (descToggle) {
      descToggle.style.display = 'none';
      descToggle.setAttribute('aria-expanded', 'false');
    }
    if (descEl && descToggle && desc) {
      descEl.classList.remove('is-expanded');
      descToggle.textContent = 'More';
      (function (el, toggle) {
        requestAnimationFrame(function () {
          if (el.scrollHeight > el.clientHeight + 1) toggle.style.display = 'inline-flex';
        });
      })(descEl, descToggle);
    }

    var shopBtn = document.getElementById('modal-shop-btn');
    if (shopBtn) {
      var shopUrl = sanitizeUrl(gift._itemUrl !== undefined ? gift._itemUrl : gift.url);
      shopBtn.href = shopUrl || '#';
      shopBtn.style.display = '';
    }

    var pagination = document.getElementById('image-pagination');
    if (pagination) {
      pagination.innerHTML = '';
      if (urls && urls.length > 1) {
        var wrap = document.createElement('div');
        wrap.className = 'modal-image-gallery';
        var imgPrev = document.createElement('button');
        imgPrev.type = 'button';
        imgPrev.className = 'modal-image-prev';
        imgPrev.setAttribute('aria-label', 'Previous image');
        imgPrev.innerHTML = '&#9664;';
        imgPrev.style.display = currentModalImageIndex > 0 ? '' : 'none';
        var imgNext = document.createElement('button');
        imgNext.type = 'button';
        imgNext.className = 'modal-image-next';
        imgNext.setAttribute('aria-label', 'Next image');
        imgNext.innerHTML = '&#9654;';
        imgNext.style.display = currentModalImageIndex < urls.length - 1 ? '' : 'none';
        var label = document.createElement('span');
        label.className = 'modal-image-label';
        label.textContent = (currentModalImageIndex + 1) + ' of ' + urls.length;
        var dotsWrap = document.createElement('div');
        dotsWrap.className = 'modal-image-dots';
        for (var i = 0; i < urls.length; i++) {
          var dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'modal-image-dot' + (i === currentModalImageIndex ? ' is-active' : '');
          dot.setAttribute('aria-label', 'Image ' + (i + 1));
          dot.setAttribute('aria-current', i === currentModalImageIndex ? 'true' : 'false');
          (function (j) {
            dot.addEventListener('click', function () {
              currentModalImageIndex = j;
              setModalImageAndDots();
            });
          })(i);
          dotsWrap.appendChild(dot);
        }
        wrap.appendChild(imgPrev);
        wrap.appendChild(label);
        wrap.appendChild(dotsWrap);
        wrap.appendChild(imgNext);
        pagination.appendChild(wrap);
        imgPrev.addEventListener('click', function () {
          if (currentModalImageIndex > 0) {
            currentModalImageIndex--;
            setModalImageAndDots();
          }
        });
        imgNext.addEventListener('click', function () {
          if (currentModalImageIndex < urls.length - 1) {
            currentModalImageIndex++;
            setModalImageAndDots();
          }
        });
      }
    }
  }

  var currentModalList = [];
  var currentModalIndex = 0;
  var currentModalImageIndex = 0;

  function showPrevItem() {
    if (currentModalIndex <= 0) return;
    currentModalIndex--;
    currentModalImageIndex = 0;
    updateModalContent(currentModalList[currentModalIndex]);
    var prevBtn = document.querySelector('.modal-prev-btn');
    var nextBtn = document.querySelector('.modal-next-btn');
    if (prevBtn) prevBtn.style.display = currentModalIndex <= 0 ? 'none' : '';
    if (nextBtn) nextBtn.style.display = '';
  }

  function showNextItem() {
    if (currentModalIndex >= currentModalList.length - 1) return;
    currentModalIndex++;
    currentModalImageIndex = 0;
    updateModalContent(currentModalList[currentModalIndex]);
    var prevBtn = document.querySelector('.modal-prev-btn');
    var nextBtn = document.querySelector('.modal-next-btn');
    if (prevBtn) prevBtn.style.display = '';
    if (nextBtn) nextBtn.style.display = currentModalIndex >= currentModalList.length - 1 ? 'none' : '';
  }

  function buildGiftCard(gift, list, index) {
    var title = (gift.local_title || gift.title || 'Gift').trim();
    var priceText = formatPrice(gift) || 'View price';
    var imageUrl = getImageUrl(gift);
    var url = sanitizeUrl(gift._itemUrl !== undefined ? gift._itemUrl : gift.url);
    var isPlaceholder = imageUrl === PLACEHOLDER_IMAGE_SVG || imageUrl.indexOf('data:image/svg') === 0;
    console.log('[Wishlist] card', index, ': imageUrl is placeholder=', isPlaceholder, ', shop url empty=', !url);
    var marketplace = (gift.marketplace || '').toLowerCase();

    var providerBadgeHtml = '';
    if (marketplace === 'ebay') providerBadgeHtml = '<span class="provider-badge provider-badge--ebay">eBay</span>';
    else if (marketplace === 'etsy') providerBadgeHtml = '<span class="provider-badge provider-badge--etsy">Etsy</span>';

    var imgHtml = '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(title) + '" loading="lazy">';

    var shopHtml = url
      ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="item-shop-btn">View</a>'
      : '';

    var card = document.createElement('div');
    card.className = 'item-card item-card--animate';
    card.innerHTML =
      '<div class="item-image">' + providerBadgeHtml + imgHtml + '</div>' +
      '<div class="item-content">' +
      '<h3 class="item-title">' + escapeHtml(title) + '</h3>' +
      '<p class="item-price">' + escapeHtml(priceText) + '</p>' +
      shopHtml +
      '</div>';

    var shopLink = card.querySelector('a.item-shop-btn');
    if (shopLink) {
      shopLink.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }

    card.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      openModal(gift, list, index);
    });

    return card;
  }

  function initSupabase() {
    if (typeof SUPABASE_CONFIG === 'undefined' || !SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) return null;
    if (typeof window.supabase === 'undefined') return null;
    return window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }

  function run() {
    var token = getTokenFromPath();
    console.log('[Wishlist] token:', token || '(missing)');
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
        var giftItemIds = data.giftItemIds || [];
        console.log('[Wishlist] wishlist loaded, giftItemIds.length:', giftItemIds.length, 'ids:', giftItemIds.slice(0, 3));
        if (giftItemIds.length === 0) {
          showContent({ wishlistName: data.wishlistName, ownerName: data.ownerName, gifts: [] });
          return;
        }
        return supabaseClient
          .rpc('get_public_gift_items_by_ids', {
            p_public_token: token,
            p_gift_item_ids: giftItemIds
          })
          .then(function (res2) {
            if (res2.error) {
              console.warn('Wishlist gift items RPC error:', res2.error.code, res2.error.message, res2.error.details);
              showError();
              return;
            }
            var gifts = Array.isArray(res2.data) ? res2.data : [];
            console.log('[Wishlist] gifts from DB:', gifts.length);
            var logLimit = Math.min(3, gifts.length);
            for (var i = 0; i < logLimit; i++) {
              var g = gifts[i];
              var titlePreview = (g && (g.title || g.local_title)) ? String(g.title || g.local_title).slice(0, 40) + (String(g.title || g.local_title).length > 40 ? '...' : '') : '(none)';
              var imgUrlPreview = g && g.image_url != null ? typeof g.image_url + ' ' + String(g.image_url).slice(0, 60) + (String(g.image_url).length > 60 ? '...' : '') : '(null/empty)';
              var imagesPreview = g && g.images != null ? (typeof g.images === 'string' ? 'string ' + String(g.images).slice(0, 60) + '...' : 'array len=' + (g.images && g.images.length) + ' first=' + (g.images && g.images[0] ? String(g.images[0]).slice(0, 40) : '')) : '(null/empty)';
              var urlPreview = g && g.url != null ? typeof g.url + ' ' + String(g.url).slice(0, 60) + (String(g.url).length > 60 ? '...' : '') : '(null/empty)';
              console.log('[Wishlist] raw gift', i, 'id=', g && g.id, 'title=', titlePreview, 'image_url=', imgUrlPreview, 'images=', imagesPreview, 'url=', urlPreview);
            }
            normalizeGiftImages(gifts);
            gifts.forEach(function (gift) {
              gift._imageUrls = getAllImageUrls(gift);
              gift._itemUrl = getItemUrl(gift);
            });
            for (var j = 0; j < logLimit; j++) {
              var r = gifts[j];
              var firstImg = r._imageUrls && r._imageUrls.length > 0 ? r._imageUrls[0].slice(0, 50) + (r._imageUrls[0].length > 50 ? '...' : '') : '(none)';
              var itemUrlStr = r._itemUrl ? r._itemUrl.slice(0, 50) + (r._itemUrl.length > 50 ? '...' : '') : '(empty)';
              console.log('[Wishlist] resolved gift', j, ' _imageUrls.length=', r._imageUrls ? r._imageUrls.length : 0, ' firstImage=', firstImg, ' _itemUrl=', itemUrlStr);
              var hasRawImages = r.image_url || (r.images && (Array.isArray(r.images) ? r.images.length > 0 : (typeof r.images === 'string' && r.images.length > 0)));
              if ((!r._imageUrls || r._imageUrls.length === 0) && hasRawImages) {
                console.warn('[Wishlist] resolved gift', j, 'has raw image data but _imageUrls empty');
              }
              if (!r._itemUrl && r.url) {
                console.warn('[Wishlist] resolved gift', j, 'has raw url but _itemUrl empty');
              }
            }
            showContent({
              wishlistName: data.wishlistName,
              ownerName: data.ownerName,
              gifts: gifts
            });
          });
      })
      .catch(function (e) {
        console.warn('Wishlist RPC request failed:', e);
        showError();
      });
  }

  function normalizeGiftImages(gifts) {
    gifts.forEach(function (gift) {
      if (gift && typeof gift.images === 'string') {
        try {
          var raw = gift.images;
          if (raw.indexOf("['") === 0 && raw.lastIndexOf("']") === raw.length - 2) {
            raw = raw.replace(/'/g, '"');
          }
          gift.images = JSON.parse(raw);
        } catch (e) {
          gift.images = [];
        }
      }
    });
  }

  function bindModalEvents() {
    var modal = document.getElementById('product-modal');
    if (!modal) return;

    function onClose() {
      closeModal();
    }
    modal.querySelectorAll('[data-close="true"]').forEach(function (el) {
      el.addEventListener('click', onClose);
    });

    var prevBtn = document.querySelector('.modal-prev-btn');
    var nextBtn = document.querySelector('.modal-next-btn');
    if (prevBtn) prevBtn.addEventListener('click', showPrevItem);
    if (nextBtn) nextBtn.addEventListener('click', showNextItem);

    var descriptionToggle = document.getElementById('modal-description-toggle');
    var descriptionEl = document.getElementById('modal-description');
    if (descriptionToggle && descriptionEl) {
      descriptionToggle.addEventListener('click', function () {
        var isExpanded = descriptionEl.classList.toggle('is-expanded');
        descriptionToggle.textContent = isExpanded ? 'Less' : 'More';
        descriptionToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      });
    }

    document.addEventListener('keydown', function (e) {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') {
        closeModal();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        showPrevItem();
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        showNextItem();
        e.preventDefault();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      run();
      bindModalEvents();
    });
  } else {
    run();
    bindModalEvents();
  }
})();
