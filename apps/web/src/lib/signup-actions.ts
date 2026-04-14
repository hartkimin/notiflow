"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface SignupData {
  email: string;
  password: string;
  name: string;
  companyName: string;
  inviteCode: string;
}

export interface SignupResult {
  error?: string;
  emailSent?: boolean;
}

async function sendAdminNotification(companyName: string, email: string) {
  const resendKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || "jinzhangxun@gmail.com";
  if (!resendKey) return; // soft-fail if not configured

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "NotiFlow <noreply@notiflow.life>",
        to: adminEmail,
        subject: `[NotiFlow] 새 조직 가입: ${companyName}`,
        html: `
          <h2>새 조직이 가입했습니다</h2>
          <p><strong>회사명:</strong> ${companyName}</p>
          <p><strong>이메일:</strong> ${email}</p>
          <p><strong>시각:</strong> ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>
          <hr/>
          <p style="color:#888;font-size:12px">
            <a href="https://supabase.com/dashboard/project/npmxlmjatwqugactcqzd/editor">Supabase에서 확인하기</a>
          </p>
        `,
      }),
    });
  } catch {
    // notification failure must not block signup
  }
}

/**
 * Create a new organization + owner user.
 * Requires a valid invite code. Uses supabase.auth.signUp() so Supabase
 * sends a confirmation email. Org + profile are created immediately;
 * the user cannot log in until confirmed.
 */
export async function signupWithOrg(data: SignupData): Promise<SignupResult> {
  const admin = createAdminClient();
  const supabase = await createClient();

  // 1. Validate invite code (service_role bypasses RLS on invite_codes)
  const code = data.inviteCode.trim().toUpperCase();
  const { data: invite, error: inviteErr } = await admin
    .from("invite_codes")
    .select("id, is_active, used_at")
    .eq("code", code)
    .maybeSingle();

  if (inviteErr || !invite) {
    return { error: "유효하지 않은 초대 코드입니다." };
  }
  if (!invite.is_active) {
    return { error: "만료된 초대 코드입니다." };
  }
  if (invite.used_at) {
    return { error: "이미 사용된 초대 코드입니다." };
  }

  // 2. Sign up via regular client → triggers confirmation email
  const { data: authData, error: signUpErr } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: { name: data.name },
    },
  });

  if (signUpErr) return { error: `계정 생성 실패: ${signUpErr.message}` };

  const user = authData.user;
  if (!user) return { error: "계정 생성에 실패했습니다. 다시 시도해 주세요." };

  // 3. Create the organization (admin client bypasses RLS)
  const slug = data.companyName
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || `org-${Date.now()}`;

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({
      name: data.companyName,
      slug: `${slug}-${Date.now().toString(36)}`,
      plan: "free",
      is_demo: false,
      is_active: true,
    })
    .select("id")
    .single();

  if (orgErr) {
    await admin.auth.admin.deleteUser(user.id);
    return { error: `조직 생성 실패: ${orgErr.message}` };
  }

  // 4. Create the user profile (owner of the new org)
  const { error: profileErr } = await admin.from("user_profiles").upsert({
    id: user.id,
    name: data.name,
    role: "viewer",
    org_role: "owner",
    organization_id: org.id,
    is_active: true,
  }, { onConflict: "id" });

  if (profileErr) {
    await admin.auth.admin.deleteUser(user.id);
    await admin.from("organizations").delete().eq("id", org.id);
    return { error: `프로필 생성 실패: ${profileErr.message}` };
  }

  // 5. Mark invite code as used
  await admin
    .from("invite_codes")
    .update({ used_at: new Date().toISOString(), used_by_org_id: org.id })
    .eq("id", invite.id);

  // 6. Notify admin (soft-fail)
  await sendAdminNotification(data.companyName, data.email);

  return { emailSent: true };
}
