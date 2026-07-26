import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowUpLeft, BarChart3, CalendarDays,
  CheckCircle2, ClipboardCopy, Database, ExternalLink, FileText, Focus,
  Gauge, Layers3, Link2, ListChecks, Maximize2, Printer, RefreshCw,
  Route, Sparkles, Target, TrendingUp, X,
} from "lucide-react";

const CARD_SELECTOR = [
  '[data-card-details]:not([data-card-details="off"])',
  '[data-testid*="card"]',
  '.glass-card',
  '[class*="rounded-3xl"][class*="border"]',
  '[class*="rounded-2xl"][class*="border"]',
  '[class*="rounded-xl"][class*="border"]',
].join(',');

const INTERACTIVE_SELECTOR = [
  'button', 'a', 'input', 'select', 'textarea', 'summary', 'label',
  '[role="button"]', '[role="link"]', '[contenteditable="true"]',
].join(',');

const ROUTE_PROFILES = [
  { prefix: '/camera-monitoring', page: 'مركز مراقبة الكاميرات', subject: 'حالة تشغيلية', purpose: 'متابعة الاتصال والتسجيل والكفاءة والصيانة' },
  { prefix: '/daily-report', page: 'الموجز التنفيذي اليومي', subject: 'بند في الموجز التنفيذي', purpose: 'تحديد الأولويات اليومية والمخاطر والقرارات المطلوبة' },
  { prefix: '/ai-lounge', page: 'مركز الوكلاء التنفيذيين', subject: 'وكيل أو قدرة تنفيذية', purpose: 'تحويل البيانات إلى تحليل وتوصية وإجراء' },
  { prefix: '/odoo-integration', page: 'بيئة تكامل Odoo', subject: 'مصدر أو مسار تكامل', purpose: 'التحقق من الاتصال وجودة البيانات والمزامنة' },
  { prefix: '/projects/', page: 'تفاصيل المشروع', subject: 'عنصر مشروع', purpose: 'متابعة النطاق والتقدم والمسؤوليات والمخاطر' },
  { prefix: '/projects', page: 'المشروعات', subject: 'مشروع أو محفظة', purpose: 'قياس التقدم والتعثر والارتباط بالأهداف' },
  { prefix: '/tasks', page: 'المهام', subject: 'مهمة تنفيذية', purpose: 'متابعة المسؤول والموعد والحالة ونسبة الإنجاز' },
  { prefix: '/executive-secretariat', page: 'السكرتارية التنفيذية', subject: 'معاملة أو متابعة', purpose: 'تنظيم المراسلات والمواعيد والقرارات والمتابعات' },
  { prefix: '/presidential-advisor', page: 'المستشار الخاص للرئيس التنفيذي', subject: 'تحليل أو توصية', purpose: 'دعم القرار التنفيذي بالتحليل والبدائل' },
  { prefix: '/legal-affairs', page: 'الشؤون القانونية', subject: 'ملف أو التزام قانوني', purpose: 'متابعة المخاطر والالتزامات والإجراءات القانونية' },
  { prefix: '/human-resources', page: 'الموارد البشرية', subject: 'مؤشر قوى عاملة', purpose: 'قراءة الموظفين والإدارات والوظائف والاحتياجات' },
  { prefix: '/quality-control', page: 'التفتيش والرقابة والجودة', subject: 'مؤشر رقابي', purpose: 'قياس الالتزام والجودة والملاحظات والإجراءات التصحيحية' },
  { prefix: '/calendar', page: 'التقويم التنفيذي', subject: 'موعد أو يوم تنفيذي', purpose: 'ربط الأحداث والاجتماعات ومواعيد الاستحقاق' },
  { prefix: '/meetings', page: 'الاجتماعات التنفيذية', subject: 'اجتماع تنفيذي', purpose: 'عرض الموعد والحضور والهدف والمخرجات والمتابعة' },
  { prefix: '/meeting-requests', page: 'طلبات الاجتماعات', subject: 'طلب اجتماع', purpose: 'متابعة الطلب والقرار والموعد والمزامنة مع Odoo' },
  { prefix: '/documents', page: 'مركز تحليل المستندات', subject: 'مستند مؤسسي', purpose: 'عرض التصنيف والملخص والمخاطر والإجراءات المستخرجة' },
  { prefix: '/messages', page: 'مركز الاتصالات', subject: 'مراسلة تنفيذية', purpose: 'التوجيه والتلخيص واستخراج المتابعة والإجراءات' },
  { prefix: '/voice', page: 'مركز الأوامر الصوتية', subject: 'أمر تنفيذي', purpose: 'تحويل التوجيه الصوتي إلى قرار أو مهمة قابلة للمتابعة' },
  { prefix: '/reports', page: 'التقارير والتحليلات', subject: 'مؤشر أو تحليل', purpose: 'تفسير الأداء والمقارنة ودعم القرار' },
  { prefix: '/team', page: 'فريق العمل', subject: 'عضو أو وحدة تنظيمية', purpose: 'عرض الدور والمسؤولية والارتباط التنظيمي' },
  { prefix: '/notifications', page: 'الإشعارات', subject: 'تنبيه تنفيذي', purpose: 'تحديد الحدث والأولوية والإجراء المطلوب' },
  { prefix: '/settings', page: 'الإعدادات', subject: 'إعداد تشغيلي', purpose: 'توضيح أثر الإعداد ونطاق تطبيقه' },
  { prefix: '/admin', page: 'إدارة المنصة', subject: 'عنصر إدارة', purpose: 'إدارة المستخدمين والصلاحيات وحالة التشغيل' },
  { prefix: '/dashboard', page: 'لوحة القيادة التنفيذية', subject: 'مؤشر تنفيذي', purpose: 'قراءة الأداء والمخاطر واتخاذ القرار' },
];

