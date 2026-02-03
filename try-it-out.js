// Try it out page - Supabase-powered gift browsing

// Items logging: namespaced [Items] prefix, level controls debug visibility
var ITEMS_LOG_LEVEL = 'info'; // 'debug' | 'info' | 'warn' | 'error'
function itemsLog(level, msg, data) {
  if (level === 'debug' && ITEMS_LOG_LEVEL !== 'debug') return;
  var prefix = '[Items]';
  var method = (typeof console[level] === 'function') ? level : 'log';
  if (data !== undefined) console[method](prefix, msg, data);
  else console[method](prefix, msg);
}

// Initialize Supabase client (use supabaseClient to avoid clashing with CDN global 'supabase')
let supabaseClient = null;

function initSupabase() {
  if (typeof SUPABASE_CONFIG === 'undefined' || !SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
    itemsLog('error', 'Supabase configuration missing. Please update config.js with your credentials.');
    showError('Configuration error. Please contact support.');
    return false;
  }

  if (typeof window.supabase === 'undefined') {
    itemsLog('error', 'Supabase library not loaded. Make sure the script tag includes the Supabase CDN.');
    showError('Configuration error. Please contact support.');
    return false;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  itemsLog('info', 'Supabase client initialized');
  return true;
}

const PAGE_SIZE = 24;

// State management
const state = {
  taxonomy: null,
  isDefaultView: true,
  defaultViewItems: {},
  recipients: [],
  selectedRecipient: null,
  selectedAge: null,
  selectedGender: null,
  clusters: [],
  selectedCluster: null,
  subClusters: [],
  selectedSubCluster: null,
  categories: [],
  selectedCategory: null,
  searchQuery: '',
  items: [],
  loading: false,
  page: 0,
  hasMore: true,
  searchTimeout: null,
  currentModalIndex: -1,
  currentItemsList: [],
  suggestions: [],
  focusedSuggestionIndex: -1
};

// DOM elements
const elements = {
  backToTrendingBtn: null,
  filtersSection: null,
  createRecipient: null,
  createAge: null,
  createGender: null,
  trendingLabel: null,
  searchInput: null,
  clusterSelect: null,
  subClusterSelect: null,
  categorySelect: null,
  itemsContainer: null,
  loadMoreBtn: null,
  emptyState: null,
  loadingState: null,
  errorState: null,
  searchSuggestions: null
};

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
  // Check if Supabase library is loaded
  if (typeof window.supabase === 'undefined') {
    showError('Supabase library not loaded. Please check your script tags.');
    return;
  }

  // Initialize Supabase
  if (!initSupabase()) {
    return;
  }

  // Get DOM elements
  elements.backToTrendingBtn = document.getElementById('back-to-trending-btn');
  elements.filtersSection = document.getElementById('filters-section');
  elements.createRecipient = document.getElementById('create-recipient');
  elements.createAge = document.getElementById('create-age');
  elements.createGender = document.getElementById('create-gender');
  elements.trendingLabel = document.getElementById('trending-label');
  elements.searchInput = document.getElementById('search-input');
  elements.clusterSelect = document.getElementById('cluster-select');
  elements.subClusterSelect = document.getElementById('sub-cluster-select');
  elements.categorySelect = document.getElementById('category-select');
  elements.itemsContainer = document.getElementById('items-container');
  elements.loadMoreBtn = document.getElementById('load-more-btn');
  elements.emptyState = document.getElementById('empty-state');
  elements.loadingState = document.getElementById('loading-state');
  elements.errorState = document.getElementById('error-state');
  elements.searchSuggestions = document.getElementById('search-suggestions');
  elements.clearFiltersBtn = document.getElementById('clear-filters-btn');

  // Set up event listeners
  setupEventListeners();

  // Use taxonomy from script (works with file://) or fallback to fetch (works with http/https)
  if (typeof window.GIFTED_TAXONOMY !== 'undefined') {
    state.taxonomy = window.GIFTED_TAXONOMY;
    itemsLog('info', 'Taxonomy loaded from GIFTED_TAXONOMY');
    loadRecipients();
  } else {
    itemsLog('info', 'Loading taxonomy…');
    fetch('items_database/taxonomy.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        state.taxonomy = data;
        itemsLog('info', 'Taxonomy loaded from taxonomy.json');
        loadRecipients();
      })
      .catch(function (err) {
        itemsLog('error', 'Error loading taxonomy:', err);
        state.taxonomy = { clusters: {} };
        loadRecipients();
      });
  }
});

