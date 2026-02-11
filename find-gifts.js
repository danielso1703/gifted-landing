// Try it out page - Supabase-powered gift browsing

// Items logging: namespaced [Items] prefix, level controls debug visibility
var ITEMS_LOG_LEVEL = 'debug'; // 'debug' | 'info' | 'warn' | 'error'
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

const PAGE_SIZE = 100; // Increased to support client-side filtering

// All available providers
var ALL_PROVIDERS = ['ebay', 'etsy'];

function allProvidersSelected() {
  if (!state.selectedProviders || state.selectedProviders.length === 0) return true;
  return ALL_PROVIDERS.every(function (p) { return state.selectedProviders.indexOf(p) !== -1; });
}

// State management
const state = {
  taxonomy: null,
  isDefaultView: true,
  defaultViewItems: {},
  recipients: [],
  selectedRecipient: null,
  selectedAge: null,
  selectedGender: null,
  selectedProviders: ['ebay', 'etsy'],
  clusters: [],
  selectedCluster: null,
  subClusters: [],
  selectedSubCluster: null,
  categories: [],
  selectedCategory: null,
  searchQuery: '',
  priceMin: null,
  priceMax: null,
  items: [],
  loading: false,
  page: 0,
  hasMore: true,
  searchTimeout: null,
  currentModalIndex: -1,
  currentItemsList: [],
  suggestions: [],
  focusedSuggestionIndex: -1,
  currentImageIndex: 0,
  hubConfig: null,
  queryConfig: null,
  hubApplied: false,
  queryApplied: false,
  hubFallbackUsed: false
};

// DOM elements
const elements = {
  backToTrendingBtn: null,
  filtersSection: null,
  createRecipient: null,
  createAge: null,
  createGender: null,
  providerFilters: null,
  priceSelect: null,
  customPriceContainer: null,
  customPriceMin: null,
  customPriceMax: null,
  customPriceApply: null,
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
  searchSuggestions: null,
  moreFiltersBtn: null
};

// Derive provider/marketplace from item URL
function getProvider(url) {
  if (!url) return 'unknown';
  if (/ebay\.(com|ca|co\.uk)/i.test(url)) return 'ebay';
  if (/etsy\.com/i.test(url)) return 'etsy';
  return 'other';
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  var num = Number(value);
  var num = Number(value);
  return isNaN(num) ? null : num;
}

function normalizePrice(priceVal) {
  if (priceVal === undefined || priceVal === null) return null;
  // If already a number
  if (typeof priceVal === 'number') return priceVal;

  // If string, strip non-numeric except dot
  // e.g. "USD 25.00" -> "25.00"
  // e.g. "$30" -> "30"
  var s = String(priceVal);
  var matches = s.match(/[0-9]+(\.[0-9]+)?/);
  if (matches && matches[0]) {
    return parseFloat(matches[0]);
  }
  return null;
}

function readHubConfig() {
  var body = document.body;
  if (!body || !body.dataset) return null;
  var dataset = body.dataset;
  var hasConfig = dataset.hub === 'true' || dataset.hub === '1' || dataset.hubRecipient || dataset.hubSearch ||
    dataset.hubCluster || dataset.hubSubCluster || dataset.hubCategory || dataset.hubPriceMin || dataset.hubPriceMax ||
    dataset.hubFallback;
  if (!hasConfig) return null;

  return {
    recipient: dataset.hubRecipient || null,
    search: dataset.hubSearch || null,
    cluster: dataset.hubCluster || null,
    subCluster: dataset.hubSubCluster || null,
    category: dataset.hubCategory || null,
    priceMin: parseNumber(dataset.hubPriceMin),
    priceMax: parseNumber(dataset.hubPriceMax),
    fallback: dataset.hubFallback || null
  };
}

