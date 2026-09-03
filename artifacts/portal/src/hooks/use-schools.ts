import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type SchoolItem = {
  id: number;
  siteId: number;
  siteName: string;
  username: string;
  blockedAt: string | null;
  lastLoginAt: string | null;
  passwordSet: boolean;
};

export type Site = {
  id: number;
  name: string;
  address: string;
  grouping: string;
  status: string;
  isDoscel: boolean;
  createdAt: string;
};

export type Staff = {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  qualifications: string | null;
  status: string;
  associatedSites?: { id: number; name: string }[];
};

export type SchoolStaffProfile = Staff & {
  email: string;
  phone: string | null;
  bio: string | null;
  profilePicturePath: string | null;
};

export type StaffQualification = {
  id: number;
  name: string;
  status: string;
  referenceNumber: string | null;
  expiryDate: string | null;
  documentPath: string | null;
};

export type SchoolStaffProfileResponse = {
  staff: SchoolStaffProfile;
  qualifications: StaffQualification[];
};

export type SchoolReportRow = {
  id: number;
  termId: number;
  weekNumber: number;
  weekBeginning: string;
  serviceType: "BSC" | "ASC" | "VAC";
  monday: string | null;
  tuesday: string | null;
  wednesday: string | null;
  thursday: string | null;
  friday: string | null;
  mondayPupilFree: boolean;
  tuesdayPupilFree: boolean;
  wednesdayPupilFree: boolean;
  thursdayPupilFree: boolean;
  fridayPupilFree: boolean;
};

export type SchoolReportTerm = {
  id: number | null;
  siteId: number;
  termNumber: number;
  status: "pending" | "open";
  termStartDate: string | null;
  termEndDate: string | null;
  holidayStartDate: string | null;
  holidayEndDate: string | null;
  weekCount: number;
  generatedAt: string | null;
  rows: SchoolReportRow[];
};

export type SchoolReportsResponse = {
  siteId: number;
  terms: SchoolReportTerm[];
};

export type VitalRecord = {
  id: number;
  siteId: number;
  recordType: string;
  recordName: string;
  provider?: string | null;
  referenceNumber?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  documentPath?: string | null;
  documentName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VecraVisit = {
  id: number;
  siteId: number;
  visitDate: string;
  visitorName: string;
  visitorOrganisation?: string | null;
  findings?: string | null;
  actions?: string | null;
  followUpDate?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SchoolPortalData = {
  site: Site;
  account: { username: string; blockedAt: string | null; lastLoginAt: string | null } | null;
  staff: Staff[];
  vitalRecords: VitalRecord[];
  vecraVisits: VecraVisit[];
};

export function useGetSchools() {
  return useQuery<SchoolItem[]>({
    queryKey: ["schools"],
    queryFn: async () => {
      const res = await fetch("/api/schools");
      if (!res.ok) throw new Error("Failed to fetch schools");
      return res.json();
    },
  });
}

export function useGetSchoolPortal(siteId?: number | null) {
  return useQuery<SchoolPortalData>({
    queryKey: ["schools", siteId, "portal"],
    queryFn: async () => {
      const res = await fetch(`/api/schools/${siteId}/portal`);
      if (!res.ok) throw new Error("Failed to fetch school portal");
      return res.json();
    },
    enabled: !!siteId,
  });
}

export function useGetSchoolStaff(siteId?: number | null, staffId?: number | null) {
  return useQuery<SchoolStaffProfileResponse>({
    queryKey: ["schools", siteId, "staff", staffId],
    queryFn: async () => {
      const res = await fetch(`/api/schools/${siteId}/staff/${staffId}`);
      if (!res.ok) throw new Error("Failed to fetch staff profile");
      return res.json();
    },
    enabled: !!siteId && !!staffId,
  });
}

export function useGetSchoolReports(siteId?: number | null) {
  return useQuery<SchoolReportsResponse>({
    queryKey: ["school-reports", siteId],
    queryFn: async () => {
      const res = await fetch(`/api/school-reports?siteId=${siteId}`);
      if (!res.ok) throw new Error("Failed to fetch school reports");
      return res.json();
    },
    enabled: !!siteId,
  });
}

export function useSaveSchoolReportTerm(siteId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      termNumber,
      termStartDate,
      termEndDate,
      holidayStartDate,
      holidayEndDate,
    }: {
      termNumber: number;
      termStartDate: string;
      termEndDate: string;
      holidayStartDate: string | null;
      holidayEndDate: string | null;
    }) => {
      const res = await fetch(`/api/school-reports/${siteId}/terms/${termNumber}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termStartDate, termEndDate, holidayStartDate, holidayEndDate }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error ?? "Failed to save report dates");
      return result as SchoolReportTerm;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school-reports", siteId] }),
  });
}

export function useGenerateSchoolReport(siteId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (termNumber: number) => {
      const res = await fetch(`/api/school-reports/${siteId}/terms/${termNumber}/generate`, {
        method: "POST",
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error ?? "Failed to generate school report");
      return result as SchoolReportTerm;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school-reports", siteId] }),
  });
}

export function useSaveSchoolReportAttendance(siteId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      termNumber,
      rows,
    }: {
      termNumber: number;
      rows: Array<{
        id: number;
        monday: string | null;
        tuesday: string | null;
        wednesday: string | null;
        thursday: string | null;
        friday: string | null;
        mondayPupilFree: boolean;
        tuesdayPupilFree: boolean;
        wednesdayPupilFree: boolean;
        thursdayPupilFree: boolean;
        fridayPupilFree: boolean;
      }>;
    }) => {
      const res = await fetch(`/api/school-reports/${siteId}/terms/${termNumber}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error ?? "Failed to save attendance");
      return result as SchoolReportTerm;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school-reports", siteId] }),
  });
}

export function useCreateVitalRecord(siteId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<VitalRecord, "id" | "siteId" | "createdAt" | "updatedAt">) => {
      const res = await fetch(`/api/schools/${siteId}/vital-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error ?? "Failed to create vital record");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools", siteId, "portal"] });
    },
  });
}

export function useDeleteVitalRecord(siteId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/schools/${siteId}/vital-records/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete vital record");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools", siteId, "portal"] });
    },
  });
}

export function useCreateVecraVisit(siteId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<VecraVisit, "id" | "siteId" | "createdAt" | "updatedAt">) => {
      const res = await fetch(`/api/schools/${siteId}/vecra-visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create VECRA visit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools", siteId, "portal"] });
    },
  });
}

export function useDeleteVecraVisit(siteId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/schools/${siteId}/vecra-visits/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete VECRA visit");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools", siteId, "portal"] });
    },
  });
}