function setupEventListeners() {
  // Search input debounce and suggestions
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', function (e) {
      var val = e.target.value;
      state.searchQuery = val.trim();

      // Show suggestions
      updateSuggestions(val);

      clearTimeout(state.searchTimeout);
      state.searchTimeout = setTimeout(function () {
        if (state.searchQuery) {
          state.isDefaultView = false;
          setFiltersVisibility();
          updateTrendingLabel();
          state.page = 0;
          state.items = [];
          loadItems();
        } else {
          // If search cleared
          if (!state.selectedRecipient) {
            goBackToTrending();
          } else {
            updateTrendingLabel();
            state.page = 0;
            state.items = [];
            loadItems();
          }
        }
      }, 300);
    });

    elements.searchInput.addEventListener('keydown', function (e) {
      if (elements.searchSuggestions.style.display === 'none') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.focusedSuggestionIndex = Math.min(state.focusedSuggestionIndex + 1, state.suggestions.length - 1);
        renderSuggestions();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.focusedSuggestionIndex = Math.max(state.focusedSuggestionIndex - 1, -1);
        renderSuggestions();
      } else if (e.key === 'Enter') {
        if (state.focusedSuggestionIndex >= 0) {
          e.preventDefault();
          selectSuggestion(state.suggestions[state.focusedSuggestionIndex]);
        }
      } else if (e.key === 'Escape') {
        closeSuggestions();
      }
    });

    // Close suggestions on blur (with delay to allow clicking)
    elements.searchInput.addEventListener('blur', function () {
      setTimeout(closeSuggestions, 200);
    });

    // Re-show suggestions on focus if input not empty
    elements.searchInput.addEventListener('focus', function () {
      if (elements.searchInput.value) {
        updateSuggestions(elements.searchInput.value);
      }
    });
  }

  // Filter selects
  if (elements.clusterSelect) {
    elements.clusterSelect.addEventListener('change', function (e) {
      state.selectedCluster = e.target.value || null;
      state.selectedSubCluster = null;
      state.selectedCategory = null;
      state.page = 0;
      state.items = [];
      updateSubClusters();
      updateCategories();
      loadItems();
    });
  }

  if (elements.subClusterSelect) {
    elements.subClusterSelect.addEventListener('change', function (e) {
      state.selectedSubCluster = e.target.value || null;
      state.selectedCategory = null;
      state.page = 0;
      state.items = [];
      updateCategories();
      loadItems();
    });
  }

  if (elements.categorySelect) {
    elements.categorySelect.addEventListener('change', function (e) {
      state.selectedCategory = e.target.value || null;
      state.page = 0;
      state.items = [];
      loadItems();
    });
  }

  // Load more button
  if (elements.loadMoreBtn) {
    elements.loadMoreBtn.addEventListener('click', function () {
      loadMoreItems();
    });
  }

  // Who filters: selecting recipient switches to search view and loads; clearing recipient clears grid
  if (elements.createRecipient) {
    elements.createRecipient.addEventListener('change', function () {
      syncWhoFromFilters();
      if (state.selectedRecipient) {
        state.isDefaultView = false;
        state.page = 0;
        state.items = [];
        updateTrendingLabel();
        setFiltersVisibility();
        loadClusters();
        hideEmptyState();
        loadItems();
      } else {
        if (state.isDefaultView) return;
        if (elements.itemsContainer) {
          elements.itemsContainer.innerHTML = '';
          elements.itemsContainer.className = '';
        }
        state.isDefaultView = true;
        updateTrendingLabel();
        setFiltersVisibility();
        loadDefaultView();
      }
    });
  }
  if (elements.createAge) {
    elements.createAge.addEventListener('change', function () {
      syncWhoFromFilters();
      if (state.selectedRecipient) {
        if (state.isDefaultView) {
          state.isDefaultView = false;
          updateTrendingLabel();
          setFiltersVisibility();
          loadClusters();
        }
        state.page = 0;
        state.items = [];
        loadItems();
      }
    });
  }
  if (elements.createGender) {
    elements.createGender.addEventListener('change', function () {
      syncWhoFromFilters();
      if (state.selectedRecipient) {
        if (state.isDefaultView) {
          state.isDefaultView = false;
          updateTrendingLabel();
          setFiltersVisibility();
          loadClusters();
        }
        state.page = 0;
        state.items = [];
        loadItems();
      }
    });
  }

  // Back to trending: return to default view
  if (elements.backToTrendingBtn) {
    elements.backToTrendingBtn.addEventListener('click', function () {
      goBackToTrending();
    });
  }

  // Clear filters button: same behavior as Back to trending (resets everything)
  if (elements.clearFiltersBtn) {
    elements.clearFiltersBtn.addEventListener('click', function () {
      goBackToTrending();
    });
  }
}

// Fixed recipient options (value sent to API; display is capitalized)
var RECIPIENT_OPTIONS = [
  { value: 'boyfriend', label: 'Boyfriend' },
  { value: 'girlfriend', label: 'Girlfriend' },
  { value: 'sister', label: 'Sister' },
  { value: 'partner', label: 'Partner' },
  { value: 'friend', label: 'Friend' },
  { value: 'mom', label: 'Mom' },
  { value: 'dad', label: 'Dad' }
];

// Load recipients from fixed list; default view = trending per recipient
function loadRecipients() {
  state.recipients = RECIPIENT_OPTIONS.map(function (r) { return r.value; });

  if (elements.createRecipient) {
    elements.createRecipient.innerHTML = '<option value="">Select recipient</option>';
    RECIPIENT_OPTIONS.forEach(function (r) {
      const option = document.createElement('option');
      option.value = r.value;
      option.textContent = r.label;
      elements.createRecipient.appendChild(option);
    });
  }

  state.isDefaultView = true;
  state.selectedRecipient = null;
  state.selectedAge = null;
  state.selectedGender = null;
  if (elements.createRecipient) elements.createRecipient.value = '';
  if (elements.createAge) elements.createAge.value = '';
  if (elements.createGender) elements.createGender.value = '';

  updateTrendingLabel();
  setFiltersVisibility();
  loadClusters();
  loadDefaultView();
}

