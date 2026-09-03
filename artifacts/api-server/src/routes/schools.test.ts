import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import pinoHttp from "pino-http";
import pino from "pino";
import { Writable } from "node:stream";

const { mockDb, queuePortalQueries, whereCalls } = vi.hoisted(() => {
  let portalQueries: unknown[][] = [];
  const whereCalls: unknown[] = [];

  function makeQuery(result: unknown[]) {
    const query = {
      from: vi.fn(),
      innerJoin: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(),
      orderBy: vi.fn(),
      then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
        return Promise.resolve(result).then(resolve, reject);
      },
      catch(onRejected: (error: unknown) => unknown) {
        return Promise.resolve(result).catch(onRejected);
      },
    };
    query.from.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    query.where.mockImplementation((predicate: unknown) => {
      whereCalls.push(predicate);
      return query;
    });
    query.limit.mockReturnValue(query);
    query.orderBy.mockReturnValue(query);
    return query;
  }

  const mockDb = {
    select: vi.fn(() => makeQuery(portalQueries.shift() ?? [])),
    delete: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };

  function queuePortalQueries(results: unknown[][]) {
    portalQueries = [...results];
  }

  return { mockDb, queuePortalQueries, whereCalls };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  organisationTable: { featureSettings: "organisation.feature_settings" },
  schoolAccountsTable: {
    siteId: "school_accounts.site_id",
    username: "school_accounts.username",
    blockedAt: "school_accounts.blocked_at",
    lastLoginAt: "school_accounts.last_login_at",
  },
  schoolVitalRecordsTable: { siteId: "school_vital_records.site_id" },
  sitesTable: { id: "sites.id", name: "sites.name" },
  staffSitesTable: { staffId: "staff_sites.staff_id", siteId: "staff_sites.site_id" },
  staffTable: {
    id: "staff.id",
    firstName: "staff.first_name",
    lastName: "staff.last_name",
    email: "staff.email",
    phone: "staff.phone",
    role: "staff.role",
    qualifications: "staff.qualifications",
    bio: "staff.bio",
    profilePicturePath: "staff.profile_picture_path",
    status: "staff.status",
    siteId: "staff.site_id",
    isSuperAdmin: "staff.is_super_admin",
  },
  staffQualificationsTable: {
    id: "staff_qualifications.id",
    staffId: "staff_qualifications.staff_id",
    name: "staff_qualifications.name",
    status: "staff_qualifications.status",
    referenceNumber: "staff_qualifications.reference_number",
    expiryDate: "staff_qualifications.expiry_date",
    documentPath: "staff_qualifications.document_path",
    archivedAt: "staff_qualifications.archived_at",
    createdAt: "staff_qualifications.created_at",
  },
  vecraVisitsTable: { siteId: "vecra_visits.site_id" },
}));

vi.mock("drizzle-orm", () => ({
  and: (...predicates: unknown[]) => `and(${predicates.join(",")})`,
  asc: (column: unknown) => `asc(${String(column)})`,
  eq: (column: unknown, value: unknown) => `eq(${String(column)},${String(value)})`,
  inArray: (column: unknown, values: unknown[]) => `inArray(${String(column)},${values.join(",")})`,
  isNull: (column: unknown) => `isNull(${String(column)})`,
  ne: (column: unknown, value: unknown) => `ne(${String(column)},${String(value)})`,
  or: (...predicates: unknown[]) => `or(${predicates.join(",")})`,
}));

vi.mock("../lib/schoolAccounts", () => ({
  ensureSchoolAccount: vi.fn(),
}));

import schoolsRouter from "./schools";

const TARGET_SITE = { id: 1, name: "Target School" };
const OTHER_SITE = { id: 2, name: "Other School" };
const THIRD_SITE = { id: 3, name: "Third School" };

function staffMember(
  id: number,
  firstName: string,
  siteId: number,
  status: "active" | "inactive" = "active",
  role = "educator",
) {
  return {
    id,
    firstName,
    lastName: "Educator",
    role,
    qualifications: "Certificate III",
    status,
    siteId,
    isSuperAdmin: false,
  };
}

