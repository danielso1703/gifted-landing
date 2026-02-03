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
  searchTimeout: null
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
  errorState: null
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
  // Search input debounce
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', function (e) {
      clearTimeout(state.searchTimeout);
      state.searchQuery = e.target.value.trim();
      state.searchTimeout = setTimeout(function () {
        state.page = 0;
        state.items = [];
        loadItems();
      }, 300);
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
    var grid = document.createElement('div');
    grid.className = 'items-grid';
    items.forEach(function (item) {
      var card = buildItemCard(item);
      if (card) grid.appendChild(card);
    });
    section.appendChild(grid);
    elements.itemsContainer.appendChild(section);
  });
  if (elements.loadMoreBtn) elements.loadMoreBtn.style.display = 'none';
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
  card.className = 'item-card';
  card.innerHTML = '<div class="item-image"><img src="' + imageUrl + '" alt="' + escapeHtml(title) + '" loading="lazy"></div><div class="item-content"><h3 class="item-title">' + escapeHtml(title) + '</h3>' + (categoryLabel ? '<p class="item-category">' + escapeHtml(categoryLabel) + '</p>' : '') + (priceText ? '<p class="item-price">' + escapeHtml(priceText) + '</p>' : '') + '<a href="' + escapeHtml(giftItem.url) + '" target="_blank" rel="noopener" class="item-shop-btn">Shop</a></div>';
  return card;
}

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
  if (state.isDefaultView || !state.selectedRecipient) {
    hideLoading();
    return;
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
      .eq('recipient', state.selectedRecipient)
      .order('current_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(startIndex, startIndex + PAGE_SIZE - 1);

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