const GENERIC_TITLE_PATTERN = /^(فتح|عرض|مشاهدة)?\s*(تفاصيل\s*)?(هذه\s*)?(البطاقة|الكارد|العنصر|المزيد|التفاصيل)$/i;
const GENERATED_TEXT_PATTERN = /فتح تفاصيل (البطاقة|الكارد)|عرض تفصيلي لمحتوى بطاقة|ضمن قسم المنصة التنفيذية/i;
const STATUS_WORDS = [
  { tokens: ['حرج', 'متأخر', 'خطر', 'فشل', 'غير متاح', 'مرفوض', 'منقطع'], label: 'يتطلب تدخلاً', tone: 'rose', level: 'high' },
  { tokens: ['بانتظار', 'قيد المراجعة', 'معلق', 'تنبيه', 'متوسط', 'تحت المراقبة'], label: 'يحتاج متابعة', tone: 'amber', level: 'medium' },
  { tokens: ['مكتمل', 'سليم', 'ناجح', 'متصل', 'معتمد', 'نشط', 'متزامن'], label: 'حالة مستقرة', tone: 'emerald', level: 'low' },
];

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function normaliseDigits(value) {
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  return String(value || '')
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isSafeHref(href) {
  return Boolean(href) && !/^\s*javascript:/i.test(String(href));
}

function routeProfile(pathname) {
  return ROUTE_PROFILES.find((profile) => pathname.startsWith(profile.prefix)) || {
    page: 'ARAAK CEO',
    subject: 'عنصر تنفيذي',
    purpose: 'عرض البيانات والارتباطات والإجراءات ذات الصلة',
  };
}

function isGenericTitle(value) {
  const text = cleanText(value);
  return !text || GENERIC_TITLE_PATTERN.test(text) || GENERATED_TEXT_PATTERN.test(text);
}

function semanticLines(card) {
  const elements = Array.from(card.querySelectorAll(
    'h1,h2,h3,h4,h5,h6,p,li,dt,dd,th,td,strong,time,[data-card-label],[data-card-value]'
  ));
  let lines = unique(elements.map((element) => element.textContent));
  if (lines.length < 2) {
    lines = unique(String(card.innerText || card.textContent || '').split(/\n+/));
  }
  return lines
    .filter((line) => line.length <= 260)
    .filter((line) => !GENERATED_TEXT_PATTERN.test(line))
    .slice(0, 60);
}

function nearestSectionTitle(card) {
  let node = card.parentElement;
  while (node && node !== document.body) {
    const directHeadings = Array.from(node.children || []).filter((child) => (
      child !== card && child.matches?.('h1,h2,h3,h4,h5,h6,[data-section-title]')
    ));
    const title = directHeadings.map((element) => cleanText(element.textContent)).find((value) => !isGenericTitle(value));
    if (title) return { title, element: directHeadings.find((element) => cleanText(element.textContent) === title) };
    node = node.parentElement;
  }
  return null;
}

function deriveTitle(card, profile, lines) {
  const explicit = cleanText(card.dataset.cardTitle);
  const heading = cleanText(card.querySelector('[data-card-title], h1, h2, h3, h4, h5, h6')?.textContent);
  const aria = card.dataset.universalGeneratedLabel === 'true' ? '' : cleanText(card.getAttribute('aria-label'));
  const labelled = cleanText(card.querySelector('[data-card-label]')?.textContent);
  const firstMeaningful = lines.find((line) => !isGenericTitle(line) && line.length <= 120);
  const candidate = [explicit, heading, labelled, aria, firstMeaningful].find((value) => !isGenericTitle(value));
  return candidate || `تفاصيل ${profile.subject}`;
}

function valueKind(value) {
  const text = cleanText(value);
  if (/%|٪/.test(text)) return 'percent';
  if (/ر\.س|ريال|SAR|USD|EUR|£|\$/.test(text)) return 'currency';
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(normaliseDigits(text))) return 'date';
  if (/^[\d٠-٩۰-۹,.]+\s*(مشروع|مهمة|موظف|اجتماع|طلب|مستند|مراسلة)?$/.test(text)) return 'number';
  return 'text';
}

