// ff-engine.js — Fridge Finder matching engine, UI builder & nav wiring
// Depends on: ff-data.js (loaded first), and globals: curWeek, navTo, switchWeek
// from the main index.html script block.

// ── Fridge Finder state ─────────────────────────────────────────────
var ffActiveCat = 'all';
var ffAvailable = [];
var ffMinPct    = 0;    // minimum match % (0 = show all with ≥1 match)

// ── Build category filter bar ───────────────────────────────────────
function ffBuildCatFilters() {
  var wrap = document.getElementById('ff-cat-filters');
  if (!wrap) return;
  FF_CATS.forEach(function(cat) {
    var btn = document.createElement('button');
    btn.className = 'ff-cat-btn' + (cat.k === 'all' ? ' on' : '');
    btn.textContent = cat.e + ' ' + cat.l;
    btn.onclick = function() {
      ffActiveCat = cat.k;
      wrap.querySelectorAll('.ff-cat-btn').forEach(function(b){ b.classList.remove('on'); });
      btn.classList.add('on');
      ffRenderResults();
    };
    wrap.appendChild(btn);
  });
}

// ── Build pantry chip bar ───────────────────────────────────────────
function ffBuildChips() {
  var wrap = document.getElementById('ff-chips');
  if (!wrap) return;
  FF_PANTRY_CHIPS.forEach(function(ing) {
    var chip = document.createElement('button');
    chip.className = 'ff-chip';
    chip.textContent = ing;
    chip.onclick = function() {
      chip.classList.toggle('active');
      var input = document.getElementById('ff-input');
      if (!input) return;
      var items = input.value.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
      if (chip.classList.contains('active')) {
        // Add ingredient if not already present (case-insensitive)
        var already = items.some(function(s){ return s.toLowerCase() === ing.toLowerCase(); });
        if (!already) items.push(ing);
      } else {
        // Remove this ingredient
        items = items.filter(function(s){ return s.toLowerCase() !== ing.toLowerCase(); });
      }
      input.value = items.join(', ');
      ffSearch();
    };
    wrap.appendChild(chip);
  });
}

// ── Search & match ──────────────────────────────────────────────────
function ffSearch() {
  var input = document.getElementById('ff-input');
  var val = input ? input.value : '';
  ffAvailable = ffParseInput(val);
  ffRenderResults();
}

function ffScoreRecipe(recipe) {
  var matched = 0;
  recipe.ing.forEach(function(ing) {
    if (ffIngMatch(ffAvailable, ing)) matched++;
  });
  return { matched: matched, total: recipe.ing.length,
           score: matched / (recipe.ing.length || 1) };
}

function ffRenderResults() {
  var container = document.getElementById('ff-results');
  if (!container) return;

  if (ffAvailable.length === 0) {
    container.innerHTML = '<div class="ff-empty"><span>🔍</span>Enter ingredients above to find matching meals</div>';
    return;
  }

  // Score and filter
  var scored = FF_RECIPES.map(function(r) {
    var s = ffScoreRecipe(r);
    return { recipe: r, matched: s.matched, total: s.total, score: s.score };
  }).filter(function(item) {
    if (ffActiveCat !== 'all' && item.recipe.c !== ffActiveCat) return false;
    return item.matched > 0 && Math.round(item.score * 100) >= ffMinPct;
  });

  // Sort by score desc, then alpha
  scored.sort(function(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.recipe.n.localeCompare(b.recipe.n);
  });

  if (scored.length === 0) {
    var catLabel = ffActiveCat === 'all' ? '' : ' in this category';
    container.innerHTML = '<div class="ff-no-match"><strong>No matches found' + catLabel + '.</strong><br>Try adding more ingredients or switch category.</div>';
    return;
  }

  container.innerHTML = '';
  scored.forEach(function(item) {
    container.appendChild(ffBuildCard(item));
  });
}

