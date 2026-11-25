const PROJECT_ID = "khashabita-catalog";
const FIREBASE_API_KEY = "AIzaSyAsP8H7ervpQjGR8Qdh6GDYS_DRI_63iVY";
const CATALOG_URL = "https://ahmed204a58-bit.github.io/Khashabita-Catalog/";

function field(fields, name) {
  const value = fields?.[name];
  if (!value) return undefined;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.arrayValue?.values) {
    return value.arrayValue.values.map((item) => {
      if (item.stringValue !== undefined) return item.stringValue;
      if (item.integerValue !== undefined) return Number(item.integerValue);
      if (item.doubleValue !== undefined) return Number(item.doubleValue);
      return null;
    }).filter((item) => item !== null);
  }
  return undefined;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function absoluteImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const clean = value.trim();
  if (/^https:\/\//i.test(clean)) return clean;
  if (/^(?:\.\/)?products\/[\w./-]+\.(?:png|jpe?g|webp|gif)$/i.test(clean) && !clean.includes("..")) {
    return new URL(clean.replace(/^\.\//, ""), CATALOG_URL).toString();
  }
  return "";
}

async function getProduct(productId) {
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products/${encodeURIComponent(productId)}`,
  );
  url.searchParams.set("key", FIREBASE_API_KEY);

  const response = await fetch(url.toString(), {
    headers: { "Accept": "application/json" },
    cf: { cacheTtl: 60, cacheEverything: true },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Firestore read failed:", response.status, detail.slice(0, 500));
    throw new Error("تعذر تحميل بيانات المنتج");
  }

  const document = await response.json();
  const fields = document.fields || {};
  const imageList = field(fields, "imageUrls");
  const images = Array.isArray(imageList)
    ? imageList.map(absoluteImageUrl).filter(Boolean)
    : [];
  const legacyImage = absoluteImageUrl(field(fields, "imageUrl"));
  const priceValue = field(fields, "price");
  const price = Number(priceValue);

  return {
    id: productId,
    name: String(field(fields, "name") || "منتج من خشابيتا"),
    sku: String(field(fields, "sku") || ""),
    category: String(field(fields, "category") || "منتجات خشبية"),
    description: String(field(fields, "description") || "اكتشف المنتج من كتالوج خشابيتا CNC."),
    price: Number.isFinite(price) ? price : null,
    image: images[0] || legacyImage || new URL("favicon-512.png", CATALOG_URL).toString(),
  };
}

function pageHtml(product, shareUrl) {
  const title = `${product.name} | خشابيتا CNC`;
  const priceText = product.price === null
    ? "السعر: للاستفسار"
    : `السعر: ${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(product.price)} ج.م`;
  const description = [priceText, product.category, product.description]
    .filter(Boolean)
    .join(" • ")
    .slice(0, 240);
  const catalogProductUrl = new URL(CATALOG_URL);
  catalogProductUrl.searchParams.set("product", product.id);

  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(product.image);
  const safeShareUrl = escapeHtml(shareUrl);
  const safeCatalogUrl = escapeHtml(catalogProductUrl.toString());
  const safeProductName = escapeHtml(product.name);

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="خشابيتا CNC">
<meta property="og:locale" content="ar_EG">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${safeShareUrl}">
<meta property="og:image" content="${safeImage}">
<meta property="og:image:alt" content="${safeProductName}">
<meta property="product:price:amount" content="${product.price === null ? "" : String(product.price)}">
<meta property="product:price:currency" content="EGP">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${safeImage}">
<meta name="robots" content="index,follow">
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:28px 16px;display:grid;place-items:center;background:linear-gradient(145deg,#061b3b,#0b4380 58%,#061b3b);font-family:Tahoma,Arial,sans-serif;color:#102b59}
main{width:min(100%,520px);background:#fff;border:1px solid #b9e7ff;border-radius:22px;overflow:hidden;box-shadow:0 18px 55px #00132d66;text-align:center}
img{display:block;width:100%;max-height:360px;object-fit:contain;background:#edf4fa}
section{padding:22px}h1{font-size:22px;margin:0 0 10px}.price{font-size:20px;font-weight:bold;color:#e32924;margin:12px 0}
p{color:#64748b;line-height:1.8;margin:8px 0 18px}
a{display:block;padding:14px 18px;border-radius:12px;background:#0879dc;color:#fff;text-decoration:none;font-weight:bold}
</style>
<script>setTimeout(function(){window.location.replace(${JSON.stringify(catalogProductUrl.toString())});},900);</script>
</head>
<body>
<main>
<img src="${safeImage}" alt="${safeProductName}">
<section>
<h1>${safeProductName}</h1>
<div class="price">${escapeHtml(priceText)}</div>
<p>جاري فتح المنتج في كتالوج خشابيتا...</p>
<a href="${safeCatalogUrl}">افتح المنتج في الكتالوج</a>
</section>
</main>
</body>
</html>`;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { "Allow": "GET, HEAD" },
      });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("Khashabita product-share worker is ready.", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const match = url.pathname.match(/^\/p\/([A-Za-z0-9_-]{1,128})\/?$/);
    if (!match) {
      return new Response("Not Found", { status: 404 });
    }

    const productId = match[1];
    try {
      const product = await getProduct(productId);
      if (!product) {
        return new Response("المنتج غير موجود في كتالوج خشابيتا.", {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      const body = pageHtml(product, request.url);
      return new Response(request.method === "HEAD" ? null : body, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60, s-maxage=300",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      });
    } catch (error) {
      console.error("Product share error:", error);
      return new Response("تعذر تجهيز معاينة المنتج حاليًا.", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  },
};