function readQueryConfig() {
  if (!window.location || !window.location.search) return null;
  var params = new URLSearchParams(window.location.search);
  if (!params || params.toString() === '') return null;

  var recipient = params.get('recipient') || null;
  var search = params.get('q') || params.get('search') || null;
  var cluster = params.get('cluster') || params.get('topic') || null;
  var subCluster = params.get('sub_cluster') || params.get('subcluster') || params.get('area') || null;
  var category = params.get('category') || null;
  var provider = params.get('provider') ? params.get('provider').split(',').filter(Boolean) : [];
  var budget = params.get('budget') || null;
  var priceMin = parseNumber(params.get('price_min') || params.get('min') || params.get('priceMin') || params.get('minPrice'));
  var priceMax = parseNumber(params.get('price_max') || params.get('max') || params.get('priceMax') || params.get('maxPrice'));

  var budgetMap = {
    'under-25': { max: 25 },
    'under-50': { max: 50 },
    '25-50': { min: 25, max: 50 },
    '50-100': { min: 50, max: 100 },
    'over-100': { min: 100 }
  };

  if (budget && budgetMap[budget]) {
    var mapped = budgetMap[budget];
    if (priceMin === null && typeof mapped.min === 'number') priceMin = mapped.min;
    if (priceMax === null && typeof mapped.max === 'number') priceMax = mapped.max;
  }

  var hasConfig = !!(
    recipient ||
    search ||
    cluster ||
    subCluster ||
    category ||
    provider ||
    priceMin !== null ||
    priceMax !== null
  );

  if (!hasConfig) return null;

  return {
    recipient: recipient,
    search: search,
    cluster: cluster,
    subCluster: subCluster,
    category: category,
    provider: provider,
    priceMin: priceMin,
    priceMax: priceMax
  };
}

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
  // Get DOM elements
  elements.backToTrendingBtn = document.getElementById('back-to-trending-btn');
  elements.filtersSection = document.getElementById('filters-section');
  elements.createRecipient = document.getElementById('create-recipient');
  elements.createAge = document.getElementById('create-age');
  elements.createGender = document.getElementById('create-gender');
  elements.priceSelect = document.getElementById('price-select');
  elements.customPriceContainer = document.getElementById('custom-price-container');
  elements.customPriceMin = document.getElementById('custom-price-min');
  elements.customPriceMax = document.getElementById('custom-price-max');
  elements.customPriceApply = document.getElementById('custom-price-apply');
  elements.dynamicSubtitle = document.getElementById('dynamic-subtitle');
  elements.searchInput = document.getElementById('search-input');
  elements.providerTrigger = document.getElementById('provider-trigger');
  elements.providerMenu = document.getElementById('provider-menu');
  elements.providerCheckboxes = document.querySelectorAll('.provider-check');
  elements.clusterSelect = document.getElementById('cluster-select');
  elements.subClusterSelect = document.getElementById('sub-cluster-select');
  elements.categorySelect = document.getElementById('category-select');
  elements.itemsContainer = document.getElementById('items-container');
  elements.loadMoreBtn = document.getElementById('load-more-btn');
  elements.emptyState = document.getElementById('empty-state');
  elements.loadingState = document.getElementById('loading-state');
  elements.errorState = document.getElementById('error-state');
  elements.customPriceClose = document.getElementById('custom-price-close');
  elements.searchSuggestions = document.getElementById('search-suggestions');
  elements.clearFiltersBtn = document.getElementById('clear-filters-btn');
  elements.moreFiltersBtn = document.getElementById('more-filters-btn');
  elements.clearSearchBtn = document.getElementById('clear-search-btn');

  state.hubConfig = readHubConfig();
  state.queryConfig = readQueryConfig();

  // Check if Supabase library is loaded
  if (typeof window.supabase === 'undefined') {
    showError('Supabase library not loaded. Please check your script tags.');
    return;
  }

  // Initialize Supabase
  if (!initSupabase()) {
    return;
  }

  // Set up event listeners
  setupEventListeners();

  // Use taxonomy from script (works with file://) or fallback to fetch (works with http/https)
  if (typeof window.TOP_NOTCH_GIFTS_TAXONOMY !== 'undefined') {
    state.taxonomy = window.TOP_NOTCH_GIFTS_TAXONOMY;
    itemsLog('info', 'Taxonomy loaded from TOP_NOTCH_GIFTS_TAXONOMY');
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

      // Show/Hide Clear X
      if (elements.clearSearchBtn) {
        elements.clearSearchBtn.style.display = val.length > 0 ? 'flex' : 'none';
      }

      state.searchQuery = val.trim();
      setFiltersVisibility(); // Update clear button visibility immediately

      // Show suggestions
      updateSuggestions(val);

      clearTimeout(state.searchTimeout);
      state.searchTimeout = setTimeout(function () {
        // If search is just text typing, maybe we don't auto-reload everything immediately?
        // Current logic: auto-reload on debounce
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
      }, 500); // Increased debounce slightly
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

  // Clear Search Button
  if (elements.clearSearchBtn) {
    elements.clearSearchBtn.addEventListener('click', function () {
      if (elements.searchInput) {
        elements.searchInput.value = '';
        elements.searchInput.focus();
        // Trigger input event manually
        var event = new Event('input', { bubbles: true });
        elements.searchInput.dispatchEvent(event);
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

      // Trigger search automatically on drop change? Yes per existing logic
      if (hasActiveFilters()) {
        state.isDefaultView = false;
        setFiltersVisibility();
        updateTrendingLabel();
        loadItems();
      } else {
        goBackToTrending();
      }
    });
  }

  if (elements.subClusterSelect) {
    elements.subClusterSelect.addEventListener('change', function (e) {
      state.selectedSubCluster = e.target.value || null;
      state.selectedCategory = null;
      state.page = 0;
      state.items = [];
      updateCategories();

      if (hasActiveFilters()) {
        state.isDefaultView = false;
        setFiltersVisibility();
        updateTrendingLabel();
        loadItems();
      } else {
        goBackToTrending();
      }
    });
  }

  if (elements.categorySelect) {
    elements.categorySelect.addEventListener('change', function (e) {
      state.selectedCategory = e.target.value || null;
      state.page = 0;
      state.items = [];

      if (hasActiveFilters()) {
        state.isDefaultView = false;
        setFiltersVisibility();
        updateTrendingLabel();
        loadItems();
      } else {
        goBackToTrending();
      }
    });
  }

  // Load more button
  if (elements.loadMoreBtn) {
    elements.loadMoreBtn.addEventListener('click', function () {
      loadMoreItems();
    });
  }

  // Who filters
  if (elements.createRecipient) {
    elements.createRecipient.addEventListener('change', function () {
      syncWhoFromFilters();
      if (hasActiveFilters()) {
        state.isDefaultView = false;
        state.page = 0;
        state.items = [];
        updateTrendingLabel();
        setFiltersVisibility();
        loadClusters();
        hideEmptyState();
        loadItems();
      } else {
        goBackToTrending();
      }
    });
  }
  if (elements.createAge) {
    elements.createAge.addEventListener('change', function () {
      syncWhoFromFilters();
      if (hasActiveFilters()) {
        state.isDefaultView = false;
        state.page = 0;
        state.items = [];
        updateTrendingLabel();
        setFiltersVisibility();
        loadClusters();
        hideEmptyState();
        loadItems();
      } else {
        goBackToTrending();
      }
    });
  }
  if (elements.createGender) {
    elements.createGender.addEventListener('change', function () {
      syncWhoFromFilters();
      if (hasActiveFilters()) {
        state.isDefaultView = false;
        state.page = 0;
        state.items = [];
        updateTrendingLabel();
        setFiltersVisibility();
        loadClusters();
        hideEmptyState();
        loadItems();
      } else {
        goBackToTrending();
      }
    });
  }

  // Provider Dropdown Logic
  if (elements.providerTrigger && elements.providerMenu) {
    // Toggle menu
    elements.providerTrigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var isHidden = elements.providerMenu.hidden;
      elements.providerMenu.hidden = !isHidden;
      elements.providerTrigger.setAttribute('aria-expanded', !isHidden);
    });

    // Close on click outside
    document.addEventListener('click', function (e) {
      if (!elements.providerTrigger.contains(e.target) && !elements.providerMenu.contains(e.target)) {
        elements.providerMenu.hidden = true;
        elements.providerTrigger.setAttribute('aria-expanded', 'false');
      }
    });

    // Stop propagation on menu click
    elements.providerMenu.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  // Select All Logic
  var selectAllBtn = document.getElementById('provider-select-all');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      state.selectedProviders = ALL_PROVIDERS.slice();
      if (elements.providerCheckboxes) {
        elements.providerCheckboxes.forEach(function (cb) { cb.checked = true; });
      }
      updateProviderTriggerText();

      elements.providerMenu.hidden = true;
      elements.providerTrigger.setAttribute('aria-expanded', 'false');

      // Reload items but keep secondary filters visible
      state.page = 0;
      state.items = [];
      updateTrendingLabel();
      setFiltersVisibility();
      loadClusters();
      hideEmptyState();
      if (hasActiveFilters()) {
        state.isDefaultView = false;
        loadItems();
      } else {
        state.isDefaultView = true;
        loadDefaultView();
      }
    });
  }

  // Provider Checkboxes Logic
  if (elements.providerCheckboxes) {
    elements.providerCheckboxes.forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        var val = checkbox.value;
        if (checkbox.checked) {
          if (state.selectedProviders.indexOf(val) === -1) {
            state.selectedProviders.push(val);
          }
        } else {
          // Prevent unchecking if it's the last one — min 1 must stay selected
          if (state.selectedProviders.length <= 1) {
            checkbox.checked = true; // Revert
            return;
          }

          var idx = state.selectedProviders.indexOf(val);
          if (idx !== -1) {
            state.selectedProviders.splice(idx, 1);
          }
        }

        updateProviderTriggerText();

        if (hasActiveFilters()) {
          state.isDefaultView = false;
          state.page = 0;
          state.items = [];
          updateTrendingLabel();
          setFiltersVisibility();
          loadClusters();
          hideEmptyState();
          loadItems();
        } else {
          // Reload without collapsing secondary filters
          state.isDefaultView = true;
          state.page = 0;
          state.items = [];
          updateTrendingLabel();
          setFiltersVisibility();
          loadClusters();
          hideEmptyState();
          loadDefaultView();
        }
      });
    });
  }

  if (elements.priceSelect) {
    elements.priceSelect.addEventListener('change', function (e) {
      var val = e.target.value;

      // Handle Custom Option visibility
      if (val === 'custom') {
        if (elements.customPriceContainer) {
          elements.priceSelect.style.display = 'none'; // Hide select
          elements.customPriceContainer.style.display = 'flex'; // Show custom
          // Focus min input
          if (elements.customPriceMin) elements.customPriceMin.focus();
        }
        // Do NOT trigger load until user clicks search
        return;
      }

      if (!val) {
        state.priceMin = null;
        state.priceMax = null;
      } else if (val.indexOf('+') !== -1) {
        // e.g. "200+"
        state.priceMin = parseInt(val.replace('+', ''), 10);
        state.priceMax = null;
      } else {
        // e.g. "25-50"
        var parts = val.split('-');
        if (parts.length === 2) {
          state.priceMin = parseInt(parts[0], 10);
          state.priceMax = parseInt(parts[1], 10);
        }
      }

      if (hasActiveFilters()) {
        state.isDefaultView = false;
        state.page = 0;
        state.items = [];
        updateTrendingLabel();
        setFiltersVisibility();
        loadClusters();
        hideEmptyState();
        loadItems();
      } else {
        goBackToTrending();
      }
    });
  }

  // Custom Price Close (X) Button
  if (elements.customPriceClose) {
    elements.customPriceClose.addEventListener('click', function () {
      // Hide custom, show select
      if (elements.customPriceContainer) elements.customPriceContainer.style.display = 'none';
      if (elements.priceSelect) {
        elements.priceSelect.style.display = '';
        elements.priceSelect.value = ''; // Reset to "Any price"

        // Trigger change to update state
        var event = new Event('change');
        elements.priceSelect.dispatchEvent(event);
      }
    });
  }

  // Main Search Button Logic
  var mainSearchBtn = document.getElementById('main-search-btn');
  if (mainSearchBtn) {
    mainSearchBtn.addEventListener('click', function () {
      performSearch();
    });
  }

  // Enter key on inputs triggers search
  function handleEnter(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch();
    }
  }

  if (elements.customPriceMin) elements.customPriceMin.addEventListener('keydown', handleEnter);
  if (elements.customPriceMax) elements.customPriceMax.addEventListener('keydown', handleEnter);

  // Perform Search Logic
  function performSearch() {
    // 1. Update Custom Price State if visible
    if (elements.customPriceContainer && elements.customPriceContainer.style.display !== 'none') {
      var minVal = elements.customPriceMin ? parseInt(elements.customPriceMin.value, 10) : NaN;
      var maxVal = elements.customPriceMax ? parseInt(elements.customPriceMax.value, 10) : NaN;

      state.priceMin = !isNaN(minVal) && minVal >= 0 ? minVal : null;
      state.priceMax = !isNaN(maxVal) && maxVal >= 0 ? maxVal : null;

      // Swap if min > max
      if (state.priceMin !== null && state.priceMax !== null && state.priceMin > state.priceMax) {
        var temp = state.priceMin;
        state.priceMin = state.priceMax;
        state.priceMax = temp;
        elements.customPriceMin.value = state.priceMin;
        elements.customPriceMax.value = state.priceMax;
      }
    }

    // 2. Trigger Load
    if (hasActiveFilters()) {
      state.isDefaultView = false;
      state.page = 0;
      state.items = [];
      updateTrendingLabel();
      setFiltersVisibility();
      loadClusters();
      hideEmptyState();
      loadItems();
    } else {
      goBackToTrending();
    }
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

  // More Filters Toggle
  if (elements.moreFiltersBtn) {
    elements.moreFiltersBtn.addEventListener('click', function () {
      var secondary = document.getElementById('secondary-filters');
      if (secondary) {
        var isHidden = secondary.style.display === 'none';
        secondary.style.display = isHidden ? 'block' : 'none';
        elements.moreFiltersBtn.setAttribute('aria-expanded', isHidden);
      }
    });
  }
}

