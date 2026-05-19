import { Layout } from "@/components/Layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const FAQS = [
  {
    q: "Which platforms does NovaSave support?",
    a: "NovaSave currently supports TikTok, YouTube, and Pinterest. You can download videos, audio, images, Shorts, Reels, Playlists, and Pins from these platforms.",
  },
  {
    q: "How do I download a TikTok video without watermark?",
    a: "Paste your TikTok URL into the downloader. NovaSave automatically fetches the highest-quality no-watermark version when available. Look for the 'HD Video (No Watermark)' option in the results.",
  },
  {
    q: "Can I download YouTube videos in 1080p?",
    a: "Yes. In Advanced mode, select '1080p' from the quality dropdown before submitting. For audio-only downloads, select 'Audio Only' to get an MP3 file.",
  },
  {
    q: "Is there a file size limit?",
    a: "NovaSave itself doesn't impose a file size limit. However, very large files may take longer to process. The download links are direct from the source platform.",
  },
  {
    q: "How long are download links valid?",
    a: "Download links are generated fresh each time you process a URL. Links from source platforms typically expire after a few hours, so download your files promptly after they appear.",
  },
  {
    q: "Is NovaSave free to use?",
    a: "Yes, NovaSave is completely free. There are no hidden fees, subscriptions, or limitations on the number of downloads.",
  },
  {
    q: "Why did my download fail?",
    a: "Downloads can fail due to: private or restricted content, platform-side changes, or temporary API issues. NovaSave automatically retries up to 3 times using different methods. If a download consistently fails, try again in a few minutes.",
  },
  {
    q: "Can I install NovaSave as a mobile app?",
    a: "Yes. NovaSave is a Progressive Web App (PWA). On mobile, tap your browser's Share or Menu button and select 'Add to Home Screen' to install it like a native app.",
  },
  {
    q: "Does NovaSave store my downloaded files?",
    a: "No. NovaSave does not store any media files on its servers. It only fetches the download links from source platforms. Your downloads go directly from the platform to your device.",
  },
  {
    q: "Is downloading from these platforms legal?",
    a: "Downloading content for personal, non-commercial use is generally permitted by most platforms. Always respect the original creator's rights and platform terms of service. Do not re-upload or distribute downloaded content without permission.",
  },
];

export default function FAQ() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mx-auto">
            <HelpCircle className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Frequently Asked Questions</h1>
          <p className="text-muted-foreground text-sm">Everything you need to know about NovaSave</p>
        </div>

        <Accordion type="single" collapsible className="space-y-3" data-testid="faq-accordion">
          {FAQS.map((item, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="glass-card rounded-xl px-5 border-none"
              data-testid={`faq-item-${i}`}
            >
              <AccordionTrigger className="text-sm font-medium text-left hover:no-underline py-4">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-4 leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Layout>
  );
}
