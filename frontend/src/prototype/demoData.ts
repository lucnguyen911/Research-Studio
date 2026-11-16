import type { IdeaItem } from './types';

export const IDEA_STATUS_LABELS: Record<IdeaItem['projectLinks'][string]['status'], string> = {
  new: 'Mới lưu',
  researching: 'Đang nghiên cứu',
  approved: 'Chốt làm',
  produced: 'Đã sản xuất',
  skipped: 'Bỏ qua',
};

export const STAGE_TWO_INFO: Record<
  | 'global-featured-stage2'
  | 'project-hot-topics-stage2'
  | 'project-evergreen-stage2'
  | 'project-opportunities-stage2'
  | 'project-ai-stage2',
  {
    title: string;
    scope: 'Global Research' | 'Project Research';
    goal: string;
    reason: string;
    alternatives: Array<{
      label: string;
      screenId: 'global-trends' | 'global-search' | 'project-keywords' | 'project-breakout' | 'project-ideas';
    }>;
  }
> = {
  'global-featured-stage2': {
    title: 'Video nổi bật — Giai đoạn 2',
    scope: 'Global Research',
    goal: 'Khám phá tổng hợp các video nổi bật liên kênh dựa trên chuỗi biến động tăng trưởng và bộ chỉ số phân tích chuyên sâu.',
    reason: 'Chưa khả dụng trong MVP V1 (Standard Mode) vì cần lịch sử snapshot > 30 ngày và phê duyệt chính sách Derived Metrics / Data Aggregation từ YouTube API.',
    alternatives: [
      { label: 'Mở Khám phá xu hướng (G2)', screenId: 'global-trends' },
      { label: 'Mở Nghiên cứu tự do (G3)', screenId: 'global-search' },
    ],
  },
  'project-hot-topics-stage2': {
    title: 'Chủ đề nóng — Giai đoạn 2',
    scope: 'Project Research',
    goal: 'Phát hiện cụm chủ đề bùng nổ theo tốc độ tăng trưởng đa kênh trong ngách của Project.',
    reason: 'Chưa khả dụng trong MVP V1 để giữ kiến trúc tinh gọn 0 USD, không tính chỉ số dẫn xuất từ YouTube API Data và tránh gom thống kê đa kênh khi chưa có phê duyệt chính sách.',
    alternatives: [
      { label: 'Mở Video bứt phá (Standard Mode)', screenId: 'project-breakout' },
      { label: 'Mở Nghiên cứu từ khóa', screenId: 'project-keywords' },
    ],
  },
  'project-evergreen-stage2': {
    title: 'Chủ đề dài hạn — Giai đoạn 2',
    scope: 'Project Research',
    goal: 'Theo dõi các chủ đề có đường cầu ổn định nhiều quý (Evergreen) dựa trên lịch sử nhiều tháng.',
    reason: 'Yêu cầu dữ liệu thống kê lưu trữ dài hạn vượt giới hạn 30 ngày lịch của Standard Mode. Sẽ được cân nhắc ở Giai đoạn 2 sau khi hoàn tất thẩm định API.',
    alternatives: [
      { label: 'Mở Nghiên cứu từ khóa', screenId: 'project-keywords' },
      { label: 'Mở Quản lý ý tưởng', screenId: 'project-ideas' },
    ],
  },
  'project-opportunities-stage2': {
    title: 'Cơ hội nội dung — Giai đoạn 2',
    scope: 'Project Research',
    goal: 'Chấm điểm cơ hội kết hợp từ độ hổng chủ đề, hiệu suất trung vị đối thủ và nhu cầu tìm kiếm.',
    reason: 'Chưa khả dụng trong MVP V1 vì điểm tổng hợp cơ hội phụ thuộc vào Channel Median và Outlier Multiplier — thuộc phạm vi chính sách Derived Metrics ở Giai đoạn 2.',
    alternatives: [
      { label: 'Mở Video bứt phá (Standard Mode)', screenId: 'project-breakout' },
      { label: 'Mở Nghiên cứu từ khóa', screenId: 'project-keywords' },
    ],
  },
  'project-ai-stage2': {
    title: 'Nghiên cứu AI — Giai đoạn 2',
    scope: 'Project Research',
    goal: 'Phân tích tóm tắt bình luận, đề xuất góc khai thác và soạn phác thảo bằng LM Studio / Ollama cục bộ (hoặc Cloud AI tùy chọn).',
    reason: 'MVP V1 khóa cứng 100% thuật toán Python tất định không AI nhằm bảo đảm chi phí 0 USD, tính ổn định cốt lõi và không phát sinh tác vụ AI trước khi hoàn thiện dữ liệu nền.',
    alternatives: [
      { label: 'Mở Quản lý ý tưởng', screenId: 'project-ideas' },
      { label: 'Mở Video bứt phá (Standard Mode)', screenId: 'project-breakout' },
    ],
  },
};

export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('vi-VN');
}