// Update the "Trending for…" label (use display label, e.g. "Boyfriend" not "boyfriend")
function updateTrendingLabel() {
  if (!elements.trendingLabel) return;

  if (state.searchQuery) {
    elements.trendingLabel.textContent = 'Results for "' + state.searchQuery + '"';
    return;
  }

  if (state.isDefaultView || !state.selectedRecipient) {
    elements.trendingLabel.textContent = 'Trending for everyone';
    return;
  }
  var display = RECIPIENT_OPTIONS.find(function (r) { return r.value === state.selectedRecipient; });
  var name = display ? display.label : state.selectedRecipient;
  var label = 'Trending for ' + name;
  if (state.selectedAge) label += ' · ' + state.selectedAge;
  if (state.selectedGender) label += ' · ' + state.selectedGender;
  elements.trendingLabel.textContent = label;
}

// Sync state from who filters (recipient, age, gender)
function syncWhoFromFilters() {
  state.selectedRecipient = elements.createRecipient ? elements.createRecipient.value || null : null;
  state.selectedAge = elements.createAge ? elements.createAge.value || null : null;
  state.selectedGender = elements.createGender ? elements.createGender.value || null : null;
}

// Show Area and Category when Topic selected; filters always visible; sync Back to trending button
function setFiltersVisibility() {
  var areaGroup = document.getElementById('filter-group-area');
  var categoryGroup = document.getElementById('filter-group-category');
  if (elements.filtersSection) elements.filtersSection.style.display = '';
  if (areaGroup) areaGroup.style.display = state.selectedCluster ? '' : 'none';
  if (categoryGroup) categoryGroup.style.display = state.selectedCluster ? '' : 'none';
  if (elements.backToTrendingBtn) {
    elements.backToTrendingBtn.style.display = state.isDefaultView ? 'none' : '';
  }
}

// Return to default (trending) view
function goBackToTrending() {
  state.isDefaultView = true;
  state.selectedRecipient = null;
  state.selectedAge = null;
  state.selectedGender = null;
  state.selectedCluster = null;
  state.selectedSubCluster = null;
  state.selectedCategory = null;
  state.searchQuery = '';
  state.items = [];
  state.page = 0;
  if (elements.searchInput) elements.searchInput.value = '';
  if (elements.createRecipient) elements.createRecipient.value = '';
  if (elements.createAge) elements.createAge.value = '';
  if (elements.createGender) elements.createGender.value = '';
  if (elements.clusterSelect) elements.clusterSelect.value = '';
  if (elements.subClusterSelect) elements.subClusterSelect.value = '';
  if (elements.categorySelect) elements.categorySelect.value = '';
  hideError();
  hideEmptyState();
  updateTrendingLabel();
  setFiltersVisibility();
  loadClusters();
  loadDefaultView();
}

// Autocomplete logic
function updateSuggestions(val) {
  if (!val || !state.taxonomy) {
    closeSuggestions();
    return;
  }

  const query = val.toLowerCase().trim();
  if (!query) {
    closeSuggestions();
    return;
  }

  // Extract all sub-clusters from taxonomy
  const allSubClusters = [];
  if (state.taxonomy.clusters) {
    Object.values(state.taxonomy.clusters).forEach(cluster => {
      if (cluster.sub_clusters) {
        Object.values(cluster.sub_clusters).forEach(subCluster => {
          allSubClusters.push(subCluster.label);
        });
      }
    });
  }

  // Filter and sort: prefix matches first, then includes matches
  const uniqueSubClusters = [...new Set(allSubClusters)];
  const filtered = uniqueSubClusters.filter(label => label.toLowerCase().includes(query));

  state.suggestions = filtered.sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aStarts = aLower.startsWith(query);
    const bStarts = bLower.startsWith(query);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return a.localeCompare(b);
  }).slice(0, 8); // Limit to top 8 suggestions

  if (state.suggestions.length > 0) {
    state.focusedSuggestionIndex = -1;
    renderSuggestions();
  } else {
    closeSuggestions();
  }
}

function renderSuggestions() {
  if (!elements.searchSuggestions) return;

  if (state.suggestions.length === 0) {
    closeSuggestions();
    return;
  }

  elements.searchSuggestions.innerHTML = '';
  state.suggestions.forEach((suggestion, index) => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    if (index === state.focusedSuggestionIndex) {
      div.classList.add('is-focused');
    }

    // Add search icon
    const iconSpan = document.createElement('span');
    iconSpan.className = 'suggestion-item-icon';
    iconSpan.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';

    div.appendChild(iconSpan);
    div.appendChild(document.createTextNode(suggestion));

    div.addEventListener('click', () => selectSuggestion(suggestion));
    elements.searchSuggestions.appendChild(div);
  });

  elements.searchSuggestions.style.display = 'block';
}

