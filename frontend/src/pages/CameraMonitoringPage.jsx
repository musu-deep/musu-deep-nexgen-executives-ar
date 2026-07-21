import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, Camera, CheckCircle2, Clock3, Eye,
  HardDrive, MapPin, Plus, RefreshCw, Search, ShieldCheck,
  Signal, Video, WifiOff, Wrench, X,
} from "lucide-react";

const STORAGE_KEY = "nexgen-camera-monitoring-v1";
const STATUS = {
  online: { label: "تعمل بكفاءة", css: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
  warning: { label: "تحتاج متابعة", css: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
  offline: { label: "متوقفة", css: "bg-rose-500/10 text-rose-300 border-rose-500/20" },
  maintenance: { label: "تحت الصيانة", css: "bg-sky-500/10 text-sky-300 border-sky-500/20" },
};

const INITIAL = [
  { id:"c1", code:"HQ-ENT-01", name:"المدخل الرئيسي", site:"المقر الرئيسي", zone:"البوابة الأمامية", ip:"10.10.1.21", model:"Hikvision 4K", status:"online", recording:true, signal:96, uptime:99.8, storageDays:30, nextMaintenance:"2026-08-18", issue:"" },
  { id:"c2", code:"WH-GATE-01", name:"بوابة المستودع", site:"المستودعات", zone:"منطقة التحميل", ip:"10.10.2.31", model:"Dahua 4K", status:"warning", recording:true, signal:68, uptime:94.6, storageDays:17, nextMaintenance:"2026-07-28", issue:"تقطّع متكرر في البث وانخفاض جودة الاتصال." },
  { id:"c3", code:"WH-AISLE-04", name:"ممر التخزين الرابع", site:"المستودعات", zone:"الممرات الداخلية", ip:"10.10.2.34", model:"Dahua 2K", status:"offline", recording:false, signal:0, uptime:86.2, storageDays:17, nextMaintenance:"2026-07-22", issue:"انقطاع كامل؛ يلزم فحص التغذية الكهربائية والشبكة." },
  { id:"c4", code:"STL-LINE-01", name:"خط الإنتاج الأول", site:"مصنع الحديد", zone:"منطقة الإنتاج", ip:"10.10.3.41", model:"Axis 4K", status:"online", recording:true, signal:94, uptime:99.1, storageDays:45, nextMaintenance:"2026-08-29", issue:"" },
  { id:"c5", code:"STL-YARD-02", name:"الساحة الخارجية", site:"مصنع الحديد", zone:"ساحة المواد الخام", ip:"10.10.3.42", model:"Axis PTZ", status:"maintenance", recording:false, signal:0, uptime:97.7, storageDays:45, nextMaintenance:"2026-09-21", issue:"صيانة مجدولة لآلية الحركة والتقريب البصري." },
  { id:"c6", code:"STR-CASH-01", name:"منطقة الكاشير", site:"أراك ستورز", zone:"نقطة البيع", ip:"10.10.4.51", model:"Hikvision 2K", status:"online", recording:true, signal:89, uptime:98.9, storageDays:21, nextMaintenance:"2026-08-08", issue:"" },
];

function loadData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || INITIAL; }
  catch { return INITIAL; }
}

function score(camera) {
  const base = camera.status === "online" ? 50 : camera.status === "warning" ? 30 : camera.status === "maintenance" ? 20 : 0;
  return Math.min(100, base + (camera.recording ? 20 : 0) + Math.round(camera.signal * .15) + Math.round(camera.uptime * .15));
}

function scoreColor(value) {
  return value >= 85 ? "text-emerald-300" : value >= 65 ? "text-amber-300" : "text-rose-300";
}

