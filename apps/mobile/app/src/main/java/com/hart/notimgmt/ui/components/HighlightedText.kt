package com.hart.notimgmt.ui.components

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import com.hart.notimgmt.ui.theme.NotiFlowWarning
import com.hart.notimgmt.ui.theme.NotiFlowYellow

@Composable
fun HighlightedText(
    text: String,
    query: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
    color: Color = Color.Unspecified,
    fontWeight: FontWeight? = null,
    highlightColor: Color = if (isSystemInDarkTheme()) {
        NotiFlowWarning.copy(alpha = 0.3f)
    } else {
        NotiFlowYellow.copy(alpha = 0.4f)
    },
    activeHighlightColor: Color = if (isSystemInDarkTheme()) {
        NotiFlowWarning.copy(alpha = 0.6f)
    } else {
        NotiFlowWarning.copy(alpha = 0.7f)
    },
    activeMatchIndex: Int = -1,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Clip
) {
    if (query.isBlank()) {
        Text(
            text = text,
            modifier = modifier,
            style = style,
            color = color,
            fontWeight = fontWeight,
            maxLines = maxLines,
            overflow = overflow
        )
        return
    }

    val lowerText = text.lowercase()
    val lowerQuery = query.lowercase()
    val queryLength = lowerQuery.length

    val annotatedString = buildAnnotatedString {
        append(text)

        var matchCount = 0
        var startIndex = 0
        while (startIndex + queryLength <= lowerText.length) {
            val index = lowerText.indexOf(lowerQuery, startIndex)
            if (index == -1) break

            val background = if (matchCount == activeMatchIndex) {
                activeHighlightColor
            } else {
                highlightColor
            }
            addStyle(
                style = SpanStyle(background = background),
                start = index,
                end = index + queryLength
            )

            matchCount++
            startIndex = index + queryLength
        }
    }

    Text(
        text = annotatedString,
        modifier = modifier,
        style = style,
        color = color,
        fontWeight = fontWeight,
        maxLines = maxLines,
        overflow = overflow
    )
}