function selectSuggestion(suggestion) {
  if (elements.searchInput) {
    elements.searchInput.value = suggestion;
    state.searchQuery = suggestion;

    // Trigger search
    state.isDefaultView = false;
    setFiltersVisibility();
    updateTrendingLabel();
    state.page = 0;
    state.items = [];
    loadItems();

    closeSuggestions();
  }
}

function closeSuggestions() {
  if (elements.searchSuggestions) {
    elements.searchSuggestions.style.display = 'none';
    state.suggestions = [];
    state.focusedSuggestionIndex = -1;
  }
}

// Fetch top N items for one recipient (for default view)
function fetchItemsForRecipient(recipient, limit) {
  if (!supabaseClient) return Promise.resolve([]);
  itemsLog('info', 'Fetching items for recipient="' + recipient + '" limit=' + limit);
  return supabaseClient
    .from('gift_scores')
    .select(`
      *,
      gift_items (
        id,
        title,
        local_title,
        url,
        image_url,
        images,
        price,
        price_amount,
        price_currency,
        category,
        description
      )
    `)
    .eq('recipient', recipient)
    .order('current_score', { ascending: false })
    .order('created_at', { ascending: false })
    .range(0, limit - 1)
    .then(function (res) {
      if (res.error) {
        itemsLog('error', 'Fetch failed for recipient="' + recipient + '"', res.error);
        return [];
      }
      var list = (res.data || []).filter(function (item) { return item.gift_items && item.gift_items.url; });
      itemsLog('info', 'Fetched ' + list.length + ' items for recipient="' + recipient + '"');
      return list;
    });
}

// Default view: load trending for each recipient, then render sections
function loadDefaultView() {
  if (!elements.itemsContainer) return;
  itemsLog('info', 'Loading default view (trending per recipient)');
  showLoading();
  state.defaultViewItems = {};
  var promises = RECIPIENT_OPTIONS.map(function (r) { return fetchItemsForRecipient(r.value, 8); });
  Promise.all(promises).then(function (results) {
    RECIPIENT_OPTIONS.forEach(function (r, i) {
      state.defaultViewItems[r.value] = results[i] || [];
    });
    var counts = RECIPIENT_OPTIONS.map(function (r) { return r.value + ': ' + (state.defaultViewItems[r.value] || []).length; }).join(', ');
    itemsLog('info', 'Default view loaded', { perRecipient: counts });
    renderDefaultView();
    hideLoading();
  }).catch(function (err) {
    itemsLog('error', 'Error loading default view:', err);
    hideLoading();
  });
}

// Open feed for a recipient (from "See all" or section click)
function openFeedForRecipient(recipientValue) {
  state.isDefaultView = false;
  state.selectedRecipient = recipientValue;
  state.selectedAge = null;
  state.selectedGender = null;
  state.selectedCluster = null;
  state.selectedSubCluster = null;
  state.selectedCategory = null;
  state.searchQuery = '';
  state.page = 0;
  state.items = [];
  if (elements.createRecipient) elements.createRecipient.value = recipientValue;
  if (elements.createAge) elements.createAge.value = '';
  if (elements.createGender) elements.createGender.value = '';
  hideError();
  updateTrendingLabel();
  setFiltersVisibility();
  loadClusters();
  loadItems();
}

