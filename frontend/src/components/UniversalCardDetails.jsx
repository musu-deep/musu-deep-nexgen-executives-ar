import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ArrowUpLeft, BarChart3, ClipboardCopy, ExternalLink, FileText,
  Layers3, ListChecks, Maximize2, Printer, RefreshCw, Route,
  Sparkles, X,
} from "lucide-react";

const CARD_SELECTOR = [
  '[data-card-details]:not([data-card-details="off"])',
  '.glass-card',
  '[class*="rounded-3xl"][class*="border"]',
  '[class*="rounded-2xl"][class*="border"]',
  '[class*="rounded-xl"][class*="border"]',
].join(',');

const INTERACTIVE_SELECTOR = [
  'button', 'a', 'input', 'select', 'textarea', 'summary', 'label',
  '[role="button"]', '[role="link"]', '[contenteditable="true"]',
].join(',');

const ROUTE_META = [
  ['/camera-monitoring', 'مركز مراقبة الكاميرات'],
  ['/daily-report', 'الموجز التنفيذي اليومي'],
  ['/ai-lounge', 'مركز الوكلاء التنفيذيين'],
  ['/projects/', 'تفاصيل المشروع'],
  ['/projects', 'المشروعات'],
  ['/tasks', 'المهام'],
  ['/executive-secretariat', 'السكرتارية التنفيذية'],
  ['/presidential-advisor', 'المستشار الخاص للرئيس التنفيذي'],
  ['/legal-affairs', 'الشؤون القانونية'],
  ['/human-resources', 'الموارد البشرية'],
  ['/quality-control', 'التفتيش والرقابة والجودة'],
  ['/calendar', 'التقويم'],
  ['/meetings', 'الاجتماعات'],
  ['/meeting-requests', 'طلبات الاجتماعات'],
  ['/documents', 'مركز تحليل المستندات'],
  ['/messages', 'مركز الاتصالات'],
  ['/voice', 'مركز الأوامر الصوتية'],
  ['/reports', 'التقارير'],
  ['/team', 'الفريق'],
  ['/notifications', 'الإشعارات'],
  ['/settings', 'الإعدادات'],
  ['/admin', 'إدارة المنصة'],
  ['/dashboard', 'لوحة القيادة التنفيذية'],
];

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function pageLabel(pathname) {
  return ROUTE_META.find(([prefix]) => pathname.startsWith(prefix))?.[1] || 'المنصة التنفيذية';
}

function isCandidate(card, root) {
  if (!card || !root?.contains(card)) return false;
  if (card.matches('button, a, form, nav, aside')) return false;
  if (card.closest('[role="dialog"], [data-card-details-scope="off"]')) return false;
  if (card.dataset.cardDetails === 'off') return false;
  if (cleanText(card.textContent).length < 2) return false;
  return true;
}

function directSubcards(card) {
  return Array.from(card.querySelectorAll(CARD_SELECTOR)).filter((candidate) => {
    if (candidate === card || !isCandidate(candidate, card)) return false;
    return candidate.parentElement?.closest(CARD_SELECTOR) === card;
  });
}

function getSnapshot(card, pathname) {
  const page = pageLabel(pathname);
  const semanticElements = Array.from(card.querySelectorAll(
    'h1,h2,h3,h4,h5,h6,p,li,dt,dd,th,td,strong,[data-card-label],[data-card-value]'
  ));

  let lines = unique(semanticElements.map((element) => element.textContent));
  if (lines.length < 2) {
    lines = unique(String(card.innerText || card.textContent || '').split(/\n+/));
  }
  lines = lines.filter((line) => line.length <= 240).slice(0, 40);

  const heading = card.querySelector('[data-card-title], h1, h2, h3, h4, h5, h6');
  const title = cleanText(card.dataset.cardTitle || heading?.textContent || card.getAttribute('aria-label') || lines[0] || page);

  const values = unique(Array.from(card.querySelectorAll(
    '[data-card-value], strong, [class*="text-5xl"], [class*="text-4xl"], [class*="text-3xl"], [class*="text-2xl"]'
  )).map((element) => element.textContent)).filter((value) => value.length <= 70).slice(0, 12);

  const indicators = unique(Array.from(card.querySelectorAll(
    '[class*="text-emerald"], [class*="text-rose"], [class*="text-amber"], [class*="text-yellow"], [class*="text-sky"], [class*="text-violet"]'
  )).map((element) => element.textContent)).filter((value) => value.length <= 80).slice(0, 12);

  const actions = unique(Array.from(card.querySelectorAll('button, a')).map((element) => (
    element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent
  ))).filter((value) => value.length <= 100).slice(0, 20);

  const links = Array.from(card.querySelectorAll('a[href]')).map((element) => ({
    label: cleanText(element.textContent || element.getAttribute('aria-label') || 'فتح الرابط'),
    href: element.getAttribute('href'),
  })).filter((item) => item.href).slice(0, 12);

  const subcards = directSubcards(card).map((element) => {
    const subHeading = element.querySelector('[data-card-title], h2, h3, h4, h5, h6');
    const subLines = unique(String(element.innerText || element.textContent || '').split(/\n+/));
    return cleanText(element.dataset.cardTitle || subHeading?.textContent || subLines[0] || 'بطاقة فرعية');
  }).slice(0, 20);

  const summary = lines.find((line) => line !== title && line.length > 25) ||
    `عرض تفصيلي لمحتوى بطاقة «${title}» ضمن قسم ${page}.`;

  return {
    element: card,
    page,
    pathname,
    title,
    summary,
    lines: lines.filter((line) => line !== title),
    values,
    indicators,
    actions,
    links,
    subcards,
  };
}

