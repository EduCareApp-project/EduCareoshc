import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, User } from "lucide-react";

type Educator = {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  bio: string | null;
  profilePicturePath: string | null;
  siteId: number | null;
};

type EducatorsResponse = {
  siteStaff: Educator[];
  educationalLeaders: Educator[];
  approvedProviders: Educator[];
};

const ROLE_LABELS: Record<string, string> = {
  educator: "Educator",
  coordinator: "Coordinator",
  educational_leader: "Educational Leader",
  admin: "Approved Provider",
};

function profileImageUrl(path: string) {
  const stripped = path.replace(/^\/objects\//, "");
  return `/api/storage/objects/${stripped}`;
}

function EducatorCard({ member }: { member: Educator }) {
  const roleLabel = ROLE_LABELS[member.role] ?? member.role;
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 flex gap-4">
        <div className="shrink-0">
          {member.profilePicturePath ? (
            <img
              src={profileImageUrl(member.profilePicturePath)}
              alt={`${member.firstName} ${member.lastName}`}
              className="h-20 w-20 rounded-full object-cover border-2 border-border"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
                (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.removeProperty("display");
              }}
            />
          ) : null}
          <div
            className={`h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border ${member.profilePicturePath ? "hidden" : ""}`}
          >
            <User className="h-8 w-8 text-primary/50" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base leading-tight">
            {member.firstName} {member.lastName}
          </p>
          <p className="text-xs text-primary font-medium mt-0.5 mb-2">{roleLabel}</p>
          {member.bio ? (
            <p className="text-sm text-muted-foreground leading-relaxed">{member.bio}</p>
          ) : (
            <p className="text-sm text-muted-foreground/50 italic">No bio provided.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  subtitle,
  members,
  emptyMessage,
}: {
  title: string;
  subtitle?: string;
  members: Educator[];
  emptyMessage: string;
}) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {members.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-25" />
            <p className="text-sm">{emptyMessage}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <EducatorCard key={m.id} member={m} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function GuardianEducators() {
  const { data, isLoading } = useQuery<EducatorsResponse>({
    queryKey: ["/api/auth/my-educators"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-educators");
      if (!res.ok) throw new Error("Failed to load educators");
      return res.json();
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Our Educators</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Meet the team at your child's service.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-8">
          {[...Array(3)].map((_, si) => (
            <div key={si}>
              <Skeleton className="h-6 w-40 mb-4" />
              <div className="grid gap-3 sm:grid-cols-2">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <Section
            title="Educators"
            subtitle="The educators and coordinators working with your child."
            members={data?.siteStaff ?? []}
            emptyMessage="No educators listed for your child's site yet."
          />

          {(data?.educationalLeaders?.length ?? 0) > 0 && (
            <Section
              title="Educational Leader"
              members={data?.educationalLeaders ?? []}
              emptyMessage="No educational leaders listed."
            />
          )}

          {(data?.approvedProviders?.length ?? 0) > 0 && (
            <Section
              title="Approved Provider"
              members={data?.approvedProviders ?? []}
              emptyMessage="No approved providers listed."
            />
          )}
        </>
      )}
    </div>
  );
}
