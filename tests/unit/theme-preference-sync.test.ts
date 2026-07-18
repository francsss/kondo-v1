// @vitest-environment jsdom

import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { ThemePreferenceSync } from "@/components/app/AppShell";
import { useTheme } from "next-themes";

vi.mock("next-themes", () => ({
  useTheme: vi.fn(),
}));

const mockedUseTheme = vi.mocked(useTheme);

describe("ThemePreferenceSync", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("does not overwrite the active theme when the local theme changes", () => {
    const setTheme = vi.fn();
    let currentTheme = "dark";

    mockedUseTheme.mockImplementation(() => ({
      theme: currentTheme,
      resolvedTheme: currentTheme,
      setTheme,
    }) as ReturnType<typeof useTheme>);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(createElement(ThemePreferenceSync, { preference: "LIGHT" }));
    });

    expect(setTheme).toHaveBeenCalledWith("light");
    expect(setTheme).toHaveBeenCalledTimes(1);

    currentTheme = "light";

    act(() => {
      root.render(createElement(ThemePreferenceSync, { preference: "LIGHT" }));
    });

    expect(setTheme).toHaveBeenCalledTimes(1);
  });
});
