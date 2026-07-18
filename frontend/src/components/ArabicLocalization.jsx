import { useEffect } from "react";
import { translateArabicText } from "../i18n/ar";
import { translateExtraArabicText } from "../i18n/ar-extra";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label", "data-empty-label"];

function translate(value) {
  return translateExtraArabicText(translateArabicText(value));
}

function localizeTextNode(node) {
  if (!node?.parentElement || SKIP_TAGS.has(node.parentElement.tagName)) return;
  const current = node.nodeValue;
  const translated = translate(current);
  if (translated !== current) node.nodeValue = translated;
}

function localizeElement(element) {
  if (!(element instanceof Element) || SKIP_TAGS.has(element.tagName)) return;

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
