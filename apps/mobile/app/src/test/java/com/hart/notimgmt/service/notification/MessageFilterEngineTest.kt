package com.hart.notimgmt.service.notification

import com.hart.notimgmt.data.db.entity.FilterRuleEntity
import com.hart.notimgmt.data.model.ConditionType
import com.hart.notimgmt.data.model.KeywordItem
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class MessageFilterEngineTest {

    private lateinit var engine: MessageFilterEngine

    @Before
    fun setup() {
        engine = MessageFilterEngine()
    }

    // ── Helper ──

    private fun rule(
        id: String = "rule-1",
        categoryId: String = "cat-1",
        senderKeywords: List<KeywordItem> = emptyList(),
        includeWords: List<KeywordItem> = emptyList(),
        conditionType: ConditionType = ConditionType.AND,
        targetAppPackages: List<String> = emptyList()
    ) = FilterRuleEntity(
        id = id,
        categoryId = categoryId,
        senderKeywords = senderKeywords,
        includeWords = includeWords,
        conditionType = conditionType,
        targetAppPackages = targetAppPackages
    )

    private fun kw(keyword: String, enabled: Boolean = true) =
        KeywordItem(keyword = keyword, isEnabled = enabled)

    // ── AND 조건 테스트 ──

    @Test
    fun `AND - sender and content both match`() {
        val rules = listOf(
            rule(
                senderKeywords = listOf(kw("병원")),
                includeWords = listOf(kw("발주")),
                conditionType = ConditionType.AND
            )
        )
        val result = engine.findAllMatchingRules(rules, "서울병원", "발주 요청합니다")
        assertEquals(1, result.size)
    }

    @Test
    fun `AND - sender matches but content does not`() {
        val rules = listOf(
            rule(
                senderKeywords = listOf(kw("병원")),
                includeWords = listOf(kw("발주")),
                conditionType = ConditionType.AND
            )
        )
        val result = engine.findAllMatchingRules(rules, "서울병원", "안녕하세요")
        assertTrue(result.isEmpty())
    }

    @Test
    fun `AND - content matches but sender does not`() {
        val rules = listOf(
            rule(
                senderKeywords = listOf(kw("병원")),
                includeWords = listOf(kw("발주")),
                conditionType = ConditionType.AND
            )
        )
        val result = engine.findAllMatchingRules(rules, "친구", "발주 요청합니다")
        assertTrue(result.isEmpty())
    }

    // ── OR 조건 테스트 ──

    @Test
    fun `OR - only sender matches`() {
        val rules = listOf(
            rule(
                senderKeywords = listOf(kw("병원")),
                includeWords = listOf(kw("발주")),
                conditionType = ConditionType.OR
            )
        )
        val result = engine.findAllMatchingRules(rules, "서울병원", "안녕하세요")
        assertEquals(1, result.size)
    }

    @Test
    fun `OR - only content matches`() {
        val rules = listOf(
            rule(
                senderKeywords = listOf(kw("병원")),
                includeWords = listOf(kw("발주")),
                conditionType = ConditionType.OR
            )
        )
        val result = engine.findAllMatchingRules(rules, "친구", "발주 요청합니다")
        assertEquals(1, result.size)
    }

    @Test
    fun `OR - neither matches`() {
        val rules = listOf(
            rule(
                senderKeywords = listOf(kw("병원")),
                includeWords = listOf(kw("발주")),
                conditionType = ConditionType.OR
            )
        )
        val result = engine.findAllMatchingRules(rules, "친구", "안녕하세요")
        assertTrue(result.isEmpty())
    }

    // ── 발신자 키워드만 설정 ──

    @Test
    fun `sender keyword only - matches`() {
        val rules = listOf(
            rule(senderKeywords = listOf(kw("병원")))
        )
        val result = engine.findAllMatchingRules(rules, "서울병원 구매팀", "아무 내용")
        assertEquals(1, result.size)
    }

    @Test
    fun `sender keyword only - does not match`() {
        val rules = listOf(
            rule(senderKeywords = listOf(kw("병원")))
        )
        val result = engine.findAllMatchingRules(rules, "친구", "병원 이야기")
        assertTrue(result.isEmpty())
    }

    // ── 포함 키워드만 설정 ──

    @Test
    fun `include keyword only - matches`() {
        val rules = listOf(
            rule(includeWords = listOf(kw("발주")))
        )
        val result = engine.findAllMatchingRules(rules, "누구든", "발주 요청합니다")
        assertEquals(1, result.size)
    }

    @Test
    fun `include keyword only - does not match`() {
        val rules = listOf(
            rule(includeWords = listOf(kw("발주")))
        )
        val result = engine.findAllMatchingRules(rules, "누구든", "안녕하세요")
        assertTrue(result.isEmpty())
    }

    // ── 키워드 없음 ──

    @Test
    fun `no keywords with target app - matches any message from that app`() {
        val rules = listOf(
            rule(targetAppPackages = listOf("com.kakao.talk"))
        )
        val result = engine.findAllMatchingRules(
            rules, "아무나", "아무 내용", packageName = "com.kakao.talk"
        )
        assertEquals(1, result.size)
    }

    @Test
    fun `no keywords and no target app - does not match (prevents infinite capture)`() {
        val rules = listOf(rule())
        val result = engine.findAllMatchingRules(rules, "아무나", "아무 내용")
        assertTrue(result.isEmpty())
    }

    // ── 대상 앱 필터 ──

    @Test
    fun `target app filter - wrong app is skipped`() {
        val rules = listOf(
            rule(
                includeWords = listOf(kw("발주")),
                targetAppPackages = listOf("com.kakao.talk")
            )
        )
        val result = engine.findAllMatchingRules(
            rules, "병원", "발주 요청", packageName = "com.samsung.sms"
        )
        assertTrue(result.isEmpty())
    }

    @Test
    fun `target app filter - correct app passes`() {
        val rules = listOf(
            rule(
                includeWords = listOf(kw("발주")),
                targetAppPackages = listOf("com.kakao.talk")
            )
        )
        val result = engine.findAllMatchingRules(
            rules, "병원", "발주 요청", packageName = "com.kakao.talk"
        )
        assertEquals(1, result.size)
    }

    // ── 비활성 키워드 ──

    @Test
    fun `disabled keyword is ignored`() {
        val rules = listOf(
            rule(
                senderKeywords = listOf(kw("병원", enabled = false)),
                includeWords = listOf(kw("발주"))
            )
        )
        // senderKeywords all disabled → treated as no sender keywords → content only
        val result = engine.findAllMatchingRules(rules, "친구", "발주 요청")
        assertEquals(1, result.size)
    }

    @Test
    fun `all keywords disabled and no target app - no match`() {
        val rules = listOf(
            rule(
                senderKeywords = listOf(kw("병원", enabled = false)),
                includeWords = listOf(kw("발주", enabled = false))
            )
        )
        val result = engine.findAllMatchingRules(rules, "서울병원", "발주 요청")
        assertTrue(result.isEmpty())
    }

    // ── 다중 규칙 매칭 ──

    @Test
    fun `multiple rules - returns all matching`() {
        val rules = listOf(
            rule(id = "r1", categoryId = "cat-1", includeWords = listOf(kw("발주"))),
            rule(id = "r2", categoryId = "cat-2", includeWords = listOf(kw("주문"))),
            rule(id = "r3", categoryId = "cat-3", includeWords = listOf(kw("배송")))
        )
        val result = engine.findAllMatchingRules(rules, "병원", "발주 및 주문 요청")
        assertEquals(2, result.size)
        assertTrue(result.any { it.id == "r1" })
        assertTrue(result.any { it.id == "r2" })
    }

    // ── 대소문자 무시 ──

    @Test
    fun `case insensitive matching`() {
        val rules = listOf(
            rule(includeWords = listOf(kw("ORDER")))
        )
        val result = engine.findAllMatchingRules(rules, "sender", "new order received")
        assertEquals(1, result.size)
    }

    // ── 다중 키워드 OR 매칭 ──

    @Test
    fun `multiple include keywords - any one matches`() {
        val rules = listOf(
            rule(includeWords = listOf(kw("발주"), kw("주문"), kw("배송")))
        )
        val result = engine.findAllMatchingRules(rules, "병원", "배송 완료했습니다")
        assertEquals(1, result.size)
    }

    // ── findMatchingRule 하위호환 ──

    @Test
    fun `findMatchingRule returns first match`() {
        val rules = listOf(
            rule(id = "r1", includeWords = listOf(kw("발주"))),
            rule(id = "r2", includeWords = listOf(kw("발주")))
        )
        val result = engine.findMatchingRule(rules, "병원", "발주 요청")
        assertNotNull(result)
        assertEquals("r1", result!!.id)
    }

    @Test
    fun `findMatchingRule returns null when no match`() {
        val rules = listOf(
            rule(includeWords = listOf(kw("발주")))
        )
        val result = engine.findMatchingRule(rules, "병원", "안녕하세요")
        assertNull(result)
    }
}
