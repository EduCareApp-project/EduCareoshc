import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Users, UserCircle, Briefcase, GraduationCap, ArrowRight } from "lucide-react";

export default function Solutions() {
  const roles = [
    {
      id: "directors",
      title: "Service Directors & Coordinators",
      icon: <Briefcase className="h-10 w-10 text-primary" />,
      pain: "Juggling regulatory requirements, staff compliance, and day-to-day operations while trying to maintain quality.",
      solution: "A centralized dashboard providing a bird's-eye view of service compliance. Automated alerts for expiring staff qualifications (WWCC, First Aid, CPR). Streamlined incident reporting and tracking. Live, collaborative QIP management that turns compliance from a yearly panic into a daily habit."
    },
    {
      id: "ed-leaders",
      title: "Educational Leaders",
      icon: <GraduationCap className="h-10 w-10 text-primary" />,
      pain: "Struggling to mentor staff, ensure MTOP alignment, and review programming quality across multiple educators.",
      solution: "Tools to review and provide feedback on educator programming in real-time. Clear visibility into how programs map to MTOP outcomes. Centralized staff professional development tracking. Easy generation of learning reports to demonstrate educational quality during assessment and rating."
    },
    {
      id: "educators",
      title: "Educators",
      icon: <Users className="h-10 w-10 text-primary" />,
      pain: "Spending hours after shifts completing required documentation instead of focusing on the children.",
      solution: "Fast, intuitive interfaces for daily jottings, learning stories, and weekly programs. Pre-loaded MTOP outcomes for quick tagging. Easy access to child profiles, health conditions, and support plans. Mobile-friendly design that works on tablets during active supervision."
    },
    {
      id: "providers",
      title: "Approved Providers",
      icon: <UserCircle className="h-10 w-10 text-primary" />,
      pain: "Lacking oversight of service performance and risking non-compliance across one or multiple sites.",
      solution: "High-level reporting on NQS compliance metrics. Secure storage for all service policies, procedures, and critical documentation. Assurance that the service is operating within regulatory boundaries with clear audit trails for all actions."
    }
  ];

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <section className="pt-20 pb-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-6"
          >
            Built for everyone in your service.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-muted-foreground"
          >
            Compliance isn't just the Director's job. EduCare provides tailored tools for every role, ensuring quality is embedded in everything you do.
          </motion.p>
        </div>
      </section>

      {/* Main Image */}
      <section className="py-12">
        <div className="container mx-auto px-4 max-w-5xl">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="aspect-[21/9] rounded-2xl overflow-hidden shadow-xl"
          >
            <img 
              src="/solutions-staff.png" 
              alt="OSHC Staff Meeting" 
              className="w-full h-full object-cover"
            />
          </motion.div>
        </div>
      </section>

      {/* Role Breakdown */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="space-y-24">
            {roles.map((role, i) => (
              <motion.div 
                key={role.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className={`flex flex-col md:flex-row gap-8 md:gap-16 ${i % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}
              >
                <div className="md:w-1/3 flex flex-col items-start justify-center">
                  <div className="bg-primary/10 p-4 rounded-2xl mb-6">
                    {role.icon}
                  </div>
                  <h2 className="text-3xl font-bold mb-4">{role.title}</h2>
                </div>
                
                <div className="md:w-2/3 bg-background border border-border rounded-2xl p-8 shadow-sm">
                  <div className="mb-6 pb-6 border-b border-border">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">The Challenge</h3>
                    <p className="text-foreground text-lg">{role.pain}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-2">The EduCare Solution</h3>
                    <p className="text-muted-foreground text-lg leading-relaxed">{role.solution}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 bg-primary text-primary-foreground text-center">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Empower your team today.</h2>
          <p className="text-xl text-primary-foreground/80 mb-10">
            Give your educators the tools they need to focus on what matters most — the children.
          </p>
          <Link href="/contact">
            <Button size="lg" variant="secondary" className="h-14 px-10 text-lg">
              Get Early Access <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
