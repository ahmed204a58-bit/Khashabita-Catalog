import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// Paste the Firebase web-app configuration from Firebase Console here.
// This config is intended to be public; security is enforced by Firestore/Storage Rules.
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
let products = [], editingId = null, unsubscribe = null, currentUser = null;

function safe(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function money(n){return Number(n||0).toLocaleString("ar-EG")+" ج.م";}
function isAdmin(){return !!currentUser && currentUser.email?.toLowerCase()===ADMIN_EMAIL.toLowerCase();}
function showAdmin(on){$("catalog").classList.toggle("hidden",on);$("admin").classList.toggle("hidden",!on);$("adminBtn").textContent=on?"عرض الكتالوج":"دخول الإدارة";}
function render(){
 const cats=[...new Set(["هدايا مخصصة","دروع وتكريم","ألعاب وبازل","رمضان والأعياد","مجسمات معمارية","ديكورات منزلية","قسم السيارات",...products.map(p=>p.category).filter(Boolean)])].sort();
 const chosen=$("categoryFilter").value;
 $("categoryFilter").innerHTML='<option value="">كل الأقسام</option>'+cats.map(c=>`<option>${safe(c)}</option>`).join("");
 $("categoryFilter").value=cats.includes(chosen)?chosen:"";
 const term=$("search").value.trim().toLowerCase();
 const visible=products.filter(p=>(!$("categoryFilter").value||p.category===$("categoryFilter").value)&&(!term||[p.name,p.sku,p.category].join(" ").toLowerCase().includes(term)));
 $("products").innerHTML=visible.length?visible.map(p=>{const imgs=Array.isArray(p.imageUrls)?p.imageUrls:(p.imageUrl?[p.imageUrl]:[]);return `<article class="card"><div class="photo">${imgs[0]?`<img src="${safe(imgs[0])}" alt="${safe(p.name)}">`:"🪵"}</div>${imgs.length>1?`<div class="gallery">${imgs.slice(1).map(u=>`<img src="${safe(u)}" alt="${safe(p.name)}">`).join("")}</div>`:""}<div class="content"><h3>${safe(p.name)}</h3><div class="muted">${safe(p.category)} · كود ${safe(p.sku)}</div><div class="muted">${safe(p.material||"")} ${p.dimensions?"· "+safe(p.dimensions):""}</div><p class="muted">${safe(p.description||"")}</p><div class="price">${money(p.price)}</div><a class="btn" style="display:block;text-align:center;text-decoration:none;background:#1fa855;color:white" target="_blank" rel="noopener" href="https://wa.me/201116026022?text=${encodeURIComponent("السلام عليكم، عايز أستفسر عن "+p.name+" - الكود "+p.sku+" - السعر "+p.price+" جنيه")}">اطلب على واتساب</a></div></article>`;}).join(""):'<div class="empty">لا توجد منتجات مطابقة.</div>';
 $("adminList").innerHTML=products.length?products.map(p=>`<div class="adminrow"><span><b>${safe(p.name)}</b><br><small class="muted">${safe(p.sku)} · ${money(p.price)}</small></span><span class="actions"><button class="light" data-edit="${p.id}">تعديل</button><button class="danger" data-delete="${p.id}">حذف</button></span></div>`).join(""):'<p class="muted">لا توجد منتجات بعد.</p>';
}
function resetForm(){editingId=null;$("productForm").reset();$("material").value="خشب MDF";$("formTitle").textContent="إضافة منتج جديد";$("imagePreviewWrap").classList.add("hidden");$("imagePreviews").innerHTML="";}
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
 if(imageUrls.some(u=>!/^https:\/\//i.test(u)))return alert("كل روابط الصور لازم تبدأ بـ https://");
 const data={name:$("name").value.trim(),sku:$("sku").value.trim(),price:Number($("price").value),category:$("category").value.trim(),dimensions:$("dimensions").value.trim(),material:$("material").value.trim(),description:$("description").value.trim(),imageUrls,updatedAt:serverTimestamp()};
 try{
  if(editingId)await updateDoc(doc(db,"products",editingId),data);
  else await addDoc(collection(db,"products"),{...data,createdAt:serverTimestamp()});
  resetForm();alert("تم حفظ المنتج وتحديث الكتالوج.");
 }catch(err){console.error(err);alert("لم يتم الحفظ: "+err.message);}
};
$("cancelEdit").onclick=resetForm;
$("adminList").onclick=async e=>{
 const edit=e.target.dataset.edit, del=e.target.dataset.delete;
 if(edit){const p=products.find(x=>x.id===edit);if(!p)return;editingId=p.id;for(const k of ["name","sku","price","category","dimensions","material","description"])$(k).value=p[k]??"";$("imageUrls").value=(p.imageUrls|| (p.imageUrl?[p.imageUrl]:[])).join("\\n");updateImagePreview();$("formTitle").textContent="تعديل المنتج";}
 if(del&&confirm("هل تريد حذف المنتج نهائياً؟")){try{await deleteDoc(doc(db,"products",del));}catch(err){alert("تعذر الحذف: "+err.message);}}
};
onAuthStateChanged(auth,user=>{
 currentUser=user;
 if(user&&!isAdmin()){signOut(auth);currentUser=null;showAdmin(false);alert("هذا الحساب غير مصرح له.");return;}
 $("adminEmail").textContent=user?`مسجل الدخول: ${user.email}`:"";
 if(unsubscribe)unsubscribe();startListener();showAdmin(!!user && isAdmin());
});

function updateImagePreview(){
 const urls=$("imageUrls").value.split(/\n|,/).map(u=>u.trim()).filter(u=>/^https:\/\//i.test(u));
 $("imagePreviews").innerHTML=urls.map(u=>`<img src="${safe(u)}" alt="معاينة صورة المنتج">`).join("");
 $("imagePreviewWrap").classList.toggle("hidden",urls.length===0);
}
$("imageUrls").addEventListener("input",updateImagePreview);
