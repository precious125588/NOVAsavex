import { Layout } from "@/components/Layout";
import { FileText } from "lucide-react";

export default function Terms() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <p className="text-muted-foreground text-sm">Last updated: May 2026</p>
        </div>

        <div className="glass-card rounded-2xl p-8 prose prose-sm dark:prose-invert max-w-none space-y-6 text-sm text-foreground leading-relaxed" data-testid="terms-content">
          <section>
            <h2 className="text-base font-semibold mb-2">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">By using NovaSave, you agree to these Terms of Service. If you do not agree, please do not use our service.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold mb-2">2. Use of Service</h2>
            <p className="text-muted-foreground">NovaSave is provided for personal, non-commercial use only. You agree not to use the service to download, distribute, or reproduce content in violation of applicable laws or the terms of service of the originating platforms (TikTok, YouTube, Pinterest, etc.).</p>
          </section>
          <section>
            <h2 className="text-base font-semibold mb-2">3. Intellectual Property</h2>
            <p className="text-muted-foreground">All content downloaded through NovaSave belongs to its respective creators and platforms. NovaSave does not claim ownership over any third-party content. Users are responsible for respecting copyright and intellectual property rights.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold mb-2">4. Prohibited Activities</h2>
            <p className="text-muted-foreground">You may not use NovaSave to: download content for commercial redistribution; circumvent platform security measures; engage in automated or bulk downloading; or download content that violates third-party rights.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold mb-2">5. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground">NovaSave is provided "as is" without warranties of any kind. We do not guarantee uninterrupted service, and we are not responsible for the availability or content of third-party platforms.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold mb-2">6. Limitation of Liability</h2>
            <p className="text-muted-foreground">NovaSave and its operators shall not be liable for any damages arising from the use or inability to use this service, including damages resulting from downloaded content or service interruptions.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold mb-2">7. Changes to Terms</h2>
            <p className="text-muted-foreground">We reserve the right to modify these terms at any time. Continued use of NovaSave after changes constitutes acceptance of the revised terms.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold mb-2">8. Contact</h2>
            <p className="text-muted-foreground">For questions about these terms, please reach out through the contact information provided on this site.</p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