function queueTargetPortalData() {
  const homeStaff = staffMember(101, "Home", TARGET_SITE.id);
  const associatedStaff = staffMember(102, "Associated", OTHER_SITE.id);
  const unrelatedStaff = staffMember(103, "Unrelated", THIRD_SITE.id);
  const inactiveStaff = staffMember(104, "Inactive", OTHER_SITE.id, "inactive");
  const homeCoordinator = staffMember(105, "Coordinator", TARGET_SITE.id, "active", "coordinator");
  const educationalLeader = staffMember(106, "Leader", OTHER_SITE.id, "active", "educational_leader");
  const admin = staffMember(107, "Admin", TARGET_SITE.id, "active", "admin");
  const adminSupport = staffMember(108, "Support", TARGET_SITE.id, "active", "admin_support");

  queuePortalQueries([
    [TARGET_SITE],
    [
      { staffId: homeStaff.id },
      { staffId: associatedStaff.id },
      { staffId: inactiveStaff.id },
      { staffId: educationalLeader.id },
    ],
    [adminSupport, admin, associatedStaff, educationalLeader, homeStaff, homeCoordinator],
    [],
    [],
    [{ username: "target-school", blockedAt: null, lastLoginAt: null }],
    [{
      featureSettings: {
        schoolPortalVisibleTabs: ["staff", "reports"],
        schoolPortalVisibleQualificationNames: ["First Aid"],
      },
    }],
    [
      // A stale Home Site association must not be returned as an Associated Site.
      { staffId: homeStaff.id, id: TARGET_SITE.id, name: TARGET_SITE.name },
      { staffId: homeStaff.id, id: OTHER_SITE.id, name: OTHER_SITE.name },
      { staffId: associatedStaff.id, id: TARGET_SITE.id, name: TARGET_SITE.name },
      { staffId: educationalLeader.id, id: TARGET_SITE.id, name: TARGET_SITE.name },
    ],
  ]);

  return {
    homeStaff,
    associatedStaff,
    unrelatedStaff,
    inactiveStaff,
    homeCoordinator,
    educationalLeader,
    admin,
    adminSupport,
  };
}

function buildTestApp(user: {
  id: number;
  type: "school";
  role: "school";
  siteId: number;
  email: string;
  name: string;
}) {
  const app = express();
  app.use(express.json());
  app.use(
    pinoHttp({
      logger: pino({ level: "silent" }, new Writable({ write(_chunk, _encoding, callback) { callback(); } })),
    }),
  );
  app.use((req, _res, next) => {
    (req as any).session = { user };
    next();
  });
  app.use("/api", schoolsRouter);
  return app;
}

describe("GET /api/schools/:siteId/portal staff scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    whereCalls.length = 0;
  });

  it("includes active Home Site and Associated Site staff, while excluding unrelated and inactive staff", async () => {
    const {
      homeStaff,
      associatedStaff,
      unrelatedStaff,
      inactiveStaff,
      homeCoordinator,
      educationalLeader,
      admin,
      adminSupport,
    } = queueTargetPortalData();

    const response = await request(
      buildTestApp({
        id: 900,
        type: "school",
        role: "school",
        siteId: TARGET_SITE.id,
        email: "target-school",
        name: TARGET_SITE.name,
      }),
    ).get(`/api/schools/${TARGET_SITE.id}/portal`);

    expect(response.status).toBe(200);
    expect(response.body.staff.map((member: { id: number }) => member.id)).toEqual([
      homeCoordinator.id,
      homeStaff.id,
      associatedStaff.id,
      educationalLeader.id,
      admin.id,
    ]);
    expect(response.body.staff.map((member: { id: number }) => member.id)).not.toContain(unrelatedStaff.id);
    expect(response.body.staff.map((member: { id: number }) => member.id)).not.toContain(inactiveStaff.id);
    expect(response.body.staff.map((member: { id: number }) => member.id)).not.toContain(adminSupport.id);

    const homeResult = response.body.staff.find((member: { id: number }) => member.id === homeStaff.id);
    const associatedResult = response.body.staff.find((member: { id: number }) => member.id === associatedStaff.id);
    expect(homeResult.associatedSites).toEqual([{ id: OTHER_SITE.id, name: OTHER_SITE.name }]);
    expect(associatedResult.associatedSites).toEqual([{ id: TARGET_SITE.id, name: TARGET_SITE.name }]);
    expect(response.body.portalSettings).toEqual({
      visibleTabs: ["staff", "reports"],
      visibleQualificationNames: ["First Aid"],
    });
    expect(whereCalls.map(String)).toContain(
      "and(or(eq(staff.site_id,1),inArray(staff.id,101,102,104,106)),eq(staff.status,active),eq(staff.is_super_admin,false),ne(staff.role,admin_support))",
    );
  });

  it("forbids a school session from loading another site's portal", async () => {
    const response = await request(
      buildTestApp({
        id: 900,
        type: "school",
        role: "school",
        siteId: TARGET_SITE.id,
        email: "target-school",
        name: TARGET_SITE.name,
      }),
    ).get(`/api/schools/${OTHER_SITE.id}/portal`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "This school is outside your access" });
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});

