import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: number;
      type: "staff" | "guardian" | "school";
      role: string;
      email: string;
      name: string;
        siteId?: number | null;
    };
    superAdmin?: {
      email: string;
    };
  }
}
