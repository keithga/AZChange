(function () {

  // #region Footer Loading Logic

  const FOOTER_MOUNT_ID = 'site-footer';
  const FOOTER_CACHE_KEY = 'sharedFooterMarkup';
  const FOOTER_FETCH_TIMEOUT_MS = 5000;

  const getFooterNodes = (markup) => {
    const doc = new DOMParser().parseFromString(markup, 'text/html');
    if (!doc.body.firstElementChild) {
      return null;
    }
    return Array.from(doc.body.childNodes);
  };

  const renderFooter = (mount, markup) => {
    const nodes = getFooterNodes(markup);
    if (!nodes) return false;
    mount.replaceChildren(...nodes);
    return true;
  };

  const loadSharedFooter = async () => {
    const mount = document.getElementById(FOOTER_MOUNT_ID);
    if (!mount) return;

    const assets = mount.getAttribute('path') ?? '../assets';

    const fallbackFooterMarkup = `
<footer class="site-footer">
    <h2>Candidates and Platforms</h2>
    <p>Which candidates are ready to tackle the issues you care about?</p>
  <a class="topic-link" href="${assets}/../address-lookup/">Address Lookup</a>
</footer>
<p>&nbsp;</p>
<p class="disclaimer">A voter outreach initiative of <a href="https://pimadems.org" style="text-decoration: none; color: inherit; font-weight: inherit;" >PCDP</a>, Brian Bickel Treasurer. Not authorized by any candidate or candidate's committee.</p>
<p>Media Resources Link <a href="${assets}/../media-resources/">here</a></p>
`;

    renderFooter(mount, fallbackFooterMarkup);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSharedFooter, { once: true });
  } else {
    loadSharedFooter();
  }

  // #endregion

  // #region Load topic from URL and store in session for use in card rendering. Only run lookup logic on address-lookup page.

  if ( document.body.hasAttribute('data-topic') ) {
    const topic = document.body.getAttribute('data-topic');
    console.log("User Selected Topic:", topic);
    sessionStorage.setItem('selectedTopic', topic );
  }

  if (!window.location.pathname.endsWith('address-lookup/')) {
    return;
  }

  // #endregion

  // #region UI Element References

  const form = document.getElementById('address-form');
  const input = document.getElementById('address-input');
  const gpsButton = document.getElementById('gps-button');
  const statusEl = document.getElementById('lookup-status');
  const districtList = document.getElementById('district-list');
  const cardGrid = document.getElementById('card-grid');

  const setStatus = (message) => {
    statusEl.textContent = message;
  };

  // #endregion 

  // #region District Parsing and Card Rendering Logic

  const MAX_DISTRICTS = 12;
  const DEFAULT_CARD_COUNT = 18;
 
  let candidatesCache = null;

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const normalizeTopicKey = (value) => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  const TOPIC_ALIASES = {
    schools: 'education',
    publicsafety: 'safety'
  };

  const getTopicSearchKeys = (selectedTopic) => {
    const normalized = normalizeTopicKey(selectedTopic);
    if (!normalized) {
      return [];
    }

    const alias = TOPIC_ALIASES[normalized];
    return alias && alias !== normalized ? [normalized, alias] : [normalized];
  };

  const getIssueDescription = (issues, selectedTopic, selectedOnly = false) => {
    if (!issues || typeof issues !== 'object') {
      return '';
    }

    const searchKeys = getTopicSearchKeys(selectedTopic);
    if (searchKeys.length) {
      const topicEntry = Object.entries(issues).find(([key]) => searchKeys.includes(normalizeTopicKey(key)));
      if (topicEntry && String(topicEntry[1] ?? '').trim()) {
        return String(topicEntry[1]).trim();
      }
    }

    if (selectedOnly) {
      return '';
    }

    const firstIssue = Object.values(issues).find((value) => String(value ?? '').trim());
    return firstIssue ? String(firstIssue).trim() : '';
  };

  const normalizeCandidate = (item, selectedTopic) => {
    const rawDistricts = Array.isArray(item?.districts)
      ? item.districts
      : item?.District
        ? [item.District]
        : item?.district
          ? [item.district]
          : [];

    const districts = rawDistricts
      .map((district) => String(district ?? '').trim())
      .filter(Boolean);

    const issueContainer = item?.Issues && typeof item.Issues === 'object'
      ? item.Issues
      : item?.issues && typeof item.issues === 'object'
        ? item.issues
        : null;

    const topicIssueSummary = getIssueDescription(issueContainer, selectedTopic, true);
    const issueSummary = getIssueDescription(issueContainer, selectedTopic);
    const issueLabel = selectedTopic
      || (issueContainer && Object.keys(issueContainer)[0])
      || item?.issue
      || 'Candidate';

    const baseDescription = String(item?.description ?? item?.Description ?? '').trim();

    return {
      name: String(item?.Name ?? item?.name ?? 'Unknown Candidate').trim(),
      type: String(item?.Party ?? item?.type ?? 'Candidate').trim() || 'Candidate',
      issue: String(item?.Office ?? item?.issue ?? issueLabel).trim() || issueLabel,
      description: baseDescription || issueSummary || 'Candidate information is available for this office.',
      topicDescription: topicIssueSummary,
      districts,
      bioUrl: item?.Bio ? String(item.Bio).trim() : '',
      imageUrl: item?.picture ? String(item.picture).trim() : ''
    };
  };

  const parseDistricts = (payload) => {
    const loc = payload && typeof payload === 'object' && payload.loc && typeof payload.loc === 'object'
      ? payload.loc
      : null;

    if (loc) {
      const preferredFields = [
        ['CongressDist', 'Congressional District'],
        ['State', 'State'],
        ['LegDist', 'Legislative District'],
        ['County', 'County'],
        ['CountyDist', 'County District'],
        ['City', 'City'],
        ['CityDist', 'City District'],
        ['Packed', 'Coded District']
      ];

      const formatted = preferredFields
        .filter(([field]) => loc[field] !== undefined && loc[field] !== null && String(loc[field]).trim() !== '')
        .map(([field, label]) => `${label}: ${String(loc[field]).trim()}`);

      if (!formatted.some((entry) => /^State\s*:/i.test(entry))) {
        formatted.unshift('State: Arizona');
      }

      if (formatted.length) {
        return formatted.slice(0, MAX_DISTRICTS);
      }
    }

    // Fallback for unexpected response shapes.
    const found = new Set();
    const walk = (value) => {
      if (value == null) return;
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (typeof value === 'object') {
        Object.values(value).forEach(walk);
        return;
      }
      const text = String(value).trim();
      if (text) {
        found.add(text);
      }
    };

    walk(payload);
    return Array.from(found).slice(0, MAX_DISTRICTS);
  };

  const updateDistricts = (districts) => {
    districtList.innerHTML = '';
    districts.forEach((district) => {
      const li = document.createElement('li');
      li.textContent = district;
      districtList.appendChild(li);
    });
  };

  const districtMatches = (itemDistrict, userDistrict) => {
    const normalizeDistrictText = (value) => String(value)
      .toLowerCase()
      .replace(/congressional/g, 'congress')
      .replace(/legislative/g, 'leg')
      .replace(/state\s*dist(rict)?/g, 'leg district')
      .replace(/county\s*dist(rict)?/g, 'county district')
      .replace(/city\s*dist(rict)?/g, 'city district')
      .replace(/congress\s*dist(rict)?/g, 'congress district')
      .replace(/leg\s*dist(rict)?/g, 'leg district')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    const item = normalizeDistrictText(itemDistrict);
    const user = normalizeDistrictText(userDistrict);

    if (!item || !user) return false;
    if (item === user || item.includes(user) || user.includes(item)) {
      return true;
    }

    const itemNumMatch = item.match(/\b(\d+)\b/);
    const userNumMatch = user.match(/\b(\d+)\b/);
    if (!itemNumMatch || !userNumMatch || itemNumMatch[1] !== userNumMatch[1]) {
      return false;
    } 

    const itemType = item.includes('leg district')
      ? 'leg district'
      : item.includes('congress district')
        ? 'congress district'
        : item.includes('county district')
          ? 'county district'
          : item.includes('city district')
            ? 'city district'
            : '';

    const userType = user.includes('leg district')
      ? 'leg district'
      : user.includes('congress district')
        ? 'congress district'
        : user.includes('county district')
          ? 'county district'
          : user.includes('city district')
            ? 'city district'
            : '';

    // If both specify district types, require matching type to avoid false positives.
    if (itemType && userType && itemType !== userType) {
      return false;
    }

    return true;
  };

  const createCard = (item) => {
    const article = document.createElement('article');
    article.className = 'card';

    const safeName = escapeHtml(item.name);
    const safeType = escapeHtml(item.type);
    const safeIssue = escapeHtml(item.issue);
    const safeDescription = escapeHtml(item.description);
    const safeDistricts = escapeHtml(item.districts.join(', ') || 'All Districts');
    const safeTopicDescription = escapeHtml(item.topicDescription || '');
    const bioMarkup = item.bioUrl
      ? `<p><a href="${escapeHtml(item.bioUrl)}" target="_blank" rel="noopener noreferrer">View candidate details</a></p>`
      : '';
    const topicMarkup = safeTopicDescription
      ? `<p><strong>Topic match:</strong> ${safeTopicDescription}</p>`
      : '';

    article.innerHTML = `
      <h3>${safeName}</h3>
      <p class="meta">${safeType} • ${safeIssue}</p>
      <p>${safeDescription}</p>
      ${topicMarkup}
      <p class="meta">Districts: ${safeDistricts}</p>
      ${bioMarkup}
    `;
    return article;
  };

  const loadCandidates = async () => {
    if (candidatesCache) return candidatesCache;
    const response = await fetch('../data/candidates.json');
    const payload = await response.json();
    candidatesCache = Array.isArray(payload)
      ? payload.filter((item) => item && typeof item === 'object' && (item.Name || item.name || item.Office || item.issue || item.District || item.district || item.districts))
      : [];
    return candidatesCache;
  };

  const renderCards = async (districts) => {
    const data = await loadCandidates();
    const selectedTopic = sessionStorage.getItem('selectedTopic') || '';

    const normalizedCandidates = data.map((item) => normalizeCandidate(item, selectedTopic));

    let matching = normalizedCandidates.filter((item) =>
      item.districts.some((district) => districts.some((d) => districtMatches(district, d)))
    );

    if (!matching.length) {
      matching = normalizedCandidates.slice(0, DEFAULT_CARD_COUNT);
    }

    cardGrid.innerHTML = '';
    matching.forEach((item) => cardGrid.appendChild(createCard(item)));
  };

  // #endregion

  // #region Address auto-fill and status update logic

    const getGoogleMapsApiKey = () => {
    const mapsScript = Array.from(document.scripts).find((script) =>
      script.src && script.src.includes('maps.googleapis.com/maps/api/js')
    );

    if (!mapsScript) return '';

    try {
      const url = new URL(mapsScript.src);
      return url.searchParams.get('key') || '';
    } catch (error) {
      return '';
    }
  };

  input.addEventListener('input', () => {
    const typedAddress = input.value.trim();
    if (!typedAddress) {
      setStatus('');
      return;
    }
    setStatus('Address entered. Select "Find My Districts" to run lookup.');
  });

  // #endregion

  // #region Address Lookup and Geolocation Logic

  const submitAddressLookup = async () => {
    const address = input.value.trim();
    if (!address) return;

    setStatus('Looking up district information...');
    const body = new URLSearchParams({ address }).toString();

    try {
      const response = await fetch('../services/AddressProxy.ashx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body
      });

      const payload = await response.json();
      console.log('District lookup payload:', payload);

      const districts = parseDistricts(payload);
      updateDistricts(districts.length ? districts : ['District information unavailable from response.']);
      await renderCards(districts);
      setStatus('Results loaded.');
    } catch (error) {
      updateDistricts(['Unable to reach district lookup service.']);
      await renderCards([]);
      setStatus('Lookup failed. Showing generic candidate and proposition cards.');
    }
  };

  gpsButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported by this browser.');
      return;
    }
    setStatus('Getting your location...');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const body = new URLSearchParams({
            lat: String(latitude),
            lon: String(longitude)
          }).toString();
          const response = await fetch('../services/ReverseGeocodeProxy.ashx', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body
          });

          if (!response.ok) {
            throw new Error(`Reverse geocode failed with status ${response.status}`);
          }

          const data = await response.json();
          console.info('Reverse geocoding result:', data);
          input.value = data.display_name || `${latitude}, ${longitude}`;
          setStatus('Location found. Looking up district information...');
          form.requestSubmit();
        } catch (error) {
          console.info('Reverse geocoding failed, falling back to coordinates. Error:', error);
          input.value = `${latitude}, ${longitude}`;
          setStatus('Location captured; address details unavailable.');
        }
      },
      () => setStatus('Unable to access location.')
    );
  });

  // #endregion

  // #region Form submission and card rendering

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitAddressLookup();
  });

  // #endregion

})();
