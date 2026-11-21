-- بيانات تجريبية لمنافسة المشاريع المدرسية
-- تحذير: هذا الملف يمسح بيانات المشاريع والأصوات الحالية قبل الزرع.
-- الاستخدام: npx wrangler d1 execute school-voting --remote --file=seed/fake-data.sql

DELETE FROM votes;
DELETE FROM voters;
DELETE FROM section_winners;
DELETE FROM projects;
DELETE FROM sections;
DELETE FROM schools;

INSERT INTO sections (id, name, description, sort_order, is_active) VALUES
  (1, 'المواقع الإلكترونية', 'مشاريع تصميم وبرمجة المواقع', 1, 1),
  (2, 'التطبيقات الذكية', 'تطبيقات الهاتف والحلول الرقمية', 2, 1),
  (3, 'مشاريع الروبوتات', 'روبوتات وحلول تحكم آلي', 3, 1);

INSERT INTO schools (id, name) VALUES
  (1, 'مدرسة النور الثانوية'),
  (2, 'مدرسة الأمل الأساسية'),
  (3, 'مدرسة الرازي الثانوية'),
  (4, 'مدرسة ابن سينا الأساسية');

INSERT INTO projects (id, name, description, section_id, school_id, sort_order, is_active, written_votes, announce_in_results) VALUES
  (1, 'منصة القراءة التفاعلية', 'منصة تساعد الطلاب على متابعة قراءاتهم وتبادل الملخصات.', 1, 1, 1, 1, 30, 1),
  (2, 'دليل المدرسة الذكي', 'دليل رقمي تفاعلي لمرافق المدرسة والأنشطة اليومية.', 1, 2, 2, 1, 30, 1),
  (3, 'متجر المشاريع الصغيرة', 'متجر إلكتروني لعرض منتجات مشاريع الطلاب.', 1, 3, 3, 1, 5, 1),
  (4, 'تطبيق متابعة الحافلات', 'تطبيق يعرض موقع الحافلة ووقت الوصول المتوقع.', 2, 1, 1, 1, 10, 1),
  (5, 'تطبيق المساعدة الدراسية', 'تطبيق يجمع الملخصات والأسئلة التدريبية في مكان واحد.', 2, 4, 2, 1, 60, 1),
  (6, 'تطبيق اللياقة المدرسية', 'تطبيق لتسجيل الأنشطة الرياضية اليومية للطلاب.', 2, 2, 3, 1, 0, 0),
  (7, 'روبوت فرز النفايات', 'روبوت يتعرف على نوع النفايات ويفرزها تلقائيًا.', 3, 3, 1, 1, 30, 1),
  (8, 'روبوت سقي النباتات', 'روبوت يقيس رطوبة التربة ويسقي النباتات عند الحاجة.', 3, 4, 2, 1, 30, 1);

INSERT INTO settings (key, value) VALUES
  ('event_name', 'منافسة المشاريع المدرسية التجريبية'),
  ('voting_mode', 'open'),
  ('results_published', '1')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

INSERT INTO result_settings (scope, source) VALUES ('global', 'combined')
ON CONFLICT(scope) DO UPDATE SET source = excluded.source;

-- فائزون محددون يدويًا لاختبار خيار "اختيار يدوي للإدارة".
INSERT INTO section_winners (section_id, project_id) VALUES
  (1, 1),
  (2, 5),
  (3, 7);

-- 90 ناخبًا تجريبيًا بأسماء وهمية واضحة.
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 90)
INSERT INTO voters (id, request_id, first_name, father_name, grandfather_name, family_name, full_name, normalized_name, channel, is_duplicate)
SELECT 'seed-voter-' || n,
       'seed-request-' || n,
       'ناخب', 'تجريبي', 'أول', 'الحالة',
       'ناخب تجريبي أول الحالة ' || n,
       'ناخب تجريبي أول الحالة ' || n,
       CASE WHEN n % 2 = 0 THEN 'qr' ELSE 'tablet' END,
       0
FROM seq;

-- القسم الأول: تعادل بين المشروعين 1 و2 (30 صوتًا لكل منهما).
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 90)
INSERT INTO votes (voter_id, section_id, project_id)
SELECT 'seed-voter-' || n, 1,
       CASE WHEN n <= 30 THEN 1 WHEN n <= 60 THEN 2 ELSE 3 END
FROM seq
WHERE n <= 80;

-- القسم الثاني: المشروع 5 يتقدم بوضوح.
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 90)
INSERT INTO votes (voter_id, section_id, project_id)
SELECT 'seed-voter-' || n, 2,
       CASE WHEN n <= 50 THEN 4 WHEN n <= 75 THEN 5 ELSE 6 END
FROM seq;

-- القسم الثالث: تعادل بين المشروعين 7 و8 (30 صوتًا لكل منهما).
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 90)
INSERT INTO votes (voter_id, section_id, project_id)
SELECT 'seed-voter-' || n, 3,
       CASE WHEN n <= 30 THEN 7 ELSE 8 END
FROM seq
WHERE n <= 60;
