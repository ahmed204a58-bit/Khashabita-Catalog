# Khashabita product-share preview Worker

This Worker returns server-rendered Open Graph metadata for an individual Firestore product.

## Deploy once (Cloudflare dashboard)

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Choose **Create application** → **Create Worker**.
3. Name it `khashabita-product-share` and deploy the starter.
4. Open **Edit code**, replace the starter code with the complete contents of `worker.js`, then save and deploy.
5. Copy the Worker URL ending in `.workers.dev`.

The Worker reads product documents from the existing Firestore collection. Firestore's current public read rule for `products` is used; no admin credentials or service-account key are included.

## Finish connecting the catalog

Send the deployed Worker URL. The catalog's copy-link button will then be switched to URLs like:

```
https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/p/FIRESTORE_PRODUCT_ID
```

When a social crawler requests that URL, the Worker responds with product-specific Open Graph title, description, image, and price. When a person opens it, the browser forwards them to the matching product in the GitHub Pages catalog.

## Test

After deploying, open:

- `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/health`
- `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/p/PRODUCT_ID`

The first should say that the Worker is ready. The second should show a product landing page and include the product-specific Open Graph tags in its HTML source.

## Limits

Cloudflare's Workers Free plan currently lists 100,000 requests per day. Workers on `workers.dev` are described by Cloudflare as intended for personal or hobby projects; for a production business domain, use a custom domain routed to the Worker if one becomes available.
