import { Layout } from "@/components/Layout";
import { ShieldCheck } from "lucide-react";

export default function Privacy() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm">Last updated: May 2026</p>
        </div>

        <div className="glass-card rounded-2xl p-8 space-y-6 text-sm text-foreground leading-relaxed" data-testid="privacy-content">
          <section>
            <h2 className="text-base font-semibold mb-2">Information We Collect</h2>
            <p className="text-muted-foreground">NovaSave collects minimal information necessary to operate the service:</p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>URLs submitted for download processing</li>
              <li>IP addresses for rate limiting and spam prevention</li>
              <li>Basic usage statistics (download counts, platform usage)</li>
            </ul>
          </section>
          <section>
            <h2 className="text-base font-semibold mb-2">Information We Do Not Collect</h2>
            <p className="text-muted-foreground">We do not collect or store:</p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Personal identification information (name, email, etc.)</li>
              <li>Downloaded media files (they go directly to your device)</li>
              <li>Account credentials or passwords</li>
              <li>Browser history or tracking cookies</li>
            </ul>
          </section>
          <section>
            <h2 className="text-base font-semibold mb-2">How We Use Information</h2>
            <p className="text-muted-foreground">Collected information is used solely to: process your download requests, prevent abuse and spam, monitor system health and performance, and improve the service.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold mb-2">Data Retention</h2>
            <p className="text-muted-foreground">Download job records are retained for a limited period for operational purposes. IP rate limit data is cleared automatically after each time window. We do not sell or share data with third parties.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold mb-2">Third-Party Services</h2>
            <p className="text-muted-foreground">NovaSave fetches content from third-party APIs (TikTok, YouTube, Pinterest platforms). Your submitted URLs are processed by these services in accordance with their own privacy policies.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold mb-2">Local Storage</h2>
            <p className="text-muted-foreground">NovaSave stores your preferences (theme, layout, quality mode) locally in your browser using localStorage. This data never leaves your device.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold mb-2">Your Rights</h2>
            <p className="text-muted-foreground">You may clear all locally stored preferences at any time through your browser settings. Since we collect minimal personal data, there is little additional data to request deletion of.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold mb-2">Changes to This Policy</h2>
            <p className="text-muted-foreground">We may update this Privacy Policy from time to time. Any changes will be reflected with an updated date at the top of this page.</p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