// Helper to check if any filters are active
function hasActiveFilters() {
  return !!(
    state.selectedRecipient ||
    state.selectedAge ||
    state.selectedGender ||
    (state.selectedProviders && state.selectedProviders.length > 0 && !allProvidersSelected()) ||
    state.selectedCluster ||
    state.selectedSubCluster ||
    state.selectedCategory ||
    state.searchQuery ||
    state.priceMin !== null ||
    state.priceMax !== null
  );
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

  if (state.queryConfig && !state.queryApplied) {
    applyQueryConfig();
    return;
  }

  if (state.hubConfig && !state.hubApplied) {
    applyHubConfig();
    return;
  }

  state.isDefaultView = true;
  state.selectedRecipient = null;
  state.selectedAge = null;
  state.selectedGender = null;
  if (elements.createRecipient) elements.createRecipient.value = '';
  if (elements.createAge) elements.createAge.value = '';
  if (elements.createGender) elements.createGender.value = '';
  if (elements.priceSelect) elements.priceSelect.value = '';

  updateTrendingLabel();
  setFiltersVisibility();
  loadClusters();
  loadDefaultView();
}

function applyConfig(config) {
  if (!config) return false;
  state.isDefaultView = false;
  state.selectedRecipient = config.recipient || null;
  state.selectedAge = null;
  state.selectedGender = null;
  state.selectedCluster = config.cluster || null;
  state.selectedSubCluster = config.subCluster || null;
  state.selectedCategory = config.category || null;
  state.selectedProviders = Array.isArray(config.provider) ? config.provider : (config.provider ? [config.provider] : []);
  state.searchQuery = config.search || '';
  state.priceMin = config.priceMin;
  state.priceMax = config.priceMax;

  // Map priceMin/Max back to select value if possible
  var priceVal = '';
  var isCustom = false;

  if (state.priceMin !== null && state.priceMax !== null) {
    var check = state.priceMin + '-' + state.priceMax;
    // Check if check is in select options (hardcoded check or simple heuristic)
    if (['0-25', '25-50', '50-100', '100-200'].includes(check)) {
      priceVal = check;
    } else {
      isCustom = true;
    }
  } else if (state.priceMin !== null && state.priceMax === null) {
    var check = state.priceMin + '+';
    if (['200+'].includes(check)) {
      priceVal = check;
    } else {
      isCustom = true;
    }
  } else if (state.priceMin === null && state.priceMax !== null) {
    priceVal = '0-' + state.priceMax; // fallback common under X logic
    if (!['0-25'].includes(priceVal)) isCustom = true; // simplified check
  }

  if (isCustom) {
    priceVal = 'custom';
    if (elements.customPriceContainer) elements.customPriceContainer.style.display = 'flex';
    if (elements.priceSelect) elements.priceSelect.style.display = 'none';
    if (elements.customPriceMin) elements.customPriceMin.value = state.priceMin !== null ? state.priceMin : '';
    if (elements.customPriceMax) elements.customPriceMax.value = state.priceMax !== null ? state.priceMax : '';
  } else {
    if (elements.customPriceContainer) elements.customPriceContainer.style.display = 'none';
    if (elements.priceSelect) elements.priceSelect.style.display = '';
    if (elements.customPriceMin) elements.customPriceMin.value = '';
    if (elements.customPriceMax) elements.customPriceMax.value = '';
  }


  state.page = 0;
  state.items = [];

  if (elements.searchInput) elements.searchInput.value = state.searchQuery || '';
  if (elements.createRecipient) elements.createRecipient.value = state.selectedRecipient || '';
  if (elements.createAge) elements.createAge.value = '';
  if (elements.createGender) elements.createGender.value = '';
  // Update provider buttons state is handled in setFiltersVisibility
  if (elements.priceSelect) elements.priceSelect.value = priceVal || '';
  if (elements.clusterSelect) elements.clusterSelect.value = state.selectedCluster || '';
  if (elements.subClusterSelect) elements.subClusterSelect.value = state.selectedSubCluster || '';
  if (elements.categorySelect) elements.categorySelect.value = state.selectedCategory || '';

  hideError();
  hideEmptyState();
  updateTrendingLabel();
  loadClusters();
  if (state.selectedCluster) {
    updateSubClusters();
    updateCategories();
  }
  setFiltersVisibility();

  // Auto-expand secondary filters if any are active
  if (state.selectedAge || state.selectedGender || (state.selectedProviders && state.selectedProviders.length > 0) || state.selectedCluster || state.selectedSubCluster || state.selectedCategory) {
    var secondary = document.getElementById('secondary-filters');
    if (secondary) {
      secondary.style.display = 'block';
      if (elements.moreFiltersBtn) elements.moreFiltersBtn.setAttribute('aria-expanded', 'true');
    }
  }

  loadItems();
  return true;
}

