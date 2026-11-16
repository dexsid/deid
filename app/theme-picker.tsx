"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Locale } from "../lib/i18n";

type Theme = "system" | "light" | "dark";
let memory: Theme = "system";
function snapshot(): Theme {
  try {
    const value = localStorage.getItem("deid-theme");
    return value === "system" || value === "light" || value === "dark" ? value : memory;
  } catch { return memory; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("deid-theme-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("deid-theme-change", callback);
  };
}
const labels = {
  ru: ["ĞÑ„Ğ¾Ñ€Ğ¼Ğ»ĞµĞ½Ğ¸Ğµ", "ĞšĞ°Ğº Ğ² ÑĞ¸ÑÑ‚ĞµĞ¼Ğµ", "Ğ¡Ğ²ĞµÑ‚Ğ»Ğ¾Ğµ", "Ğ¢Ñ‘Ğ¼Ğ½Ğ¾Ğµ"],
  en: ["Appearance", "System", "Light", "Dark"],
  kk: ["ĞšÓ©Ñ€Ñ–Ğ½Ñ–Ñ", "Ğ–Ò¯Ğ¹ĞµĞ´ĞµĞ³Ñ–Ğ´ĞµĞ¹", "ĞÑˆÑ‹Ò›", "ÒšĞ°Ñ€Ğ°Ò£Ò“Ñ‹"],
};

export default function ThemePicker({ locale }: { locale: Locale }) {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "system" as Theme);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const text = labels[locale];
  return <label className="themePicker">{text[0]}
    <select value={theme} onChange={event => {
      memory = event.target.value as Theme;
      try { localStorage.setItem("deid-theme", memory); } catch { /-»¶‰Ëkºwµç][YKXÚ[™ÙHŠJNÂˆ_O‚ˆÜ[Ûˆ˜[YOHœŞ\İ[Hİ^ÌW_OÛÜ[ÛÜ[Ûˆ˜[YOH›YÚİ^Ì—_OÛÜ[ÛÜ[Ûˆ˜[YOH™\šÈİ^Ì×_OÛÜ[Û‚ˆÜÙ[Xİ‚ˆÛX™[ÂŸB