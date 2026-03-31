package com.hart.notimgmt.service.notification

import android.util.Log
import com.hart.notimgmt.data.db.entity.FilterRuleEntity
import com.hart.notimgmt.data.model.ConditionType

class MessageFilterEngine {

    companion object {
        private const val TAG = "MessageFilterEngine"
    }

    /**
     * 필터 규칙에 매칭되는 모든 규칙을 찾습니다.
     *
     * 필터링 로직:
     * - 대상 앱 필터: 규칙에 대상 앱이 설정되어 있고 현재 패키지가 대상에 없으면 스킵
     * - 발신자 키워드 (OR): 활성화된 키워드 중 하나라도 발신자에 포함되면 매칭
     *   - 발신자 키워드가 비어있으면 모든 발신자 허용
     * - 포함 키워드 (OR): 활성화된 키워드 중 하나라도 내용에 포함되면 매칭
     *   - 포함 키워드가 비어있으면 매칭 안됨 (반드시 키워드 필요)
     * - conditionType에 따라:
     *   - AND: 설정된 조건을 모두 만족해야 매칭
     *     (한쪽 키워드만 설정 시 해당 조건만 확인)
     *   - OR: 발신자 OR 포함 키워드 중 하나라도 만족하면 매칭
     * - 키워드가 모두 비어있는 경우:
     *   - 대상 앱이 지정되어 있으면 해당 앱의 모든 메시지 매칭 (앱 필터 전용 규칙)
     *   - 대상 앱도 없으면 매칭 안됨 (무한 캡처 방지)
     * - 비활성화된 키워드는 조건에서 제외
     * - 여러 카테고리에 매칭되면 모두 반환
     */
    fun findAllMatchingRules(
        rules: List<FilterRuleEntity>,
        sender: String,
        content: String,
        phoneNumber: String? = null,
        packageName: String? = null
    ): List<FilterRuleEntity> {
        Log.d(TAG, "=== 필터링 시작 ===")
        Log.d(TAG, "발신자: $sender")
        Log.d(TAG, "패키지: $packageName")
        Log.d(TAG, "활성 규칙 수: ${rules.size}")

        val matchedRules = mutableListOf<FilterRuleEntity>()

        for (rule in rules) {
            // 대상 앱 필터: 규칙에 대상 앱이 설정되어 있고 현재 패키지가 대상에 없으면 스킵
            if (rule.targetAppPackages.isNotEmpty() && packageName != null) {
                if (packageName !in rule.targetAppPackages) {
                    Log.d(TAG, "규칙 ID: ${rule.id} - 대상 앱 불일치 (${packageName}), 스킵")
                    continue
                }
            }
            val senderMatch = matchesSender(rule, sender)
            val contentMatch = matchesIncludeWords(rule, content)

            Log.d(TAG, "규칙 ID: ${rule.id}")
            Log.d(TAG, "  조건 타입: ${rule.conditionType}")
            Log.d(TAG, "  발신자 키워드: ${rule.senderKeywords.filter { it.isEnabled }.map { it.keyword }}")
            Log.d(TAG, "  포함 키워드: ${rule.includeWords.filter { it.isEnabled }.map { it.keyword }}")
            Log.d(TAG, "  발신자 매칭: $senderMatch, 내용 매칭: $contentMatch")

            val hasSenderKeywords = rule.senderKeywords.any { it.isEnabled }
            val hasIncludeKeywords = rule.includeWords.any { it.isEnabled }

            val matched = when {
                // 키워드 없음: 대상 앱이 지정된 경우에만 매칭 (앱 필터 전용 규칙)
                !hasSenderKeywords && !hasIncludeKeywords -> rule.targetAppPackages.isNotEmpty()
                // 발신자 키워드만 설정: 발신자 매칭만 확인
                hasSenderKeywords && !hasIncludeKeywords -> senderMatch
                // 포함 키워드만 설정: 내용 매칭만 확인
                !hasSenderKeywords && hasIncludeKeywords -> contentMatch
                // 둘 다 설정: conditionType에 따라 AND/OR
                else -> when (rule.conditionType) {
                    ConditionType.AND -> senderMatch && contentMatch
                    ConditionType.OR -> senderMatch || contentMatch
                }
            }

            if (matched) {
                Log.d(TAG, ">>> 매칭된 규칙: ${rule.id} (카테고리: ${rule.categoryId})")
                matchedRules.add(rule)
            }
        }

        if (matchedRules.isEmpty()) {
            Log.d(TAG, ">>> 매칭된 규칙 없음 - 메시지 저장 안함")
        } else {
            Log.d(TAG, ">>> 총 ${matchedRules.size}개 규칙 매칭")
        }

        return matchedRules
    }

    // 하위 호환성을 위한 기존 메서드 유지
    fun findMatchingRule(
        rules: List<FilterRuleEntity>,
        sender: String,
        content: String,
        phoneNumber: String? = null
    ): FilterRuleEntity? {
        return findAllMatchingRules(rules, sender, content, phoneNumber).firstOrNull()
    }

    private fun matchesSender(rule: FilterRuleEntity, sender: String): Boolean {
        val enabledKeywords = rule.senderKeywords.filter { it.isEnabled }
        // 발신자 키워드가 비어있으면 모든 발신자 허용
        if (enabledKeywords.isEmpty()) return true
        return enabledKeywords.any { item ->
            sender.contains(item.keyword, ignoreCase = true)
        }
    }

    private fun matchesIncludeWords(rule: FilterRuleEntity, content: String): Boolean {
        val enabledKeywords = rule.includeWords.filter { it.isEnabled }
        // 포함 키워드가 비어있으면 매칭 안됨 (반드시 키워드 지정 필요)
        if (enabledKeywords.isEmpty()) return false
        return enabledKeywords.any { item ->
            content.contains(item.keyword, ignoreCase = true)
        }
    }
}