function ffBuildCard(item) {
  var r = item.recipe;
  var pct = Math.round(item.score * 100);
  var catLabel = FF_CATS.filter(function(c){ return c.k === r.c; })[0];
  catLabel = catLabel ? catLabel.l : r.c;

  // Missing ingredients
  var missing = r.ing.filter(function(ing) {
    return !ffIngMatch(ffAvailable, ing);
  });

  // Bar colour: green ≥75%, amber 40-74%, rust <40%
  var barColour = pct >= 75 ? 'var(--green2)' : pct >= 40 ? 'var(--gold)' : 'var(--rust2)';

  var card = document.createElement('div');
  card.className = 'ff-rcard';

  // Head
  var head = document.createElement('div');
  head.className = 'ff-rcard-head';
  head.innerHTML =
    '<span class="ff-emoji">' + r.e + '</span>' +
    '<div class="ff-rcard-info">' +
      '<div class="ff-rcard-name">' + r.n + '</div>' +
      '<div class="ff-rcard-meta">' +
        '<span class="ff-badge ff-badge-time">⏱ ' + r.t + ' min</span>' +
        '<span class="ff-badge ff-badge-cat">' + catLabel + '</span>' +
        (r.p ? '<span class="ff-badge ff-badge-hf">💪 ~' + r.p + 'g protein</span>' : '') +
        (r.tags.indexOf('v') !== -1 ? '<span class="ff-badge ff-badge-v">vegetarian</span>' : '') +
        (r.tags.indexOf('gf') !== -1 ? '<span class="ff-badge ff-badge-gf">GF</span>' : '') +
      '</div>' +
    '</div>' +
    '<span class="ff-chevron">▼</span>';
  head.onclick = function() {
    card.classList.toggle('open');
    body.classList.toggle('open');
  };

  // Match bar
  var matchWrap = document.createElement('div');
  matchWrap.className = 'ff-match-wrap';
  matchWrap.innerHTML =
    '<div class="ff-match-top">' +
      '<span>You have ' + item.matched + ' of ' + item.total + ' ingredients</span>' +
      '<span class="ff-match-pct">' + pct + '% match</span>' +
    '</div>' +
    '<div class="ff-bar-track"><div class="ff-bar-fill" style="width:' + pct + '%;background:' + barColour + '"></div></div>';

  // Missing
  var missingEl = document.createElement('div');
  missingEl.className = 'ff-missing';
  if (missing.length > 0) {
    missingEl.innerHTML = 'Still need: <em>' + missing.join(', ') + '</em>';
  } else {
    missingEl.innerHTML = '✅ <strong style="color:var(--green)">You have everything!</strong>';
  }

  // Body (hidden until toggled)
  var body = document.createElement('div');
  body.className = 'ff-body';

  // Ingredient pills
  var ingTitle = document.createElement('div');
  ingTitle.className = 'ff-body-title';
  ingTitle.textContent = 'INGREDIENTS (serves ' + r.s + ')';
  var ingGrid = document.createElement('div');
  ingGrid.className = 'ff-ing-grid';
  r.ing.forEach(function(ing) {
    var have = ffIngMatch(ffAvailable, ing);
    var pill = document.createElement('span');
    pill.className = 'ff-ing ' + (have ? 'have' : 'need');
    pill.textContent = (have ? '✓ ' : '✗ ') + ing;
    ingGrid.appendChild(pill);
  });

  // Method
  var methTitle = document.createElement('div');
  methTitle.className = 'ff-body-title';
  methTitle.style.marginTop = '.9rem';
  methTitle.textContent = 'METHOD';
  var methList = document.createElement('ol');
  methList.className = 'ff-method';
  r.steps.forEach(function(step, i) {
    var li = document.createElement('li');
    li.innerHTML = '<span class="ff-step-num">' + (i+1) + '</span><span>' + step + '</span>';
    methList.appendChild(li);
  });

  // Buttons
  var btns = document.createElement('div');
  btns.className = 'ff-card-btns';

  if (missing.length > 0) {
    var addBtn = document.createElement('button');
    addBtn.className = 'ff-btn ff-btn-add';
    addBtn.textContent = '➕ Add missing to shopping list';
    addBtn.onclick = function(e) {
      e.stopPropagation();
      ffAddMissing(r.n, missing);
    };
    btns.appendChild(addBtn);
  }

  var waBtn = document.createElement('button');
  waBtn.className = 'ff-btn ff-btn-wa';
  waBtn.textContent = '📤 Share on WhatsApp';
  waBtn.onclick = function(e) {
    e.stopPropagation();
    ffShareWhatsApp(r);
  };
  btns.appendChild(waBtn);

  var aiBtn = document.createElement('button');
  aiBtn.className = 'ff-btn';
  aiBtn.textContent = '🤖 Ask Claude AI';
  aiBtn.onclick = function(e) {
    e.stopPropagation();
    var prompt = encodeURIComponent('Give me a detailed recipe for ' + r.n + ' to serve ' + r.s + '. I have: ' + ffAvailable.join(', ') + '. Keep it simple and budget-friendly for a South African family.');
    window.open('https://claude.ai/new?q=' + prompt, '_blank');
  };
  btns.appendChild(aiBtn);

  body.appendChild(ingTitle);
  body.appendChild(ingGrid);
  body.appendChild(methTitle);
  body.appendChild(methList);
  body.appendChild(btns);

  card.appendChild(head);
  card.appendChild(matchWrap);
  card.appendChild(missingEl);
  card.appendChild(body);
  return card;
}

