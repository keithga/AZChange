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
  - District lookup API POST to local IIS proxy at `/services/AddressProxy.ashx`
  - Candidate/initiative cards from `/data/candidates.json`

## IIS address proxy service

When hosted on IIS with ASP.NET enabled, `/services/AddressProxy.ashx` accepts a POSTed
`address` value and forwards it to `https://customsite.com/testapi/` as URL-encoded form
data with `next=true`.

Set `AddressProxyUpstreamUrl` in `/web.config` for environment-specific upstream targets.
The handler validates HTTPS and restricts the host to `customsite.com`.