function applyHubConfig() {
  if (!state.hubConfig || state.hubApplied) return false;
  state.hubApplied = true;
  return applyConfig(state.hubConfig);
}

function applyQueryConfig() {
  if (!state.queryConfig || state.queryApplied) return false;
  state.queryApplied = true;
  return applyConfig(state.queryConfig);
}

// Update the Page Subtitle (Dynamic Subtitle)
function updateProviderTriggerText() {
  if (!elements.providerTrigger) return;

  var count = state.selectedProviders ? state.selectedProviders.length : 0;
  if (count === 0 || allProvidersSelected()) {
    elements.providerTrigger.textContent = 'Providers';
    elements.providerTrigger.classList.remove('has-value');
  } else if (count === 1) {
    var val = state.selectedProviders[0];
    elements.providerTrigger.textContent = val === 'ebay' ? 'eBay' : (val === 'etsy' ? 'Etsy' : val);
    elements.providerTrigger.classList.add('has-value');
  } else {
    elements.providerTrigger.textContent = count + ' selected';
    elements.providerTrigger.classList.add('has-value');
  }
}

function updateTrendingLabel() {
  if (!elements.dynamicSubtitle) return;

  if (state.searchQuery) {
    elements.dynamicSubtitle.textContent = 'Results for "' + state.searchQuery + '"';
    return;
  }

  if (state.isDefaultView || !state.selectedRecipient) {
    elements.dynamicSubtitle.textContent = 'For everyone';
    return;
  }
  var display = RECIPIENT_OPTIONS.find(function (r) { return r.value === state.selectedRecipient; });
  var name = display ? display.label : state.selectedRecipient;
  var label = 'For ' + name;
  if (state.selectedAge) label += ' · ' + state.selectedAge;
  if (state.selectedGender) label += ' · ' + state.selectedGender;
  elements.dynamicSubtitle.textContent = label;
}

// Sync state from who filters (recipient, age, gender)
function syncWhoFromFilters() {
  state.selectedRecipient = elements.createRecipient ? elements.createRecipient.value || null : null;
  state.selectedAge = elements.createAge ? elements.createAge.value || null : null;
  state.selectedGender = elements.createGender ? elements.createGender.value || null : null;
}

