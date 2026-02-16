package com.hart.notimgmt.service.notification

import android.app.PendingIntent
import android.util.LruCache

/**
 * 알림 딥링크 캐시 — 이중 LruCache 구조
 *
 * 1차 캐시: messageId → PendingIntent (정확한 메시지 매칭)
 * 2차 캐시: "source|sender" → PendingIntent (같은 발신자 대화방 재활용)
 *
 * 메시징 앱은 같은 발신자의 알림 contentIntent가 모두 동일한 대화방을 여는 특성을 활용.
 * 예: 카카오톡 "홍길동"의 모든 알림 → 홍길동 채팅방으로 이동하는 같은 PendingIntent.
 */
object DeepLinkCache {

    private val messageCache = LruCache<String, PendingIntent>(300)
    private val senderCache = LruCache<String, PendingIntent>(150)

    /** 메시지 캡처 시 호출 — messageId + source|sender 양쪽 캐시에 저장 */
    fun store(messageId: String, source: String, sender: String, pendingIntent: PendingIntent?) {
        if (pendingIntent == null) return
        messageCache.put(messageId, pendingIntent)
        senderCache.put(senderKey(source, sender), pendingIntent)
    }

    /** 알림 수신 시 source|sender 단위로 저장 (필터 매칭 전에도 호출) */
    fun storeBySender(source: String, sender: String, pendingIntent: PendingIntent?) {
        if (pendingIntent == null) return
        senderCache.put(senderKey(source, sender), pendingIntent)
    }

    /** messageId로 정확 조회 */
    fun get(messageId: String): PendingIntent? = messageCache.get(messageId)

    /** source + sender로 조회 (같은 발신자의 최신 PendingIntent) */
    fun getBySender(source: String, sender: String): PendingIntent? =
        senderCache.get(senderKey(source, sender))

    private fun senderKey(source: String, sender: String): String = "$source|$sender"
}
