-- ============================================================
-- day_categories 테이블 생성 (요일별 카테고리 선택)
-- NotiFlow v3.4.0 — DB v18, Backup Format v7
-- ============================================================

-- 1. 테이블 생성
CREATE TABLE day_categories (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date BIGINT NOT NULL,
    category_id TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE(date, category_id, user_id)
);

-- 2. 인덱스
CREATE INDEX idx_day_categories_user_id ON day_categories(user_id);
CREATE INDEX idx_day_categories_date ON day_categories(date);

-- 3. Row Level Security 활성화
ALTER TABLE day_categories ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책: 본인 데이터만 조회/생성/수정/삭제
CREATE POLICY "Users can select own day_categories"
    ON day_categories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own day_categories"
    ON day_categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own day_categories"
    ON day_categories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own day_categories"
    ON day_categories FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Realtime 구독 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE day_categories;
