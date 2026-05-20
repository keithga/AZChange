(function () {
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

  const pathSegment = window.location.pathname.split('/').filter(Boolean)[0];
  const MAX_DISTRICTS = 12;
  const DEFAULT_CARD_COUNT = 18;
  const MAX_RENDERED_CARDS = 24;
  if (topicMap[pathSegment]) {
    sessionStorage.setItem('selectedTopic', topicMap[pathSegment]);
  }

  if (!window.location.pathname.startsWith('/address-lookup')) {
    return;
  }

  const form = document.getElementById('address-form');
  const input = document.getElementById('address-input');
  const suggestionsEl = document.getElementById('suggestions');
  const gpsButton = document.getElementById('gps-button');
  const statusEl = document.getElementById('lookup-status');
  const districtList = document.getElementById('district-list');
  const cardGrid = document.getElementById('card-grid');
  let candidatesCache = null;
  let debounceTimer = null;

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
    const response = await fetch('/data/candidates.json');
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

  const fetchSuggestions = async (query) => {
    if (!query || query.length < 4) {
      suggestionsEl.innerHTML = '';
      return;
    }

    const url = `https://geocode.maps.co/search?country=US&state=AZ&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const results = await response.json();
    suggestionsEl.innerHTML = '';

    results.slice(0, 5).forEach((result) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = result.display_name;
      button.addEventListener('click', () => {
        input.value = result.display_name;
        suggestionsEl.innerHTML = '';
      });
      li.appendChild(button);
      suggestionsEl.appendChild(li);
    });
  };

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetchSuggestions(input.value).catch(() => {
        suggestionsEl.innerHTML = '';
      });
    }, 300);
  });

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
          const reverseUrl = `https://geocode.maps.co/reverse?lat=${latitude}&lon=${longitude}`;
          const response = await fetch(reverseUrl, { headers: { Accept: 'application/json' } });
          const data = await response.json();
          input.value = data.display_name || `${latitude}, ${longitude}`;
          setStatus('Location found.');
        } catch (error) {
          input.value = `${latitude}, ${longitude}`;
          setStatus('Location captured; address details unavailable.');
        }
      },
      () => setStatus('Unable to access location.')
    );
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const address = input.value.trim();
    if (!address) return;

    setStatus('Looking up district information...');
    const body = new URLSearchParams({ address }).toString();

    try {
      const response = await fetch('https://www.azcleanelections.gov/Custom/GetLocation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body
      });

      const text = await response.text();
      let payload = text;
      try {
        payload = JSON.parse(text);
      } catch (error) {
        console.warn('District lookup response was not JSON; parseDistricts will process raw text instead of parsed JSON.', error);
      }

      const districts = parseDistricts(payload);
      updateDistricts(districts.length ? districts : ['District information unavailable from response.']);
      await renderCards(districts);
      setStatus('Results loaded.');
    } catch (error) {
      updateDistricts(['Unable to reach district lookup service.']);
      await renderCards([]);
      setStatus('Lookup failed. Showing generic candidate and initiative cards.');
    }
  });
})();
