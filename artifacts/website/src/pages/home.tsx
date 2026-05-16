import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, ShieldCheck, FileText, Activity } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 md:pt-32 md:pb-48 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary mb-6">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
              Built for Australian OSHC Centres
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight mb-6">
              Master OSHC Compliance Without the Chaos.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              The all-in-one platform for Approved Providers, Nominated Supervisors, and Educational Leaders to manage NQS alignment, MTOP programming, and daily regulatory burden.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/contact">
                <Button size="lg" className="text-base h-12 px-8">
                  Get Early Access
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/solutions">
                <Button size="lg" variant="outline" className="text-base h-12 px-8">
                  Explore Solutions
                </Button>
              </Link>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-border/50">
              <img 
                src="/hero-image.png" 
                alt="OSHC children engaged in activities" 
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Floating stats card */}
            <div className="absolute -bottom-6 -left-6 bg-background rounded-xl p-4 shadow-xl border border-border/50 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
              <div className="bg-primary/10 p-3 rounded-full text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">NQS Ready</p>
                <p className="font-bold text-foreground">Quality Areas 1-7</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Running an Approved Service shouldn't mean drowning in paperwork.</h2>
          <p className="text-lg text-muted-foreground mb-12">
            Between tracking educator qualifications, managing the Quality Improvement Plan (QIP), documenting MTOP outcomes, and handling incident reports, service leaders are stretched thin. EduCare brings it all into one secure, centralized portal.
          </p>
        </div>
        
        <div className="container mx-auto px-4 grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Scattered Documentation",
              desc: "Stop hunting through binders and disconnected spreadsheets for compliance evidence when assessors arrive.",
              icon: <FileText className="h-8 w-8" />
            },
            {
              title: "QIP Stagnation",
              desc: "Keep your Quality Improvement Plan alive and actionable, rather than a document updated once a year.",
              icon: <Activity className="h-8 w-8" />
            },
            {
              title: "Programming Disconnect",
              desc: "Ensure every educational program and observation ties directly back to My Time, Our Place outcomes.",
              icon: <CheckCircle2 className="h-8 w-8" />
            }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-background p-8 rounded-2xl border border-border shadow-sm"
            >
              <div className="text-primary mb-6">{item.icon}</div>
              <h3 className="text-xl font-bold mb-3">{item.title}</h3>
              <p className="text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Feature 1: Compliance */}
      <section className="py-24 overflow-hidden">
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-2 md:order-1"
          >
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-xl border border-border">
              <img 
                src="/feature-compliance.png" 
                alt="Compliance Dashboard" 
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-1 md:order-2"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Total visibility over NQS Quality Areas 1–7.</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Maintain a real-time pulse on your service's compliance. EduCare maps your documentation, policies, and educator actions directly to the National Quality Standard.
            </p>
            <ul className="space-y-4 mb-8">
              {[
                "Live QIP tracking and collaborative editing",
                "Automated staff qualification expiry alerts",
                "Incident, injury, trauma and illness reporting",
                "Evacuation and lockdown drill logs"
              ].map((item, i) => (
                <li key={i} className="flex items-start">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mr-3" />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* Feature 2: MTOP Programming */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">MTOP programming that educators actually want to use.</h2>
            <p className="text-lg text-primary-foreground/80 mb-8">
              Remove the friction from educational documentation. We've built tools that respect an educator's time while capturing meaningful insights into children's learning and development.
            </p>
            <ul className="space-y-4 mb-8">
              {[
                "Framework-aligned weekly programs and evaluations",
                "Quick jottings and detailed learning stories",
                "Direct links to MTOP outcomes and principles",
                "Confidential child welfare notes and profiles"
              ].map((item, i) => (
                <li key={i} className="flex items-start">
                  <CheckCircle2 className="h-6 w-6 text-primary-foreground/50 shrink-0 mr-3" />
                  <span className="text-primary-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-primary-foreground/20">
              <img 
                src="/feature-documentation.png" 
                alt="Educator using tablet" 
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-6">Ready to regain control of your service?</h2>
            <p className="text-xl text-muted-foreground mb-10">
              Join the forward-thinking Approved Providers and Directors streamlining their operations with EduCare.
            </p>
            <Link href="/contact">
              <Button size="lg" className="h-14 px-10 text-lg">
                Request Early Access
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
