import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";



import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://heswhtppyiboxbccgoag.supabase.co";
const SUPABASE_KEY = "sb_publishable_yFWjEhFpJXvXzQpBNkGX3Q_i1EdFM3o";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
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
const CLOUDINARY_CLOUD_NAME = "hbbdio2h";
const CLOUDINARY_UPLOAD_PRESET = "khashabita_products";
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const provider = new GoogleAuthProvider();
const $ = id => document.getElementById(id);
let products = [], editingId = null, unsubscribe = null, currentUser = null;
let activeProduct = null, activeImageIndex = 0;

function safe(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function money(n){return Number(n||0).toLocaleString("ar-EG")+" ج.م";}
function isAdmin(){return !!currentUser && currentUser.email?.toLowerCase()===ADMIN_EMAIL.toLowerCase();}
function validImage(u){return /^https:\/\//i.test(u) || (/^(?:\.\/|products\/)[\w./-]+\.(?:png|jpe?g|webp|gif)$/i.test(u) && !u.includes(".."));}
function productImages(p){return (Array.isArray(p.imageUrls)?p.imageUrls:(p.imageUrl?[p.imageUrl]:[])).filter(validImage);}
function showAdmin(on){$("catalog").classList.toggle("hidden",on);$("admin").classList.toggle("hidden",!on);$("adminBtn").textContent=on?"عرض الكتالوج":"دخول الإدارة";if(on)loadPendingReviews();}function waLink(p){return "https://wa.me/201116026022?text="+encodeURIComponent("السلام عليكم، عايز أستفسر عن "+p.name+" - الكود "+(p.sku||"")+" - السعر "+(p.price||"") +" جنيه");}

function render(){
const cats=[...new Set(["هدايا مخصصة","شبكة وخطوبة","أدوات مكتبية","دروع وتكريم","ألعاب وبازل","رمضان والأعياد","مجسمات معمارية","ديكورات منزلية","مركبات","أنتيكات","أدوات مدرسية وتعليمية","منوعات",...products.map(p=>p.category).filter(Boolean)])]; const chosen=$("categoryFilter").value;
 $("categoryFilter").innerHTML='<option value="">كل الأقسام</option>'+cats.map(c=>`<option value="${safe(c)}">${safe(c)}</option>`).join("");
 $("categoryFilter").value=cats.includes(chosen)?chosen:"";
 const term=$("search").value.trim().toLowerCase();
 const visible=products.filter(p=>(!$("categoryFilter").value||p.category===$("categoryFilter").value)&&(!term||[p.name,p.sku,p.category,p.description].join(" ").toLowerCase().includes(term)));
 $("products").innerHTML=visible.length?visible.map(p=>{
   const imgs=productImages(p), cover=imgs[0];
   return `<article class="card">
     <button class="card-photo" data-open="${safe(p.id)}" aria-label="عرض تفاصيل ${safe(p.name)}">
       ${cover?`<img src="${safe(cover)}" alt="${safe(p.name)}" loading="lazy">`:`<span class="photo-placeholder" aria-hidden="true">▧</span>`}
       ${imgs.length>1?`<span class="image-count">▧ ${imgs.length} صور</span>`:""}
     </button>
     <div class="content">
       <span class="product-category">${safe(p.category||"منتج خشبي")}</span>
       <h3>${safe(p.name)}</h3>
       <div class="muted">${p.dimensions?safe(p.dimensions)+" · ":""}${safe(p.material||"خشب MDF")}</div>
       <div class="price">${money(p.price)}</div>
       <div class="card-actions"><button class="light" data-open="${safe(p.id)}">تفاصيل المنتج</button><a class="btn wa" target="_blank" rel="noopener" href="${waLink(p)}">اطلب على واتساب</a></div>
     </div></article>`;
 }).join(""):'<div class="empty"><span class="empty-icon">⌕</span><b>لا توجد منتجات مطابقة</b><p>جرّب البحث بكلمة تانية أو اختار قسم مختلف.</p></div>';
 $("adminList").innerHTML=products.length?products.map(p=>`<div class="adminrow"><span><b>${safe(p.name)}</b><br><small class="muted">${safe(p.sku)} · ${money(p.price)}</small></span><span class="actions"><button class="light" data-edit="${safe(p.id)}">تعديل</button><button class="danger" data-delete="${safe(p.id)}">حذف</button></span></div>`).join(""):'<p class="muted">لا توجد منتجات بعد.</p>';
}
function resetForm(){editingId=null;$("productForm").reset();
                     $("category").value=$("categoryFilter").value;$("material").value="خشب MDF";$("formTitle").textContent="إضافة منتج جديد";$("imagePreviewWrap").classList.add("hidden");$("imagePreviews").innerHTML="";$("uploadStatus").textContent="";}
function startListener(){
 if(unsubscribe)unsubscribe();
 const q=query(collection(db,"products"),orderBy("createdAt","desc"));
 unsubscribe=onSnapshot(q,snap=>{products=snap.docs.map(d=>({id:d.id,...d.data()}));render();},err=>{$("products").innerHTML='<div class="empty">تعذر تحميل المنتجات. راجع إعدادات قاعدة البيانات.</div>';console.error(err);});
}
$("adminBtn").onclick=async()=>{if(isAdmin()){showAdmin($("catalog").classList.contains("hidden"));return;}try{const result=await signInWithPopup(auth,provider);if(result.user.email?.toLowerCase()!==ADMIN_EMAIL.toLowerCase()){await signOut(auth);alert("هذا الحساب غير مصرح له بإدارة الكتالوج.");}}catch(e){alert("تعذر تسجيل الدخول باستخدام Google: "+e.message);}};
$("logout").onclick=()=>signOut(auth);
$("search").oninput=render;$("categoryFilter").onchange=render;
$("productForm").onsubmit=async e=>{
 e.preventDefault();if(!isAdmin())return alert("غير مصرح.");
 const imageUrls=$("imageUrls").value.split(/\n|,/).map(u=>u.trim()).filter(Boolean);
 if(imageUrls.some(u=>!validImage(u)))return alert("فيه رابط صورة غير صالح. ارفع الصور من زر إضافة صور أو استخدم رابط HTTPS صحيح.");
 if($("imageFiles").files.length){try{await uploadSelectedImages();}catch(err){console.error(err);alert("تعذر رفع الصور: "+err.message);return;}}
 const finalImageUrls=$("imageUrls").value.split(/\n|,/).map(u=>u.trim()).filter(validImage);
 const data={name:$("name").value.trim(),sku:$("sku").value.trim(),price:Number($("price").value),category:$("category").value.trim(),dimensions:$("dimensions").value.trim(),material:$("material").value.trim(),description:$("description").value.trim(),videoUrl:$("videoUrl").value.trim(),tiktokUrl:$("tiktokUrl").value.trim(),imageUrls:finalImageUrls,updatedAt:serverTimestamp()};
 try{
  if(editingId)await updateDoc(doc(db,"products",editingId),data);
  else await addDoc(collection(db,"products"),{...data,createdAt:serverTimestamp()});
  resetForm();alert("تم حفظ المنتج وتحديث الكتالوج.");
 }catch(err){console.error(err);alert("لم يتم الحفظ: "+err.message);}
};
$("cancelEdit").onclick=resetForm;
$("adminList").onclick=async e=>{
 const edit=e.target.dataset.edit, del=e.target.dataset.delete;
 if(edit){const p=products.find(x=>x.id===edit);if(!p)return;editingId=p.id;for(const k of ["name","sku","price","category","dimensions","material","description","videoUrl","tiktokUrl"])$(k).value=p[k]??"";$("imageUrls").value=productImages(p).join("\n");updateImagePreview();$("formTitle").textContent="تعديل المنتج";$("productForm").scrollIntoView({behavior:"smooth"});}
 if(del&&confirm("هل تريد حذف المنتج نهائياً؟")){try{await deleteDoc(doc(db,"products",del));}catch(err){alert("تعذر الحذف: "+err.message);}}
};
onAuthStateChanged(auth,user=>{
 currentUser=user;
 if(user&&!isAdmin()){signOut(auth);currentUser=null;showAdmin(false);alert("هذا الحساب غير مصرح له.");return;}
 $("adminEmail").textContent=user?`مسجل الدخول: ${user.email}`:"";
 if(unsubscribe)unsubscribe();startListener();showAdmin(!!user && isAdmin());
});

async function uploadSelectedImages(){
 const files=[...$("imageFiles").files]; if(!files.length)return;
 const status=$("uploadStatus"), existing=$("imageUrls").value.split(/\n|,/).map(u=>u.trim()).filter(validImage), uploaded=[];
 const allowed=["image/jpeg","image/png","image/webp","image/gif"];
 for(let i=0;i<files.length;i++){
  const file=files[i];
  if(!allowed.includes(file.type))throw new Error(`الملف ${file.name} ليس صورة JPG أو PNG أو WEBP أو GIF.`);
  if(file.size>10*1024*1024)throw new Error(`حجم ${file.name} أكبر من 10 ميجابايت.`);
  status.textContent=`جاري رفع الصورة ${i+1} من ${files.length}: ${file.name}`;
  const body=new FormData();body.append("file",file);body.append("upload_preset",CLOUDINARY_UPLOAD_PRESET);
  const response=await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,{method:"POST",body});
  const result=await response.json();if(!response.ok)throw new Error(result.error?.message||`فشل رفع ${file.name}`);
  if(!result.secure_url)throw new Error(`لم يرجع رابط آمن للصورة ${file.name}`);uploaded.push(result.secure_url);
 }
 $("imageUrls").value=[...existing,...uploaded].join("\n");$("imageFiles").value="";
 status.textContent=`تم رفع ${uploaded.length} صورة بنجاح. إجمالي الصور: ${existing.length+uploaded.length}`;updateImagePreview();
}
$("imageFiles").addEventListener("change",async()=>{if(!$("imageFiles").files.length)return;try{await uploadSelectedImages();}catch(err){console.error(err);$("uploadStatus").textContent="فشل رفع الصور";alert("تعذر رفع الصور: "+err.message);$("imageFiles").value="";}});


function updateImagePreview(){
  const urls=$("imageUrls").value.split(/\n/).map(u=>u.trim()).filter(validImage);

  $("imagePreviews").innerHTML=urls.map((u,i)=>`
    <div style="display:inline-flex;flex-direction:column;align-items:center;gap:5px;margin:5px">
      <img src="${safe(u)}" alt="معاينة صورة المنتج" style="width:90px;height:90px;object-fit:cover;border-radius:8px">
      <button type="button" data-remove-image="${i}" style="background:#dc3545;color:white;border:0;border-radius:6px;padding:5px 12px;cursor:pointer">حذف الصورة</button>
    </div>
  `).join("");

  $("imagePreviewWrap").classList.toggle("hidden",urls.length===0);

  $("imagePreviews").querySelectorAll("[data-remove-image]").forEach(button=>{
    button.onclick=()=>{
      const current=$("imageUrls").value.split(/\n/).map(u=>u.trim()).filter(validImage);
      current.splice(Number(button.dataset.removeImage),1);
      $("imageUrls").value=current.join("\n");
      updateImagePreview();
    };
  });
}

$("imageUrls").addEventListener("input",updateImagePreview);

function openDetails(id){
 const p=products.find(x=>x.id===id);if(!p)return;
 activeProduct=p;activeImageIndex=0;renderDetails();
 $("productModal").classList.remove("hidden");document.body.classList.add("modal-open");
 $("modalClose").focus();
}
function renderDetails(){
 if(!activeProduct)return;
 const p=activeProduct, imgs=productImages(p);
 const current=imgs[activeImageIndex]||"";
 $("modalContent").innerHTML=`
  <div class="modal-gallery">
   <div class="modal-main-image">${current?`<img src="${safe(current)}" alt="${safe(p.name)}">`:`<span class="photo-placeholder">▧</span>`}
    ${imgs.length>1?`<button class="gallery-arrow prev" id="galleryPrev" aria-label="الصورة السابقة">‹</button><button class="gallery-arrow next" id="galleryNext" aria-label="الصورة التالية">›</button>`:""}
    ${imgs.length?`<span class="gallery-position">${activeImageIndex+1} / ${imgs.length}</span>`:""}
   </div>
   ${imgs.length>1?`<div class="modal-thumbs">${imgs.map((u,i)=>`<button class="${i===activeImageIndex?"selected":""}" data-image-index="${i}" aria-label="عرض الصورة ${i+1}"><img src="${safe(u)}" alt=""></button>`).join("")}</div>`:""}
  </div>
  <div class="modal-info"><span class="product-category">${safe(p.category||"منتج خشبي")}</span><h2>${safe(p.name)}</h2>
   <div class="price">${money(p.price)}</div><p>${safe(p.description||"منتج مصنوع بعناية في خشابيتا CNC.")}</p>
   <dl class="product-specs"><div><dt>كود المنتج</dt><dd>${safe(p.sku||"—")}</dd></div><div><dt>المقاس</dt><dd>${safe(p.dimensions||"حسب الطلب")}</dd></div><div><dt>الخامة</dt><dd>${safe(p.material||"خشب MDF")}</dd></div></dl>
   ${/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(p.videoUrl||"")?'<a class="btn light" target="_blank" rel="noopener noreferrer" href="'+safe(p.videoUrl)+'">▶ شاهد على YouTube</a>':""} ${/^https:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com)\//i.test(p.tiktokUrl||"")?'<a class="btn light" target="_blank" rel="noopener noreferrer" href="'+safe(p.tiktokUrl)+'">▶ شاهد على TikTok</a>':""} <a class="btn wa modal-wa" target="_blank" rel="noopener" href="${waLink(p)}">اطلب المنتج على واتساب</a>
  </div>`;
 $("galleryPrev")?.addEventListener("click",()=>changeImage(-1));
 $("galleryNext")?.addEventListener("click",()=>changeImage(1));
 $("modalContent").querySelectorAll("[data-image-index]").forEach(b=>b.addEventListener("click",()=>{activeImageIndex=Number(b.dataset.imageIndex);renderDetails();}));
}
function changeImage(delta){const n=productImages(activeProduct).length;if(!n)return;activeImageIndex=(activeImageIndex+delta+n)%n;renderDetails();}
$("products").addEventListener("click",e=>{const b=e.target.closest("[data-open]");if(b)openDetails(b.dataset.open);});
$("modalClose").onclick=closeDetails;
$("productModal").addEventListener("click",e=>{if(e.target===$("productModal"))closeDetails();});
function closeDetails(){$("productModal").classList.add("hidden");document.body.classList.remove("modal-open");activeProduct=null;}
document.addEventListener("keydown",e=>{if($("productModal").classList.contains("hidden"))return;if(e.key==="Escape")closeDetails();if(e.key==="ArrowLeft")changeImage(1);if(e.key==="ArrowRight")changeImage(-1);});

// ===== نظام تقييمات خشابيتا =====

async function loadPendingReviews() {
  const list = $("adminReviewsList");
  if (!list) return;

  list.textContent = "جاري تحميل التقييمات المعلقة...";

  const { data, error } = await supabase
    .from("site_reviews")
    .select("id, rating, comment, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    list.textContent = "حدث خطأ أثناء تحميل التقييمات.";
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    list.textContent = "لا توجد تقييمات معلقة حالياً.";
    return;
  }

  list.innerHTML = data.map(review => `
    <div class="review-card">
      <div>⭐ ${review.rating} / 5</div>
      <p>${safe(review.comment)}</p>
      <button class="light" data-approve="${review.id}">موافقة</button>
      <button class="danger" data-reject="${review.id}">رفض</button>
    </div>
  `).join("");

  list.querySelectorAll("[data-approve]").forEach(button => {
    button.onclick = () => updateReviewStatus(button.dataset.approve, "approved");
  });

  list.querySelectorAll("[data-reject]").forEach(button => {
    button.onclick = () => updateReviewStatus(button.dataset.reject, "rejected");
  });
}

async function updateReviewStatus(id, status) {
  const { error } = await supabase
    .from("site_reviews")
    .update({ status })
    .eq("id", id);

  if (error) {
    alert("حصل خطأ أثناء تحديث التقييم.");
    console.error(error);
    return;
  }

  await loadPendingReviews();
  await loadReviews();
}
async function loadReviews() {
  const list = $("reviewsList");
  if (!list) return;

  list.textContent = "جاري تحميل التقييمات...";

  const { data, error } = await supabase
    .from("site_reviews")
    .select("rating, comment, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  list.replaceChildren();

  if (error) {
    list.textContent = "تعذر تحميل التقييمات حاليًا.";
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    list.textContent = "لسه مفيش تقييمات معتمدة. كن أول من يقيّم خشابيتا!";
    return;
  }

  data.forEach(review => {
    const card = document.createElement("div");
    card.className = "review-card";

    const stars = document.createElement("div");
    stars.textContent = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
    stars.style.color = "#e6a800";

    const comment = document.createElement("p");
    comment.textContent = review.comment;

    const date = document.createElement("small");
    date.textContent = new Date(review.created_at).toLocaleDateString("ar-EG");

    card.append(stars, comment, date);
    list.appendChild(card);
  });
}

const reviewForm = $("reviewForm");

if (reviewForm) {
  reviewForm.addEventListener("submit", async e => {
    e.preventDefault();

    const rating = Number($("reviewRating").value);
    const comment = $("reviewComment").value.trim();
    const submitButton = reviewForm.querySelector('button[type="submit"]');

    if (!rating || rating < 1 || rating > 5 || !comment) {
      alert("من فضلك اختار التقييم واكتب تعليقك.");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "جاري إرسال التقييم...";

    const { error } = await supabase
      .from("site_reviews")
      .insert([{
        rating,
        comment,
        status: "pending"
      }]);

    submitButton.disabled = false;
    submitButton.textContent = "إرسال التقييم";

    if (error) {
      console.error(error);
      alert("حصل خطأ أثناء إرسال التقييم. حاول مرة تانية.");
      return;
    }

    reviewForm.reset();
    alert("شكرًا ليك! تم إرسال تقييمك، وهيظهر بعد المراجعة.");
  });
}

loadReviews();