export default function CameraMonitoringPage() {
  const [cameras, setCameras] = useState(loadData);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [site, setSite] = useState("all");
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ code:"", name:"", site:"المقر الرئيسي", zone:"", ip:"" });

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(cameras)), [cameras]);

  const sites = useMemo(() => [...new Set(cameras.map(c => c.site))], [cameras]);
  const filtered = useMemo(() => cameras.filter(camera => {
    const text = `${camera.name} ${camera.code} ${camera.site} ${camera.zone} ${camera.ip}`.toLowerCase();
    return (status === "all" || camera.status === status) && (site === "all" || camera.site === site) && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [cameras, query, status, site]);

  const stats = useMemo(() => ({
    total: cameras.length,
    online: cameras.filter(c => c.status === "online").length,
    warning: cameras.filter(c => c.status === "warning").length,
    offline: cameras.filter(c => c.status === "offline").length,
    recording: cameras.filter(c => c.recording).length,
    health: Math.round(cameras.reduce((sum, c) => sum + score(c), 0) / Math.max(cameras.length, 1)),
  }), [cameras]);

  const update = (id, changes) => setCameras(current => current.map(c => c.id === id ? { ...c, ...changes, lastCheck:new Date().toISOString() } : c));
  const checkAll = () => {
    setCameras(current => current.map(c => ({ ...c, lastCheck:new Date().toISOString() })));
    toast.success("اكتمل الفحص التشغيلي وتحديث حالة الاتصال");
  };
  const addCamera = event => {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return toast.error("أدخل رمز الكاميرا واسمها");
    setCameras(current => [{ id:`cam-${Date.now()}`, ...form, model:"غير محدد", status:"online", recording:true, signal:100, uptime:100, storageDays:30, nextMaintenance:"2026-09-21", issue:"" }, ...current]);
    setShowAdd(false); setForm({ code:"", name:"", site:"المقر الرئيسي", zone:"", ip:"" });
    toast.success("تمت إضافة الكاميرا إلى مركز المراقبة");
  };

  const alerts = cameras.filter(c => c.status !== "online" || !c.recording || c.signal < 75);

  return (
    <div dir="rtl" data-testid="camera-monitoring-page">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-7">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">الرقابة التشغيلية واستمرارية أنظمة المراقبة</div>
          <h1 className="font-heading text-4xl font-black mt-2 flex items-center gap-3"><Camera className="text-yellow-500" /> مركز مراقبة الكاميرات</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-4xl">متابعة الاتصال والتسجيل والكفاءة والتخزين والصيانة والتنبيهات التشغيلية عبر مواقع المجموعة.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={checkAll} className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 flex items-center gap-2 text-sm font-bold"><RefreshCw size={16}/> فحص شامل</button>
          <button onClick={() => setShowAdd(true)} className="px-5 py-3 rounded-xl bg-yellow-500 text-black flex items-center gap-2 text-sm font-black"><Plus size={16}/> إضافة كاميرا</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <Metric icon={<Camera size={17}/>} label="إجمالي الكاميرات" value={stats.total}/>
        <Metric icon={<CheckCircle2 size={17}/>} label="تعمل بكفاءة" value={stats.online} tone="text-emerald-300"/>
        <Metric icon={<AlertTriangle size={17}/>} label="تحتاج متابعة" value={stats.warning} tone="text-amber-300"/>
        <Metric icon={<WifiOff size={17}/>} label="متوقفة" value={stats.offline} tone="text-rose-300"/>
        <Metric icon={<Video size={17}/>} label="التسجيل نشط" value={`${stats.recording}/${stats.total}`}/>
        <Metric icon={<ShieldCheck size={17}/>} label="مؤشر الكفاءة" value={`${stats.health}%`} tone={scoreColor(stats.health)}/>
      </div>

      <div className="glass-card p-4 mb-5 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="البحث بالاسم أو الرمز أو الموقع أو عنوان الشبكة..." className="w-full pr-10 pl-4 py-3 rounded-xl bg-black/20 border border-white/10 text-sm outline-none"/></div>
        <select value={site} onChange={e => setSite(e.target.value)} className="px-4 py-3 rounded-xl bg-[#0d121d] border border-white/10 text-sm text-slate-300"><option value="all">كل المواقع</option>{sites.map(item => <option key={item}>{item}</option>)}</select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="px-4 py-3 rounded-xl bg-[#0d121d] border border-white/10 text-sm text-slate-300"><option value="all">كل الحالات</option>{Object.entries(STATUS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 grid md:grid-cols-2 gap-4">
          {filtered.map(camera => <CameraCard key={camera.id} camera={camera} update={update} open={() => setSelected(camera)}/>) }
          {!filtered.length && <div className="md:col-span-2 glass-card p-12 text-center text-slate-500">لا توجد كاميرات مطابقة.</div>}
        </div>
        <div className="space-y-5">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4"><h2 className="font-heading text-xl font-black">التنبيهات المفتوحة</h2><span className="text-xs px-2 py-1 rounded-full bg-rose-500/10 text-rose-300">{alerts.length}</span></div>
            <div className="space-y-3">{alerts.map(camera => <button key={camera.id} onClick={() => setSelected(camera)} className="w-full text-right p-3 rounded-xl bg-white/[.025] border border-white/5"><div className="font-bold text-sm">{camera.name}</div><div className="text-[11px] text-slate-500 mt-1">{camera.site} • {camera.code}</div><p className="text-xs text-amber-200/70 mt-2">{camera.issue || "التسجيل أو الاتصال دون المستوى المعتمد."}</p></button>)}</div>
          </div>
          <div className="glass-card p-5"><h2 className="font-heading text-lg font-black flex items-center gap-2 mb-4"><Wrench size={17} className="text-yellow-400"/> الصيانة القادمة</h2>{[...cameras].sort((a,b) => a.nextMaintenance.localeCompare(b.nextMaintenance)).slice(0,5).map(c => <div key={c.id} className="flex justify-between gap-3 py-3 border-b border-white/5 last:border-0"><div><div className="text-sm font-semibold">{c.name}</div><div className="text-[10px] text-slate-600">{c.site}</div></div><div className="text-[11px] text-yellow-400 flex items-center gap-1"><Clock3 size={12}/>{new Date(c.nextMaintenance).toLocaleDateString("ar")}</div></div>)}</div>
        </div>
      </div>

      {selected && <Detail camera={cameras.find(c => c.id === selected.id) || selected} close={() => setSelected(null)} update={update}/>} 
      {showAdd && <AddModal form={form} setForm={setForm} close={() => setShowAdd(false)} submit={addCamera}/>} 
    </div>
  );
}

function Metric({ icon, label, value, tone="text-slate-100" }) { return <div className="glass-card p-4"><div className="flex justify-between"><span className="w-9 h-9 rounded-lg bg-white/5 text-yellow-400 flex items-center justify-center">{icon}</span><span className={`font-heading text-2xl font-black ${tone}`}>{value}</span></div><div className="text-xs text-slate-500 mt-3">{label}</div></div>; }

function CameraCard({ camera, update, open }) {
  const health = score(camera); const meta = STATUS[camera.status];
  return <div className="glass-card overflow-hidden"><div className="h-32 bg-gradient-to-br from-slate-900 to-black relative flex items-center justify-center"><Camera size={42} className="text-slate-700"/><span className={`absolute top-3 right-3 text-[10px] px-2 py-1 rounded-full border ${meta.css}`}>{meta.label}</span>{camera.recording && <span className="absolute top-3 left-3 text-[9px] text-rose-300">● REC</span>}</div><div className="p-4"><div className="flex justify-between gap-3"><div><h3 className="font-heading text-lg font-black">{camera.name}</h3><div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1"><MapPin size={11}/>{camera.site} • {camera.zone}</div></div><div className={`text-xl font-black ${scoreColor(health)}`}>{health}%</div></div><div className="grid grid-cols-3 gap-2 mt-4"><Mini icon={<Signal size={12}/>} label="الإشارة" value={`${camera.signal}%`}/><Mini icon={<HardDrive size={12}/>} label="التخزين" value={`${camera.storageDays} يوم`}/><Mini icon={<Activity size={12}/>} label="الجاهزية" value={`${camera.uptime}%`}/></div>{camera.issue && <div className="text-[11px] text-amber-200/70 mt-3 line-clamp-2">{camera.issue}</div>}<div className="flex gap-2 mt-4"><button onClick={open} className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-xs font-bold flex items-center justify-center gap-2"><Eye size={13}/> التفاصيل</button><select value={camera.status} onChange={e => update(camera.id,{status:e.target.value, recording:["online","warning"].includes(e.target.value) ? camera.recording : false})} className="bg-[#0d121d] border border-white/10 rounded-lg text-[10px] px-2">{Object.entries(STATUS).map(([key,item]) => <option key={key} value={key}>{item.label}</option>)}</select></div></div></div>;
}

function Mini({ icon, label, value }) { return <div className="rounded-lg bg-white/[.025] border border-white/5 p-2 text-center"><div className="text-yellow-400 flex justify-center">{icon}</div><div className="text-[9px] text-slate-600 mt-1">{label}</div><div className="text-[10px] font-bold mt-1">{value}</div></div>; }

function Detail({ camera, close, update }) {
  return <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-2xl glass-card p-6 border-yellow-500/20"><div className="flex justify-between"><div><div className="text-xs text-yellow-500">{camera.code}</div><h2 className="font-heading text-3xl font-black mt-1">{camera.name}</h2><div className="text-sm text-slate-500 mt-2">{camera.site} • {camera.zone}</div></div><button onClick={close} className="p-2"><X size={18}/></button></div><div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-6"><Info label="عنوان الشبكة" value={camera.ip}/><Info label="الطراز" value={camera.model}/><Info label="الإشارة" value={`${camera.signal}%`}/><Info label="الجاهزية" value={`${camera.uptime}%`}/><Info label="التسجيل" value={camera.recording ? "نشط" : "متوقف"}/><Info label="التخزين" value={`${camera.storageDays} يوم`}/><Info label="الحالة" value={STATUS[camera.status].label}/><Info label="الكفاءة" value={`${score(camera)}%`}/></div>{camera.issue && <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 text-sm text-amber-200/70">{camera.issue}</div>}<div className="flex justify-end gap-2 mt-6"><button onClick={() => update(camera.id,{status:"maintenance",recording:false,issue:"أُحيلت الكاميرا إلى الصيانة الفنية."})} className="px-4 py-2.5 rounded-lg bg-sky-500/10 text-sky-300 text-xs font-bold"><Wrench size={13} className="inline ml-1"/> تحويل للصيانة</button><button onClick={() => update(camera.id,{status:"online",recording:true,signal:Math.max(camera.signal,90),issue:""})} className="px-4 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-300 text-xs font-bold"><CheckCircle2 size={13} className="inline ml-1"/> اعتماد التشغيل</button></div></div></div>;
}

function Info({ label, value }) { return <div className="rounded-xl bg-white/[.025] border border-white/5 p-3"><div className="text-[10px] text-slate-600">{label}</div><div className="text-xs font-bold mt-1.5 break-words">{value}</div></div>; }

function AddModal({ form, setForm, close, submit }) {
  return <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-xl glass-card p-6 border-yellow-500/20"><div className="flex justify-between mb-5"><h2 className="font-heading text-2xl font-black">إضافة كاميرا جديدة</h2><button onClick={close}><X size={18}/></button></div><form onSubmit={submit} className="grid md:grid-cols-2 gap-4">{[["code","رمز الكاميرا"],["name","اسم الكاميرا"],["site","الموقع"],["zone","المنطقة"],["ip","عنوان الشبكة"]].map(([key,label]) => <label key={key} className={key === "ip" ? "md:col-span-2" : ""}><span className="text-xs text-slate-400 block mb-2">{label}</span><input value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-sm outline-none"/></label>)}<div className="md:col-span-2 flex justify-end gap-2 mt-2"><button type="button" onClick={close} className="px-5 py-3 rounded-xl bg-white/5">إلغاء</button><button type="submit" className="px-6 py-3 rounded-xl bg-yellow-500 text-black font-black">حفظ الكاميرا</button></div></form></div></div>;
}