// Show Area and Category when Topic selected; filters always visible; sync "Clear" button and active states
function setFiltersVisibility() {
  var areaGroup = document.getElementById('filter-group-area');
  var categoryGroup = document.getElementById('filter-group-category');
  if (elements.filtersSection) elements.filtersSection.style.display = '';
  if (areaGroup) areaGroup.style.display = state.selectedCluster ? '' : 'none';
  if (categoryGroup) categoryGroup.style.display = state.selectedCluster ? '' : 'none';

  // Show clear button if any filter is active
  if (elements.clearFiltersBtn) {
    elements.clearFiltersBtn.style.display = hasActiveFilters() ? '' : 'none';
  }

  // Update visual active state for selects
  if (elements.createRecipient) elements.createRecipient.classList.toggle('has-value', !!elements.createRecipient.value);
  if (elements.createAge) elements.createAge.classList.toggle('has-value', !!elements.createAge.value);
  if (elements.createGender) elements.createGender.classList.toggle('has-value', !!elements.createGender.value);
  if (elements.priceSelect) {
    elements.priceSelect.classList.toggle('has-value', !!elements.priceSelect.value && elements.priceSelect.value !== 'custom');
    // If custom is selected and has values, we might want to style it or the container
    if (elements.priceSelect.value === 'custom' && (state.priceMin !== null || state.priceMax !== null)) {
      elements.priceSelect.classList.add('has-value');
    }
  }

  // Update provider checkboxes state
  if (elements.providerCheckboxes) {
    elements.providerCheckboxes.forEach(function (checkbox) {
      checkbox.checked = state.selectedProviders.indexOf(checkbox.value) !== -1;
    });
    updateProviderTriggerText();
  }

  if (elements.clusterSelect) elements.clusterSelect.classList.toggle('has-value', !!elements.clusterSelect.value);
  if (elements.subClusterSelect) elements.subClusterSelect.classList.toggle('has-value', !!elements.subClusterSelect.value);
  if (elements.categorySelect) elements.categorySelect.classList.toggle('has-value', !!elements.categorySelect.value);

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
  state.selectedProviders = [];
  state.selectedCluster = null;
  state.selectedSubCluster = null;
  state.selectedCategory = null;
  state.searchQuery = '';
  state.priceMin = null;
  state.priceMax = null;
  state.items = [];
  state.page = 0;
  if (elements.searchInput) elements.searchInput.value = '';
  if (elements.createRecipient) elements.createRecipient.value = '';
  if (elements.createAge) elements.createAge.value = '';
  if (elements.createGender) elements.createGender.value = '';
  // Reset provider checkboxes to all selected
  state.selectedProviders = ALL_PROVIDERS.slice();
  if (elements.providerCheckboxes) {
    elements.providerCheckboxes.forEach(function (checkbox) {
      checkbox.checked = true;
    });
    updateProviderTriggerText();
  }
  if (elements.providerMenu) elements.providerMenu.hidden = true;

  if (elements.priceSelect) {
    elements.priceSelect.value = '';
    elements.priceSelect.style.display = '';
  }
  if (elements.customPriceContainer) elements.customPriceContainer.style.display = 'none';
  if (elements.customPriceMin) elements.customPriceMin.value = '';
  if (elements.customPriceMax) elements.customPriceMax.value = '';
  if (elements.clusterSelect) elements.clusterSelect.value = '';
  if (elements.subClusterSelect) elements.subClusterSelect.value = '';
  if (elements.categorySelect) elements.categorySelect.value = '';

  // Collapse secondary filters
  var secondary = document.getElementById('secondary-filters');
  if (secondary) secondary.style.display = 'none';
  if (elements.moreFiltersBtn) elements.moreFiltersBtn.setAttribute('aria-expanded', 'false');

  hideError();
  hideEmptyState();
  updateTrendingLabel();
  setFiltersVisibility();
  loadClusters();
  loadDefaultView();
}

// Autocomplete logic
function updateSuggestions(val) {
  if (!val) {
    closeSuggestions();
    return;
  }

  const query = val.toLowerCase().trim();
  if (!query) {
    closeSuggestions();
    return;
  }

  const suggestions = [];

  // Extract all sub-clusters from taxonomy if available
  if (state.taxonomy && state.taxonomy.clusters) {
    const allSubClusters = [];
    Object.values(state.taxonomy.clusters).forEach(cluster => {
      if (cluster.sub_clusters) {
        Object.values(cluster.sub_clusters).forEach(subCluster => {
          allSubClusters.push(subCluster.label);
        });
      }
    });

    // Filter and sort
    const uniqueSubClusters = [...new Set(allSubClusters)];
    const filtered = uniqueSubClusters.filter(label => label.toLowerCase().includes(query));

    const sorted = filtered.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aStarts = aLower.startsWith(query);
      const bStarts = bLower.startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    }).slice(0, 6); // Limit category suggestions

    sorted.forEach(s => {
      suggestions.push({ type: 'category', value: s, label: s });
    });
  }

  // Always add specific search option
  suggestions.push({ type: 'search', value: val.trim(), label: `Search for "${val.trim()}"` });

  state.suggestions = suggestions;

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

    // Add icon based on type
    const iconSpan = document.createElement('span');
    iconSpan.className = 'suggestion-item-icon';

    if (suggestion.type === 'category') {
      // Tag/Category icon
      iconSpan.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>';
    } else {
      // Search icon
      iconSpan.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
    }

    div.appendChild(iconSpan);

    const textSpan = document.createElement('span');
    textSpan.textContent = suggestion.label;
    if (suggestion.type === 'search') textSpan.style.fontStyle = 'italic';
    div.appendChild(textSpan);

    div.addEventListener('click', () => selectSuggestion(suggestion));
    elements.searchSuggestions.appendChild(div);
  });

  elements.searchSuggestions.style.display = 'block';
}

