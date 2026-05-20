# AZChange

Voter information website for Arizona.

## Local preview

From the repository root:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Included pages

- Home page with links to 10 issue/topic folders
- Topic pages with placeholder (lorem ipsum) content
- Address Lookup page with:
  - Address entry + realtime suggestions
  - Browser GPS lookup
  - District lookup API POST to `https://www.azcleanelections.gov/Custom/GetLocation`
  - Candidate/initiative cards from `/data/candidates.json`