function markCards(root) {
  if (!root) return;
  const candidates = Array.from(root.querySelectorAll(CARD_SELECTOR));
  if (root.matches?.(CARD_SELECTOR)) candidates.unshift(root);

  candidates.forEach((card) => {
    if (!isCandidate(card, root)) return;
    if (card.matches(INTERACTIVE_SELECTOR)) return;
    card.dataset.universalCardEnhanced = 'true';
    if (!card.hasAttribute('tabindex')) card.tabIndex = 0;
    if (!card.hasAttribute('role')) card.setAttribute('role', 'button');
    if (!card.hasAttribute('aria-label')) {
      const heading = card.querySelector('h1,h2,h3,h4,h5,h6');
      card.setAttribute('aria-label', `فتح تفاصيل ${cleanText(heading?.textContent) || 'البطاقة'}`);
    }
  });
}

export default function UniversalCardDetails({ children }) {
  const rootRef = useRef(null);
  const location = useLocation();
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const openCard = (card) => setDetail(getSnapshot(card, location.pathname));

    const handleClick = (event) => {
      if (event.defaultPrevented) return;
      const card = event.target.closest(CARD_SELECTOR);
      if (!isCandidate(card, root) || card.dataset.universalCardEnhanced !== 'true') return;
      const interactive = event.target.closest(INTERACTIVE_SELECTOR);
      if (interactive && interactive !== card) return;
      openCard(card);
    };

    const handleKeyDown = (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      const card = event.target.closest('[data-universal-card-enhanced="true"]');
      if (!isCandidate(card, root)) return;
      event.preventDefault();
      openCard(card);
    };

    markCards(root);
    const observer = new MutationObserver(() => markCards(root));
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener('click', handleClick);
    root.addEventListener('keydown', handleKeyDown);

    return () => {
      observer.disconnect();
      root.removeEventListener('click', handleClick);
      root.removeEventListener('keydown', handleKeyDown);
    };
  }, [location.pathname]);

  useEffect(() => setDetail(null), [location.pathname]);

  return (
    <>
      <div ref={rootRef} data-universal-card-root="true">{children}</div>
      <UniversalCardModal detail={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function UniversalCardModal({ detail, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!detail) return undefined;
    setActiveTab('overview');
    setCopied(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [detail, onClose]);

  const printableText = useMemo(() => {
    if (!detail) return '';
    return [detail.title, detail.summary, ...detail.lines].filter(Boolean).join('\n');
  }, [detail]);

  if (!detail) return null;

  const tabs = [
    { id: 'overview', label: 'نظرة عامة', icon: Sparkles },
    { id: 'details', label: `البيانات (${detail.lines.length})`, icon: ListChecks },
    { id: 'actions', label: 'الإجراءات والارتباطات', icon: Route },
  ];

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(printableText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const printDetails = () => {
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) return;
    const escaped = printableText
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');
    popup.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${detail.title}</title><style>body{font-family:Arial,sans-serif;padding:48px;line-height:2;color:#111}h1{font-size:28px;margin-bottom:18px}.meta{color:#666;font-size:13px;margin-bottom:24px}.content{border:1px solid #ddd;border-radius:16px;padding:24px}</style></head><body><h1>${detail.title}</h1><div class="meta">${detail.page}</div><div class="content">${escaped}</div><script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  };

  const focusOriginal = () => {
    const element = detail.element;
    onClose();
    window.setTimeout(() => {
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.focus?.({ preventScroll: true });
    }, 80);
  };

  return (
    <div
      className="universal-card-modal fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm p-3 md:p-6 flex items-center justify-center"
      data-card-details-scope="off"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="w-full max-w-5xl max-h-[92vh] rounded-3xl border border-white/10 bg-slate-950 shadow-2xl overflow-hidden" dir="rtl" role="dialog" aria-modal="true" aria-label={detail.title}>
        <header className="px-5 md:px-7 py-5 border-b border-white/10 bg-white/[0.025] flex items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="text-xs text-yellow-500/80 mb-2 flex items-center gap-2"><Layers3 size={14}/>{detail.page}</div>
            <h2 className="font-heading text-2xl md:text-3xl font-black text-slate-100 truncate">{detail.title}</h2>
            <p className="text-sm text-slate-500 mt-2 leading-7">{detail.summary}</p>
          </div>
          <button type="button" onClick={onClose} className="w-11 h-11 shrink-0 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center" aria-label="إغلاق التفاصيل"><X size={20}/></button>
        </header>

        <div className="px-5 md:px-7 pt-4 border-b border-white/10 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setActiveTab(id)} className={`px-4 py-3 rounded-t-xl flex items-center gap-2 text-sm font-bold border-b-2 transition ${activeTab === id ? 'border-yellow-400 text-yellow-300 bg-yellow-500/10' : 'border-transparent text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}>
                <Icon size={16}/>{label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 md:p-7 overflow-y-auto max-h-[calc(92vh-190px)]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard icon={<BarChart3 size={18}/>} label="المؤشرات الظاهرة" value={detail.values.length} />
                <SummaryCard icon={<FileText size={18}/>} label="أسطر البيانات" value={detail.lines.length} />
                <SummaryCard icon={<Layers3 size={18}/>} label="البطاقات الفرعية" value={detail.subcards.length} />
                <SummaryCard icon={<Maximize2 size={18}/>} label="الإجراءات الأصلية" value={detail.actions.length} />
              </div>

              {detail.values.length > 0 && (
                <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <h3 className="font-heading text-lg font-black text-slate-100 mb-4">المؤشرات الرئيسية</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {detail.values.map((value, index) => <div key={`${value}-${index}`} className="rounded-xl border border-yellow-500/10 bg-yellow-500/[0.04] px-4 py-3 font-bold text-yellow-200">{value}</div>)}
                  </div>
                </section>
              )}

              {detail.indicators.length > 0 && (
                <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <h3 className="font-heading text-lg font-black text-slate-100 mb-4">الحالات والتنبيهات</h3>
                  <div className="flex flex-wrap gap-2">
                    {detail.indicators.map((indicator, index) => <span key={`${indicator}-${index}`} className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300">{indicator}</span>)}
                  </div>
                </section>
              )}

              {detail.subcards.length > 0 && (
                <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <h3 className="font-heading text-lg font-black text-slate-100 mb-4">البطاقات الفرعية المرتبطة</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {detail.subcards.map((item, index) => <div key={`${item}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-slate-300 flex items-center gap-2"><ArrowUpLeft size={14} className="text-yellow-400"/>{item}</div>)}
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-3">
              {detail.lines.length ? detail.lines.map((line, index) => (
                <div key={`${line}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.025] p-4 flex items-start gap-3">
                  <span className="w-7 h-7 shrink-0 rounded-lg bg-yellow-500/10 text-yellow-300 flex items-center justify-center text-xs font-black">{index + 1}</span>
                  <div className="text-sm leading-7 text-slate-300">{line}</div>
                </div>
              )) : <EmptyState text="لا توجد بيانات نصية إضافية داخل هذه البطاقة." />}
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <ActionButton icon={<Maximize2 size={17}/>} label="إظهار البطاقة الأصلية" onClick={focusOriginal} />
                <ActionButton icon={<ClipboardCopy size={17}/>} label={copied ? 'تم النسخ' : 'نسخ التفاصيل'} onClick={copyDetails} />
                <ActionButton icon={<Printer size={17}/>} label="طباعة التفاصيل" onClick={printDetails} />
                <ActionButton icon={<RefreshCw size={17}/>} label="تحديث القسم" onClick={() => window.location.reload()} />
              </div>

              {detail.actions.length > 0 && (
                <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <h3 className="font-heading text-lg font-black text-slate-100 mb-4">الإجراءات المتاحة داخل البطاقة</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {detail.actions.map((action, index) => <div key={`${action}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-slate-300">{action}</div>)}
                  </div>
                </section>
              )}

              {detail.links.length > 0 && (
                <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <h3 className="font-heading text-lg font-black text-slate-100 mb-4">الارتباطات</h3>
                  <div className="space-y-3">
                    {detail.links.map((link, index) => <a key={`${link.href}-${index}`} href={link.href} className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-sky-300 hover:border-sky-500/30 flex items-center justify-between gap-3"><span>{link.label || link.href}</span><ExternalLink size={15}/></a>)}
                  </div>
                </section>
              )}

              {!detail.actions.length && !detail.links.length && <EmptyState text="لا توجد إجراءات أصلية مرتبطة بهذه البطاقة؛ يمكن نسخها أو طباعتها أو العودة إلى موقعها في القسم." />}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ icon, label, value }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><div className="w-9 h-9 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center">{icon}</div><div className="font-heading text-3xl font-black mt-4 text-slate-100">{value}</div><div className="text-xs text-slate-500 mt-2">{label}</div></div>;
}

function ActionButton({ icon, label, onClick }) {
  return <button type="button" onClick={onClick} className="rounded-xl border border-white/10 bg-white/[0.025] hover:bg-yellow-500/10 hover:border-yellow-500/25 px-4 py-4 text-sm font-bold text-slate-200 flex items-center gap-3 transition">{icon}{label}</button>;
}

function EmptyState({ text }) {
  return <div className="p-8 text-center rounded-xl border border-dashed border-white/10 text-slate-600 text-sm">{text}</div>;
}
