import { describe, expect, it } from "vitest";
import {
  feedLeadsHome,
  HOME_SECTIONS,
  homeSectionOrder,
  showsLocalPresence,
  type HomeSection,
} from "@/lib/home-layout";
import { JOURNEY_GROUPS } from "@/lib/journey";

/**
 * These pin the promises the ordering makes, not the taste behind it. A future
 * edit may reasonably move a section; it may not drop one, duplicate one, or
 * put the marketplace above the checklist for someone who has not arrived yet.
 */

describe("home section order", () => {
  it("renders every section exactly once for every group", () => {
    for (const group of JOURNEY_GROUPS) {
      const order = homeSectionOrder(group);
      expect(new Set(order).size, group).toBe(order.length);
      expect([...order].sort(), group).toEqual([...HOME_SECTIONS].sort());
    }
  });

  it("leads the pre-arrival group with what they have to do, not what they can buy", () => {
    const order = homeSectionOrder("PREPARING_FOR_CHINA");
    expect(order[0]).toBe("GUIDE_NEXT_STEP");
    expect(order[1]).toBe("NAVIGATOR");
    // The marketplace sells to people who are already here.
    expect(order.indexOf("MARKETPLACE")).toBe(order.length - 1);
    expect(order.indexOf("GUIDE_NEXT_STEP")).toBeLessThan(
      order.indexOf("FEED"),
    );
  });

  it("keeps the in-China order the page already had", () => {
    const order = homeSectionOrder("STUDYING_AND_LIVING_IN_CHINA");
    expect(order[0]).toBe("FEED");
    expect(order.indexOf("LOCAL_RECOMMENDATIONS")).toBeLessThan(
      order.indexOf("OPPORTUNITIES"),
    );
  });

  it("moves opportunities up and the arrival guide down for the career group", () => {
    const order = homeSectionOrder("CAREER_ALUMNI_AND_ENTREPRENEURSHIP");
    expect(order.indexOf("OPPORTUNITIES")).toBeLessThan(
      order.indexOf("GUIDE_NEXT_STEP"),
    );
    expect(order.indexOf("OPPORTUNITIES")).toBeLessThan(
      order.indexOf("MARKETPLACE"),
    );
  });

  it("falls back to the shipped order for an unknown or missing group", () => {
    expect(homeSectionOrder(null)).toEqual(
      homeSectionOrder("STUDYING_AND_LIVING_IN_CHINA"),
    );
    expect(homeSectionOrder(undefined)).toEqual(
      homeSectionOrder("STUDYING_AND_LIVING_IN_CHINA"),
    );
  });

  it("reports which groups lead with the feed", () => {
    expect(feedLeadsHome("PREPARING_FOR_CHINA")).toBe(false);
    expect(feedLeadsHome("STUDYING_AND_LIVING_IN_CHINA")).toBe(true);
    expect(feedLeadsHome("CAREER_ALUMNI_AND_ENTREPRENEURSHIP")).toBe(true);
  });

  it("only claims a local presence for members who have one", () => {
    expect(showsLocalPresence("PREPARING_FOR_CHINA")).toBe(false);
    expect(showsLocalPresence("STUDYING_AND_LIVING_IN_CHINA")).toBe(true);
    expect(showsLocalPresence("CAREER_ALUMNI_AND_ENTREPRENEURSHIP")).toBe(true);
  });

  it("never hides a section from anyone", () => {
    const seen = new Set<HomeSection>();
    for (const group of JOURNEY_GROUPS) {
      for (const section of homeSectionOrder(group)) seen.add(section);
    }
    expect(seen.size).toBe(HOME_SECTIONS.length);
  });
});