// Render default view: one section per recipient with a grid of items; "See all" and clickable heading
function renderDefaultView() {
  if (!elements.itemsContainer) return;
  elements.itemsContainer.innerHTML = '';
  elements.itemsContainer.className = 'trending-sections';
  RECIPIENT_OPTIONS.forEach(function (r) {
    var items = state.defaultViewItems[r.value] || [];
    if (items.length === 0) return;
    var section = document.createElement('div');
    section.className = 'trending-section';
    var header = document.createElement('div');
    header.className = 'trending-section-header';
    var heading = document.createElement('h3');
    heading.className = 'trending-section-title';
    heading.textContent = 'Trending for ' + r.label;
    heading.setAttribute('tabindex', '0');
    heading.setAttribute('role', 'button');
    heading.addEventListener('click', function () { openFeedForRecipient(r.value); });
    heading.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFeedForRecipient(r.value);
      }
    });
    header.appendChild(heading);
    var seeAllLink = document.createElement('button');
    seeAllLink.type = 'button';
    seeAllLink.className = 'trending-section-see-all';
    seeAllLink.textContent = 'See all';
    seeAllLink.addEventListener('click', function () { openFeedForRecipient(r.value); });
    header.appendChild(seeAllLink);
    section.appendChild(header);

    var carousel = document.createElement('div');
    carousel.className = 'trending-carousel';

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'carousel-btn carousel-btn--prev';
    prevBtn.setAttribute('aria-label', 'Scroll left');
    prevBtn.innerHTML = '&#8249;';

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'carousel-btn carousel-btn--next';
    nextBtn.setAttribute('aria-label', 'Scroll right');
    nextBtn.innerHTML = '&#8250;';

    var grid = document.createElement('div');
    grid.className = 'items-grid items-grid--carousel';
    items.forEach(function (item) {
      var card = buildItemCard(item);
      if (card) grid.appendChild(card);
    });

    carousel.appendChild(prevBtn);
    carousel.appendChild(grid);
    carousel.appendChild(nextBtn);
    section.appendChild(carousel);
    elements.itemsContainer.appendChild(section);

    (function attachCarouselControls(carouselEl, gridEl, prevEl, nextEl) {
      var isDragging = false;
      var startX = 0;
      var startScrollLeft = 0;
      var lastX = 0;
      var lastTime = 0;
      var velocity = 0;
      var RAF = null;

      var updateButtons = function () {
        var maxScroll = gridEl.scrollWidth - gridEl.clientWidth;
        var left = gridEl.scrollLeft;
        prevEl.disabled = left <= 5;
        nextEl.disabled = left >= maxScroll - 5;
        prevEl.classList.toggle('is-disabled', prevEl.disabled);
        nextEl.classList.toggle('is-disabled', nextEl.disabled);
      };

      var scrollByAmount = function (direction) {
        var card = gridEl.querySelector('.item-card');
        var cardWidth = card ? card.getBoundingClientRect().width : 280;
        var gap = parseFloat(getComputedStyle(gridEl).columnGap || getComputedStyle(gridEl).gap || 16);
        // Scroll by 2 cards at a time for better UX
        var delta = (cardWidth + gap) * 2 * direction;
        gridEl.scrollBy({ left: delta, behavior: 'smooth' });
      };

      var momentumScroll = function () {
        if (Math.abs(velocity) < 0.2 || isDragging) {
          if (!isDragging) {
            gridEl.classList.remove('is-dragging');
            gridEl.style.scrollSnapType = ''; // Restore snap
            updateButtons();
          }
          return;
        }
        gridEl.scrollLeft -= velocity;
        velocity *= 0.95; // Friction
        RAF = requestAnimationFrame(momentumScroll);
      };

      prevEl.addEventListener('click', function () {
        cancelAnimationFrame(RAF);
        scrollByAmount(-1);
      });
      nextEl.addEventListener('click', function () {
        cancelAnimationFrame(RAF);
        scrollByAmount(1);
      });

      gridEl.addEventListener('scroll', function () {
        if (!isDragging && !RAF) {
          window.requestAnimationFrame(updateButtons);
        }
      }, { passive: true });

      var onPointerDown = function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        isDragging = true;
        startX = e.clientX;
        lastX = e.clientX;
        startScrollLeft = gridEl.scrollLeft;
        lastTime = performance.now();
        velocity = 0;

        cancelAnimationFrame(RAF);
        RAF = null;

        gridEl.classList.add('is-dragging');
        gridEl.style.scrollSnapType = 'none'; // Disable snap during drag
        gridEl.style.scrollBehavior = 'auto'; // Disable smooth scroll during drag

        try { gridEl.setPointerCapture(e.pointerId); } catch (err) { }
      };

      var onPointerMove = function (e) {
        if (!isDragging) return;
        var now = performance.now();
        var dt = now - lastTime;
        if (dt > 0) {
          var dx = e.clientX - lastX;
          // Calculate velocity (pixels per frame roughly)
          // We use a weighted average for smoother momentum
          velocity = (dx * 0.8) + (velocity * 0.2);
          lastX = e.clientX;
          lastTime = now;
        }
        var delta = e.clientX - startX;
        gridEl.scrollLeft = startScrollLeft - delta;
      };

      var onPointerUp = function (e) {
        if (!isDragging) return;
        isDragging = false;

        // Restore scroll behavior
        gridEl.style.scrollBehavior = '';

        // Prevent click if we moved more than 10px
        var totalDelta = Math.abs(e.clientX - startX);
        if (totalDelta > 10) {
          gridEl.classList.add('prevent-click');
          // Short timeout to allow click event to be swallowed
          setTimeout(function () {
            gridEl.classList.remove('prevent-click');
          }, 50);
        }

        // Apply momentum if velocity is significant
        if (Math.abs(velocity) > 2) {
          RAF = requestAnimationFrame(momentumScroll);
        } else {
          gridEl.classList.remove('is-dragging');
          gridEl.style.scrollSnapType = ''; // Restore snap
          updateButtons();
        }
      };

      gridEl.addEventListener('pointerdown', onPointerDown);
      gridEl.addEventListener('pointermove', onPointerMove);
      gridEl.addEventListener('pointerup', onPointerUp);
      gridEl.addEventListener('pointerleave', onPointerUp);
      gridEl.addEventListener('pointercancel', onPointerUp);

      updateButtons();
    })(carousel, grid, prevBtn, nextBtn);
  });
  if (elements.loadMoreBtn) elements.loadMoreBtn.style.display = 'none';
}