function selectSuggestion(suggestion) {
  if (elements.searchInput && suggestion) {
    const val = suggestion.value;
    elements.searchInput.value = val;
    state.searchQuery = val;

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
  if (elements.priceSelect) elements.priceSelect.value = '';
  hideError();
  updateTrendingLabel();
  setFiltersVisibility();
  loadClusters();
  loadItems();
}

// Render default view: one section per recipient with a grid of items; "See all" and clickable heading
function renderDefaultView() {
  if (!elements.itemsContainer) return;

  // Hide pre-JS content and skeleton loader when real data is rendered
  var preJsContent = document.getElementById('pre-js-content');
  var skeletonLoader = document.getElementById('skeleton-loader');
  if (preJsContent) preJsContent.style.display = 'none';
  if (skeletonLoader) skeletonLoader.style.display = 'none';
  document.querySelector('.find-gifts-container')?.classList.add('has-loaded-items');

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
    // SVG Left Arrow
    prevBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'carousel-btn carousel-btn--next';
    nextBtn.setAttribute('aria-label', 'Scroll right');
    // SVG Right Arrow
    nextBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';

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
      var isPointerDown = false;
      var isDragging = false;
      var dragThreshold = 6;
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

        // On touch devices, we favor native scrolling for smoothness.
        // We only initiate manual drag for mouse pointers.
        if (e.pointerType === 'touch') return;

        isPointerDown = true;
        isDragging = false;
        startX = e.clientX;
        lastX = e.clientX;
        startScrollLeft = gridEl.scrollLeft;
        lastTime = performance.now();
        velocity = 0;

        cancelAnimationFrame(RAF);
        RAF = null;
      };

      var onPointerMove = function (e) {
        if (!isPointerDown) return;
        if (e.pointerType === 'touch') return; // Let native touch handle it

        var delta = e.clientX - startX;
        if (!isDragging) {
          if (Math.abs(delta) < dragThreshold) return;
          isDragging = true;
          gridEl.classList.add('is-dragging');
          gridEl.style.scrollSnapType = 'none'; // Disable snap during drag
          gridEl.style.scrollBehavior = 'auto'; // Disable smooth scroll during drag
          try { gridEl.setPointerCapture(e.pointerId); } catch (err) { }
        }
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
        gridEl.scrollLeft = startScrollLeft - delta;
      };

      var onPointerUp = function (e) {
        if (!isPointerDown) return;
        isPointerDown = false;

        // Restore scroll behavior
        gridEl.style.scrollBehavior = '';

        if (isDragging) {
          isDragging = false;
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
        }
      };

      gridEl.addEventListener('pointerdown', onPointerDown);
      gridEl.addEventListener('pointermove', onPointerMove);
      gridEl.addEventListener('pointerup', onPointerUp);
      gridEl.addEventListener('pointerleave', onPointerUp);
      gridEl.addEventListener('pointercancel', onPointerUp);

      // Touch event handling for native scroll with swipe detection
      // This prevents the modal from opening after a horizontal swipe
      var touchStartX = 0;
      var touchStartY = 0;
      var touchSwipeThreshold = 10; // pixels to consider it a swipe vs tap
      var preventClickTimeout = null;

      gridEl.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        // Clear any pending timeout and remove prevent-click for fresh interaction
        if (preventClickTimeout) {
          clearTimeout(preventClickTimeout);
          preventClickTimeout = null;
        }
        gridEl.classList.remove('prevent-click');
      }, { passive: true });

      gridEl.addEventListener('touchmove', function (e) {
        if (e.touches.length !== 1) return;
        var dx = Math.abs(e.touches[0].clientX - touchStartX);
        var dy = Math.abs(e.touches[0].clientY - touchStartY);
        // If horizontal movement exceeds threshold and is primarily horizontal,
        // immediately add prevent-click to block any click that fires before touchend
        if (dx > touchSwipeThreshold && dx > dy) {
          if (!gridEl.classList.contains('prevent-click')) {
            gridEl.classList.add('prevent-click');
          }
        }
      }, { passive: true });

      gridEl.addEventListener('touchend', function (e) {
        // If prevent-click was set (meaning we swiped), keep it a bit longer
        // to ensure the click event (which fires after touchend) is blocked
        if (gridEl.classList.contains('prevent-click')) {
          preventClickTimeout = setTimeout(function () {
            gridEl.classList.remove('prevent-click');
            preventClickTimeout = null;
          }, 300);
        }
      }, { passive: true });

      gridEl.addEventListener('touchcancel', function (e) {
        // On cancel, clear the state
        if (preventClickTimeout) {
          clearTimeout(preventClickTimeout);
          preventClickTimeout = null;
        }
        gridEl.classList.remove('prevent-click');
      }, { passive: true });

      updateButtons();
    })(carousel, grid, prevBtn, nextBtn);
  });
  if (elements.loadMoreBtn) elements.loadMoreBtn.style.display = 'none';
}

// Open modal for a specific item
function openModal(item, list, index) {
  state.currentItemsList = list;
  state.currentModalIndex = index;
  state.currentImageIndex = 0;
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

  // Pause video if playing
  const video = document.getElementById('modal-video');
  if (video) {
    video.pause();
    video.currentTime = 0;
    video.src = '';
  }

  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
}

// Update modal content
function updateModalContent(item) {
  const giftItem = item.gift_items;
  if (!giftItem) return;

  // Parse images if it's a string (e.g. "['url']") or invalid format
  let rawImages = giftItem.images;
  if (typeof rawImages === 'string') {
    try {
      // Try JSON parse first
      rawImages = JSON.parse(rawImages);
    } catch (e) {
      // If JSON fails, it might be single-quoted string "['url']" which is common in some exports
      // We can try to replace single quotes with double quotes if safe, or just regex extract
      try {
        if (rawImages.startsWith("['") && rawImages.endsWith("']")) {
          rawImages = rawImages.replace(/'/g, '"');
          rawImages = JSON.parse(rawImages);
        }
      } catch (e2) {
        itemsLog('warn', 'Failed to parse images string', rawImages);
        rawImages = [];
      }
    }
  }

  const images = Array.isArray(rawImages) && rawImages.length > 0 ? rawImages : (giftItem.image_url ? [giftItem.image_url] : []);
  const imageUrl = images[state.currentImageIndex] || images[0];
  const title = giftItem.local_title || giftItem.title;
  const description = giftItem.description || '';
  const category = item.category || item.sub_cluster || item.cluster || '';

  let priceText = '';
  if (giftItem.price && giftItem.price !== '0' && giftItem.price !== 0) {
    priceText = giftItem.price;
  } else if (giftItem.price_amount && giftItem.price_amount > 0 && giftItem.price_currency) {
    priceText = new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: giftItem.price_currency
    }).format(giftItem.price_amount);
  }

  if (!priceText) {
    priceText = 'View price';
  }

  const modalImage = document.getElementById('modal-image');
  const modalVideo = document.getElementById('modal-video');

  // Detect if it is a video (handle query strings)
  const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(imageUrl);

  if (isVideo) {
    if (modalImage) modalImage.style.display = 'none';
    if (modalVideo) {
      modalVideo.style.display = 'block';
      modalVideo.src = imageUrl;
      modalVideo.load();
      // Try to play (autoplay is set but good to Force it)
      var playPromise = modalVideo.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // Auto-play was prevented
          console.log('Auto-play prevented:', error);
        });
      }
    }
  } else {
    if (modalVideo) {
      modalVideo.style.display = 'none';
      modalVideo.pause();
      modalVideo.src = '';
    }
    if (modalImage) {
      modalImage.style.display = 'block';
      modalImage.src = imageUrl || '';

      // Error handling / Fallback
      modalImage.onerror = function () {
        // If we are showing a gallery image and it fails, try the main image_url (if different)
        // Check if we are already using the fallback to avoid infinite loop
        if (this.src !== giftItem.image_url && giftItem.image_url) {
          itemsLog('warn', 'Gallery image failed, falling back to main image', { failed: this.src, fallback: giftItem.image_url });
          this.src = giftItem.image_url;
        } else {
          // If fallback also fails or was same, show placeholder
          itemsLog('warn', 'Image failed to load', { src: this.src });
          this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23E6E8EF" width="200" height="200"/%3E%3Ctext fill="%23707487" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
          this.onerror = null; // Prevent infinite loop
        }
      };
    }
  }

  document.getElementById('modal-category').textContent = category;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-price').textContent = priceText;

  // Provider badge in modal
  var modalProvider = document.getElementById('modal-provider');
  if (modalProvider) {
    var prov = getProvider(giftItem.url);
    var provLabel = prov === 'ebay' ? 'eBay' : prov === 'etsy' ? 'Etsy' : '';
    if (provLabel) {
      modalProvider.textContent = provLabel;
      modalProvider.className = 'modal-provider provider-badge provider-badge--' + prov;
      modalProvider.style.display = '';
    } else {
      modalProvider.style.display = 'none';
    }
  }
  const descriptionEl = document.getElementById('modal-description');
  const descriptionToggle = document.getElementById('modal-description-toggle');
  if (descriptionEl) {
    descriptionEl.textContent = description;
    descriptionEl.classList.remove('is-expanded');
  }
  if (descriptionToggle) {
    descriptionToggle.textContent = 'More';
    descriptionToggle.style.display = 'none';
    descriptionToggle.setAttribute('aria-expanded', 'false');
  }
  if (descriptionEl && descriptionToggle) {
    window.requestAnimationFrame(function () {
      if (descriptionEl.scrollHeight > descriptionEl.clientHeight + 1) {
        descriptionToggle.style.display = 'inline-flex';
      }
    });
  }
  document.getElementById('modal-shop-btn').href = sanitizeUrl(giftItem.url);

  // Update pagination dots and image cursor
  const paginationContainer = document.getElementById('image-pagination');

  // Reset
  if (paginationContainer) paginationContainer.innerHTML = '';
  if (modalImage) modalImage.classList.remove('has-multiple');

  if (images.length > 1) {
    if (modalImage) modalImage.classList.add('has-multiple');
    if (paginationContainer) {
      images.forEach((_, idx) => {
        const dot = document.createElement('div');
        dot.className = 'pagination-dot' + (idx === state.currentImageIndex ? ' is-active' : '');
        paginationContainer.appendChild(dot);
      });
    }
  }
}

