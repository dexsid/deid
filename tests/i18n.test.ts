import { describe, expect, it } from "vitest";
import { dictionaries, isLocale, isSection, localizedPath, locales } from "../lib/i18n";

describe("interface locales and routes", () => {
  it("accepts only supported locale codes and sections", () => {
    for (const locale of locales) expect(isLocale(locale)).toBe(true);
    for (const invalid of ["kz", "RU", "fr", "", "../ru"]) expect(isLocale(invalid)).toBe(false);
    expect(isSection("publications")).toBe(true);
    expect(isSection("admin")).toBe(false);
    expect(isSection("../about")).toBe(false);
  });

  it("keeps the material path when switching languages", () => {
    expect(localizedPath("/ru/publications/my-article", "kk")).toBe("/kk/publications/my-article");
    expect(localizedPath("/en/goals", "ru")).toBe("/ru/goals");
    expect(localizedPath("/kk", "en")).toBe("/en");
  });

  it("rejects unknown prefixes and absolute URLs", () => {
    for (const path of ["/fr/about", "//example.com", "https://example.com", "/", "ru/goals"]) {
      expect(localizedPath(path, "ru")).toBe("/ru");
    }
  });

  it("provides a non-empty translation for every interface key", () => {
    for (const locale of locales) {
      expect(Object.keys(dictionaries[locale]).sort()).toEqual(Object.keys(dictionaries.ru).sort());
      for (const value of Object.values(dictionaries[locale])) expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});
