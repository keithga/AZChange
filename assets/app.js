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
  <a class="topic-link" href="${assets}/../address-lookup/">Address Lookup</a>
  <p>&nbsp;</p>
  <p>&nbsp;</p>
  <p class="disclaimer">Paid for by <a href="https://pimadems.org"  style="text-decoration: none;" >PCDP</a>, Brian Bickel Treasurer. Not authorized by any candidate or candidate's committee.</p>
</footer>`; 

    renderFooter(mount, fallbackFooterMarkup);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSharedFooter, { once: true });
  } else {
    loadSharedFooter();
  }

  if (!window.location.pathname.endsWith('address-lookup/')) {
    return;
  }

  // #endregion

  const topicMap = {
    Transportation: 'Transportation',
    Schools: 'Schools',
    Parks: 'Parks',
    Technology: 'Technology',
    Healthcare: 'Healthcare',
    Housing: 'Housing',
    Environment: 'Environment',
    PublicSafety: 'Public Safety',
    Economy: 'Economy',
    Water: 'Water'
  };

  // #region District Parsing and Card Rendering Logic

  const MAX_DISTRICTS = 12;
  const DEFAULT_CARD_COUNT = 18;
  const MAX_RENDERED_CARDS = 24;
  const pathSegment = window.location.pathname.split('/').filter(Boolean)[0];
  if (topicMap[pathSegment]) {
    sessionStorage.setItem('selectedTopic', topicMap[pathSegment]);
  }

  const form = document.getElementById('address-form');
  const input = document.getElementById('address-input');
  const gpsButton = document.getElementById('gps-button');
  const statusEl = document.getElementById('lookup-status');
  const districtList = document.getElementById('district-list');
  const cardGrid = document.getElementById('card-grid');
  let candidatesCache = null;

  const setStatus = (message) => {
    statusEl.textContent = message;
  };

  const parseDistricts = (payload) => {
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
      const text = String(value);
      if (/district|precinct|ward|congress|legislative/i.test(text)) {
        console.log('District-like text found:', text);

        found.add(text.trim());
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
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const item = String(itemDistrict).trim();
    const user = String(userDistrict).trim();
    const itemInUser = new RegExp(`\\b${escapeRegex(item)}\\b`, 'i').test(user);
    const userInItem = new RegExp(`\\b${escapeRegex(user)}\\b`, 'i').test(item);
    return itemInUser || userInItem;
  };

  const createCard = (item) => {
    const article = document.createElement('article');
    article.className = 'card';
    article.innerHTML = `
      <h3>${item.name}</h3>
      <p class="meta">${item.type} • ${item.issue}</p>
      <p>${item.description}</p>
      <p class="meta">Districts: ${item.districts.join(', ')}</p>
    `;
    return article;
  };

  const loadCandidates = async () => {
    if (candidatesCache) return candidatesCache;
    const response = await fetch('../data/candidates.json');
    candidatesCache = await response.json();
    return candidatesCache;
  };

  const renderCards = async (districts) => {
    const data = await loadCandidates();
    const selectedTopic = sessionStorage.getItem('selectedTopic');

    let matching = data.filter((item) =>
      item.districts.some((district) => districts.some((d) => districtMatches(district, d)))
    );

    if (!matching.length) {
      matching = data.slice(0, DEFAULT_CARD_COUNT);
    }

    if (selectedTopic && !matching.some((item) => item.type === 'Issue Highlight' && item.issue === selectedTopic)) {
      matching.unshift({
        name: `${selectedTopic} Focus`,
        type: 'Issue Highlight',
        issue: selectedTopic,
        description: `This card was added because your session started from the ${selectedTopic} topic page.`,
        districts: ['All Districts']
      });
    }

    cardGrid.innerHTML = '';
    matching.slice(0, MAX_RENDERED_CARDS).forEach((item) => cardGrid.appendChild(createCard(item)));
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
      setStatus('Lookup failed. Showing generic candidate and initiative cards.');
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
