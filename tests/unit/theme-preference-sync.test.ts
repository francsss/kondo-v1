// @vitest-environment jsdom

import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type ReactNode } from "react";
import {
  ThemePreferenceProvider,
  ThemePreferenceSync,
  useThemePreference,
} from "@/components/app/AppShell";
import { useTheme } from "next-themes";

vi.mock("next-themes", () => ({
  useTheme: vi.fn(),
}));

const mockedUseTheme = vi.mocked(useTheme);

function renderWithProvider(
  children: ReactNode,
  preference: "LIGHT" | "DARK" | "SYSTEM" = "LIGHT",
) {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      createElement(
        ThemePreferenceProvider,
        { initialPreference: preference, children: null },
        createElement(ThemePreferenceSync, { preference }),
        children,
      ),
    );
  });

  return { container, root };
}

describe("ThemePreferenceSync", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("does not overwrite the active theme when a local theme change is pending", async () => {
    const setTheme = vi.fn();

    mockedUseTheme.mockImplementation(() => ({
      theme: "light",
      resolvedTheme: "light",
      setTheme,
      themes: [],
    }) as unknown as ReturnType<typeof useTheme>);

    let resolveFetch: ((value: Response) => void) | undefined;
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    ) as typeof fetch;

    function PreferenceConsumer() {
      const { applyPreference } = useThemePreference();
      return createElement(
        "button",
        {
          id: "theme-action",
          onClick: () => {
            void applyPreference("DARK");
          },
        },
        "change theme",
      );
    }

    const { container, root } = renderWithProvider(
      createElement(PreferenceConsumer),
      "LIGHT",
    );

    expect(setTheme).toHaveBeenCalledWith("light");

    const button = container.querySelector("#theme-action") as HTMLButtonElement;

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(setTheme).not.toHaveBeenLastCalledWith("light");

    act(() => {
      root.render(
        createElement(
          ThemePreferenceProvider,
          { initialPreference: "LIGHT" as const, children: null },
          createElement(ThemePreferenceSync, { preference: "LIGHT" as const }),
          createElement(PreferenceConsumer),
        ),
      );
    });

    expect(setTheme).not.toHaveBeenLastCalledWith("light");

    await act(async () => {
      resolveFetch?.(
        new Response(JSON.stringify({ preferences: { theme: "DARK" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await Promise.resolve();
    });

    expect(setTheme).toHaveBeenCalledWith("dark");
    root.unmount();
  });
});
