"use server";

export interface WaitlistResult {
  error?: string;
  success?: boolean;
}

export async function joinWaitlist(email: string): Promise<WaitlistResult> {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "유효한 이메일 주소를 입력해 주세요." };
  }

  const resendKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || "jinzhangxun@gmail.com";

  if (!resendKey) {
    // Log to console as fallback during development
    console.log(`[Waitlist] New signup: ${email}`);
    return { success: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "NotiFlow <noreply@notiflow.life>",
        to: adminEmail,
        subject: `[NotiFlow 베타] 대기명단 등록: ${email}`,
        html: `
          <h2>베타 대기명단에 새 신청이 들어왔습니다</h2>
          <p><strong>이메일:</strong> ${email}</p>
          <p><strong>시각:</strong> ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>
          <hr/>
          <p style="color:#888;font-size:12px">NotiFlow 베타 대기명단</p>
        `,
      }),
    });

    if (!res.ok) {
      console.error("[Waitlist] Resend error:", await res.text());
      return { error: "등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
    }
  } catch {
    console.error("[Waitlist] Network error");
    return { error: "등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }

  return { success: true };
}