// Open modal for a specific item
function openModal(item, list, index) {
  state.currentItemsList = list;
  state.currentModalIndex = index;
  updateModalContent(item);

  const modal = document.getElementById('product-modal');
  modal.style.display = 'flex';
  // Force reflow
  modal.offsetHeight;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

// Close modal
function closeModal() {
  const modal = document.getElementById('product-modal');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
}

// Update modal content
function updateModalContent(item) {
  const giftItem = item.gift_items;
  if (!giftItem) return;

  const imageUrl = giftItem.image_url || (giftItem.images && giftItem.images[0]);
  const title = giftItem.local_title || giftItem.title;
  const description = giftItem.description || '';
  const category = item.category || item.sub_cluster || item.cluster || '';

  let priceText = '';
  if (giftItem.price) {
    priceText = giftItem.price;
  } else if (giftItem.price_amount && giftItem.price_currency) {
    priceText = new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: giftItem.price_currency
    }).format(giftItem.price_amount);
  }

  document.getElementById('modal-image').src = imageUrl || '';
  document.getElementById('modal-category').textContent = category;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-price').textContent = priceText;
  document.getElementById('modal-description').textContent = description;
  document.getElementById('modal-shop-btn').href = giftItem.url;
}

// Show next item in modal
function showNextItem() {
  if (state.currentModalIndex < state.currentItemsList.length - 1) {
    state.currentModalIndex++;
    updateModalContent(state.currentItemsList[state.currentModalIndex]);
  }
}

// Show previous item in modal
function showPrevItem() {
  if (state.currentModalIndex > 0) {
    state.currentModalIndex--;
    updateModalContent(state.currentItemsList[state.currentModalIndex]);
  }
}

// Build one item card DOM element (shared by default view and search view)
function buildItemCard(item) {
  var giftItem = item.gift_items;
  if (!giftItem) return null;
  var imageUrl = giftItem.image_url;
  if (!imageUrl && giftItem.images && Array.isArray(giftItem.images) && giftItem.images.length > 0) {
    imageUrl = giftItem.images[0];
  }
  if (!imageUrl) {
    imageUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23E6E8EF" width="200" height="200"/%3E%3Ctext fill="%23707487" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
  }
  var title = giftItem.local_title || giftItem.title || 'Untitled Item';
  var priceText = '';
  if (giftItem.price) {
    priceText = giftItem.price;
  } else if (giftItem.price_amount && giftItem.price_currency) {
    priceText = new Intl.NumberFormat('en-CA', { style: 'currency', currency: giftItem.price_currency || 'CAD' }).format(giftItem.price_amount);
  }
  var categoryLabel = item.category || item.sub_cluster || item.cluster || '';
  var card = document.createElement('div');
  card.className = 'item-card item-card--animate';
  card.innerHTML = '<a class="item-image" href="' + escapeHtml(giftItem.url) + '" target="_blank" rel="noopener"><img src="' + imageUrl + '" alt="' + escapeHtml(title) + '" loading="lazy"></a><div class="item-content"><h3 class="item-title">' + escapeHtml(title) + '</h3>' + (categoryLabel ? '<p class="item-category">' + escapeHtml(categoryLabel) + '</p>' : '') + (priceText ? '<p class="item-price">' + escapeHtml(priceText) + '</p>' : '') + '<a href="' + escapeHtml(giftItem.url) + '" target="_blank" rel="noopener" class="item-shop-btn">Shop</a></div>';

  // click to open modal
  card.addEventListener('click', function (e) {
    // If the grid is in prevent-click mode (just finished a drag), ignore
    if (card.closest('.items-grid').classList.contains('prevent-click')) {
      return;
    }
    // Clicking the image or shop link should go to the product URL, not the preview modal
    if (e.target.closest('a')) {
      return;
    }

    // Determine which list this item belongs to
    // If in default view, we need to find the recipient list
    let list = state.items; // default for search view
    let index = -1;

    if (state.isDefaultView) {
      // Find the recipient this item looks like it belongs to.
      // Since item objects are distinct, we can search by ID in all lists
      const recipients = Object.keys(state.defaultViewItems);
      for (let r of recipients) {
        const foundIndex = state.defaultViewItems[r].indexOf(item);
        if (foundIndex !== -1) {
          list = state.defaultViewItems[r];
          index = foundIndex;
          break;
        }
      }
    } else {
      index = state.items.indexOf(item);
    }

    if (index !== -1) {
      openModal(item, list, index);
    }
  });

  return card;
}

// Initialize Modal Events
document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('product-modal');
  if (!modal) return;

  const closeBtn = modal.querySelector('.modal-close-btn');
  const prevBtn = modal.querySelector('.modal-prev-btn');
  const nextBtn = modal.querySelector('.modal-next-btn');
  const overlay = modal.querySelector('.modal-overlay');

  function handleClose() { closeModal(); }

  closeBtn.addEventListener('click', handleClose);
  overlay.addEventListener('click', handleClose);

  // Keyboard nav
  document.addEventListener('keydown', function (e) {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') handleClose();
    if (e.key === 'ArrowLeft') showPrevItem();
    if (e.key === 'ArrowRight') showNextItem();
  });

  // Arrow buttons
  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); showPrevItem(); });
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); showNextItem(); });

  // Swipe support for mobile
  let touchStartX = 0;
  let touchEndX = 0;

  modal.addEventListener('touchstart', function (e) {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  modal.addEventListener('touchend', function (e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const swipeThreshold = 50;
    if (touchEndX < touchStartX - swipeThreshold) {
      showNextItem(); // Swipe Left -> Next
    }
    if (touchEndX > touchStartX + swipeThreshold) {
      showPrevItem(); // Swipe Right -> Prev
    }
  }
});


// Load Topic (cluster) options from taxonomy
function loadClusters() {
  if (!state.taxonomy || !state.taxonomy.clusters) {
    state.clusters = [];
    renderClusterSelect();
    setFiltersVisibility();
    return;
  }
  state.clusters = Object.keys(state.taxonomy.clusters).map(function (key) {
    const c = state.taxonomy.clusters[key];
    return { key: key, label: (c && c.label) ? c.label : key.replace(/_/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); }) };
  }).sort(function (a, b) { return a.label.localeCompare(b.label); });
  renderClusterSelect();
  setFiltersVisibility();
}

