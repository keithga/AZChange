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
  - Candidate/Proposition cards from `/data/candidates.json`

## IIS address proxy service

When hosted on IIS with ASP.NET enabled, `/services/AddressProxy.ashx` accepts a POSTed
`address` value and forwards it to `https://customsite.com/testapi/` as URL-encoded form
data with `next=true`.

Set `AddressProxyUpstreamUrl` in `/web.config` for environment-specific upstream targets.
Set `AddressProxyAllowedHost` to define which HTTPS host is permitted (default `customsite.com`).

## IIS reverse geocode proxy service

Browser JavaScript cannot set the `User-Agent` request header. To support OpenStreetMap
Nominatim requirements, `/services/ReverseGeocodeProxy.ashx` accepts `lat` and `lon`
via POST and forwards the request server-side with a configurable `User-Agent` header.

Configure these keys in `/web.config` as needed:

- `ReverseGeocodeUpstreamUrl` (default `https://nominatim.openstreetmap.org/reverse`)
- `ReverseGeocodeAllowedHost` (default `nominatim.openstreetmap.org`)
- `ReverseGeocodeUserAgent` (default `AZChange.org/1.0 (admin@AzChange.org)`)

The proxy sends `format=jsonv2`, plus `lat`/`lon`, and returns upstream JSON.