// Show next image (looping)
function showNextImage() {
  const item = state.currentItemsList[state.currentModalIndex];
  if (!item || !item.gift_items) return;
  const images = item.gift_items.images || [];
  if (images.length <= 1) return;

  state.currentImageIndex = (state.currentImageIndex + 1) % images.length;
  updateModalContent(item);
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
  if (giftItem.price && giftItem.price !== '0' && giftItem.price !== 0) {
    priceText = giftItem.price;
  } else if (giftItem.price_amount && giftItem.price_amount > 0 && giftItem.price_currency) {
    priceText = new Intl.NumberFormat('en-CA', { style: 'currency', currency: giftItem.price_currency || 'CAD' }).format(giftItem.price_amount);
  }

  if (!priceText) {
    priceText = 'View price';
  }

  var categoryLabel = item.category || item.sub_cluster || item.cluster || '';
  var provider = getProvider(giftItem.url);
  var providerLabel = provider === 'ebay' ? 'eBay' : provider === 'etsy' ? 'Etsy' : '';
  var providerBadgeHtml = providerLabel ? '<span class="provider-badge provider-badge--' + provider + '">' + providerLabel + '</span>' : '';
  var card = document.createElement('div');
  card.className = 'item-card item-card--animate';
  card.innerHTML = '<div class="item-image">' + providerBadgeHtml + '<img src="' + imageUrl + '" alt="' + escapeHtml(title) + '" loading="lazy"></div><div class="item-content"><h3 class="item-title">' + escapeHtml(title) + '</h3>' + (categoryLabel ? '<p class="item-category">' + escapeHtml(categoryLabel) + '</p>' : '') + '<p class="item-price">' + escapeHtml(priceText) + '</p><a href="' + sanitizeUrl(giftItem.url) + '" target="_blank" rel="noopener" class="item-shop-btn">Shop</a></div>';

  // Ensure link clicks don't trigger the preview modal
  var cardLinks = card.querySelectorAll('a');
  cardLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  });

  // click to open modal
  card.addEventListener('click', function (e) {
    itemsLog('debug', 'Card clicked', { target: e.target, preventClick: card.closest('.items-grid').classList.contains('prevent-click') });

    // If the grid is in prevent-click mode (just finished a drag), ignore
    if (card.closest('.items-grid').classList.contains('prevent-click')) {
      return;
    }
    // Clicking the shop link should go to the product URL, not the preview modal
    if (e.target.closest('a')) {
      itemsLog('debug', 'Shop link clicked');
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

    itemsLog('debug', 'Calling openModal', { index: index, item: item });
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
  const descriptionToggle = modal.querySelector('#modal-description-toggle');
  const descriptionEl = modal.querySelector('#modal-description');

  function handleClose() { closeModal(); }

  closeBtn.addEventListener('click', handleClose);
  overlay.addEventListener('click', handleClose);

  if (descriptionToggle && descriptionEl) {
    descriptionToggle.addEventListener('click', function () {
      const isExpanded = descriptionEl.classList.toggle('is-expanded');
      descriptionToggle.textContent = isExpanded ? 'Less' : 'More';
      descriptionToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    });
  }

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
      showNextItem(); // Swipe Left -> Next Item
    }
    if (touchEndX > touchStartX + swipeThreshold) {
      showPrevItem(); // Swipe Right -> Prev Item
    }
  }

  // Tap/Click image to advance (if multiple)
  const modalImage = document.getElementById('modal-image');
  if (modalImage) {
    modalImage.addEventListener('click', (e) => {
      e.stopPropagation();
      showNextImage();
    });
  }

  // Side-tap navigation for mobile
  const modalContainer = modal.querySelector('.modal-container');
  if (modalContainer) {
    modalContainer.addEventListener('click', function (e) {
      // Ignore if clicking image, video, nav buttons, or shop button
      if (e.target.closest('#modal-image') ||
        e.target.closest('#modal-video') ||
        e.target.closest('.modal-nav-btn') ||
        e.target.closest('.modal-close-btn') ||
        e.target.closest('.modal-shop-btn') ||
        e.target.closest('#modal-description-toggle')) {
        return;
      }

      // Only on mobile screens
      if (window.innerWidth <= 768) {
        const rect = modalContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < rect.width / 2) {
          showPrevItem();
        } else {
          showNextItem();
        }
      }
    });
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
  if (state.selectedCluster) {
    elements.clusterSelect.value = state.selectedCluster;
  }
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
  if (state.selectedSubCluster) {
    elements.subClusterSelect.value = state.selectedSubCluster;
  }
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
  if (state.selectedCategory) {
    elements.categorySelect.value = state.selectedCategory;
  }
}