// ── Add missing ingredients to shopping list ────────────────────────
var FF_SHOP_EXTRAS_KEY = 'mealplan_ff_extras_v1';

function ffAddMissing(recipeName, missing) {
  var stored = [];
  try { stored = JSON.parse(localStorage.getItem(FF_SHOP_EXTRAS_KEY)) || []; } catch(e){ stored=[]; }
  missing.forEach(function(ing) {
    if (stored.indexOf(ing) === -1) stored.push(ing);
  });
  localStorage.setItem(FF_SHOP_EXTRAS_KEY, JSON.stringify(stored));
  ffShowToast('✓ ' + missing.length + ' item' + (missing.length > 1 ? 's' : '') + ' added to Shopping List');
  // Inject into shopping page if visible
  ffInjectExtrasIntoShop();
}

function ffInjectExtrasIntoShop() {
  var stored = [];
  try { stored = JSON.parse(localStorage.getItem(FF_SHOP_EXTRAS_KEY)) || []; } catch(e){ stored=[]; }
  if (stored.length === 0) return;

  // Target current week's shopping page, fall back to w1
  var weekShopId = curWeek === 1 ? 'shop' : 'w' + curWeek + '-shop';
  var shopPage = document.getElementById(weekShopId) || document.getElementById('shop');
  if (!shopPage) return;

  var existing = document.getElementById('ff-extras-card');
  if (!existing) {
    var card = document.createElement('div');
    card.id = 'ff-extras-card';
    card.className = 'shop-card';
    card.style.cssText = 'border-left:3px solid var(--gold);margin-bottom:1.25rem';
    card.innerHTML =
      '<div class="shop-card-header" onclick="document.getElementById(\'ff-extras-items\').classList.toggle(\'open\')" style="cursor:pointer;display:flex;align-items:center;gap:8px">' +
        '<span style="font-weight:600;font-size:13px;color:var(--gold)">🧑‍🍳 Chef\'s Shopping Additions</span>' +
        '<button onclick="event.stopPropagation();ffClearExtras()" style="background:none;border:none;color:var(--ink4);font-size:11px;cursor:pointer;margin-left:auto;padding:4px 8px">✕ Clear all</button>' +
      '</div>' +
      '<div id="ff-extras-items" class="open" style="padding:.75rem 1rem"></div>';

    // Insert AFTER the page-header so it sits below the title
    var hdr = shopPage.querySelector('.page-header');
    if (hdr && hdr.nextSibling) {
      shopPage.insertBefore(card, hdr.nextSibling);
    } else {
      shopPage.appendChild(card);
    }
    existing = card;
  }

  var list = document.getElementById('ff-extras-items');
  if (!list) return;
  list.innerHTML = '';
  stored.forEach(function(ing) {
    var row = document.createElement('div');
    row.style.cssText = 'padding:6px 0;font-size:13px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center';
    var label = document.createElement('span');
    label.textContent = ing;
    var removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.style.cssText = 'background:none;border:none;color:var(--ink4);cursor:pointer;font-size:18px;padding:0 4px;line-height:1';
    removeBtn.setAttribute('data-ing', ing);
    removeBtn.onclick = function(){ ffRemoveExtra(this.getAttribute('data-ing')); };
    row.appendChild(label);
    row.appendChild(removeBtn);
    list.appendChild(row);
  });
}

