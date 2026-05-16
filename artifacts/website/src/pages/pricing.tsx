import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default function Pricing() {
  const features = [
    "Full NQS alignment tools & QIP management",
    "MTOP-linked educational programming",
    "Unlimited child profiles & medical records",
    "Unlimited educator & staff accounts",
    "Staff qualification tracking & expiry alerts",
    "Incident, injury, trauma & illness reporting",
    "Evacuation & lockdown drill logging",
    "Policy & procedure document library",
    "Welfare & confidential notes",
    "Secure cloud storage hosted in Australia"
  ];

  return (
    <div className="flex flex-col w-full min-h-screen bg-muted/20">
      <section className="pt-20 pb-16">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-6"
          >
            Simple, transparent pricing.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-muted-foreground"
          >
            No complicated tiers. No hidden fees. Everything your service needs for one flat monthly rate.
          </motion.p>
        </div>
      </section>

      <section className="pb-32">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-background border border-border rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row"
          >
            {/* Price Column */}
            <div className="md:w-5/12 bg-primary text-primary-foreground p-10 flex flex-col justify-center items-center text-center">
              <h2 className="text-2xl font-semibold mb-2">Service License</h2>
              <p className="text-primary-foreground/80 mb-8">All features included</p>
              
              <div className="mb-2">
                <span className="text-5xl font-bold">$30</span>
                <span className="text-xl font-medium text-primary-foreground/80"> /mo</span>
              </div>
              <p className="text-sm text-primary-foreground/70 mb-8">+ GST (Billed annually)</p>

              <Link href="/contact" className="w-full">
                <Button variant="secondary" size="lg" className="w-full h-14 text-lg font-semibold">
                  Get Early Access
                </Button>
              </Link>
              <p className="text-xs text-primary-foreground/60 mt-4">
                * Stripe payment integration coming soon.
              </p>
            </div>

            {/* Features Column */}
            <div className="md:w-7/12 p-10 md:p-12">
              <h3 className="text-xl font-bold mb-6">Everything you need to manage your service:</h3>
              <ul className="space-y-4">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <div className="mt-1 bg-primary/10 rounded-full p-1 mr-3 shrink-0">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          <div className="mt-16 text-center max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold mb-4">Have multiple services?</h3>
            <p className="text-muted-foreground mb-6">
              Are you an Approved Provider managing multiple OSHC sites? Contact us for enterprise implementation and multi-site dashboard access.
            </p>
            <Link href="/contact">
              <Button variant="outline">Contact Sales</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
