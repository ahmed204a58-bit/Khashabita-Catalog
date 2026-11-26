import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAsP8H7ervpQjGR8Qdh6GDYS_DRI_63iVY",
  authDomain: "khashabita-catalog.firebaseapp.com",
  projectId: "khashabita-catalog",
  storageBucket: "khashabita-catalog.firebasestorage.app",
  messagingSenderId: "511523446069",
  appId: "1:511523446069:web:9cc601e4c6f6dd9a2ac07c",
  measurementId: "G-6Y64SKT5RT"
};
const ADMIN_EMAIL = "ahmed204a58@gmail.com";
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const provider = new GoogleAuthProvider();
const $ = id => document.getElementById(id);
const THEME_STORAGE_KEY = "khashabita-theme";
function applySiteTheme(theme, save = false) {
 const selected = theme === "dark" ? "dark" : "light";
 document.documentElement.dataset.theme = selected;
 document.documentElement.style.colorScheme = selected;
 const button = $("themeToggle");
 if (button) {
  button.textContent = selected === "dark" ? "☀" : "☾";
  button.setAttribute("aria-pressed", String(selected === "dark"));
  button.setAttribute("aria-label", selected === "dark" ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن");
  button.title = selected === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن";
 }
 const themeMeta = document.querySelector('meta[name="theme-color"]');
 if (themeMeta) themeMeta.setAttribute("content", selected === "dark" ? "#0b1422" : "#082e70");
 if (save) {
  try { localStorage.setItem(THEME_STORAGE_KEY, selected); }
  catch (err) { console.warn("Could not save theme preference:", err); }
 }
}
let savedSiteTheme = "light";
try { savedSiteTheme = localStorage.getItem(THEME_STORAGE_KEY) || "light"; }
catch (err) { console.warn("Could not read theme preference:", err); }
applySiteTheme(savedSiteTheme);
$("themeToggle")?.addEventListener("click", () => {
 const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
 applySiteTheme(nextTheme, true);
});

let products = [], editingId = null, unsubscribe = null, currentUser = null;
let activeProduct = null, activeImageIndex = 0;
let imageChangeDirection = 1;
let deepLinkHandled = false;
const CATALOG_PAGE_TITLE = document.title;
// Set to the deployed Cloudflare Worker origin to enable product-specific social previews.
const PRODUCT_SHARE_WORKER_BASE = "https://khashabita-product-share.ahmed204a58.workers.dev";

function safe(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function money(n){return Number(n||0).toLocaleString("ar-EG")+" ج.م";}
function isOfferProduct(p){const original=Number(p?.price||0),sale=Number(p?.offerPrice||0);return p?.isOffer===true&&original>0&&sale>0&&sale<original;}
function offerDiscount(p){return isOfferProduct(p)?Math.round((1-Number(p.offerPrice)/Number(p.price))*100):0;}
function priceMarkup(p){return isOfferProduct(p)?`<div class="price offer-price-group"><del>${money(p.price)}</del><strong>${money(p.offerPrice)}</strong></div>`:`<div class="price">${money(p.price)}</div>`;}
function productAvailability(p){
 const value=p?.availabilityStatus;
 return ["available","made-to-order","unavailable"].includes(value)?value:"available";
}
function availabilityLabel(p){
 return ({available:"متاح الآن","made-to-order":"ينفذ حسب الطلب",unavailable:"غير متاح حاليًا"})[productAvailability(p)];
}
function availabilityBadgeMarkup(p, extraClass=""){
 const status=productAvailability(p);
 return `<span class="product-availability-badge availability-${status} ${extraClass}">${availabilityLabel(p)}</span>`;
}
function orderButtonMarkup(p,label,className="btn wa",track=false){
 const status=productAvailability(p);
 if(status==="unavailable")return `<span class="${className} availability-disabled" aria-disabled="true">غير متاح حاليًا</span>`;
 const finalLabel=status==="made-to-order"?(label==="اطلب"?"حسب الطلب":"اطلب حسب الطلب"):label;
 return `<a class="${className}" target="_blank" rel="noopener" href="${waLink(p)}"${track?` data-track-whatsapp="${safe(p.id)}"`:""}>${finalLabel}</a>`;
}

function isAdmin(){return !!currentUser && currentUser.email?.toLowerCase()===ADMIN_EMAIL.toLowerCase();}
function validImage(u){return /^https:\/\//i.test(u) || (/^(?:\.\/|products\/)[\w./-]+\.(?:png|jpe?g|webp|gif)$/i.test(u) && !u.includes(".."));}
function productImages(p){return (Array.isArray(p.imageUrls)?p.imageUrls:(p.imageUrl?[p.imageUrl]:[])).filter(validImage);}
function showAdmin(on){$("catalog").classList.toggle("hidden",on);$("admin").classList.toggle("hidden",!on);$("adminBtn").textContent=on?"عرض الكتالوج":"دخول الإدارة";}
function waLink(p){const amount=isOfferProduct(p)?p.offerPrice:p.price;const priceText=isOfferProduct(p)?("السعر بعد الخصم "+amount+" جنيه بدل "+p.price+" جنيه"):("السعر "+(amount||"")+" جنيه");const orderNote=productAvailability(p)==="made-to-order"?" - المنتج بيتنفذ حسب الطلب":"";return "https://wa.me/201116026022?text="+encodeURIComponent("السلام عليكم، عايز أطلب "+p.name+" - الكود "+(p.sku||"")+" - "+priceText+orderNote);}

function render(){
 const cats=[...new Set(["هدايا مخصصة","دروع وتكريم","ألعاب وبازل","رمضان والأعياد","مجسمات معمارية","ديكورات منزلية","قسم السيارات",...products.map(p=>p.category).filter(Boolean)])];
 const chosen=$("categoryFilter").value;
 $("categoryFilter").innerHTML='<option value="">كل الأقسام</option>'+cats.map(c=>`<option value="${safe(c)}">${safe(c)}</option>`).join("");
 $("categoryFilter").value=cats.includes(chosen)?chosen:"";
 const term=$("search").value.trim().toLowerCase();
 const selectedAvailability=$("availabilityFilter")?.value||"";
 const visible=products.filter(p=>(!$("categoryFilter").value||p.category===$("categoryFilter").value)&&(!selectedAvailability||productAvailability(p)===selectedAvailability)&&(!term||[p.name,p.sku,p.category,p.description].join(" ").toLowerCase().includes(term)));

 $("products").innerHTML=visible.length?visible.map(p=>{
   const imgs=productImages(p), cover=imgs[0];
   const isNew=products.indexOf(p)>=0 && products.indexOf(p)<5;
   return `<article class="card">
     <button class="card-photo" data-open="${safe(p.id)}" aria-label="عرض تفاصيل ${safe(p.name)}">
       ${cover?`<img src="${safe(cover)}" alt="${safe(p.name)}" loading="lazy">`:`<span class="photo-placeholder" aria-hidden="true">▧</span>`}
       ${isNew?`<span class="new-product-badge" aria-label="منتج جديد" style="position:absolute;top:9px;left:12px;right:auto;z-index:50;display:block;width:108px;height:74px;opacity:1;visibility:visible;pointer-events:none;filter:drop-shadow(0 5px 8px rgba(0,10,32,.48))"><span aria-hidden="true" style="position:absolute;top:0;left:0;display:block;width:108px;height:14px;background:linear-gradient(90deg,#071b36 0%,#4d9acb 15%,#d8f5ff 45%,#4d9acb 82%,#071b36 100%);clip-path:polygon(8% 0,92% 0,100% 100%,0 100%)"></span><span aria-hidden="true" style="position:absolute;top:8px;left:11px;display:flex;align-items:center;justify-content:center;width:86px;height:59px;background:linear-gradient(145deg,#174d7c 0%,#0a2e56 48%,#04172f 100%);border:1px solid #70d4ff;border-top:0;border-radius:0 0 21px 21px;box-shadow:inset 0 1px 0 rgba(255,255,255,.24),inset 0 -8px 14px rgba(0,0,0,.24)"><span aria-hidden="true" style="position:absolute;top:0;left:10px;right:10px;height:2px;background:linear-gradient(90deg,transparent,#c9f4ff,#fff,#c9f4ff,transparent);box-shadow:0 0 8px #3ac7ff"></span><b style="position:relative;color:#fff;font-family:Tahoma,Arial,sans-serif;font-size:19px;font-weight:900;line-height:1;text-shadow:0 0 9px rgba(62,196,255,.66),0 2px 2px rgba(0,0,0,.45)">جديد</b></span><span aria-hidden="true" style="position:absolute;top:12px;left:0;width:12px;height:14px;background:#061a34;clip-path:polygon(100% 0,100% 100%,0 72%)"></span><span aria-hidden="true" style="position:absolute;top:12px;right:0;width:12px;height:14px;background:#061a34;clip-path:polygon(0 0,100% 72%,0 100%)"></span></span>`:""}
       ${imgs.length>1?`<span class="image-count">▧ ${imgs.length} صور</span>`:""}
     </button>
     <div class="content">
       <span class="product-category">${safe(p.category||"منتج خشبي")}</span>${availabilityBadgeMarkup(p)}
       <h3>${safe(p.name)}</h3>
       <div class="muted">${p.dimensions?safe(p.dimensions)+" · ":""}${safe(p.material||"خشب MDF")}</div>
       ${priceMarkup(p)}
       <div class="card-actions"><button class="light" data-open="${safe(p.id)}">تفاصيل المنتج</button>${orderButtonMarkup(p,"اطلب على واتساب","btn wa",true)}</div>
     </div></article>`;
 }).join(""):'<div class="empty"><span class="empty-icon">⌕</span><b>لا توجد منتجات مطابقة</b><p>جرّب البحث بكلمة تانية أو اختار قسم مختلف.</p></div>';
 renderOffers();
 $("adminList").innerHTML=products.length?products.map(p=>`<div class="adminrow"><span><b>${safe(p.name)}</b><br><small class="muted">${safe(p.sku)} · ${availabilityLabel(p)} · ${isOfferProduct(p)?`عرض بسعر ${money(p.offerPrice)} بدل ${money(p.price)}`:money(p.price)}</small></span><span class="actions"><button class="light" data-edit="${safe(p.id)}">تعديل</button><button class="danger" data-delete="${safe(p.id)}">حذف</button></span></div>`).join(""):'<p class="muted">لا توجد منتجات بعد.</p>';
}
function renderOffers(){
 const target=$("offerProducts");
 if(!target)return;
 const offers=products.filter(isOfferProduct);
 target.innerHTML=offers.length?offers.map(p=>{
  const cover=productImages(p)[0], discount=offerDiscount(p);
  return `<article class="offer-mini-card">
   <button type="button" class="offer-mini-image" data-open="${safe(p.id)}" aria-label="عرض تفاصيل ${safe(p.name)}">
    ${cover?`<img src="${safe(cover)}" alt="${safe(p.name)}" loading="lazy">`:`<span class="offer-mini-placeholder" aria-hidden="true">▧</span>`}
    <span class="offer-mini-ribbon">خصم ${discount}٪</span>
   </button>
   <div class="offer-mini-info">
    <h3>${safe(p.name)}</h3>
    <div class="offer-mini-prices"><del>${money(p.price)}</del><strong>${money(p.offerPrice)}</strong></div>
    <div class="offer-mini-actions">
     <button type="button" class="offer-mini-details" data-open="${safe(p.id)}">التفاصيل</button>
     ${orderButtonMarkup(p,"اطلب","offer-mini-buy",true)}
    </div>
   </div>
  </article>`;
 }).join(""):'<div class="offers-empty">العروض الخاصة هتظهر هنا بمجرد تفعيلها من لوحة الإدارة.</div>';
}

function resetForm(){editingId=null;$("productForm").reset();$("availabilityStatus").value="available";$("isOffer").checked=false;$("offerPrice").value="";$("offerFields").classList.add("hidden");$("material").value="خشب MDF";$("formTitle").textContent="إضافة منتج جديد";$("imagePreviewWrap").classList.add("hidden");$("imagePreviews").innerHTML="";}
function startListener(){
 if(unsubscribe)unsubscribe();
 const q=query(collection(db,"products"),orderBy("createdAt","desc"));
 unsubscribe=onSnapshot(q,snap=>{products=snap.docs.map(d=>({id:d.id,...d.data()}));render();openSharedProductFromUrl();},err=>{$("products").innerHTML='<div class="empty">تعذر تحميل المنتجات. راجع إعدادات قاعدة البيانات.</div>';console.error(err);});
}
$("adminBtn").onclick=async()=>{if(isAdmin()){showAdmin($("catalog").classList.contains("hidden"));return;}try{const result=await signInWithPopup(auth,provider);if(result.user.email?.toLowerCase()!==ADMIN_EMAIL.toLowerCase()){await signOut(auth);alert("هذا الحساب غير مصرح له بإدارة الكتالوج.");}}catch(e){alert("تعذر تسجيل الدخول باستخدام Google: "+e.message);}};
$("logout").onclick=()=>signOut(auth);
$("search").oninput=render;$("categoryFilter").onchange=render;$("availabilityFilter").onchange=render;
$("homeButton")?.addEventListener("click",()=>{
 $("categoryFilter").value="";
 $("availabilityFilter").value="";
 $("search").value="";
 render();
 window.scrollTo({top:0,behavior:"smooth"});
});
$("isOffer")?.addEventListener("change",()=>{$("offerFields").classList.toggle("hidden",!$("isOffer").checked);if(!$("isOffer").checked)$("offerPrice").value="";});
$("productForm").onsubmit=async e=>{
 e.preventDefault();if(!isAdmin())return alert("غير مصرح.");
 const imageUrls=$("imageUrls").value.split(/\n|,/).map(u=>u.trim()).filter(Boolean);
 if(imageUrls.some(u=>!validImage(u)))return alert("استخدم روابط صور HTTPS أو مسارات صور داخل مجلد products مثل products/car-1.jpg");
 const originalPrice=Number($("price").value),offerEnabled=$("isOffer").checked,discountedPrice=Number($("offerPrice").value);
 if(offerEnabled&&(!discountedPrice||discountedPrice<=0||discountedPrice>=originalPrice))return alert("سعر العرض لازم يكون أكبر من صفر وأقل من السعر الأساسي.");
 const data={name:$("name").value.trim(),sku:$("sku").value.trim(),availabilityStatus:$("availabilityStatus").value||"available",price:Number($("price").value),isOffer:offerEnabled,offerPrice:offerEnabled?discountedPrice:null,category:$("category").value.trim(),dimensions:$("dimensions").value.trim(),material:$("material").value.trim(),description:$("description").value.trim(),imageUrls,updatedAt:serverTimestamp()};
 try{
  if(editingId)await updateDoc(doc(db,"products",editingId),data);
  else await addDoc(collection(db,"products"),{...data,createdAt:serverTimestamp()});
  resetForm();alert("تم حفظ المنتج وتحديث الكتالوج.");
 }catch(err){console.error(err);alert("لم يتم الحفظ: "+err.message);}
};
$("cancelEdit").onclick=resetForm;
$("adminList").onclick=async e=>{
 const edit=e.target.dataset.edit, del=e.target.dataset.delete;
 if(edit){const p=products.find(x=>x.id===edit);if(!p)return;editingId=p.id;$("availabilityStatus").value=p.availabilityStatus||"available";for(const k of ["name","sku","price","category","dimensions","material","description"])$(k).value=p[k]??"";$("isOffer").checked=isOfferProduct(p);$("offerPrice").value=isOfferProduct(p)?p.offerPrice:"";$("offerFields").classList.toggle("hidden",!$("isOffer").checked);$("imageUrls").value=productImages(p).join("\n");updateImagePreview();$("formTitle").textContent="تعديل المنتج";$("productForm").scrollIntoView({behavior:"smooth"});}
 if(del&&confirm("هل تريد حذف المنتج نهائياً؟")){try{await deleteDoc(doc(db,"products",del));}catch(err){alert("تعذر الحذف: "+err.message);}}
};
onAuthStateChanged(auth,user=>{
 currentUser=user;
 if(user&&!isAdmin()){signOut(auth);currentUser=null;showAdmin(false);alert("هذا الحساب غير مصرح له.");return;}
 $("adminEmail").textContent=user?`مسجل الدخول: ${user.email}`:"";
 if(unsubscribe)unsubscribe();startListener();showAdmin(!!user && isAdmin());
});

function updateImagePreview(){
 const urls=$("imageUrls").value.split(/\n|,/).map(u=>u.trim()).filter(validImage);
 $("imagePreviews").innerHTML=urls.map(u=>`<img src="${safe(u)}" alt="معاينة صورة المنتج">`).join("");
 $("imagePreviewWrap").classList.toggle("hidden",urls.length===0);
}
$("imageUrls").addEventListener("input",updateImagePreview);


function productShareUrl(productId){
 if(PRODUCT_SHARE_WORKER_BASE){
  return `${PRODUCT_SHARE_WORKER_BASE.replace(/\/+$/,"")}/p/${encodeURIComponent(productId)}`;
 }
 const url=new URL(window.location.href);
 url.search="";
 url.hash="";
 url.searchParams.set("product",productId);
 return url.toString();
}
async function copyTextToClipboard(value){
 try{
  if(navigator.clipboard&&window.isSecureContext){
   await navigator.clipboard.writeText(value);
   return true;
  }
 }catch(_){}
 const field=document.createElement("textarea");
 field.value=value;
 field.setAttribute("readonly","");
 field.style.position="fixed";
 field.style.left="-9999px";
 field.style.top="0";
 document.body.appendChild(field);
 field.focus();
 field.select();
 let copied=false;
 try{copied=document.execCommand("copy");}catch(_){}
 field.remove();
 return copied;
}
async function copyProductLink(productId,button){
 const copied=await copyTextToClipboard(productShareUrl(productId));
 if(!button)return copied;
 button.textContent=copied?"تم نسخ الرابط ✓":"تعذر النسخ";
 button.classList.toggle("copied",copied);
 button.disabled=true;
 window.setTimeout(()=>{
  if(button.isConnected){
   button.textContent="نسخ رابط المنتج";
   button.classList.remove("copied");
   button.disabled=false;
  }
 },1800);
 return copied;
}
function openSharedProductFromUrl(){
 if(deepLinkHandled)return;
 const productId=new URLSearchParams(window.location.search).get("product");
 if(!productId)return;
 const product=products.find(p=>p.id===productId);
 if(!product)return;
 deepLinkHandled=true;
 openDetails(product.id);
}

function setCatalogVisibility(showCatalog){
 const selectors=[".searchbar","#categoryTiles","#offersSection",".custom-order-section","#catalog"];
 selectors.forEach(selector=>document.querySelectorAll(selector).forEach(el=>el.classList.toggle("hidden",!showCatalog)));
 $("productPage").classList.toggle("hidden",showCatalog);
}
function openDetails(id, options={}){
 const p=products.find(x=>x.id===id);
 if(!p)return;
 if(!options.fromHistory){
  const nextUrl=new URL(window.location.href);
  const alreadyCurrent=nextUrl.searchParams.get("product")===id;
  if(!(window.history.state?.khashabitaProductPage&&window.history.state.productId===id)){
   nextUrl.searchParams.set("product",id);
   const state={khashabitaProductPage:true,productId:id,direct:alreadyCurrent};
   const address=nextUrl.pathname+nextUrl.search+nextUrl.hash;
   if(alreadyCurrent)window.history.replaceState(state,"",address);
   else window.history.pushState(state,"",address);
  }
 }
 activeProduct=p;
 activeImageIndex=0;
 deepLinkHandled=true;
 document.title=p.name+" | خشابيتا";
 setCatalogVisibility(false);
 renderDetails();
 if(typeof trackProductView==="function")trackProductView(p.id);
 window.scrollTo({top:0,behavior:"smooth"});
}

function relatedProductsMarkup(product){
 const others=products.filter(item=>item.id!==product.id);
 const sameCategory=product.category?others.filter(item=>item.category===product.category):[];
 const recommendations=[...sameCategory,...others.filter(item=>!sameCategory.some(match=>match.id===item.id))].slice(0,4);
 if(!recommendations.length)return "";
 return `
  <section class="related-products-section" aria-label="منتجات ممكن تعجبك">
   <div class="related-products-heading">
    <span class="related-products-kicker">اكتشف المزيد من خشابيتا</span>
    <h2>منتجات ممكن تعجبك</h2>
    <p>${sameCategory.length?"اختيارات من نفس القسم ومنتجات مميزة تانية":"شوف منتجات تانية ممكن تناسبك"}</p>
   </div>
   <div class="related-products-grid">
    ${recommendations.map(item=>{
     const cover=productImages(item)[0];
     return `<button type="button" class="related-product-card" data-open="${safe(item.id)}" aria-label="عرض تفاصيل ${safe(item.name)}">
      <span class="related-product-image">
       ${cover?`<img src="${safe(cover)}" alt="${safe(item.name)}" loading="lazy">`:'<span class="related-product-placeholder" aria-hidden="true">▧</span>'}
      </span>
      <span class="related-product-info">
       <span class="related-product-category">${safe(item.category||"منتج خشبي")}</span>
       <strong class="related-product-name">${safe(item.name)}</strong>
       ${availabilityBadgeMarkup(item,"related-product-status")}
       ${priceMarkup(item)}
      </span>
     </button>`;
    }).join("")}
   </div>
  </section>`;
}

function renderDetails(){
 if(!activeProduct)return;
 const p=activeProduct, imgs=productImages(p);
 const current=imgs[activeImageIndex]||"";
 const videoLinks=
  (/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(p.videoUrl||"")?'<a class="btn light" target="_blank" rel="noopener noreferrer" href="'+safe(p.videoUrl)+'">▶ شاهد على YouTube</a>':"")+
  (/^https:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com)\//i.test(p.tiktokUrl||"")?'<a class="btn light" target="_blank" rel="noopener noreferrer" href="'+safe(p.tiktokUrl)+'">▶ شاهد على TikTok</a>':"");
 $("productBreadcrumbName").textContent=p.name;
 $("productPageContent").innerHTML=`
  <div class="product-page-layout">
   <div class="product-page-gallery">
    <div class="product-page-main-image ${imageChangeDirection>0?"slide-from-right":"slide-from-left"}">
     ${current?`<img src="${safe(current)}" alt="${safe(p.name)}">`:`<span class="product-page-placeholder" aria-hidden="true">▧</span>`}
     ${imgs.length>1?`<button class="gallery-arrow prev" id="productGalleryPrev" aria-label="الصورة السابقة">‹</button><button class="gallery-arrow next" id="productGalleryNext" aria-label="الصورة التالية">›</button>`:""}
     ${imgs.length?`<span class="product-page-image-position">${activeImageIndex+1} / ${imgs.length}</span>`:""}
    </div>
    ${imgs.length>1?`<div class="product-page-thumbs">${imgs.map((u,i)=>`<button type="button" class="${i===activeImageIndex?"selected":""}" data-image-index="${i}" aria-label="عرض الصورة ${i+1}"><img src="${safe(u)}" alt=""></button>`).join("")}</div>`:""}
   </div>
   <article class="product-page-info">
    <span class="product-category">${safe(p.category||"منتج خشبي")}</span>
    ${availabilityBadgeMarkup(p,"product-page-status")}
    <h1>${safe(p.name)}</h1>
    ${priceMarkup(p)}
    <p class="product-page-description">${safe(p.description||"منتج مصنوع بعناية في خشابيتا CNC.")}</p>
    <div class="product-page-divider"></div>
    <dl class="product-page-specs">
     <div><dt>كود المنتج</dt><dd>${safe(p.sku||"—")}</dd></div>
     <div><dt>المقاس</dt><dd>${safe(p.dimensions||"حسب الطلب")}</dd></div>
     <div><dt>الخامة</dt><dd>${safe(p.material||"خشب MDF")}</dd></div>
    </dl>
    <div class="product-page-badges">
     ${isOfferProduct(p)?`<span class="product-page-discount">خصم ${offerDiscount(p)}٪</span>`:""}
     <span class="muted">تصميم وتنفيذ خشابيتا CNC</span>
    </div>
    ${videoLinks?`<div class="product-page-video-links">${videoLinks}</div>`:""}
    <div class="product-page-actions">
     ${orderButtonMarkup(p,"اطلب المنتج على واتساب","btn wa",true)}
     <button type="button" class="btn light modal-share-link" id="copyProductLink">نسخ رابط المنتج</button>
    </div>
   </article>
  </div>
  ${relatedProductsMarkup(p)}
  `;
 $("productGalleryPrev")?.addEventListener("click",()=>changeImage(-1));
 $("productGalleryNext")?.addEventListener("click",()=>changeImage(1));
 const mainImage=$("productPageContent").querySelector(".product-page-main-image");
 let touchStartX=0;
 mainImage?.addEventListener("touchstart",e=>{touchStartX=e.changedTouches[0]?.clientX||0;},{passive:true});
 mainImage?.addEventListener("touchend",e=>{
  const touchEndX=e.changedTouches[0]?.clientX||0;
  const swipeDistance=touchEndX-touchStartX;
  if(Math.abs(swipeDistance)>45)changeImage(swipeDistance<0?1:-1);
 },{passive:true});
 $("productPageContent").querySelectorAll("[data-image-index]").forEach(button=>button.addEventListener("click",()=>{
  const nextIndex=Number(button.dataset.imageIndex);
  imageChangeDirection=nextIndex>=activeImageIndex?1:-1;
  activeImageIndex=nextIndex;
  renderDetails();
 }));
 $("copyProductLink")?.addEventListener("click",e=>copyProductLink(p.id,e.currentTarget));
}
function changeImage(delta){
 const count=productImages(activeProduct).length;
 if(!count)return;
 imageChangeDirection=delta>0?1:-1;
 activeImageIndex=(activeImageIndex+delta+count)%count;
 renderDetails();
}
$("productBack").addEventListener("click",closeDetails);
function handleProductOpen(e){
 const button=e.target.closest("[data-open]");
 if(button)openDetails(button.dataset.open);
}
$("products").addEventListener("click",handleProductOpen);
$("productPageContent").addEventListener("click",handleProductOpen);
$("offerProducts")?.addEventListener("click",handleProductOpen);
function showCatalogPage(){
 setCatalogVisibility(true);
 activeProduct=null;
 deepLinkHandled=false;
 document.title=CATALOG_PAGE_TITLE;
 const url=new URL(window.location.href);
 if(url.searchParams.has("product")){
  url.searchParams.delete("product");
  window.history.replaceState({khashabitaCatalog:true},"",url.pathname+url.search+url.hash);
 }
 window.scrollTo({top:0,behavior:"smooth"});
}
function closeDetails(){
 if(!activeProduct)return;
 const state=window.history.state;
 if(state?.khashabitaProductPage&&!state.direct){
  window.history.back();
  return;
 }
 showCatalogPage();
}
window.addEventListener("popstate",()=>{
 const productId=new URLSearchParams(window.location.search).get("product");
 if(productId){
  const product=products.find(item=>item.id===productId);
  if(product){
   deepLinkHandled=true;
   openDetails(product.id,{fromHistory:true});
   return;
  }
 }
 if(!$("productPage").classList.contains("hidden")){
  setCatalogVisibility(true);
  activeProduct=null;
  deepLinkHandled=false;
  document.title=CATALOG_PAGE_TITLE;
 }
});
document.addEventListener("keydown",e=>{
 if(e.key==="Escape"&&!$("productPage").classList.contains("hidden"))closeDetails();
 if($("productPage").classList.contains("hidden"))return;
 if(e.key==="ArrowLeft")changeImage(1);
 if(e.key==="ArrowRight")changeImage(-1);
});

// ===== Custom design request via WhatsApp =====
const customOrderModal = $("customOrderModal");
function closeCustomOrder() {
 if(!customOrderModal)return;
 customOrderModal.classList.add("hidden");
 document.body.classList.remove("custom-order-open");
}
$("heroCustomOrder")?.addEventListener("click",()=> $("openCustomOrder")?.click());
$("openCustomOrder")?.addEventListener("click",()=>{
 customOrderModal?.classList.remove("hidden");
 document.body.classList.add("custom-order-open");
 $("customOrderName")?.focus();
});
$("customOrderClose")?.addEventListener("click",closeCustomOrder);
$("customOrderCancel")?.addEventListener("click",closeCustomOrder);
customOrderModal?.addEventListener("click",e=>{if(e.target===customOrderModal)closeCustomOrder();});
$("customOrderFiles")?.addEventListener("change",()=>{
 const files=[...($("customOrderFiles").files||[])];
 $("customOrderFileNames").textContent=files.length
  ? files.slice(0,5).map(file=>file.name).join("، ")+(files.length>5?" (أول 5 ملفات فقط)":"")
  : "تقدر تختار صور أو ملف PDF، بحد أقصى 5 ملفات.";
});
$("customOrderForm")?.addEventListener("submit",async e=>{
 e.preventDefault();
 const form=$("customOrderForm");
 if(!form.reportValidity())return;
 const files=[...($("customOrderFiles").files||[])];
 if(files.length>5)return alert("مسموح بإرسال 5 ملفات كحد أقصى.");
 if(files.some(file=>file.size>10*1024*1024))return alert("حجم كل ملف لازم يكون أقل من 10 ميجابايت.");
 const value=id=>$(id)?.value.trim()||"غير محدد";
 const message=[
  "السلام عليكم، عايز أطلب تصميم خاص من خشابيتا.",
  "الاسم: "+value("customOrderName"),
  "رقم التواصل: "+value("customOrderPhone"),
  "نوع المنتج: "+value("customOrderType"),
  "المقاس: "+value("customOrderSize"),
  "الخامة: "+value("customOrderMaterial"),
  "اللون: "+value("customOrderColor"),
  "الكمية: "+value("customOrderQty"),
  "تفاصيل الفكرة: "+value("customOrderDetails"),
  files.length?"ملفات التصميم: "+files.map(file=>file.name).join("، "):"لا توجد مرفقات."
 ].join("\n");
 const whatsappUrl="https://wa.me/201116026022?text="+encodeURIComponent(message);
 if(files.length&&navigator.share&&navigator.canShare){
  try{
   const shareData={files,title:"طلب تصميم خاص - خشابيتا",text:message};
   if(navigator.canShare({files})) {
    await navigator.share(shareData);
    closeCustomOrder();
    form.reset();
    $("customOrderFileNames").textContent="تقدر تختار صور أو ملف PDF، بحد أقصى 5 ملفات.";
    return;
   }
  }catch(err){
   if(err?.name==="AbortError")return;
   console.warn("File sharing is not available; opening WhatsApp text instead.",err);
  }
 }
 const fallbackMessage=files.length?message+"\nهرفق الصور أو الرسم في نفس محادثة واتساب.":"";
 const fallbackUrl=files.length
  ?"https://wa.me/201116026022?text="+encodeURIComponent(fallbackMessage)
  :whatsappUrl;
 const opened=window.open(fallbackUrl,"_blank","noopener,noreferrer");
 if(!opened)window.location.href=fallbackUrl;
 if(files.length)alert("بعد ما تفتح محادثة واتساب، اضغط علامة المرفقات وابعت صور أو ملف التصميم اللي اخترته.");
 closeCustomOrder();
 form.reset();
 $("customOrderFileNames").textContent="تقدر تختار صور أو ملف PDF، بحد أقصى 5 ملفات.";
});
document.addEventListener("keydown",e=>{
 if(e.key==="Escape"&&customOrderModal&&!customOrderModal.classList.contains("hidden"))closeCustomOrder();
});