function ffRemoveExtra(ing) {
  var stored = [];
  try { stored = JSON.parse(localStorage.getItem(FF_SHOP_EXTRAS_KEY)) || []; } catch(e){ stored=[]; }
  stored = stored.filter(function(s){ return s !== ing; });
  localStorage.setItem(FF_SHOP_EXTRAS_KEY, JSON.stringify(stored));
  ffInjectExtrasIntoShop();
  if (stored.length === 0) {
    var card = document.getElementById('ff-extras-card');
    if (card) card.remove();
  }
}

function ffClearExtras() {
  localStorage.removeItem(FF_SHOP_EXTRAS_KEY);
  var card = document.getElementById('ff-extras-card');
  if (card) card.remove();
}

// ── WhatsApp share ──────────────────────────────────────────────────
function ffShareWhatsApp(r) {
  var msg = '🍽 *' + r.n + '*\n';
  msg += '⏱ ' + r.t + ' min | Serves ' + r.s + '\n\n';
  msg += '*Ingredients:*\n' + r.ing.map(function(i){ return '• ' + i; }).join('\n');
  msg += '\n\n*Method:*\n' + r.steps.map(function(s,i){ return (i+1)+'. '+s; }).join('\n');
  msg += '\n\n_From the Family Meal Plan app_';
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}

// ── Toast ───────────────────────────────────────────────────────────
function ffShowToast(msg) {
  var t = document.getElementById('ff-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2800);
}

// ── navTo override for 'chef' slug ──────────────────────────────────
var _navToPreFF = navTo;
navTo = function(slug, btn) {
  var chefPage = document.getElementById('chef-page');
  if (slug === 'chef') {
    // Hide week blocks, show chef page
    ['w1','w2','w3','w4'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.classList.remove('on');
    });
    if (chefPage) chefPage.classList.add('on');
    document.querySelectorAll('#main-nav .nav-btn').forEach(function(b){ b.classList.remove('on'); });
    if (btn) btn.classList.add('on');
    window.scrollTo({top:0, behavior:'smooth'});
    // Inject any saved extras into the shop list
    ffInjectExtrasIntoShop();
  } else {
    // Hide chef page, restore week block
    if (chefPage) chefPage.classList.remove('on');
    var wBlock = document.getElementById('w' + curWeek);
    if (wBlock) wBlock.classList.add('on');
    _navToPreFF(slug, btn);
  }
};

// Also ensure switchWeek hides chef page
var _switchWeekPreFF = switchWeek;
switchWeek = function(n, btn) {
  var chefPage = document.getElementById('chef-page');
  if (chefPage) chefPage.classList.remove('on');
  _switchWeekPreFF(n, btn);
};

// ── Init Fridge Finder ──────────────────────────────────────────────
function initFridgeFinder() {
  ffBuildCatFilters();
  ffBuildChips();

  // Live search as user types; also allow Enter
  var input = document.getElementById('ff-input');
  if (input) {
    input.addEventListener('input', function() {
      // Keep chips in sync with what's typed (deactivate chips removed from input)
      var val = input.value.toLowerCase();
      document.querySelectorAll('#ff-chips .ff-chip').forEach(function(chip) {
        var chipLower = chip.textContent.toLowerCase();
        // Only force-deactivate if the chip text is completely gone from input
        if (chip.classList.contains('active') && val.indexOf(chipLower) === -1) {
          chip.classList.remove('active');
        }
      });
      ffSearch();
    });
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); ffSearch(); }
    });
  }

  // Min-match slider
  var slider = document.getElementById('ff-min-pct');
  var sliderVal = document.getElementById('ff-min-pct-val');
  if (slider && sliderVal) {
    slider.addEventListener('input', function() {
      ffMinPct = parseInt(slider.value, 10);
      sliderVal.textContent = ffMinPct === 0 ? 'Any' : ffMinPct + '%+';
      ffRenderResults();
    });
  }

  // Restore any saved shopping extras
  ffInjectExtrasIntoShop();
}
document.addEventListener('DOMContentLoaded', initFridgeFinder);
