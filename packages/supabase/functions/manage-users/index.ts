import { createClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// CORS headers for browser requests from the Dashboard
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// ---------------------------------------------------------------------------
// Auth: verify JWT + admin role check
// ---------------------------------------------------------------------------

interface AuthResult {
  userId: string;
  error?: never;
}

interface AuthError {
  userId?: never;
  error: Response;
}

async function verifyAdmin(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<AuthResult | AuthError> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: errorResponse("Missing or invalid Authorization header", 401) };
  }

  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: errorResponse("Invalid or expired token", 401) };
  }

  // Check user_profiles role
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: errorResponse("User profile not found", 403) };
  }

  if (!profile.is_active) {
    return { error: errorResponse("Account is deactivated", 403) };
  }

  if (profile.role !== "admin") {
    return { error: errorResponse("Admin access required", 403) };
  }

  return { userId: user.id };
}

// ---------------------------------------------------------------------------
// Last admin protection: prevents removing / demoting the sole admin
// ---------------------------------------------------------------------------

async function isLastAdmin(
  supabase: ReturnType<typeof createClient>,
  targetId: string,
): Promise<{ isLast: boolean; targetRole: string | null }> {
  const { data: target } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", targetId)
    .single();

  if (target?.role !== "admin") {
    return { isLast: false, targetRole: target?.role ?? null };
  }

  const { count } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true);

  return { isLast: (count || 0) <= 1, targetRole: target.role };
}

// ---------------------------------------------------------------------------
// GET  - List all users (merged auth.users + user_profiles)
// ---------------------------------------------------------------------------

async function handleGet(
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const {
    data: { users },
    error: listError,
  } = await supabase.auth.admin.listUsers();

  if (listError) {
    return errorResponse(`Failed to list auth users: ${listError.message}`, 500);
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("user_profiles")
    .select("*");

  if (profilesError) {
    return errorResponse(`Failed to fetch profiles: ${profilesError.message}`, 500);
  }

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p]),
  );

  const merged = (users ?? []).map((authUser) => {
    const profile = profileMap.get(authUser.id);
    return {
      id: authUser.id,
      email: authUser.email,
      name: profile?.name ?? null,
      role: profile?.role ?? "viewer",
      is_active: profile?.is_active ?? true,
      created_at: authUser.created_at,
      updated_at: profile?.updated_at ?? authUser.updated_at,
    };
  });

  return jsonResponse({ users: merged, total: merged.length });
}

// ---------------------------------------------------------------------------
// POST - Create user
// ---------------------------------------------------------------------------

async function handlePost(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const { email, password, name, role = "viewer" } = await req.json();

  if (!email || !password || !name) {
    return errorResponse("email, password, and name are required");
  }

  const validRoles = ["admin", "manager", "viewer"];
  if (!validRoles.includes(role)) {
    return errorResponse(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
  }

  // Create auth user
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    return errorResponse(`Failed to create user: ${createError.message}`);
  }

  // Insert user_profiles row
  const { error: profileInsertError } = await supabase
    .from("user_profiles")
    .insert({
      id: newUser.user.id,
      name,
      role,
      is_active: true,
    });

  if (profileInsertError) {
    // Rollback: delete the auth user we just created
    await supabase.auth.admin.deleteUser(newUser.user.id);
    return errorResponse(`Failed to create profile: ${profileInsertError.message}`, 500);
  }

  return jsonResponse(
    {
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        name,
        role,
        is_active: true,
        created_at: newUser.user.created_at,
        updated_at: newUser.user.updated_at,
      },
    },
    201,
  );
}

// ---------------------------------------------------------------------------
// PATCH - Update user
// ---------------------------------------------------------------------------

async function handlePatch(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const { id, name, role, is_active, password } = await req.json();

  if (!id) {
    return errorResponse("id is required");
  }

  // Last admin protection: check if demoting / deactivating the last admin
  if (role !== undefined || is_active === false) {
    const { data: currentProfile } = await supabase
      .from("user_profiles")
      .select("role, is_active")
      .eq("id", id)
      .single();

    if (currentProfile?.role === "admin") {
      // Demoting away from admin, or deactivating an admin
      const changingRole = role !== undefined && role !== "admin";
      const deactivating = is_active === false;

      if (changingRole || deactivating) {
        const { isLast } = await isLastAdmin(supabase, id);
        if (isLast) {
          return errorResponse("마지막 관리자는 변경할 수 없습니다.", 400);
        }
      }
    }
  }

  // Build profile update payload
  const profileUpdate: Record<string, unknown> = {};
  if (name !== undefined) profileUpdate.name = name;
  if (role !== undefined) {
    const validRoles = ["admin", "manager", "viewer"];
    if (!validRoles.includes(role)) {
      return errorResponse(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
    }
    profileUpdate.role = role;
  }
  if (is_active !== undefined) profileUpdate.is_active = is_active;

  // Update user_profiles if there are profile fields to update
  if (Object.keys(profileUpdate).length > 0) {
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update(profileUpdate)
      .eq("id", id);

    if (updateError) {
      return errorResponse(`Failed to update profile: ${updateError.message}`, 500);
    }
  }

  // Update auth password if provided
  if (password) {
    const { error: pwError } = await supabase.auth.admin.updateUserById(id, {
      password,
    });

    if (pwError) {
      return errorResponse(`Failed to update password: ${pwError.message}`, 500);
    }
  }

  // Return the updated profile
  const { data: updatedProfile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", id)
    .single();

  const {
    data: { users },
  } = await supabase.auth.admin.listUsers();
  const authUser = (users ?? []).find((u) => u.id === id);

  return jsonResponse({
    user: {
      id,
      email: authUser?.email ?? null,
      name: updatedProfile?.name ?? null,
      role: updatedProfile?.role ?? "viewer",
      is_active: updatedProfile?.is_active ?? true,
      created_at: authUser?.created_at ?? null,
      updated_at: updatedProfile?.updated_at ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// DELETE - Deactivate user (soft delete)
// ---------------------------------------------------------------------------

async function handleDelete(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const { id } = await req.json();

  if (!id) {
    return errorResponse("id is required");
  }

  // Last admin protection
  const { isLast, targetRole } = await isLastAdmin(supabase, id);
  if (targetRole === "admin" && isLast) {
    return errorResponse("마지막 관리자는 변경할 수 없습니다.", 400);
  }

  // Soft delete: set is_active = false
  const { error: deactivateError } = await supabase
    .from("user_profiles")
    .update({ is_active: false })
    .eq("id", id);

  if (deactivateError) {
    return errorResponse(`Failed to deactivate user: ${deactivateError.message}`, 500);
  }

  return jsonResponse({ success: true, id });
}

// ---------------------------------------------------------------------------
// Edge Function entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Create Supabase admin client (service role key for admin operations)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Authenticate and check admin role
    const auth = await verifyAdmin(req, supabase);
    if (auth.error) return auth.error;

    // Route by HTTP method
    switch (req.method) {
      case "GET":
        return await handleGet(supabase);
      case "POST":
        return await handlePost(req, supabase);
      case "PATCH":
        return await handlePatch(req, supabase);
      case "DELETE":
        return await handleDelete(req, supabase);
      default:
        return errorResponse(`Method ${req.method} not allowed`, 405);
    }
  } catch (err) {
    console.error("manage-users unexpected error:", err);
    return errorResponse(`Internal server error: ${(err as Error).message}`, 500);
  }
});
