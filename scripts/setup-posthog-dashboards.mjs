const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;
const projectId = process.env.POSTHOG_PROJECT_ID;
const configuredHost =
  process.env.POSTHOG_API_HOST ??
  process.env.NEXT_PUBLIC_POSTHOG_HOST ??
  "https://us.posthog.com";
const apiHost = configuredHost
  .replace("://us.i.", "://us.")
  .replace("://eu.i.", "://eu.")
  .replace(/\/+$/, "");

if (!personalApiKey || !projectId) {
  console.error(
    "POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID are required to provision dashboards.",
  );
  process.exitCode = 1;
} else {
  await provision();
}

async function api(path, init = {}) {
  const response = await fetch(
    `${apiHost}/api/projects/${projectId}/${path.replace(/^\/+/, "")}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${personalApiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `PostHog API ${response.status}: ${body.detail ?? body.error ?? "request failed"}`,
    );
  }
  return body;
}

function event(name, customName, extras = {}) {
  return {
    kind: "EventsNode",
    event: name,
    custom_name: customName,
    ...extras,
  };
}

function insightViz(source) {
  return {
    kind: "InsightVizNode",
    source,
  };
}

function funnel(events, viz = "steps") {
  return insightViz({
    kind: "FunnelsQuery",
    series: events.map(([name, label, step]) =>
      event(name, label, {
        ...(step
          ? {
              properties: [
                {
                  key: "step",
                  value: [step],
                  operator: "exact",
                  type: "event",
                },
              ],
            }
          : {}),
      }),
    ),
    dateRange: { date_from: "-30d" },
    funnelsFilter: {
      funnelVizType: viz,
      funnelWindowInterval: 14,
      funnelWindowIntervalUnit: "day",
      layout: "vertical",
    },
  });
}

function trends(series, options = {}) {
  return insightViz({
    kind: "TrendsQuery",
    series,
    interval: options.interval ?? "day",
    dateRange: { date_from: options.dateFrom ?? "-30d" },
    ...(options.breakdown
      ? {
          breakdownFilter: {
            breakdown: options.breakdown,
            breakdown_type: options.breakdownType ?? "event",
            breakdown_limit: options.breakdownLimit ?? 12,
          },
        }
      : {}),
    trendsFilter: {
      display: options.display ?? "ActionsLineGraph",
      showLegend: true,
    },
  });
}

function retention() {
  return insightViz({
    kind: "RetentionQuery",
    dateRange: { date_from: "-90d" },
    retentionFilter: {
      period: "Day",
      totalIntervals: 30,
      retentionType: "retention_first_time",
      targetEntity: {
        id: "registration_completed",
        type: "events",
        kind: "EventsNode",
        name: "Registration completed",
      },
      returningEntity: {
        id: "$pageview",
        type: "events",
        kind: "EventsNode",
        name: "Returned to Kondo",
      },
    },
  });
}

const dashboards = [
  {
    name: "Kondo · Activation & retention",
    description:
      "Registration and onboarding conversion, time to activate, and D1/D7/D30 retention.",
    insights: [
      {
        name: "Kondo · Register → Onboarding → Home",
        description: "Primary activation funnel and abandonment by step.",
        query: funnel([
          ["landing_viewed", "Landing viewed"],
          ["join_clicked", "Join clicked"],
          ["registration_started", "Registration started"],
          ["registration_completed", "Registration completed"],
          ["onboarding_started", "Onboarding started"],
          ["onboarding_completed", "Onboarding completed"],
          ["home_arrived_after_onboarding", "Arrived home"],
        ]),
      },
      {
        name: "Kondo · Onboarding step conversion",
        description: "Conversion through the four onboarding steps.",
        query: funnel([
          ["onboarding_started", "Onboarding started"],
          ["onboarding_step_completed", "Country completed", "country"],
          [
            "onboarding_step_completed",
            "Study location completed",
            "study_location",
          ],
          ["onboarding_step_completed", "Studies completed", "studies"],
          ["onboarding_step_completed", "Interests completed", "interests"],
          ["onboarding_completed", "Onboarding completed"],
          ["home_arrived_after_onboarding", "Arrived home"],
        ]),
      },
      {
        name: "Kondo · Average onboarding step time",
        description:
          "Average seconds to complete each onboarding step, excluding abandoned steps.",
        query: trends(
          [
            event("onboarding_step_completed", "Average seconds", {
              math: "avg",
              math_property: "duration_seconds",
              math_property_type: "event",
            }),
          ],
          {
            breakdown: "step",
            display: "ActionsBarValue",
          },
        ),
      },
      {
        name: "Kondo · Activation time",
        description: "Time from registration start to first Home arrival.",
        query: funnel(
          [
            ["registration_started", "Registration started"],
            ["registration_completed", "Registration completed"],
            ["onboarding_completed", "Onboarding completed"],
            ["home_arrived_after_onboarding", "Arrived home"],
          ],
          "time_to_convert",
        ),
      },
      {
        name: "Kondo · D1 D7 D30 retention",
        description:
          "New registered members returning to any Kondo page over 30 days.",
        query: retention(),
      },
    ],
  },
  {
    name: "Kondo · Product usage & reliability",
    description:
      "Active users, top features, time spent, geography, uploads, and actionable errors.",
    insights: [
      {
        name: "Kondo · DAU WAU MAU",
        description:
          "Unique active members by daily, weekly and monthly window.",
        query: trends([
          event("$pageview", "DAU", { math: "dau" }),
          event("$pageview", "WAU", { math: "weekly_active" }),
          event("$pageview", "MAU", { math: "monthly_active" }),
        ]),
      },
      {
        name: "Kondo · Top feature openings",
        description: "Feature adoption based on intentional opening events.",
        query: trends(
          [
            event("community_opened", "Communities"),
            event("marketplace_opened", "Marketplace"),
            event("student_hub_opened", "Student Hub"),
            event("meet_opened", "Meet"),
            event("explore_city_opened", "Explore"),
          ],
          { display: "ActionsBarValue" },
        ),
      },
      {
        name: "Kondo · Average time by feature",
        description: "Average engaged route duration, broken down by area.",
        query: trends(
          [
            event("feature_time_spent", "Average seconds", {
              math: "avg",
              math_property: "duration_seconds",
              math_property_type: "event",
            }),
          ],
          { breakdown: "area", display: "ActionsBarValue" },
        ),
      },
      {
        name: "Kondo · Errors and slow experiences",
        description:
          "Only failed or slow requests, JavaScript errors, uploads, and slow pages.",
        query: trends([
          event("api_request_failed", "API failed"),
          event("api_request_slow", "API slow"),
          event("javascript_error", "JavaScript error"),
          event("upload_failed", "Upload failed"),
          event("page_performance_slow", "Slow page"),
        ]),
      },
      {
        name: "Kondo · Active users by city",
        description: "Page activity broken down by the identified city trait.",
        query: trends([event("$pageview", "Active users", { math: "dau" })], {
          breakdown: "city",
          breakdownType: "person",
          display: "ActionsBarValue",
        }),
      },
      {
        name: "Kondo · Active users by university",
        description:
          "Page activity broken down by the identified university trait.",
        query: trends([event("$pageview", "Active users", { math: "dau" })], {
          breakdown: "university",
          breakdownType: "person",
          display: "ActionsBarValue",
        }),
      },
      {
        name: "Kondo · Timetable import health",
        description:
          "Import and AI generation starts, successes, and failures.",
        query: trends([
          event("student_hub_file_import_started", "Import started"),
          event("student_hub_file_import_succeeded", "Import succeeded"),
          event("student_hub_file_import_failed", "Import failed"),
          event("student_hub_generation_succeeded", "Generation succeeded"),
          event("student_hub_generation_failed", "Generation failed"),
        ]),
      },
    ],
  },
  {
    name: "Kondo · MVP feedback",
    description:
      "Kondo Pet visibility, click-through, feedback conversion, completion time, and cancellation.",
    insights: [
      {
        name: "Kondo · Pet display → feedback submitted",
        description:
          "Primary Kondo Pet funnel for click-through and successful feedback submission.",
        query: funnel([
          ["pet_displayed", "Pet displayed"],
          ["pet_clicked", "Pet clicked"],
          ["feedback_modal_opened", "Feedback opened"],
          ["feedback_submitted", "Feedback submitted"],
        ]),
      },
      {
        name: "Kondo · Pet engagement by area",
        description:
          "Displays, clicks, submissions, and cancellations broken down by product area.",
        query: trends(
          [
            event("pet_displayed", "Displayed"),
            event("pet_clicked", "Clicked"),
            event("feedback_submitted", "Submitted"),
            event("feedback_cancelled", "Cancelled"),
          ],
          { breakdown: "area", display: "ActionsBarValue" },
        ),
      },
      {
        name: "Kondo · Average feedback completion time",
        description:
          "Average time from opening the feedback modal to a successful submission.",
        query: trends(
          [
            event("feedback_submitted", "Average milliseconds", {
              math: "avg",
              math_property: "duration_ms",
              math_property_type: "event",
            }),
          ],
          { breakdown: "category", display: "ActionsBarValue" },
        ),
      },
    ],
  },
];

async function getAll(path) {
  const first = await api(`${path}?limit=100`);
  return first.results ?? first;
}

async function provision() {
  const [existingDashboards, existingInsights] = await Promise.all([
    getAll("dashboards/"),
    getAll("insights/"),
  ]);
  const dashboardsByName = new Map(
    existingDashboards.map((dashboard) => [dashboard.name, dashboard]),
  );
  const insightsByName = new Map(
    existingInsights.map((insight) => [insight.name, insight]),
  );

  for (const definition of dashboards) {
    let dashboard = dashboardsByName.get(definition.name);
    if (!dashboard) {
      dashboard = await api("dashboards/", {
        method: "POST",
        body: JSON.stringify({
          name: definition.name,
          description: definition.description,
          pinned: true,
          tags: ["kondo", "product-analytics"],
        }),
      });
      console.log(`Created dashboard: ${definition.name}`);
    } else {
      console.log(`Dashboard already exists: ${definition.name}`);
    }

    for (const insightDefinition of definition.insights) {
      if (insightsByName.has(insightDefinition.name)) {
        console.log(`Insight already exists: ${insightDefinition.name}`);
        continue;
      }
      const insight = await api("insights/", {
        method: "POST",
        body: JSON.stringify({
          ...insightDefinition,
          dashboards: [dashboard.id],
          tags: ["kondo"],
        }),
      });
      insightsByName.set(insight.name, insight);
      console.log(`Created insight: ${insightDefinition.name}`);
    }
  }
}