function numericValue(value) {
  const normalised = normaliseDigits(value).replace(/,/g, '');
  const match = normalised.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function metricLabel(valueElement, value, profile) {
  const explicit = valueElement.getAttribute('data-card-label')
    || valueElement.closest('[data-card-metric]')?.querySelector('[data-card-label]')?.textContent;
  if (cleanText(explicit)) return cleanText(explicit);

  const container = valueElement.closest('li,td,th,dt,dd,[class*="grid"],div');
  if (container) {
    const pieces = unique(Array.from(container.querySelectorAll('span,div,p,small,label')).map((element) => element.textContent));
    const label = pieces.find((piece) => piece !== cleanText(value) && piece.length <= 90 && !/^[-+]?\d/.test(normaliseDigits(piece)));
    if (label) return label;
  }
  return profile.subject;
}

function collectMetrics(card, profile) {
  const metrics = [];
  const add = (label, value, sourceElement = null) => {
    const cleanValue = cleanText(value);
    const cleanLabel = cleanText(label);
    if (!cleanValue || cleanValue.length > 100 || isGenericTitle(cleanValue)) return;
    const signature = `${cleanLabel}|${cleanValue}`;
    if (metrics.some((metric) => metric.signature === signature)) return;
    metrics.push({
      signature,
      label: cleanLabel || profile.subject,
      value: cleanValue,
      kind: valueKind(cleanValue),
      numeric: numericValue(cleanValue),
      element: sourceElement,
    });
  };

  Array.from(card.querySelectorAll('[data-card-value]')).forEach((element) => {
    add(metricLabel(element, element.textContent, profile), element.textContent, element);
  });

  Array.from(card.querySelectorAll('dt')).forEach((term) => {
    const description = term.nextElementSibling;
    if (description?.matches('dd')) add(term.textContent, description.textContent, description);
  });

  Array.from(card.querySelectorAll('tr')).forEach((row) => {
    const cells = Array.from(row.querySelectorAll(':scope > th, :scope > td'));
    if (cells.length >= 2) add(cells[0].textContent, cells.slice(1).map((cell) => cleanText(cell.textContent)).join(' • '), row);
  });

  const visibleValueSelector = [
    'strong',
    '[class*="text-5xl"]', '[class*="text-4xl"]', '[class*="text-3xl"]', '[class*="text-2xl"]',
    '[class*="font-black"]', '[class*="tabular-nums"]', 'time',
  ].join(',');

  Array.from(card.querySelectorAll(visibleValueSelector)).forEach((element) => {
    const value = cleanText(element.textContent);
    const kind = valueKind(value);
    if (kind === 'text' && value.length > 35) return;
    if (kind === 'text' && !/(مكتمل|نشط|متأخر|حرج|معتمد|متصل|بانتظار|قيد)/.test(value)) return;
    add(metricLabel(element, value, profile), value, element);
  });

  return metrics.slice(0, 16);
}

function collectStatuses(card, lines) {
  const statuses = [];
  const add = (text, tone, level) => {
    const label = cleanText(text);
    if (!label || statuses.some((status) => status.label === label)) return;
    statuses.push({ label, tone, level });
  };

  Array.from(card.querySelectorAll(
    '[class*="text-emerald"], [class*="text-rose"], [class*="text-red"], [class*="text-amber"], [class*="text-yellow"], [class*="text-sky"]'
  )).forEach((element) => {
    const text = cleanText(element.textContent);
    if (!text || text.length > 90) return;
    const classes = String(element.className || '');
    if (/rose|red/.test(classes)) add(text, 'rose', 'high');
    else if (/amber|yellow/.test(classes)) add(text, 'amber', 'medium');
    else if (/emerald/.test(classes)) add(text, 'emerald', 'low');
    else add(text, 'sky', 'info');
  });

  lines.forEach((line) => {
    const match = STATUS_WORDS.find((status) => status.tokens.some((token) => line.includes(token)));
    if (match && line.length <= 90) add(line, match.tone, match.level);
  });

  return statuses.slice(0, 10);
}

function directSubcards(card) {
  return Array.from(card.querySelectorAll(CARD_SELECTOR)).filter((candidate) => {
    if (candidate === card || !isCandidate(candidate, card)) return false;
    return candidate.parentElement?.closest(CARD_SELECTOR) === card;
  });
}

function miniSnapshot(element, pathname) {
  const profile = routeProfile(pathname);
  const lines = semanticLines(element);
  const title = deriveTitle(element, profile, lines);
  const metrics = collectMetrics(element, profile);
  const summary = lines.find((line) => line !== title && line.length > 18 && line.length <= 150) || '';
  return { element, title, summary, metrics };
}

function collectRelationships(card, pathname, profile) {
  const relationships = [];
  const add = (type, label, detail, element = null, href = null) => {
    const cleanLabel = cleanText(label);
    if (!cleanLabel || isGenericTitle(cleanLabel)) return;
    const signature = `${type}|${cleanLabel}|${href || ''}`;
    if (relationships.some((item) => item.signature === signature)) return;
    relationships.push({ signature, type, label: cleanLabel, detail: cleanText(detail), element, href });
  };

  const parentCard = card.parentElement?.closest(CARD_SELECTOR);
  if (parentCard && parentCard !== card) {
    const parent = miniSnapshot(parentCard, pathname);
    add('parent', parent.title, 'البطاقة الأعلى التي تحتوي هذا المؤشر', parentCard);
  }

  const section = nearestSectionTitle(card);
  if (section && section.title !== profile.page) add('section', section.title, `السياق المباشر داخل ${profile.page}`, section.element);

  Array.from(card.parentElement?.children || []).filter((element) => (
    element !== card && element.matches?.(CARD_SELECTOR) && isCandidate(element, card.parentElement)
  )).slice(0, 6).forEach((element) => {
    const sibling = miniSnapshot(element, pathname);
    add('sibling', sibling.title, sibling.summary || 'بطاقة مرتبطة في المستوى نفسه', element);
  });

  const ownLink = card.matches('a[href]') ? [{ element: card, href: card.getAttribute('href') }] : [];
  const nestedLinks = Array.from(card.querySelectorAll('a[href]')).map((element) => ({ element, href: element.getAttribute('href') }));
  [...ownLink, ...nestedLinks].forEach(({ element, href }) => {
    if (!isSafeHref(href)) return;
    add('link', element.getAttribute('aria-label') || element.textContent || 'فتح الارتباط', 'انتقال إلى صفحة أو سجل مرتبط', element, href);
  });

  return relationships.slice(0, 16);
}

function sourceLabel(card, lines) {
  const explicit = cleanText(card.dataset.cardSource);
  if (explicit) return explicit;
  const text = lines.join(' ').toLowerCase();
  if (text.includes('odoo')) return 'Odoo مباشر';
  if (text.includes('live') || text.includes('مباشر')) return 'بيانات تشغيلية مباشرة';
  if (text.includes('araak ceo')) return 'ARAAK CEO';
  if (text.includes('تجريبي') || text.includes('demo')) return 'بيانات تجريبية';
  return 'البيانات الظاهرة في الصفحة';
}

function buildSummary({ title, profile, metrics, statuses, relationships, explicitSummary }) {
  if (explicitSummary && !GENERATED_TEXT_PATTERN.test(explicitSummary) && explicitSummary !== title) return explicitSummary;
  const primaryMetric = metrics.find((metric) => metric.kind !== 'text') || metrics[0];
  const status = statuses[0];
  const parts = [`تعرض هذه البطاقة ${profile.subject} «${title}» ضمن ${profile.page}، بهدف ${profile.purpose}.`];
  if (primaryMetric) parts.push(`القيمة الأبرز هي ${primaryMetric.value} لـ${primaryMetric.label}.`);
  if (status) parts.push(`الحالة الظاهرة: ${status.label}.`);
  if (relationships.length) parts.push(`ترتبط البطاقة بـ${relationships.length} عنصرًا أو مسارًا يمكن الرجوع إليه.`);
  return parts.join(' ');
}

function buildInsights(metrics, statuses, profile) {
  const insights = [];
  const add = (title, text, tone = 'sky') => {
    if (!text || insights.some((item) => item.text === text)) return;
    insights.push({ title, text, tone });
  };

  metrics.forEach((metric) => {
    if (metric.kind === 'percent' && metric.numeric !== null) {
      if (metric.numeric === 0) add('قراءة الإنجاز', `${metric.label} يظهر عند 0%؛ يلزم التحقق من تحديث المصدر أو بدء التنفيذ الفعلي.`, 'amber');
      else if (metric.numeric < 40) add('قراءة الإنجاز', `${metric.label} عند ${metric.value} وهو مستوى منخفض يحتاج متابعة أسباب التعثر وخطة الاستدراك.`, 'rose');
      else if (metric.numeric < 75) add('قراءة الإنجاز', `${metric.label} عند ${metric.value}؛ التقدم قائم مع حاجة إلى متابعة البنود المفتوحة.`, 'amber');
      else add('قراءة الإنجاز', `${metric.label} عند ${metric.value} ويعكس تقدماً جيداً مع ضرورة تثبيت الإغلاق والمخرجات.`, 'emerald');
    }
    if (metric.kind === 'number' && metric.numeric === 0) {
      add('اكتمال البيانات', `${metric.label} لا يعرض سجلات حالياً؛ قد يعني عدم وجود عناصر أو أن المصدر لم يحدّث بعد.`, 'amber');
    }
  });

  const highestStatus = statuses.find((status) => status.level === 'high') || statuses.find((status) => status.level === 'medium');
  if (highestStatus) {
    add(
      highestStatus.level === 'high' ? 'تنبيه تنفيذي' : 'متابعة مطلوبة',
      highestStatus.level === 'high'
        ? `الحالة «${highestStatus.label}» تستدعي تحديد المسؤول والإجراء والموعد قبل إغلاق المتابعة.`
        : `الحالة «${highestStatus.label}» تحتاج متابعة حتى الانتقال إلى حالة مستقرة أو مكتملة.`,
      highestStatus.tone,
    );
  }

  if (!insights.length) {
    add('دلالة البطاقة', `تُقرأ هذه البطاقة في سياق ${profile.purpose}، ويُستحسن ربطها بمسؤول وموعد أو سجل تفصيلي متى كان ذلك متاحًا.`, 'sky');
  }
  return insights.slice(0, 8);
}

function getSnapshot(card, pathname) {
  const profile = routeProfile(pathname);
  const lines = semanticLines(card);
  const title = deriveTitle(card, profile, lines);
  const metrics = collectMetrics(card, profile);
  const statuses = collectStatuses(card, lines);
  const relationships = collectRelationships(card, pathname, profile);
  const subcards = directSubcards(card).map((element) => miniSnapshot(element, pathname)).slice(0, 12);
  const actions = unique(Array.from(card.querySelectorAll('button, a')).map((element) => (
    element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent
  ))).filter((value) => value.length <= 110 && !GENERIC_TITLE_PATTERN.test(value)).slice(0, 20);
  const links = relationships.filter((relationship) => relationship.type === 'link' && relationship.href);
  const explicitSummary = cleanText(
    card.dataset.cardSummary
      || Array.from(card.querySelectorAll('p,[data-card-summary]')).map((element) => cleanText(element.textContent)).find((line) => line.length > 24)
  );
  const filteredLines = lines.filter((line) => line !== title && line !== explicitSummary && !isGenericTitle(line)).slice(0, 50);
  const summary = buildSummary({ title, profile, metrics, statuses, relationships, explicitSummary });
  const insights = buildInsights(metrics, statuses, profile);

  return {
    element: card,
    pathname,
    profile,
    page: profile.page,
    title,
    summary,
    lines: filteredLines,
    metrics,
    statuses,
    insights,
    relationships,
    subcards,
    actions,
    links,
    source: sourceLabel(card, lines),
    capturedAt: new Date().toISOString(),
  };
}

function cardContentScore(card) {
  const text = cleanText(card.textContent);
  const numeric = normaliseDigits(text).match(/\d+/g)?.length || 0;
  const semantic = card.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,dt,dd,th,td,strong,time,[data-card-value]').length;
  const links = card.querySelectorAll('a[href],button').length;
  return Math.min(text.length, 100) + (numeric * 12) + (semantic * 8) + (links * 5);
}

function isCandidate(card, root) {
  if (!card || !root?.contains(card)) return false;
  if (card.matches('button, form, nav, aside')) return false;
  if (card.closest('[role="dialog"], [data-card-details-scope="off"]')) return false;
  if (card.closest('.fixed.inset-0') && card.dataset.cardDetails !== 'force') return false;
  if (card.dataset.cardDetails === 'off') return false;
  if (cleanText(card.textContent).length < 2) return false;
  if (cardContentScore(card) < 18 && card.dataset.cardDetails !== 'force') return false;
  return true;
}

function markCards(root, pathname) {
  if (!root) return;
  const candidates = Array.from(root.querySelectorAll(CARD_SELECTOR));
  if (root.matches?.(CARD_SELECTOR)) candidates.unshift(root);

  candidates.forEach((card) => {
    if (!isCandidate(card, root)) return;
    const cardAnchor = card.matches('a[href]');
    if (card.matches(INTERACTIVE_SELECTOR) && !cardAnchor) return;
    card.dataset.universalCardEnhanced = 'true';
    if (!cardAnchor) {
      if (!card.hasAttribute('tabindex')) card.tabIndex = 0;
      if (!card.hasAttribute('role')) card.setAttribute('role', 'button');
    }
    if (!card.hasAttribute('aria-label') || card.dataset.universalGeneratedLabel === 'true') {
      const preview = getSnapshot(card, pathname);
      card.dataset.universalGeneratedLabel = 'true';
      card.setAttribute('aria-label', `عرض ${preview.title}`);
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

      if (card.matches('a[href]')) {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
      }
      openCard(card);
    };

    const handleKeyDown = (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      const card = event.target.closest('[data-universal-card-enhanced="true"]');
      if (!isCandidate(card, root)) return;
      if (card.matches('a[href]') && event.key === 'Enter') return;
      event.preventDefault();
      openCard(card);
    };

    markCards(root, location.pathname);
    const observer = new MutationObserver(() => markCards(root, location.pathname));
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    root.addEventListener('click', handleClick);
    root.addEventListener('keydown', handleKeyDown);

    return () => {
      observer.disconnect();
      root.removeEventListener('click', handleClick);
      root.removeEventListener('keydown', handleKeyDown);
    };
  }, [location.pathname]);

  useEffect(() => setDetail(null), [location.pathname]);

  const refreshDetail = () => {
    setDetail((current) => current?.element?.isConnected ? getSnapshot(current.element, current.pathname) : current);
  };

  const openRelated = (element) => {
    if (element?.isConnected) setDetail(getSnapshot(element, location.pathname));
  };

  return (
    <>
      <div ref={rootRef} data-universal-card-root="true">{children}</div>
      <UniversalCardModal
        detail={detail}
        onClose={() => setDetail(null)}
        onRefresh={refreshDetail}
        onOpenRelated={openRelated}
      />
    </>
  );
}

function UniversalCardModal({ detail, onClose, onRefresh, onOpenRelated }) {
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
    const metrics = detail.metrics.map((metric) => `${metric.label}: ${metric.value}`);
    const insights = detail.insights.map((insight) => `${insight.title}: ${insight.text}`);
    return [detail.title, detail.summary, ...metrics, ...insights, ...detail.lines].filter(Boolean).join('\n');
  }, [detail]);

  if (!detail) return null;

  const tabs = [
    { id: 'overview', label: 'الملخص التنفيذي', icon: Sparkles },
    { id: 'details', label: `البيانات (${detail.metrics.length + detail.lines.length})`, icon: ListChecks },
    { id: 'context', label: `السياق والارتباط (${detail.relationships.length + detail.subcards.length})`, icon: Layers3 },
    { id: 'actions', label: 'الإجراءات', icon: Route },
  ];

  const primaryMetric = detail.metrics.find((metric) => metric.kind !== 'text') || detail.metrics[0];
  const primaryStatus = detail.statuses.find((status) => status.level === 'high') || detail.statuses[0];
  const capturedTime = new Date(detail.capturedAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });

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
    const popup = window.open('', '_blank', 'width=980,height=760');
    if (!popup) return;
    const safeTitle = escapeHtml(detail.title);
    const safePage = escapeHtml(detail.page);
    const escaped = escapeHtml(printableText).replace(/\n/g, '<br/>');
    popup.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${safeTitle}</title><style>body{font-family:Arial,sans-serif;padding:48px;line-height:2;color:#111}h1{font-size:28px;margin-bottom:8px}.meta{color:#666;font-size:13px;margin-bottom:24px}.content{border:1px solid #ddd;border-radius:16px;padding:24px}</style></head><body><h1>${safeTitle}</h1><div class="meta">${safePage} • ARAAK CEO</div><div class="content">${escaped}</div><script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  };

  const focusElement = (element = detail.element) => {
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
      <section className="w-full max-w-6xl max-h-[94vh] rounded-3xl border border-white/10 bg-slate-950 shadow-2xl overflow-hidden" dir="rtl" role="dialog" aria-modal="true" aria-label={detail.title}>
        <header className="px-5 md:px-7 py-5 border-b border-white/10 bg-white/[0.025] flex items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-xs text-yellow-500/80 flex items-center gap-2"><Layers3 size={14}/>{detail.page}</span>
              <span className="px-2.5 py-1 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.07] text-[10px] text-emerald-300 flex items-center gap-1.5"><Database size={11}/>{detail.source}</span>
              <span className="text-[10px] text-slate-600">قراءة محدثة {capturedTime}</span>
            </div>
            <h2 className="font-heading text-2xl md:text-3xl font-black text-slate-100 leading-tight">{detail.title}</h2>
            <p className="text-sm text-slate-400 mt-2 leading-7 max-w-4xl">{detail.summary}</p>
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

        <div className="p-5 md:p-7 overflow-y-auto max-h-[calc(94vh-205px)]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <ExecutiveSummaryCard
                  icon={<Gauge size={18}/>}
                  label={primaryMetric?.label || 'القيمة الرئيسية'}
                  value={primaryMetric?.value || '—'}
                  tone="yellow"
                />
                <ExecutiveSummaryCard
                  icon={primaryStatus?.level === 'high' ? <AlertTriangle size={18}/> : <CheckCircle2 size={18}/>}
                  label="الحالة التنفيذية"
                  value={primaryStatus?.label || 'لا يوجد تنبيه ظاهر'}
                  tone={primaryStatus?.tone || 'emerald'}
                />
                <ExecutiveSummaryCard icon={<Target size={18}/>} label="الغرض التشغيلي" value={detail.profile.purpose} tone="sky" compact />
                <ExecutiveSummaryCard icon={<Link2 size={18}/>} label="العناصر المرتبطة" value={detail.relationships.length + detail.subcards.length} tone="violet" />
              </div>

              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 md:p-6">
                <div className="flex items-center gap-2 text-yellow-300 mb-3"><Sparkles size={17}/><h3 className="font-heading text-lg font-black">الخلاصة التنفيذية</h3></div>
                <p className="text-sm md:text-base leading-8 text-slate-300">{detail.summary}</p>
              </section>

              {detail.metrics.length > 0 && (
                <section>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2 text-slate-100"><BarChart3 size={17} className="text-yellow-400"/><h3 className="font-heading text-lg font-black">قراءة المؤشرات</h3></div>
                    <span className="text-[10px] text-slate-600">قيم مستخرجة من البطاقة الحالية</span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {detail.metrics.slice(0, 9).map((metric, index) => <MetricCard key={`${metric.signature}-${index}`} metric={metric} />)}
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-center gap-2 text-slate-100 mb-4"><TrendingUp size={17} className="text-yellow-400"/><h3 className="font-heading text-lg font-black">الدلالة وما يستحق الانتباه</h3></div>
                <div className="grid md:grid-cols-2 gap-3">
                  {detail.insights.map((insight, index) => <InsightCard key={`${insight.title}-${index}`} insight={insight} />)}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-6">
              {detail.metrics.length > 0 && (
                <section>
                  <h3 className="font-heading text-lg font-black text-slate-100 mb-4">البيانات المنظمة</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {detail.metrics.map((metric, index) => (
                      <div key={`${metric.signature}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.025] p-4 flex items-center justify-between gap-4">
                        <div className="text-xs text-slate-500">{metric.label}</div>
                        <div className="font-heading font-black text-slate-100 text-left">{metric.value}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="font-heading text-lg font-black text-slate-100 mb-4">الشرح والبيانات النصية</h3>
                <div className="space-y-3">
                  {detail.lines.length ? detail.lines.map((line, index) => (
                    <div key={`${line}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.025] p-4 flex items-start gap-3">
                      <span className="w-7 h-7 shrink-0 rounded-lg bg-yellow-500/10 text-yellow-300 flex items-center justify-center text-xs font-black">{index + 1}</span>
                      <div className="text-sm leading-7 text-slate-300">{line}</div>
                    </div>
                  )) : <EmptyState text="لا توجد بيانات نصية إضافية، لكن المؤشرات المنظمة أعلاه تمثل محتوى البطاقة الحالي." />}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'context' && (
            <div className="space-y-6">
              <section className="rounded-2xl border border-sky-500/10 bg-sky-500/[0.035] p-5">
                <div className="flex items-center gap-2 text-sky-300 mb-2"><Focus size={17}/><h3 className="font-heading text-lg font-black">موقع البطاقة في السياق</h3></div>
                <p className="text-sm leading-7 text-slate-300">هذه البطاقة جزء من {detail.page}، وتُستخدم في {detail.profile.purpose}. العناصر أدناه توضح ما يسبقها أو يجاورها أو يرتبط بها مباشرة.</p>
              </section>

              {detail.relationships.length > 0 && (
                <section>
                  <h3 className="font-heading text-lg font-black text-slate-100 mb-4">الارتباطات المباشرة</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {detail.relationships.map((relationship, index) => (
                      relationship.href ? (
                        <a key={`${relationship.signature}-${index}`} href={relationship.href} className="rounded-xl border border-white/10 bg-white/[0.025] hover:border-sky-500/30 p-4 flex items-center justify-between gap-3">
                          <div><div className="font-bold text-sky-300">{relationship.label}</div><div className="text-xs text-slate-500 mt-1">{relationship.detail}</div></div><ExternalLink size={16} className="text-sky-400"/>
                        </a>
                      ) : (
                        <button key={`${relationship.signature}-${index}`} type="button" onClick={() => relationship.element && focusElement(relationship.element)} className="rounded-xl border border-white/10 bg-white/[0.025] hover:border-yellow-500/25 p-4 text-right flex items-center justify-between gap-3">
                          <div><div className="font-bold text-slate-200">{relationship.label}</div><div className="text-xs text-slate-500 mt-1">{relationship.detail}</div></div><ArrowUpLeft size={16} className="text-yellow-400"/>
                        </button>
                      )
                    ))}
                  </div>
                </section>
              )}

              {detail.subcards.length > 0 && (
                <section>
                  <h3 className="font-heading text-lg font-black text-slate-100 mb-4">تفاصيل البطاقات التابعة</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {detail.subcards.map((subcard, index) => (
                      <button key={`${subcard.title}-${index}`} type="button" onClick={() => onOpenRelated(subcard.element)} className="rounded-xl border border-white/10 bg-white/[0.025] hover:border-yellow-500/25 p-4 text-right">
                        <div className="flex items-center justify-between gap-2"><div className="font-bold text-slate-100">{subcard.title}</div><Maximize2 size={14} className="text-yellow-400"/></div>
                        {subcard.summary && <div className="text-xs text-slate-500 leading-6 mt-2 line-clamp-2">{subcard.summary}</div>}
                        {subcard.metrics[0] && <div className="mt-3 text-sm font-black text-yellow-300">{subcard.metrics[0].value}<span className="text-[10px] font-normal text-slate-600 mr-2">{subcard.metrics[0].label}</span></div>}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {!detail.relationships.length && !detail.subcards.length && <EmptyState text="لم تظهر عناصر مرتبطة داخل بنية الصفحة الحالية. يمكن الرجوع إلى البطاقة الأصلية أو استخدام الروابط والإجراءات المتاحة." />}
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <ActionButton icon={<Focus size={17}/>} label="العودة إلى موقع البطاقة" onClick={() => focusElement()} />
                <ActionButton icon={<RefreshCw size={17}/>} label="إعادة قراءة البيانات" onClick={onRefresh} />
                <ActionButton icon={<ClipboardCopy size={17}/>} label={copied ? 'تم نسخ الملخص' : 'نسخ الملخص والبيانات'} onClick={copyDetails} />
                <ActionButton icon={<Printer size={17}/>} label="طباعة القراءة التنفيذية" onClick={printDetails} />
              </div>

              {detail.actions.length > 0 && (
                <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <h3 className="font-heading text-lg font-black text-slate-100 mb-4">الإجراءات الأصلية داخل البطاقة</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {detail.actions.map((action, index) => <div key={`${action}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-slate-300 flex items-center gap-2"><Activity size={14} className="text-yellow-400"/>{action}</div>)}
                  </div>
                </section>
              )}

              {detail.links.length > 0 && (
                <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <h3 className="font-heading text-lg font-black text-slate-100 mb-4">صفحات وسجلات مرتبطة</h3>
                  <div className="space-y-3">
                    {detail.links.map((link, index) => <a key={`${link.href}-${index}`} href={link.href} className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-sky-300 hover:border-sky-500/30 flex items-center justify-between gap-3"><span>{link.label || link.href}</span><ExternalLink size={15}/></a>)}
                  </div>
                </section>
              )}

              {!detail.actions.length && !detail.links.length && <EmptyState text="لا توجد أزرار أو روابط أصلية داخل البطاقة؛ تبقى خيارات العودة، إعادة القراءة، النسخ والطباعة متاحة." />}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ExecutiveSummaryCard({ icon, label, value, tone = 'yellow', compact = false }) {
  const toneClasses = {
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/10',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/10',
    rose: 'bg-rose-500/10 text-rose-300 border-rose-500/10',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/10',
    sky: 'bg-sky-500/10 text-sky-300 border-sky-500/10',
    violet: 'bg-violet-500/10 text-violet-300 border-violet-500/10',
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 min-h-[138px]">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${toneClasses[tone] || toneClasses.yellow}`}>{icon}</div>
      <div className={`font-heading font-black mt-4 text-slate-100 ${compact ? 'text-sm leading-6' : 'text-2xl'}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-2">{label}</div>
    </div>
  );
}

function MetricCard({ metric }) {
  const percent = metric.kind === 'percent' && metric.numeric !== null ? Math.max(0, Math.min(100, metric.numeric)) : null;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <div className="text-xs text-slate-500">{metric.label}</div>
      <div className="font-heading text-2xl font-black text-yellow-200 mt-2">{metric.value}</div>
      {percent !== null && (
        <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-yellow-500" style={{ width: `${percent}%` }} /></div>
      )}
    </div>
  );
}

function InsightCard({ insight }) {
  const toneClasses = {
    rose: 'border-rose-500/15 bg-rose-500/[0.05] text-rose-300',
    amber: 'border-amber-500/15 bg-amber-500/[0.05] text-amber-300',
    emerald: 'border-emerald-500/15 bg-emerald-500/[0.05] text-emerald-300',
    sky: 'border-sky-500/15 bg-sky-500/[0.05] text-sky-300',
  };
  const icon = insight.tone === 'rose' || insight.tone === 'amber' ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>;
  return (
    <div className={`rounded-xl border p-4 ${toneClasses[insight.tone] || toneClasses.sky}`}>
      <div className="flex items-center gap-2 font-bold text-sm">{icon}{insight.title}</div>
      <div className="text-xs leading-6 text-slate-300 mt-2">{insight.text}</div>
    </div>
  );
}

function ActionButton({ icon, label, onClick }) {
  return <button type="button" onClick={onClick} className="rounded-xl border border-white/10 bg-white/[0.025] hover:bg-yellow-500/10 hover:border-yellow-500/25 px-4 py-4 text-sm font-bold text-slate-200 flex items-center gap-3 transition">{icon}{label}</button>;
}

function EmptyState({ text }) {
  return <div className="p-8 text-center rounded-xl border border-dashed border-white/10 text-slate-600 text-sm">{text}</div>;
}
