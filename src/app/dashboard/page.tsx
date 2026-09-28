import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { QrCode, Sparkles } from "lucide-react";

import AppHeader from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import TopAds from "@/components/conversions/top-ads";
import ConversionComparison from "@/components/dashboard/conversion-comparison";
import CrmActions from "@/components/dashboard/crm-actions";
import CustomersSection from "@/components/dashboard/customers-section";
import { formatDateRange, formatUsd } from "@/components/dashboard/format";
import KpiCards from "@/components/dashboard/kpi-cards";
import PlatformSection from "@/components/dashboard/platform-section";
import { listConversions } from "@/lib/conversions/store";
import { getDashboardData, recommendedActions } from "@/lib/dashboard-data";
import { demoCampaign } from "@/lib/demo-campaign";

export const metadata: Metadata = { title: "Dashboard · One Marketing Command Center" };

export default async function Dashboard() {
  await connection();
  const data = getDashboardData(await listConversions());
  const actions = recommendedActions(data);

  const sections = [
    ...data.platforms.map((p) => ({ id: p.id, label: p.name })),
    { id: "ads", label: "Ads" },
    { id: "customers", label: "Customers" },
    { id: "actions", label: "Next steps" },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/dashboard" />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Campaign dashboard</h1>
              <p className="mt-1 text-muted-foreground">
                {demoCampaign.business.businessName} · {formatDateRange(data.period.start, data.period.end)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                Sample data
              </span>
              <Link href="/conversions" className={buttonVariants({ variant: "outline", size: "lg" })}>
                <QrCode data-icon="inline-start" />
                Conversion feed
              </Link>
            </div>
          </div>

          {/* The campaign set up in setup, at a glance. */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary/10 to-fuchsia-500/10 px-3 py-1 font-medium text-primary">
              <Sparkles className="size-3.5" />
              {demoCampaign.splitMode === "auto" ? "Auto mode" : "Custom split"}
            </span>
            <span className="rounded-full border bg-card px-3 py-1">
              {formatUsd(demoCampaign.monthlyBudget)}/month
            </span>
            {demoCampaign.platforms.map((p) => (
              <span key={p.value} className="rounded-full border bg-card px-3 py-1">
                {p.label} {p.share}%
              </span>
            ))}
            <span className="rounded-full border bg-card px-3 py-1">
              {demoCampaign.placements.length} placements · {demoCampaign.ads.length} ads
            </span>
            <span className="rounded-full border bg-card px-3 py-1">Conversions from QR codes</span>
          </div>

          <nav aria-label="Dashboard sections" className="flex flex-wrap gap-1.5 text-sm">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-full border bg-card px-3 py-1 text-muted-foreground hover:text-foreground"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>

        <KpiCards data={data} />

        {data.platforms.map((p) => (
          <PlatformSection key={p.id} platform={p} />
        ))}

        <div id="ads" className="grid scroll-mt-20 gap-6 lg:grid-cols-2">
          <TopAds conversions={data.matched} impressions={data.adImpressions} />
          <ConversionComparison placements={data.placements} />
        </div>

        <div id="customers" className="scroll-mt-20">
          <CustomersSection data={data} />
        </div>

        <div id="actions" className="scroll-mt-20">
          <CrmActions actions={actions} />
        </div>
      </main>
    </div>
  );
}
