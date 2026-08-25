import { getAuth } from "@/lib/auth/server";

type AuthContext = {
  params: Promise<{ path: string[] }>;
};

export function GET(request: Request, context: AuthContext) {
  return getAuth().handler().GET(request, context);
}

export function POST(request: Request, context: AuthContext) {
  return getAuth().handler().POST(request, context);
}
