import { useEffect } from "react";
import { translateArabicText } from "../i18n/ar";
import { translateExtraArabicText } from "../i18n/ar-extra";
import ARAAK_GROUP_LOGO from "../assets/araakGroupLogoData";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label", "data-empty-label"];
const LEGACY_BRAND_ALT = /NEXGEN EXECUTIVES/i;

const PROFESSIONAL_TERMS = [
  [/معرف المجموعة التنظيمية/g, "معرّف مجموعة العمل"],
  [/معرف مجموعتك/g, "معرّف مجموعة العمل"],
  [/معرف المجموعة/g, "معرّف مجموعة العمل"],
  [/(?<!التفتيش و)الرقابة والجودة/g, "التفتيش والرقابة والجودة"],
  [/صالة الوكلاء الذكيين/g, "مركز الوكلاء التنفيذيين"],
  [/صالة الذكاء التنفيذي/g, "مركز العمليات التنفيذية"],
  [/صالة الوكلاء/g, "مركز الوكلاء التنفيذيين"],
  [/القوى العاملة الذكية/g, "منظومة الوكلاء التنفيذيين"],
  [/الذكاء الاصطناعي/g, "الأتمتة والتحليل المؤسسي"],
  [/الذكاء التنفيذي/g, "التحليل التنفيذي"],
  [/التنسيق الذكي/g, "التنسيق التنفيذي"],
  [/التنقل الذكي/g, "مركز الأوامر التنفيذية"],
  [/رادار المخاطر الذكي/g, "رادار المخاطر التنفيذي"],
  [/رئيس الديوان الذكي/g, "رئيس الديوان الرقمي"],
  [/وكيل ذكاء المشروعات/g, "وكيل تحليل المشروعات"],
  [/وكيل ذكاء الاجتماعات/g, "وكيل تحليل الاجتماعات"],
  [/وكيل ذكاء المستندات/g, "وكيل تحليل المستندات"],
  [/محطة ذكاء المستندات/g, "مركز تحليل المستندات"],
  [/ذكاء المشروعات/g, "تحليل المشروعات"],
  [/ذكاء الاجتماعات/g, "تحليل الاجتماعات"],
  [/ذكاء المستندات/g, "تحليل المستندات"],
  [/الذكيين/g, "التنفيذيين"],
  [/الذكيات/g, "المتقدمات"],
  [/الذكية/g, "المتقدمة"],
  [/الذكي/g, "الرقمي"],
  [/ذكاء/g, "تحليل"],
  [/الذكاء/g, "التحليل"],
  [/صالة/g, "مركز"],
  [/\bArtificial Intelligence\b/gi, "Advanced Operations"],
  [/\bExecutive Intelligence\b/gi, "Executive Analysis"],
  [/\bIntelligence\b/gi, "Analysis"],
  [/\bIntelligent\b/gi, "Advanced"],
  [/\bSmart\b/gi, "Professional"],
  [/\bAI\b/g, "Executive"],
];

function professionalize(value) {
  if (typeof value !== "string") return value;
  return PROFESSIONAL_TERMS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    value,
  );
}

function translate(value) {
  return professionalize(translateExtraArabicText(translateArabicText(value)));
}

function localizeTextNode(node) {
  if (!node?.parentElement || SKIP_TAGS.has(node.parentElement.tagName)) return;
  const current = node.nodeValue;
  const translated = translate(current);
  if (translated !== current) node.nodeValue = translated;
}

function applyOfficialBranding(element) {
  if (!(element instanceof HTMLImageElement)) return;
  const alt = element.getAttribute("alt") || "";
  if (!LEGACY_BRAND_ALT.test(alt)) return;

  if (element.src !== ARAAK_GROUP_LOGO) element.src = ARAAK_GROUP_LOGO;
  element.alt = "مجموعة أراك للتنمية";
  element.classList.add("araak-official-logo");
}

function localizeElement(element) {
  if (!(element instanceof Element) || SKIP_TAGS.has(element.tagName)) return;

  applyOfficialBranding(element);

  for (const attr of TRANSLATABLE_ATTRIBUTES) {
    if (!element.hasAttribute(attr)) continue;
    const current = element.getAttribute(attr);
    const translated = translate(current);
    if (translated !== current) element.setAttribute(attr, translated);
  }

  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) localizeTextNode(child);
  }
}

function localizeTree(root) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    localizeTextNode(root);
    return;
  }
  if (!(root instanceof Element) && root !== document.body) return;

  if (root instanceof Element) localizeElement(root);
  root.querySelectorAll?.("*").forEach(localizeElement);
}

export default function ArabicLocalization() {
  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.body.dir = "rtl";
    document.body.classList.add("arabic-only-version");

    localizeTree(document.body);

    let scheduled = false;
    const pendingRoots = new Set();

    const flush = () => {
      scheduled = false;
      pendingRoots.forEach(localizeTree);
      pendingRoots.clear();
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          pendingRoots.add(mutation.target);
        } else if (mutation.type === "attributes") {
          pendingRoots.add(mutation.target);
        } else {
          mutation.addedNodes.forEach((node) => pendingRoots.add(node));
        }
      }
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(flush);
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES,
    });

    return () => {
      observer.disconnect();
      document.body.classList.remove("arabic-only-version");
    };
  }, []);

  return null;
}