// Load items with filters (search view only)
async function loadItems() {
  if (state.isDefaultView && !hasActiveFilters()) {
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
      priceMin: state.priceMin,
      priceMax: state.priceMax,
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
        gift_items!inner (
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

    // Price filtering moved to client-side to handle "USD 25" strings
    // if (state.priceMin !== null) {
    //   query = query.gte('gift_items.price_amount', state.priceMin);
    // }
    // if (state.priceMax !== null) {
    //   query = query.lte('gift_items.price_amount', state.priceMax);
    // }

    // Apply search execution server-side
    if (state.searchQuery) {
      // Sanitize query for PostgREST syntax (remove commas, parens which define syntax)
      const safeQuery = state.searchQuery.replace(/[,()]/g, ' ').trim();
      if (safeQuery) {
        // Search in title, local_title, and description
        // valid syntax: column.ilike.%value%
        query = query.or(`local_title.ilike.%${safeQuery}%,title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`, { foreignTable: 'gift_items' });
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    // Data is already filtered by search query from server
    let filteredData = Array.isArray(data) ? data : [];

    // Normalize images: ensure gift_items.images is an array
    filteredData.forEach(function (item) {
      if (item.gift_items && typeof item.gift_items.images === 'string') {
        try {
          // Attempt JSON parse
          let raw = item.gift_items.images;
          // Handle python/postgres style ['...'] which is valid JSON if quotes are double, but here might be single
          if (raw.startsWith("['") && raw.endsWith("']")) {
            raw = raw.replace(/'/g, '"');
          }
          item.gift_items.images = JSON.parse(raw);
        } catch (e) {
          // If parse fails, assume empty or invalid
          item.gift_items.images = [];
        }
      }
    });

    // Filter out items without gift_items
    filteredData = filteredData.filter(function (item) {
      return item.gift_items && item.gift_items.url;
    });

    // Deduplicate items by gift_item_id (especially when no recipient filter is used)
    const seenIds = new Set();
    filteredData = filteredData.filter(item => {
      const id = item.gift_item_id || item.gift_items.id;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    // Client-side Price Filtering
    if (state.priceMin !== null || state.priceMax !== null) {
      filteredData = filteredData.filter(function (item) {
        // Prefer price_amount if valid? User said price_amount unreliable.
        // Let's use normalizePrice on 'price' string if available, falling back to price_amount
        var p = item.gift_items.price;
        var val = normalizePrice(p);

        // If val is null, try price_amount
        if (val === null && item.gift_items.price_amount) {
          val = item.gift_items.price_amount;
        }

        if (val === null) return false; // No price found, filter out? Or keep? Safest to filter out if filtering is active.

        if (state.priceMin !== null && val < state.priceMin) return false;
        if (state.priceMax !== null && val > state.priceMax) return false;

        return true;
      });
    }

    // Client-side Provider Filtering (Multi-select) — skip if all selected
    if (state.selectedProviders && state.selectedProviders.length > 0 && !allProvidersSelected()) {
      filteredData = filteredData.filter(function (item) {
        var p = getProvider(item.gift_items.url);
        return state.selectedProviders.indexOf(p) !== -1;
      });
    }

    if (startPage === 0 && filteredData.length === 0 && state.hubConfig && state.hubConfig.fallback === 'default' && !state.hubFallbackUsed) {
      state.hubFallbackUsed = true;
      itemsLog('warn', 'Hub filters returned 0 items. Falling back to default view.');
      goBackToTrending();
      return;
    }

    let itemsToRender = [];
    if (startPage === 0) {
      state.items = filteredData;
      itemsToRender = filteredData;
    } else {
      // Avoid duplicates with already loaded items
      const existingIds = new Set(state.items.map(item => item.gift_item_id || item.gift_items.id));
      const newItems = filteredData.filter(item => !existingIds.has(item.gift_item_id || item.gift_items.id));
      state.items = state.items.concat(newItems);
      itemsToRender = newItems;
    }

    // Determine hasMore based on raw data length
    var rawCount = Array.isArray(data) ? data.length : 0;
    state.hasMore = rawCount === PAGE_SIZE;
    state.page = startPage + 1;

    renderItems(itemsToRender, startPage === 0);

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
function renderItems(itemsToRender, isFirstLoad) {
  if (!elements.itemsContainer) return;

  // Hide pre-JS content and skeleton loader when real data is rendered
  var preJsContent = document.getElementById('pre-js-content');
  var skeletonLoader = document.getElementById('skeleton-loader');
  if (preJsContent) preJsContent.style.display = 'none';
  if (skeletonLoader) skeletonLoader.style.display = 'none';
  document.querySelector('.find-gifts-container')?.classList.add('has-loaded-items');

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

// Sanitize URL to ensure proper formatting for external links
function sanitizeUrl(url) {
  if (!url) return '';

  // Rewrite eBay URLs to avoid pipe characters which browsers encode to %7C
  // Format: .../itm/v1|ITEM_ID|VAR_ID?... -> .../itm/ITEM_ID?var=VAR_ID&...
  // Handles both encoded (%7C) and decoded (|) pipes
  if (url.includes('ebay.com/itm/')) {
    // Regex to capture the ID parts. Matches v1 followed by pipe or %7C, then item ID, then pipe or %7C, then var ID
    const match = url.match(/\/itm\/v1(?:%7C|\|)(\d+)(?:%7C|\|)(\d+)(\?.*)?$/);
    if (match) {
      const itemId = match[1];
      const varId = match[2];
      const queryParams = match[3] || ''; // Includes '?'

      // Construct new safe URL
      let newUrl = 'https://www.ebay.com/itm/' + itemId + '?var=' + varId;

      // Append existing query params (removing the leading ? if we already added it)
      if (queryParams) {
        // If queryParams starts with ?, change it to & to append to our new param
        newUrl += queryParams.replace('?', '&');
      }

      return newUrl;
    }
  }

  // Fallback: Fix other pipe encoding issues if the regex didn't match
  if (url.includes('ebay.com') && (url.includes('%7C') || url.includes('%7c'))) {
    const newUrl = url.replace(/%7C/gi, '|');
    return newUrl;
  }

  return url;
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