// Render Topic select from taxonomy
function renderClusterSelect() {
  if (!elements.clusterSelect) return;

  elements.clusterSelect.innerHTML = '<option value="">All Topics</option>';
  state.clusters.forEach(function (c) {
    const option = document.createElement('option');
    option.value = c.key;
    option.textContent = c.label;
    elements.clusterSelect.appendChild(option);
  });
}

// Update Area (sub_cluster) options from taxonomy based on selected Topic
function updateSubClusters() {
  if (!state.selectedCluster || !state.taxonomy || !state.taxonomy.clusters[state.selectedCluster]) {
    state.subClusters = [];
    renderSubClusterSelect();
    setFiltersVisibility();
    return;
  }
  const subClustersObj = state.taxonomy.clusters[state.selectedCluster].sub_clusters;
  if (!subClustersObj) {
    state.subClusters = [];
    renderSubClusterSelect();
    setFiltersVisibility();
    return;
  }
  state.subClusters = Object.keys(subClustersObj).map(function (key) {
    const s = subClustersObj[key];
    return { key: key, label: (s && s.label) ? s.label : key.replace(/_/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); }) };
  }).sort(function (a, b) { return a.label.localeCompare(b.label); });
  renderSubClusterSelect();
  setFiltersVisibility();
}

// Render Area select from taxonomy
function renderSubClusterSelect() {
  if (!elements.subClusterSelect) return;

  elements.subClusterSelect.innerHTML = '<option value="">All Areas</option>';
  state.subClusters.forEach(function (s) {
    const option = document.createElement('option');
    option.value = s.key;
    option.textContent = s.label;
    elements.subClusterSelect.appendChild(option);
  });
}

// Update Category options from taxonomy based on selected Topic and Area
function updateCategories() {
  if (!state.selectedCluster || !state.taxonomy || !state.taxonomy.clusters[state.selectedCluster]) {
    state.categories = [];
    renderCategorySelect();
    return;
  }
  const subClustersObj = state.taxonomy.clusters[state.selectedCluster].sub_clusters;
  if (!subClustersObj) {
    state.categories = [];
    renderCategorySelect();
    return;
  }
  var list = [];
  if (state.selectedSubCluster && subClustersObj[state.selectedSubCluster] && subClustersObj[state.selectedSubCluster].categories) {
    list = subClustersObj[state.selectedSubCluster].categories.slice();
  } else {
    Object.keys(subClustersObj).forEach(function (key) {
      const cats = subClustersObj[key].categories;
      if (Array.isArray(cats)) cats.forEach(function (c) { if (list.indexOf(c) === -1) list.push(c); });
    });
  }
  list.sort(function (a, b) { return a.localeCompare(b); });
  state.categories = list;
  renderCategorySelect();
  setFiltersVisibility();
}

// Render Category select from taxonomy
function renderCategorySelect() {
  if (!elements.categorySelect) return;

  elements.categorySelect.innerHTML = '<option value="">All Categories</option>';
  state.categories.forEach(function (cat) {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat.replace(/_/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); });
    elements.categorySelect.appendChild(option);
  });
}