describe("GET /api/schools/:siteId/staff/:staffId profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    whereCalls.length = 0;
  });

  it("returns contact details and active qualifications for staff assigned to the site", async () => {
    const member = {
      ...staffMember(101, "Home", TARGET_SITE.id),
      email: "home@example.com",
      phone: "0400 123 456",
      bio: "An experienced educator.",
      profilePicturePath: "/objects/profile/home.jpg",
    };
    const qualification = {
      id: 501,
      name: "Diploma of Early Childhood Education",
      status: "current",
      referenceNumber: "DIP-501",
      expiryDate: null,
    };
    queuePortalQueries([
      [member],
      [{ featureSettings: {
        schoolPortalVisibleTabs: ["staff"],
        schoolPortalVisibleQualificationNames: [qualification.name],
      } }],
      [qualification],
    ]);

    const response = await request(
      buildTestApp({
        id: 900,
        type: "school",
        role: "school",
        siteId: TARGET_SITE.id,
        email: "target-school",
        name: TARGET_SITE.name,
      }),
    ).get(`/api/schools/${TARGET_SITE.id}/staff/${member.id}`);

    expect(response.status).toBe(200);
    expect(response.body.staff).toMatchObject({
      id: member.id,
      email: member.email,
      phone: member.phone,
      bio: member.bio,
      profilePicturePath: null,
      hasProfilePicture: true,
    });
    expect(response.body.qualifications).toEqual([{
      ...qualification,
      hasDocument: false,
    }]);
    expect(whereCalls.map(String)).toContain(
      `and(eq(staff_qualifications.staff_id,101),isNull(staff_qualifications.archived_at),inArray(staff_qualifications.name,${qualification.name}))`,
    );
  });

  it("returns no qualification records when the school qualification list is empty", async () => {
    const member = {
      ...staffMember(101, "Home", TARGET_SITE.id),
      email: "home@example.com",
      phone: null,
      bio: null,
      profilePicturePath: null,
    };
    queuePortalQueries([
      [member],
      [{ featureSettings: {
        schoolPortalVisibleTabs: ["staff"],
        schoolPortalVisibleQualificationNames: [],
      } }],
    ]);

    const response = await request(
      buildTestApp({
        id: 900,
        type: "school",
        role: "school",
        siteId: TARGET_SITE.id,
        email: "target-school",
        name: TARGET_SITE.name,
      }),
    ).get(`/api/schools/${TARGET_SITE.id}/staff/${member.id}`);

    expect(response.status).toBe(200);
    expect(response.body.qualifications).toEqual([]);
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });

  it("does not expose a staff member who is not assigned or associated with the site", async () => {
    const member = staffMember(102, "Other", OTHER_SITE.id);
    queuePortalQueries([[member], []]);

    const response = await request(
      buildTestApp({
        id: 900,
        type: "school",
        role: "school",
        siteId: TARGET_SITE.id,
        email: "target-school",
        name: TARGET_SITE.name,
      }),
    ).get(`/api/schools/${TARGET_SITE.id}/staff/${member.id}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Staff member not found for this site" });
  });
});