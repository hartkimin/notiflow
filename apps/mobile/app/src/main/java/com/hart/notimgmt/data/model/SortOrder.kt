package com.hart.notimgmt.data.model

enum class SortOrder(val label: String) {
    NEWEST("최신순"),
    OLDEST("오래된순"),
    BY_SENDER("발신자순"),
    BY_APP("앱별")
}