// Load items with filters (search view only)
async function loadItems() {
  if ((state.isDefaultView && !state.searchQuery) || (!state.selectedRecipient && !state.searchQuery)) {
    // If default view and no search, OR no recipient and no search: do nothing (stay in default view or empty)
    // Actually, if !selectedRecipient and !state.isDefaultView and !searchQuery -> this is an odd state, likely transition.
    // But relying on goBackToTrending for the clear case.
    if (state.isDefaultView) {
      hideLoading();
      return;
    }
    // If not default view but no recipient and no search, we might want to load global allowed items? 
    // For now proceed if query exists or recipient exists.
    if (!state.selectedRecipient && !state.searchQuery) {
      hideLoading();
      return;
    }
  }

  try {
    var startPage = state.page;
    var startIndex = startPage * PAGE_SIZE;
    state.loading = true;
    showLoading();
    hideError();
    hideEmptyState();

    var startMs = Date.now();
    itemsLog('info', 'Loading items', {
      recipient: state.selectedRecipient,
      page: startPage,
      startIndex: startIndex,
      cluster: state.selectedCluster || null,
      subCluster: state.selectedSubCluster || null,
      category: state.selectedCategory || null,
      searchQuery: state.searchQuery || null
    });

    // Build query
    let query = supabaseClient
      .from('gift_scores')
      .select(`
        *,
        gift_items (
          id,
          title,
          local_title,
          url,
          image_url,
          images,
          price,
          price_amount,
          price_currency,
          category,
          description
        )
      `)
      .order('current_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(startIndex, startIndex + PAGE_SIZE - 1);

    // Apply recipient filter if selected
    if (state.selectedRecipient) {
      query = query.eq('recipient', state.selectedRecipient);
    }

    // Apply filters
    if (state.selectedCluster) {
      query = query.eq('cluster', state.selectedCluster);
    }
    if (state.selectedSubCluster) {
      query = query.eq('sub_cluster', state.selectedSubCluster);
    }
    if (state.selectedCategory) {
      query = query.eq('category', state.selectedCategory);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter by search query if present
    let filteredData = Array.isArray(data) ? data : [];
    if (state.searchQuery) {
      const searchLower = state.searchQuery.toLowerCase();
      filteredData = filteredData.filter(function (item) {
        const giftItem = item.gift_items;
        if (!giftItem) return false;

        const title = (giftItem.local_title || giftItem.title || '').toLowerCase();
        const description = (giftItem.description || '').toLowerCase();

        return title.includes(searchLower) || description.includes(searchLower);
      });
    }

    // Filter out items without gift_items
    filteredData = filteredData.filter(function (item) {
      return item.gift_items && item.gift_items.url;
    });

    if (startPage === 0) {
      state.items = filteredData;
    } else {
      state.items = state.items.concat(filteredData);
    }

    // Determine hasMore based on raw data length
    var rawCount = Array.isArray(data) ? data.length : 0;
    state.hasMore = rawCount === PAGE_SIZE;
    state.page = startPage + 1;

    renderItems(startPage === 0);

    if (state.items.length === 0) {
      showEmptyState();
    }

    itemsLog('info', 'Loaded ' + filteredData.length + ' items (next page=' + state.page + ', hasMore=' + state.hasMore + ')', {
      count: filteredData.length,
      page: state.page,
      hasMore: state.hasMore,
      durationMs: Date.now() - startMs
    });
    hideLoading();
  } catch (error) {
    itemsLog('error', 'Error loading items:', error);
    showError('Unable to load items. Please try again.');
    hideLoading();
  } finally {
    state.loading = false;
    updateLoadMoreButton();
  }
}

// Load more items
function loadMoreItems() {
  if (state.loading || !state.hasMore) return;
  itemsLog('debug', 'Load more requested (next page=' + state.page + ')');
  loadItems();
}

// Render items grid (search view: single grid with load more)
function renderItems(isFirstLoad) {
  if (!elements.itemsContainer) return;

  var itemsToRender = isFirstLoad ? state.items : state.items.slice(-PAGE_SIZE);
  var grid;

  if (isFirstLoad) {
    elements.itemsContainer.innerHTML = '';
    elements.itemsContainer.className = 'items-container-single';
    grid = document.createElement('div');
    grid.className = 'items-grid';
    elements.itemsContainer.appendChild(grid);
  } else {
    grid = elements.itemsContainer.querySelector('.items-grid');
  }

  if (!grid) return;
  itemsToRender.forEach(function (item) {
    var card = buildItemCard(item);
    if (card) grid.appendChild(card);
  });
}

// Update load more button
function updateLoadMoreButton() {
  if (!elements.loadMoreBtn) return;

  if (state.hasMore && state.items.length > 0) {
    elements.loadMoreBtn.style.display = 'block';
    elements.loadMoreBtn.disabled = state.loading;
    elements.loadMoreBtn.textContent = state.loading ? 'Loading...' : 'Load more';
  } else {
    elements.loadMoreBtn.style.display = 'none';
  }
}

// Utility: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Skeleton card HTML for grid loading animation
function getSkeletonCardHtml() {
  return '<div class="item-card item-card--skeleton" aria-hidden="true">' +
    '<div class="item-image"></div>' +
    '<div class="item-content">' +
    '<div class="skeleton-line"></div>' +
    '<div class="skeleton-line"></div>' +
    '<div class="skeleton-line"></div>' +
    '<span class="skeleton-btn"></span>' +
    '</div></div>';
}

// Show/hide loading state — skeleton grid in items container
function showLoading() {
  if (elements.itemsContainer && (state.isDefaultView || state.page === 0)) {
    elements.itemsContainer.innerHTML = '';
    elements.itemsContainer.className = 'items-container-single';
    var grid = document.createElement('div');
    grid.className = 'items-grid items-grid--loading';
    var n = 8;
    for (var i = 0; i < n; i++) {
      grid.insertAdjacentHTML('beforeend', getSkeletonCardHtml());
    }
    elements.itemsContainer.appendChild(grid);
  }
}

function hideLoading() {
  if (elements.loadingState) {
    elements.loadingState.style.display = 'none';
  }
}

// Show/hide empty state
function showEmptyState() {
  if (elements.emptyState) {
    elements.emptyState.style.display = 'block';
  }
}

function hideEmptyState() {
  if (elements.emptyState) {
    elements.emptyState.style.display = 'none';
  }
}

// Show/hide error state
function showError(message) {
  if (elements.errorState) {
    elements.errorState.textContent = message || 'An error occurred. Please try again.';
    elements.errorState.style.display = 'block';
  }
}

function hideError() {
  if (elements.errorState) {
    elements.errorState.style.display = 'none';
  }
}
